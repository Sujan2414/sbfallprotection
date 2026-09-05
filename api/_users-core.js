/**
 * Staff account management — platform-neutral core.
 *
 * Creating, listing and deleting Supabase users requires the service_role key,
 * which bypasses RLS completely. That key must never reach the browser, so the
 * admin panel calls this instead: it runs server-side, checks that the caller
 * already holds a valid staff session, and only then talks to the Supabase
 * admin API on their behalf.
 *
 * Wrapped by api/users.js (Vercel) and netlify/functions/users.js (Netlify).
 *
 * Environment:
 *   SUPABASE_URL                required
 *   SUPABASE_ANON_KEY           required — used only to verify the caller's token
 *   SUPABASE_SERVICE_ROLE_KEY   required — server-side only, never sent to a client
 *   ADMIN_EMAILS                optional — comma-separated allow-list of accounts
 *                               permitted to manage users. Unset means any signed-in
 *                               staff member may, which matches how every other
 *                               write in the panel behaves today.
 */

const env = (k) => process.env[k] || '';

/** Shape every reply the same way so both wrappers stay dumb. */
const reply = (status, json) => ({ status, json });

async function sbFetch(path, init = {}) {
  const url = env('SUPABASE_URL').replace(/\/$/, '') + path;
  const res = await fetch(url, init);
  let body = null;
  try { body = await res.json(); } catch { /* 204s have no body */ }
  return { ok: res.ok, status: res.status, body };
}

/** Resolve the bearer token to a Supabase user, or null. */
async function callerFromToken(token) {
  const { ok, body } = await sbFetch('/auth/v1/user', {
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` },
  });
  return ok && body && body.id ? body : null;
}

function allowed(email) {
  const list = env('ADMIN_EMAILS')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true;              // no allow-list configured
  return list.includes(String(email || '').toLowerCase());
}

/** Only fields the panel needs — never tokens, never identities payloads. */
const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  created_at: u.created_at,
  last_sign_in_at: u.last_sign_in_at,
  confirmed: Boolean(u.email_confirmed_at || u.confirmed_at),
  providers: (u.app_metadata && u.app_metadata.providers) || [],
});

const admin = (extra = {}) => ({
  apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
  Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
  ...extra,
});


/**
 * The caller's role from the staff roster. Read with service_role because the
 * roster deliberately has no browser-writable policy — see supabase/roles.sql.
 * A caller with no row is treated as 'admin': they can edit content (the RLS
 * policies decide that) but not manage accounts.
 */
async function roleOf(userId) {
  const { ok, body } = await sbFetch(
    `/rest/v1/staff?select=role&user_id=eq.${encodeURIComponent(userId)}`,
    { headers: admin() });
  if (!ok || !Array.isArray(body) || body.length === 0) return null;
  return body[0].role || 'admin';
}

/** True only when nobody has been rostered yet — a genuinely fresh install. */
async function rosterIsEmpty() {
  const { ok, body } = await sbFetch('/rest/v1/staff?select=user_id&limit=1', {
    headers: admin(),
  });
  return ok && Array.isArray(body) && body.length === 0;
}

/** Add or update someone's roster entry. */
async function setRole(userId, email, role) {
  return sbFetch('/rest/v1/staff?on_conflict=user_id', {
    method: 'POST',
    headers: admin({
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    }),
    body: JSON.stringify({ user_id: userId, email, role }),
  });
}

/**
 * @param {{method: string, token: string, body: any}} req
 */
export async function handleUsers(req) {
  if (!env('SUPABASE_URL') || !env('SUPABASE_ANON_KEY')) {
    return reply(500, { error: 'SUPABASE_URL and SUPABASE_ANON_KEY are not set on the server.' });
  }
  // Authenticate before reporting anything about the server's configuration —
  // an anonymous caller should learn nothing about how this is set up.
  if (!req.token) return reply(401, { error: 'Sign in first.' });
  const caller = await callerFromToken(req.token);
  if (!caller) return reply(401, { error: 'That session is not valid any more. Sign in again.' });
  if (!allowed(caller.email)) {
    return reply(403, {
      error: 'forbidden',
      message: `${caller.email} is not on the ADMIN_EMAILS allow-list, so it cannot manage staff accounts.`,
    });
  }

  if (!env('SUPABASE_SERVICE_ROLE_KEY')) {
    return reply(501, {
      error: 'not_configured',
      message:
        'Add SUPABASE_SERVICE_ROLE_KEY as an environment variable on the host, then redeploy. ' +
        'Find it in Supabase under Project Settings → API → service_role. Keep it server-side only.',
    });
  }

  if (req.method === 'GET') {
    const callerRole = await roleOf(caller.id);
    if (callerRole === null && !(await rosterIsEmpty())) {
      return reply(403, { error: 'forbidden', message: 'This account is not on the staff list.' });
    }
    const { ok, status, body } = await sbFetch('/auth/v1/admin/users?per_page=200', {
      headers: admin(),
    });
    if (!ok) return reply(status, { error: (body && body.msg) || 'Could not list users.' });
    const users = (body.users || []).map(publicUser);
    users.sort((a, b) => String(a.email).localeCompare(String(b.email)));
    return reply(200, {
      users,
      caller: caller.email,
      callerRole: callerRole || 'admin',
      allowList: Boolean(env('ADMIN_EMAILS')),
    });
  }

  // Managing accounts is a super_admin job. Before the roster exists nobody has
  // a row yet, so fall back to the ADMIN_EMAILS allow-list if one is set, and
  // otherwise allow it — that is the bootstrap case, and it matches how the
  // panel behaved before roles existed.
  if (req.method === 'POST' || req.method === 'DELETE') {
    const role = await roleOf(caller.id);
    // Bootstrap means "nobody is rostered yet", not "this caller has no row".
    // The looser test handed account management to anyone who could sign in.
    const bootstrapping = role === null && !env('ADMIN_EMAILS') && (await rosterIsEmpty());
    if (!bootstrapping && role !== 'super_admin') {
      return reply(403, {
        error: 'forbidden',
        message: 'Only a super admin can add or remove staff accounts.',
      });
    }
  }

  if (req.method === 'POST') {
    const email = String((req.body && req.body.email) || '').trim();
    const password = String((req.body && req.body.password) || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply(400, { error: 'That does not look like an email address.' });
    }
    if (password.length < 8) {
      return reply(400, { error: 'Use a password of at least 8 characters.' });
    }
    const { ok, status, body } = await sbFetch('/auth/v1/admin/users', {
      method: 'POST',
      headers: admin({ 'Content-Type': 'application/json' }),
      // confirmed immediately: this is a staff account created by a colleague,
      // not a public sign-up that needs to prove it owns the mailbox
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (!ok) return reply(status, { error: (body && (body.msg || body.error_description)) || 'Could not create that user.' });

    const wanted = req.body && req.body.role === 'super_admin' ? 'super_admin' : 'admin';
    const rostered = await setRole(body.id, email, wanted);
    if (!rostered.ok) {
      // the login exists but has no roster row, so it cannot write anything yet
      return reply(207, {
        user: publicUser(body),
        warning: 'account_created_without_role',
      });
    }
    return reply(201, { user: { ...publicUser(body), role: wanted } });
  }

  if (req.method === 'DELETE') {
    const id = String((req.body && req.body.id) || '').trim();
    if (!id) return reply(400, { error: 'Which user?' });
    if (id === caller.id) {
      return reply(400, { error: 'You cannot remove your own account while signed in with it.' });
    }
    const { ok, status, body } = await sbFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: admin(),
    });
    if (!ok) return reply(status, { error: (body && body.msg) || 'Could not remove that user.' });
    return reply(200, { removed: id });
  }

  return reply(405, { error: 'Method not allowed.' });
}

/**
 * Shared by api/publish.js: confirm the request carries a live staff session
 * before doing anything privileged.
 */
export async function verifyCaller(token) {
  if (!env('SUPABASE_URL') || !env('SUPABASE_ANON_KEY')) return null;
  if (!token) return null;
  return callerFromToken(token);
}

export const bearer = (header) => {
  const m = /^Bearer\s+(.+)$/i.exec(String(header || ''));
  return m ? m[1].trim() : '';
};
