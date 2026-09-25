/**
 * SB Fall Protection — admin console.
 *
 * Talks to Supabase directly from the browser with the anon key. That key is
 * public by design: RLS allows anonymous reads of the catalogue but restricts
 * every write to an authenticated session, so signing in is what grants edit
 * rights (verified: anonymous PATCH/DELETE affect zero rows). The
 * service-role key is never shipped here.
 *
 * The public site is statically generated, so edits land in the database
 * immediately but only reach visitors after a rebuild — hence "Publish to
 * site", which calls a serverless endpoint holding the deploy hook. Staff
 * accounts go through a second endpoint for the same reason: the service_role
 * key it needs must never reach the browser.
 *
 * Presentation follows the DashStack admin UI kit; see src/styles/admin.css.
 */
import { createClient } from '@supabase/supabase-js';

// the page carries a same-origin path (/sb) that the host proxies to
// Supabase; the client library needs it absolute
const URL = document.body.dataset.sbUrl
  ? new window.URL(document.body.dataset.sbUrl, location.origin).href.replace(/\/$/, '')
  : '';
const KEY = document.body.dataset.sbKey;

const loginView = document.getElementById('admLogin');
const appView = document.getElementById('admApp');
const main = document.getElementById('admMain');
const toastEl = document.getElementById('toast');

if (!URL || !KEY) {
  loginView.hidden = false;
  // the detail is for whoever deploys this, not for whoever is signing in
  console.error('[admin] SUPABASE_URL / SUPABASE_ANON_KEY missing from this build');
  document.getElementById('loginMsg').innerHTML =
    '<div class="adm-msg err">Sign-in is unavailable right now.</div>';
  throw new Error('supabase not configured');
}

/**
 * "Keep me signed in" decides where the session lives. Unticked, it goes to
 * sessionStorage so closing the tab signs the user out — worth having on a
 * shared factory-office machine. Reads check both, so an existing session is
 * still found whichever box was ticked last time.
 */
const REMEMBER = 'sbfp-admin-remember';
const store = {
  getItem: (k) => window.localStorage.getItem(k) ?? window.sessionStorage.getItem(k),
  setItem: (k, v) => {
    const persist = window.localStorage.getItem(REMEMBER) !== '0';
    (persist ? window.localStorage : window.sessionStorage).setItem(k, v);
    (persist ? window.sessionStorage : window.localStorage).removeItem(k);
  },
  removeItem: (k) => {
    window.localStorage.removeItem(k);
    window.sessionStorage.removeItem(k);
  },
};

const sb = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sbfp-admin', storage: store },
});

/* ─────────────────────────── helpers ─────────────────────────── */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
function toast(msg, bad) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('bad', !!bad);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtWhen = (s) =>
  s ? new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const ICON = {
  key: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14.5 8.5l2.5 2.5"/></svg>',
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>',
  eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  prev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  up: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
  img: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-5-4-6 6"/></svg>',
  box: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8.4v7.2a2 2 0 0 1-1 1.73l-6.5 3.6a2 2 0 0 1-2 0L5 17.33a2 2 0 0 1-1-1.73V8.4a2 2 0 0 1 1-1.73l6.5-3.6a2 2 0 0 1 2 0l6.5 3.6A2 2 0 0 1 21 8.4Z"/><path d="m4.3 7.3 7.7 4.3 7.7-4.3M12 20.5v-8.9"/></svg>',
  layers: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5M3 17.5l9 5 9-5"/></svg>',
  inbox: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2 3h6l2-3h4"/><path d="M5 5h14l2 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2-7Z"/></svg>',
  people: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  file: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
};

/**
 * The staff-account and publish endpoints run server-side because they need
 * the service_role key and the deploy hook, neither of which may reach the
 * browser. Both take the caller's session token so they can check who is asking.
 */
async function api(path, method = 'GET', body) {
  const { data } = await sb.auth.getSession();
  const token = data && data.session ? data.session.access_token : '';
  const res = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, data: json || {} };
}

/* ─────────────────────────── drawer ─────────────────────────── */

const drawer = document.getElementById('drawer');
const drawerTitle = document.getElementById('drawerTitle');
const drawerBody = document.getElementById('drawerBody');
const drawerSave = document.getElementById('drawerSave');
const drawerDraft = document.getElementById('drawerDraft');
let onSave = null;
let drawerOpts = {};

/*
 * Three kinds of drawer:
 *   content  Close, Save as draft, Save and publish. The site is pre-rendered,
 *            so publishing saves and then rebuilds it; a draft is saved but not
 *            pushed live. The callback is told which button was pressed, so a
 *            record with a live flag (products, articles) can set it from that.
 *   save     Close and one action, for anything that is not site content: an
 *            enquiry's status, a staff account.
 *   none     Close only. Confirmation drawers carry their own button.
 */
function openDrawer(title, html, save, opts = {}) {
  drawerTitle.textContent = title;
  drawerBody.innerHTML = html;
  onSave = save || null;
  drawerOpts = { ...opts, mode: save ? (opts.mode || 'content') : 'none' };
  drawerSave.hidden = !save;
  drawerDraft.hidden = drawerOpts.mode !== 'content';
  drawerSave.textContent = drawerOpts.mode === 'content' ? 'Save and publish' : (opts.saveLabel || 'Save');
  drawer.classList.add('open');
}
function closeDrawer() {
  drawer.classList.remove('open');
  onSave = null;
}
drawer.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeDrawer(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

/** Rebuild the public site so saved changes reach visitors. */
async function publishSite() {
  const { ok, data } = await api('/api/publish', 'POST');
  return { ok, message: ok ? '' : apiError(data, 'Could not publish just now') };
}

async function runSave(publish) {
  if (!onSave) return;
  const { mode, draftNote, doneMsg } = drawerOpts;
  const btn = publish ? drawerSave : drawerDraft;
  const label = btn.textContent;
  drawerSave.disabled = drawerDraft.disabled = true;
  btn.textContent = publish && mode === 'content' ? 'Publishing…' : 'Saving…';
  try {
    await onSave(publish);
    closeDrawer();
    if (mode !== 'content') {
      toast(doneMsg || 'Saved');
    } else if (!publish) {
      toast(draftNote || 'Saved as a draft. It is not on the site.');
    } else {
      const r = await publishSite();
      toast(r.ok ? 'Saved and published. The site updates in a minute or two.'
        : `Saved, but the site did not rebuild: ${r.message}`, !r.ok);
    }
  } catch (err) {
    toast(err.message || 'Save failed', true);
  } finally {
    drawerSave.disabled = drawerDraft.disabled = false;
    btn.textContent = label;
  }
}
drawerSave.addEventListener('click', () => runSave(true));
drawerDraft.addEventListener('click', () => runSave(false));

/*
 * Files go to Supabase Storage, but the address saved is the site's own /sb
 * path: several Indian ISPs block supabase.co, and a visitor there could not
 * load a clip served from it. See SB_BROWSER_PATH in src/lib/supabase.ts.
 */
const publicPath = (bucket, path) => `/sb/storage/v1/object/public/${bucket}/${path}`;

async function uploadTo(bucket, path, file) {
  const { error } = await sb.storage.from(bucket).upload(path, file, {
    cacheControl: '31536000', contentType: file.type, upsert: true,
  });
  if (error) throw new Error(error.message || 'Upload failed');
  return publicPath(bucket, path);
}

const safeName = (name) => String(name).toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');

/** A URL field with an "Upload from computer" button beside it. */
const uploadField = (label, name, value, accept) => `
  <div class="adm-field full"><span>${esc(label)}</span>
    <div class="adm-upload">
      <input class="adm-input" name="${name}" value="${esc(value)}" placeholder="Paste a link, or upload a file">
      <label class="adm-btn adm-btn-soft adm-upload-btn">
        <input type="file" accept="${accept}" data-upload="${name}" hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>
        Upload from computer
      </label>
    </div>
    <small class="adm-upload-state" data-state="${name}"></small>
  </div>`;

/** Wire every upload button in the open drawer to a bucket. */
function wireUploads(bucket, folder = '') {
  drawerBody.querySelectorAll('[data-upload]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const name = input.dataset.upload;
      const state = drawerBody.querySelector(`[data-state="${name}"]`);
      const target = drawerBody.querySelector(`[name="${name}"]`);
      state.textContent = `Uploading ${file.name}…`;
      drawerSave.disabled = drawerDraft.disabled = true;
      try {
        const path = `${folder}${Date.now()}-${safeName(file.name)}`;
        target.value = await uploadTo(bucket, path, file);
        state.textContent = `Uploaded ${file.name}`;
      } catch (err) {
        state.textContent = '';
        toast(err.message, true);
      } finally {
        drawerSave.disabled = drawerDraft.disabled = false;
        input.value = '';
      }
    });
  });
}

const field = (label, name, value, type = 'text', cls = 'full') => `
  <label class="adm-field ${cls}"><span>${esc(label)}</span>
    ${type === 'textarea'
      ? `<textarea name="${name}">${esc(value)}</textarea>`
      : `<input type="${type}" name="${name}" value="${esc(value)}">`}
  </label>`;
const select = (label, name, options, current, cls = 'full') => `
  <label class="adm-field ${cls}"><span>${esc(label)}</span>
    <select name="${name}">${options.map(([v, t]) =>
      `<option value="${esc(v)}" ${String(v) === String(current) ? 'selected' : ''}>${esc(t)}</option>`).join('')}
    </select></label>`;
const val = (n) => {
  const el = drawerBody.querySelector(`[name="${n}"]`);
  return el ? el.value.trim() : '';
};

/* ─────────────────────────── auth ─────────────────────────── */

const pwEye = document.getElementById('pwEye');
pwEye.addEventListener('click', () => {
  const pw = document.getElementById('pw');
  const show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  pwEye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  // eye / eye-off, swapped in place so the button never reflows
  pwEye.innerHTML = show
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3 4M6.6 6.6A18 18 0 0 0 2 12s3.5 7 10 7a9.9 9.9 0 0 0 4.4-1M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  pw.focus();
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('loginMsg');
  const btn = e.target.querySelector('button');
  msg.innerHTML = '';
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  window.localStorage.setItem(REMEMBER, e.target.remember.checked ? '1' : '0');
  const { error } = await sb.auth.signInWithPassword({
    email: e.target.email.value.trim(),
    password: e.target.password.value,
  });
  btn.disabled = false;
  btn.textContent = 'Sign in';
  if (error) msg.innerHTML = `<div class="adm-msg err">${esc(error.message)}</div>`;
});

/**
 * Google sign-in. The button only exists when the build sets
 * SUPABASE_GOOGLE_AUTH=1, so this is a no-op until Google is enabled in
 * Supabase. Same session storage as the password flow, so "keep me signed in"
 * still applies -- OAuth returns to this page and onAuthStateChange picks it up.
 */
const btnGoogle = document.getElementById('btnGoogle');
if (btnGoogle) {
  const setupMsg = 'Google sign-in is not available yet — use your email and password.';

  btnGoogle.addEventListener('click', async () => {
    const msg = document.getElementById('loginMsg');
    msg.innerHTML = '';
    btnGoogle.disabled = true;
    window.localStorage.setItem(REMEMBER, '1');

    // Build the authorize URL without navigating, so a disabled provider shows
    // a message here instead of dumping Supabase's raw 400 JSON in the tab.
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/aij-admin/',
        skipBrowserRedirect: true,
      },
    });
    if (error || !data || !data.url) {
      btnGoogle.disabled = false;
      msg.innerHTML = `<div class="adm-msg err">${esc((error && error.message) || setupMsg)}</div>`;
      return;
    }

    // A disabled provider answers 400 with CORS headers, so it is readable.
    // Enabled, it answers a redirect, which reads as an opaque redirect
    // cross-origin — and a blocked probe throws, in which case just go.
    let disabled = false;
    try {
      const probe = await fetch(data.url, { redirect: 'manual' });
      disabled = probe.status === 400;
    } catch { /* opaque or blocked — proceed to the real redirect */ }

    if (disabled) {
      btnGoogle.disabled = false;
      msg.innerHTML = `<div class="adm-msg err">${setupMsg}</div>`;
      return;
    }
    window.location.assign(data.url);
  });
}

document.getElementById('btnOut').addEventListener('click', () => sb.auth.signOut());

/* the profile chip: photo or initials, name or email, and the role */
const initialsOf = (s) => {
  const words = String(s || '').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((words.length > 1 ? words[0][0] + words[1][0] : String(s || 'SB').slice(0, 2)) || 'SB').toUpperCase();
};
const avatarHtml = (url, who) => (url ? `<img src="${esc(url)}" alt="">` : esc(initialsOf(who)));

function paintMe(user) {
  const md = (user && user.user_metadata) || {};
  const name = String(md.full_name || '').trim();
  document.getElementById('admWho').textContent = name || me.email;
  document.getElementById('admInitials').innerHTML = avatarHtml(md.avatar_url, name || me.email);
}
function paintRole() {
  document.getElementById('admRole').textContent =
    ({ super_admin: 'Super admin', admin: 'Admin' })[me.role] || 'Admin';
}

const userBtn = document.getElementById('btnUser');
const userMenu = document.getElementById('userMenu');
function toggleUserMenu(open) {
  userMenu.hidden = !open;
  userBtn.setAttribute('aria-expanded', String(open));
}
userBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleUserMenu(userMenu.hidden); });
document.addEventListener('click', (e) => { if (!userMenu.hidden && !userMenu.contains(e.target)) toggleUserMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleUserMenu(false); });
userMenu.addEventListener('click', (e) => {
  const b = e.target.closest('[data-menu]');
  if (!b) return;
  toggleUserMenu(false);
  if (b.dataset.menu === 'settings') setTab('settings');
  else sb.auth.signOut();
});

/** Signed in, but not staff: say so plainly and end the session. */
function refuse(email) {
  sb.auth.signOut().finally(() => {
    appView.hidden = true;
    loginView.hidden = false;
    document.getElementById('loginMsg').innerHTML =
      `<div class="adm-msg err">${esc(email)} does not have access to this panel.
       Ask an administrator to add you under Users.</div>`;
  });
}

sb.auth.onAuthStateChange((_evt, session) => {
  if (session) {
    loginView.hidden = true;
    appView.hidden = false;
    const email = session.user.email || '';
    me = {
      id: session.user.id,
      email,
      role: 'admin',
      last_sign_in_at: session.user.last_sign_in_at || null,
      created_at: session.user.created_at || null,
    };
    paintMe(session.user);
    /*
     * Signing in is not the same as having access. Supabase will happily
     * authenticate a Google account; whether it may use this panel is decided
     * by the staff roster, so check that before showing anything. An empty
     * roster is the fresh-install case and is allowed through.
     */
    Promise.all([
      sb.from('staff').select('role').eq('user_id', me.id).maybeSingle(),
      sb.from('staff').select('user_id').limit(1),
    ]).then(([mine, any]) => {
      if (mine.data && mine.data.role) { me.role = mine.data.role; me.rostered = true; }
      paintRole();
      const rosterEmpty = !any.error && (any.data || []).length === 0;
      if (!me.rostered && !rosterEmpty) return refuse(email);
      boot();
    }).catch(() => boot());
  } else {
    appView.hidden = true;
    loginView.hidden = false;
  }
});

/* ─────────────────────────── sidebar / topbar chrome ─────────────────────────── */

const side = document.getElementById('admSide');
const sideScrim = document.getElementById('sideScrim');
function closeSide() { side.classList.remove('open'); sideScrim.classList.remove('open'); }
document.getElementById('btnBurger').addEventListener('click', () => {
  side.classList.toggle('open');
  sideScrim.classList.toggle('open');
});
sideScrim.addEventListener('click', closeSide);

// the bell is a shortcut to the enquiry inbox it counts
document.getElementById('btnBell').addEventListener('click', () => setTab('inquiries'));

document.getElementById('globalSearch').addEventListener('input', (e) => {
  const q = e.target.value.trim();
  if (!q) return;
  prodQuery = q;
  setTab('products');
});

/* ─────────────────────────── data ─────────────────────────── */

const db = { categories: [], families: [], products: [], inquiries: [], posts: [], reels: [] };

async function loadAll() {
  const [c, f, p, i, po, rl] = await Promise.all([
    sb.from('categories').select('*').order('sort_order'),
    sb.from('families').select('*').order('sort_order'),
    sb.from('products').select('*').order('sort_order').limit(2000),
    sb.from('inquiries').select('*').order('created_at', { ascending: false }).limit(500),
    sb.from('posts').select('*').order('published_at', { ascending: false }),
    sb.from('instagram_posts').select('*').order('posted_at', { ascending: false }),
  ]);
  for (const r of [c, f, p, i, po]) if (r.error) throw r.error;
  db.categories = c.data; db.families = f.data; db.products = p.data;
  db.inquiries = i.data; db.posts = po.data;
  // reels are optional — a missing table should not take the whole panel down
  db.reels = rl.error ? [] : (rl.data || []);
  if (rl.error) console.warn('[admin] instagram_posts', rl.error.message);

  const n = db.inquiries.filter((x) => x.status === 'new').length;
  for (const id of ['inqCount', 'bellDot']) {
    const el = document.getElementById(id);
    if (el) { el.hidden = n === 0; el.textContent = n; }
  }
}

let booted = false;
async function boot() {
  if (booted) return;
  booted = true;
  main.innerHTML = '<div class="adm-card adm-empty">Loading…</div>';
  try {
    await loadAll();
    render();
  } catch (err) {
    main.innerHTML = `<div class="adm-card adm-empty">Could not load data.<br>
      <span style="font-size:13px">${esc(err.message)}</span></div>`;
  }
}

/* ─────────────────────────── routing ─────────────────────────── */

let tab = 'overview';
function setTab(next) {
  tab = next;
  document.querySelectorAll('.adm-navitem[data-tab]').forEach((b) =>
    b.classList.toggle('on', b.dataset.tab === next));
  closeSide();
  render();
}
document.querySelectorAll('.adm-navitem[data-tab]').forEach((b) =>
  b.addEventListener('click', () => setTab(b.dataset.tab)));

function render() {
  ({ overview, products, taxonomy, posts, reels, inquiries, users, settings }[tab] || overview)();
  window.scrollTo({ top: 0 });
}

const pageHead = (title, right = '') =>
  `<div class="adm-pagehead"><h1 class="adm-title">${esc(title)}</h1>
   <span class="spacer"></span>${right}</div>`;

/* ─────────────────────────── dashboard ─────────────────────────── */

function statCard(label, value, tint, color, icon, foot) {
  return `<div class="adm-stat">
    <div class="adm-stat-row">
      <div class="grow">
        <div class="adm-stat-label">${esc(label)}</div>
        <div class="adm-stat-value">${esc(value)}</div>
      </div>
      <span class="adm-stat-ic" style="background:${tint};color:${color}">${icon}</span>
    </div>
    ${foot ? `<div class="adm-stat-foot">${foot}</div>` : ''}
  </div>`;
}

function overview() {
  const newInq = db.inquiries.filter((x) => x.status === 'new');
  const hidden = db.products.filter((p) => !p.published).length;
  const live = db.posts.filter((p) => p.published).length;

  main.innerHTML = pageHead('Dashboard') + `
    <div class="adm-stats">
      ${statCard('Product Codes', db.products.length, '#fff1ea', '#fe5922', ICON.box,
        `<span class="up">${ICON.up}</span> ${db.categories.length} categories`)}
      ${statCard('Ranges', db.families.length, '#eef3ff', '#4880ff', ICON.layers,
        'Across the catalogue')}
      ${statCard('Published Articles', live, '#e8f7ee', '#00b69b', ICON.file,
        `${db.posts.length - live} in draft`)}
      ${statCard('New Enquiries', newInq.length, newInq.length ? '#fdecea' : '#f1f4f9',
        newInq.length ? '#fd5454' : '#606060', ICON.inbox,
        `${db.inquiries.length} total received`)}
    </div>

    <div class="adm-table-card">
      <div class="adm-table-head">
        <h2>Recent Enquiries</h2><span class="spacer"></span>
        <button class="adm-btn adm-btn-ghost" data-goto="inquiries">View all</button>
      </div>
      <div class="adm-table-scroll">${inqTable(db.inquiries.slice(0, 6))}</div>
    </div>
`;

  main.querySelector('[data-goto]').addEventListener('click', () => setTab('inquiries'));
  wireInq();
}

/* ─────────────────────────── products ─────────────────────────── */

let prodQuery = '';
let prodCat = '';
let prodPage = 1;
const PER = 12;

function stdOf(specs) {
  const key = Object.keys(specs || {}).find((k) => /standard|conformity/i.test(k));
  if (!key) return null;
  const m = String(specs[key]).match(/(EN|ANSI|IS)\s?[\d.:\-\s]+/i);
  return (m ? m[0] : specs[key]).trim().slice(0, 20);
}

function products() {
  const q = prodQuery.toLowerCase();
  const all = db.products.filter((p) => {
    if (prodCat && p.category !== prodCat) return false;
    if (!q) return true;
    return (p.sku || '').toLowerCase().includes(q) ||
      (p.attachment || '').toLowerCase().includes(q) ||
      JSON.stringify(p.specs || {}).toLowerCase().includes(q);
  });

  const pages = Math.max(1, Math.ceil(all.length / PER));
  if (prodPage > pages) prodPage = 1;
  const from = (prodPage - 1) * PER;
  const rows = all.slice(from, from + PER);

  main.innerHTML = pageHead('Products') + `
    <div class="adm-table-card">
      <div class="adm-table-head">
        <h2>Product Stock</h2>
        <span class="spacer"></span>
        <select class="adm-btn adm-btn-ghost" id="pCat" style="font-weight:600">
          <option value="">All categories</option>
          ${db.categories.map((c) =>
            `<option value="${esc(c.slug)}" ${c.slug === prodCat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
        <div class="adm-search" style="flex:0 1 260px">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="pQ" placeholder="Search product name" value="${esc(prodQuery)}">
        </div>
      </div>

      <div class="adm-table-scroll">
        ${rows.length === 0 ? '<div class="adm-empty">No products match that search.</div>' : `
        <table class="adm-table"><thead><tr>
          <th>Image</th><th>Product Code</th><th>Description</th><th>Category</th>
          <th>Specs</th><th>Standard</th><th>Status</th><th>Action</th>
        </tr></thead><tbody>
          ${rows.map((p) => `<tr>
            <td>${p.image
              ? `<img class="adm-thumb" src="${esc(p.image)}" alt="" loading="lazy">`
              : `<span class="adm-thumb-ph">${ICON.img}</span>`}</td>
            <td><span class="adm-code">${esc(p.sku)}</span></td>
            <td class="adm-td-muted">${esc((p.attachment || (p.specs && p.specs.Usage) || '—')).slice(0, 46)}</td>
            <td class="adm-td-muted">${esc((db.categories.find((c) => c.slug === p.category) || {}).name || p.category)}</td>
            <td class="adm-td-muted">${Object.keys(p.specs || {}).length}</td>
            <td class="adm-td-muted">${esc(stdOf(p.specs) || '—')}</td>
            <td><span class="adm-pill ${p.published ? 'green' : 'grey'}">${p.published ? 'Live' : 'Hidden'}</span></td>
            <td><span class="adm-act">
              <button class="adm-icon-btn" data-edit="${p.id}" title="Edit">${ICON.edit}</button>
              <button class="adm-icon-btn danger" data-del="${p.id}" title="Delete">${ICON.trash}</button>
            </span></td>
          </tr>`).join('')}
        </tbody></table>`}
      </div>

      <div class="adm-pager">
        <span class="info">Showing ${all.length ? from + 1 : 0}–${Math.min(from + PER, all.length)} of ${all.length}</span>
        <button class="adm-page-btn" id="pPrev" ${prodPage === 1 ? 'disabled' : ''}>${ICON.prev}</button>
        <button class="adm-page-btn" id="pNext" ${prodPage >= pages ? 'disabled' : ''}>${ICON.next}</button>
      </div>
    </div>`;

  const qi = main.querySelector('#pQ');
  if (qi) {
    qi.addEventListener('input', () => {
      prodQuery = qi.value; prodPage = 1;
      const at = qi.selectionStart;
      products();
      const n = main.querySelector('#pQ');
      n.focus(); n.setSelectionRange(at, at);
    });
  }
  main.querySelector('#pCat').addEventListener('change', (e) => {
    prodCat = e.target.value; prodPage = 1; products();
  });
  main.querySelector('#pPrev').addEventListener('click', () => { prodPage--; products(); });
  main.querySelector('#pNext').addEventListener('click', () => { prodPage++; products(); });
  main.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => editProduct(b.dataset.edit)));
  main.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => deleteProduct(b.dataset.del)));
}

const specRow = (k = '', v = '') => `<div class="spec-row">
  <input class="sk" placeholder="Field" value="${esc(k)}">
  <input class="sv" placeholder="Value" value="${esc(v)}">
  <button type="button" class="spec-del" title="Remove">×</button>
</div>`;

function editProduct(id) {
  const p = db.products.find((x) => x.id === id);
  if (!p) return;
  openDrawer(`Edit ${p.sku}`, `
    <div class="adm-fields">
      ${field('Product code', 'sku', p.sku, 'text', '')}
      ${field('Short description', 'attachment', p.attachment || '', 'text')}
      ${select('Category', 'category', db.categories.map((c) => [c.slug, c.name]), p.category, '')}
      ${select('Range', 'family', [['', '— none —']].concat(db.families.map((f) => [f.slug, f.name])), p.family || '', '')}
      ${field('Image URL', 'image', p.image || '', 'text')}
      <div class="adm-field full"><span>Specifications</span>
        <div class="spec-rows" id="specRows">
          ${Object.entries(p.specs || {}).map(([k, v]) => specRow(k, v)).join('') || specRow()}
        </div>
        <button type="button" class="adm-btn adm-btn-soft" id="addSpec" style="margin-top:11px">+ Add field</button>
      </div>
    </div>`,
    async (publish) => {
      const specs = {};
      drawerBody.querySelectorAll('.spec-row').forEach((r) => {
        const k = r.querySelector('.sk').value.trim();
        if (k) specs[k] = r.querySelector('.sv').value.trim();
      });
      const patch = {
        sku: val('sku'), attachment: val('attachment') || null,
        category: val('category'), family: val('family') || null,
        image: val('image') || null, published: publish, specs,
      };
      const { error } = await sb.from('products').update(patch).eq('id', id);
      if (error) throw error;
      Object.assign(p, patch);
      products();
    });

  const rows = drawerBody.querySelector('#specRows');
  drawerBody.querySelector('#addSpec').addEventListener('click', () =>
    rows.insertAdjacentHTML('beforeend', specRow()));
  rows.addEventListener('click', (e) => {
    if (e.target.classList.contains('spec-del')) e.target.closest('.spec-row').remove();
  });
}

function deleteProduct(id) {
  const p = db.products.find((x) => x.id === id);
  if (!p) return;
  openDrawer(`Delete ${p.sku}?`, `
    <p style="font-size:15px;line-height:1.65">
      This permanently removes <strong>${esc(p.sku)}</strong> from the catalogue,
      and its page comes off the site in a minute or two.
    </p>
<button class="adm-btn adm-btn-danger" id="confirmDel" style="margin-top:22px">
      Yes, delete permanently</button>`, null);
  drawerBody.querySelector('#confirmDel').addEventListener('click', async () => {
    const { error } = await sb.from('products').delete().eq('id', id);
    if (error) return toast(error.message, true);
    db.products = db.products.filter((x) => x.id !== id);
    closeDrawer();
    products();
    const r = await publishSite();
    toast(r.ok ? `${p.sku} deleted. The site updates in a minute or two.`
      : `${p.sku} deleted, but the site did not rebuild: ${r.message}`, !r.ok);
  });
}

/* ─────────────────────────── categories & ranges ─────────────────────────── */

function taxonomy() {
  main.innerHTML = pageHead('Categories') + `
    <div class="adm-table-card">
      <div class="adm-table-head"><h2>Categories</h2></div>
      <div class="adm-table-scroll">
        <table class="adm-table"><thead><tr>
          <th>Name</th><th>Slug</th><th>Card blurb</th><th>Products</th><th>Action</th>
        </tr></thead><tbody>
        ${db.categories.map((c) => `<tr>
          <td><span class="adm-code">${esc(c.name)}</span></td>
          <td class="adm-td-muted">${esc(c.slug)}</td>
          <td class="adm-td-muted">${esc((c.blurb || '—').slice(0, 60))}${(c.blurb || '').length > 60 ? '…' : ''}</td>
          <td class="adm-td-muted">${db.products.filter((p) => p.category === c.slug).length}</td>
          <td><span class="adm-act"><button class="adm-icon-btn" data-cat="${esc(c.slug)}">${ICON.edit}</button></span></td>
        </tr>`).join('')}
        </tbody></table>
      </div>
    </div>

    <div class="adm-table-card" style="margin-top:24px">
      <div class="adm-table-head"><h2>Ranges</h2></div>
      <div class="adm-table-scroll">
        <table class="adm-table"><thead><tr>
          <th>Name</th><th>Category</th><th>Layout</th><th>Notes</th><th>Products</th><th>Action</th>
        </tr></thead><tbody>
        ${db.families.map((f) => `<tr>
          <td><span class="adm-code">${esc(f.name)}</span></td>
          <td class="adm-td-muted">${esc((db.categories.find((c) => c.slug === f.category) || {}).name || f.category)}</td>
          <td><span class="adm-pill ${f.layout === 'spec' ? 'blue' : 'grey'}">${esc(f.layout)}</span></td>
          <td class="adm-td-muted">${(f.bullets || []).length}</td>
          <td class="adm-td-muted">${db.products.filter((p) => p.family === f.slug).length}</td>
          <td><span class="adm-act"><button class="adm-icon-btn" data-fam="${esc(f.slug)}">${ICON.edit}</button></span></td>
        </tr>`).join('')}
        </tbody></table>
      </div>
    </div>`;

  main.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => editCategory(b.dataset.cat)));
  main.querySelectorAll('[data-fam]').forEach((b) => b.addEventListener('click', () => editFamily(b.dataset.fam)));
}

function editCategory(slug) {
  const c = db.categories.find((x) => x.slug === slug);
  openDrawer(`Edit ${c.name}`, `
    <div class="adm-fields">
      ${field('Name', 'name', c.name)}
      ${field('Card blurb (products page)', 'blurb', c.blurb || '', 'textarea')}
      ${field('Intro (category page)', 'intro', c.intro || '', 'textarea')}
      ${field('Icon key', 'icon', c.icon || '', 'text')}
    </div>
`,
    async () => {
      const patch = { name: val('name'), blurb: val('blurb'), intro: val('intro'), icon: val('icon') };
      const { error } = await sb.from('categories').update(patch).eq('slug', slug);
      if (error) throw error;
      Object.assign(c, patch);
      taxonomy();
    }, { draftNote: 'Saved. It goes live the next time anything is published.' });
}

function editFamily(slug) {
  const f = db.families.find((x) => x.slug === slug);
  openDrawer(`Edit ${f.name}`, `
    <div class="adm-fields">
      ${field('Name', 'name', f.name)}
      ${field('Intro', 'intro', f.intro || '', 'textarea')}
      ${field('Shared spec notes (one per line)', 'bullets', (f.bullets || []).join('\n'), 'textarea')}
    </div>`,
    async () => {
      const patch = {
        name: val('name'), intro: val('intro'),
        bullets: val('bullets').split('\n').map((s) => s.trim()).filter(Boolean),
      };
      const { error } = await sb.from('families').update(patch).eq('slug', slug);
      if (error) throw error;
      Object.assign(f, patch);
      taxonomy();
    }, { draftNote: 'Saved. It goes live the next time anything is published.' });
}

/* ─────────────────────────── articles ─────────────────────────── */

function posts() {
  main.innerHTML = pageHead('Articles',
    '<button class="adm-btn adm-btn-primary" id="newPost">+ New article</button>') + `
    <div class="adm-grid">
      ${db.posts.map((p) => `<article class="adm-tile">
        <span class="adm-tile-ph">
          <img src="/assets/blog-${esc(p.image)}.jpg" alt="" loading="lazy"
               onerror="this.style.display='none'">
        </span>
        <div class="adm-tile-body">
          <span class="adm-tile-meta">${esc(p.topic || '—')} · ${p.read_mins} min</span>
          <h3>${esc(p.title)}</h3>
          <p class="adm-tile-desc">${esc(p.excerpt || '')}</p>
          <div class="adm-tile-foot">
            <span class="adm-pill ${p.published ? 'green' : 'grey'}">${p.published ? 'Live' : 'Draft'}</span>
            <span class="spacer" style="flex:1"></span>
            <button class="adm-btn adm-btn-soft" data-post="${esc(p.slug)}">Edit</button>
          </div>
        </div>
      </article>`).join('') || '<div class="adm-card adm-empty">No articles yet.</div>'}
    </div>
`;
  main.querySelectorAll('[data-post]').forEach((b) => b.addEventListener('click', () => editPost(b.dataset.post)));
  main.querySelector('#newPost').addEventListener('click', () => editPost(null));
}

function editPost(slug) {
  const p = slug ? db.posts.find((x) => x.slug === slug) : {
    slug: '', title: '', excerpt: '', body: '', image: 'post-standards', image_alt: '',
    topic: '', author: 'SB Fall Protection', read_mins: 5, featured: false, published: false,
    published_at: new Date().toISOString(),
  };
  openDrawer(slug ? 'Edit article' : 'New article', `
    <div class="adm-fields">
      ${field('Title', 'title', p.title)}
      ${field('URL slug', 'slug', p.slug, 'text', '')}
      ${field('Topic', 'topic', p.topic || '', 'text', '')}
      ${field('Excerpt', 'excerpt', p.excerpt || '', 'textarea')}
      ${field('Image key', 'image', p.image || '', 'text', '')}
      ${field('Read time (min)', 'read_mins', p.read_mins, 'number', '')}
      ${field('Image alt text', 'image_alt', p.image_alt || '', 'text')}
      ${field('Author', 'author', p.author || '', 'text', '')}
      ${field('Publish date', 'published_at', (p.published_at || '').slice(0, 10), 'date', '')}
      ${select('Featured', 'featured', [['false', 'No'], ['true', 'Yes']], String(!!p.featured), '')}
      ${field('Body (Markdown)', 'body', p.body || '', 'textarea')}
    </div>`,
    async (publish) => {
      const row = {
        slug: val('slug'), title: val('title'), topic: val('topic'), excerpt: val('excerpt'),
        image: val('image'), image_alt: val('image_alt'), author: val('author'),
        read_mins: parseInt(val('read_mins'), 10) || 5,
        published: publish, featured: val('featured') === 'true',
        published_at: new Date(val('published_at') || Date.now()).toISOString(),
        body: drawerBody.querySelector('[name="body"]').value,
      };
      if (!row.slug || !row.title) throw new Error('Title and slug are both required');
      const { error } = await sb.from('posts').upsert(row, { onConflict: 'slug' });
      if (error) throw error;
      await loadAll();
      posts();
    });
  drawerBody.querySelector('[name="body"]').style.minHeight = '340px';
}

/* ─────────────────────────── enquiries ─────────────────────────── */

const STATUS = ['new', 'in_progress', 'quoted', 'closed'];
const S_LABEL = { new: 'New', in_progress: 'In progress', quoted: 'Quoted', closed: 'Closed' };
const S_PILL = { new: 'red', in_progress: 'blue', quoted: 'green', closed: 'grey' };

function inqTable(rows) {
  if (!rows.length) return '<div class="adm-empty">No enquiries yet.</div>';
  return `<table class="adm-table"><thead><tr>
    <th>Received</th><th>From</th><th>Interest</th><th>Destination</th><th>Status</th><th>Action</th>
  </tr></thead><tbody>${rows.map((r) => `<tr>
    <td class="adm-td-muted">${fmtWhen(r.created_at)}</td>
    <td><span class="adm-code">${esc(r.name || '—')}</span>
        ${r.company ? `<span class="adm-sub">${esc(r.company)}</span>` : ''}</td>
    <td class="adm-td-muted">${esc(r.sku || r.category || '—')}</td>
    <td class="adm-td-muted">${esc(r.country || '—')}</td>
    <td><span class="adm-pill ${S_PILL[r.status] || 'grey'}">${esc(S_LABEL[r.status] || r.status)}</span></td>
    <td><span class="adm-act"><button class="adm-icon-btn" data-inq="${r.id}" title="Open">${ICON.eye}</button></span></td>
  </tr>`).join('')}</tbody></table>`;
}

function inquiries() {
  main.innerHTML = pageHead('Enquiries') + `
    <div class="adm-table-card">
      <div class="adm-table-head"><h2>Inbox</h2><span class="spacer"></span>
        <span class="adm-td-muted">${db.inquiries.length} total</span></div>
      <div class="adm-table-scroll">${inqTable(db.inquiries)}</div>
    </div>`;
  wireInq();
}

function wireInq() {
  main.querySelectorAll('[data-inq]').forEach((b) =>
    b.addEventListener('click', () => openInq(b.dataset.inq)));
}

function openInq(id) {
  const r = db.inquiries.find((x) => x.id === id);
  if (!r) return;
  const mailto = `mailto:${r.email}?subject=${encodeURIComponent('Re: your enquiry — SB Fall Protection')}`;
  openDrawer('Enquiry', `
    <div class="inq-head">
      <div class="inq-when">${fmtWhen(r.created_at)}</div>
      <div class="inq-name">${esc(r.name || '—')}</div>
      ${r.company ? `<div class="inq-co">${esc(r.company)}</div>` : ''}
      <div class="inq-rows">
        ${r.email ? `<div><a href="${esc(mailto)}">${esc(r.email)}</a></div>` : ''}
        ${r.phone ? `<div>${esc(r.phone)}</div>` : ''}
        ${r.country ? `<div><span class="k">Ship to:</span> ${esc(r.country)}</div>` : ''}
        ${r.category ? `<div><span class="k">Category:</span> ${esc(r.category)}</div>` : ''}
        ${r.sku ? `<div><span class="k">Product:</span> <strong>${esc(r.sku)}</strong></div>` : ''}
        ${r.source_page ? `<div><span class="k">From page:</span> ${esc(r.source_page)}</div>` : ''}
      </div>
    </div>
    <div style="margin-top:20px">
      <span class="adm-label">Message</span>
      <div class="inq-msg">${esc(r.message || '—')}</div>
    </div>
    <div class="adm-fields" style="margin-top:20px">
      ${select('Status', 'status', STATUS.map((s) => [s, S_LABEL[s]]), r.status)}
    </div>`,
    async () => {
      const status = val('status');
      const { error } = await sb.from('inquiries').update({ status }).eq('id', id);
      if (error) throw error;
      r.status = status;
      const n = db.inquiries.filter((x) => x.status === 'new').length;
      for (const el of ['inqCount', 'bellDot'].map((i) => document.getElementById(i))) {
        if (el) { el.hidden = n === 0; el.textContent = n; }
      }
      render();
    }, { mode: 'save', saveLabel: 'Save' });
}

/* ─────────────────────────── settings & publish ─────────────────────────── */

/**
 * Server replies carry two kinds of error: a plain sentence the person can act
 * on ("that is not an email address"), and a machine code for a setup or
 * permission problem they cannot. Show the first, log the second.
 */
function apiError(data, fallback) {
  console.warn('[admin]', data);
  const code = data && data.error;
  if (!code) return fallback;
  // codes the person cannot act on, phrased so they still know which wall they hit
  if (code === 'not_configured') return 'Account management is not switched on yet.';
  if (code === 'forbidden') return data.message || 'You do not have access to do that.';
  return String(code);
}


/**
 * Reels shown on the home page, held in `instagram_posts`. Videos are linked by
 * URL rather than uploaded: the clips already live on Instagram or a CDN, and
 * the site only needs somewhere to point.
 */
function reels() {
  main.innerHTML = pageHead('Reels',
    '<button class="adm-btn adm-btn-primary" id="newReel">+ Add reel</button>') + `
    <div class="adm-grid">
      ${db.reels.map((r) => `<article class="adm-tile">
        <span class="adm-tile-ph">
          ${r.thumbnail_url
            ? `<img src="${esc(r.thumbnail_url)}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : ICON.img}
        </span>
        <div class="adm-tile-body">
          <span class="adm-tile-meta">${esc(r.media_type || 'VIDEO')} · ${fmtDate(r.posted_at)}</span>
          <h3>${esc(r.caption || 'Untitled clip')}</h3>
          <p class="adm-tile-desc">${esc(r.permalink || 'No Instagram link')}</p>
          <div class="adm-tile-foot">
            <span class="adm-pill ${r.media_url ? 'green' : 'amber'}">${r.media_url ? 'Live' : 'No video'}</span>
            <span class="spacer" style="flex:1"></span>
            <button class="adm-btn adm-btn-soft" data-reel="${esc(r.id)}">Edit</button>
            <button class="adm-icon-btn danger" data-reel-del="${esc(r.id)}" title="Remove">${ICON.trash}</button>
          </div>
        </div>
      </article>`).join('') ||
      '<div class="adm-card adm-empty">No reels yet — the home page is showing the built-in clips.</div>'}
    </div>`;

  main.querySelector('#newReel').addEventListener('click', () => editReel(null));
  main.querySelectorAll('[data-reel]').forEach((b) =>
    b.addEventListener('click', () => editReel(b.dataset.reel)));
  main.querySelectorAll('[data-reel-del]').forEach((b) =>
    b.addEventListener('click', () => deleteReel(b.dataset.reelDel)));
}

function editReel(id) {
  const r = id ? db.reels.find((x) => x.id === id) : {
    id: '', media_type: 'VIDEO', media_url: '', thumbnail_url: '',
    permalink: '', caption: '', posted_at: new Date().toISOString(),
  };
  openDrawer(id ? 'Edit reel' : 'Add a reel', `
    <div class="adm-fields">
      ${field('Caption', 'caption', r.caption || '')}
      ${uploadField('Video (.mp4)', 'media_url', r.media_url || '', 'video/mp4,video/webm,video/quicktime')}
      ${uploadField('Poster image', 'thumbnail_url', r.thumbnail_url || '', 'image/jpeg,image/png,image/webp')}
      ${field('Instagram link', 'permalink', r.permalink || '', 'url')}
      ${field('Date', 'posted_at', (r.posted_at || '').slice(0, 10), 'date', '')}
      ${select('Type', 'media_type', [['VIDEO', 'Video'], ['IMAGE', 'Image']], r.media_type || 'VIDEO', '')}
    </div>`,
    async () => {
      const row = {
        id: id || `reel-${Date.now()}`,
        caption: val('caption'),
        media_url: val('media_url'),
        thumbnail_url: val('thumbnail_url') || null,
        permalink: val('permalink') || null,
        media_type: val('media_type'),
        posted_at: new Date(val('posted_at') || Date.now()).toISOString(),
      };
      if (!row.media_url) throw new Error('Add a video: paste a link or upload one.');
      const { error } = await sb.from('instagram_posts').upsert(row, { onConflict: 'id' });
      if (error) throw error;
      await loadAll();
      reels();
    }, { draftNote: 'Saved. It goes live the next time anything is published.' });
  wireUploads('reels');
}

function deleteReel(id) {
  const r = db.reels.find((x) => x.id === id);
  if (!r) return;
  openDrawer('Remove this reel?', `
    <p style="font-size:15px;line-height:1.65">
      <strong>${esc(r.caption || 'This clip')}</strong> comes off the home page in a
      minute or two.
    </p>
    <button class="adm-btn adm-btn-danger" id="confirmDelReel" style="margin-top:22px">
      Yes, remove it</button>`, null);
  drawerBody.querySelector('#confirmDelReel').addEventListener('click', async () => {
    const { error } = await sb.from('instagram_posts').delete().eq('id', id);
    if (error) return toast(error.message, true);
    db.reels = db.reels.filter((x) => x.id !== id);
    closeDrawer();
    reels();
    const r2 = await publishSite();
    toast(r2.ok ? 'Reel removed. The site updates in a minute or two.'
      : `Reel removed, but the site did not rebuild: ${r2.message}`, !r2.ok);
  });
}

/**
 * Staff accounts.
 *
 * The roster is read straight from the `staff` table with the ordinary session,
 * so the list works without the service_role key. Creating and removing the
 * underlying auth users does need that key, so those go through /api/users.
 * Your own row always shows, taken from the live session, even if neither is
 * reachable.
 */
let me = {
  id: '', email: '', role: 'admin', last_sign_in_at: null, created_at: null,
  // null role = no roster row yet, which the API treats as the bootstrap case
  rostered: false,
};
const canManageUsers = () => me.role === 'super_admin';

const ROLE_LABEL = { super_admin: 'Super admin', admin: 'Admin' };

function users() {
  const canManage = canManageUsers();
  main.innerHTML = pageHead('Users',
    canManage ? '<button class="adm-btn adm-btn-primary" id="newUser">+ Add user</button>' : '') +
    '<div class="adm-table-card"><div class="adm-empty">Loading staff accounts...</div></div>';
  const add = main.querySelector('#newUser');
  if (add) add.addEventListener('click', () => addUser());
  loadUsers();
}

async function loadUsers() {
  const card = main.querySelector('.adm-table-card');

  // the roster, readable with the ordinary session
  const roster = await sb.from('staff').select('user_id, email, role').order('email');
  if (roster.error) console.warn('[admin] staff table', roster.error.message);

  // live auth detail (last sign-in, confirmed, provider) when the key is set
  const live = await api('/api/users');
  if (!live.ok) console.warn('[admin] /api/users', live.status, live.data);

  const byEmail = new Map();
  const put = (email, patch) => {
    const k = String(email || '').toLowerCase();
    if (!k) return;
    byEmail.set(k, { ...(byEmail.get(k) || { email }), ...patch });
  };

  (roster.data || []).forEach((r) => put(r.email, { id: r.user_id, role: r.role }));
  (live.ok ? live.data.users || [] : []).forEach((u) =>
    put(u.email, {
      id: u.id,
      confirmed: u.confirmed,
      last_sign_in_at: u.last_sign_in_at,
      created_at: u.created_at,
      providers: u.providers,
    }));

  // you are always in the list, whatever else failed
  put(me.email, {
    id: me.id,
    role: (byEmail.get(me.email.toLowerCase()) || {}).role || me.role,
    last_sign_in_at: (byEmail.get(me.email.toLowerCase()) || {}).last_sign_in_at || me.last_sign_in_at,
    created_at: (byEmail.get(me.email.toLowerCase()) || {}).created_at || me.created_at,
    confirmed: true,
  });

  const rows = [...byEmail.values()].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'super_admin' ? -1 : 1;
    return String(a.email).localeCompare(String(b.email));
  });
  const canManage = canManageUsers();

  card.innerHTML = `
    <div class="adm-table-head"><h2>Staff Accounts</h2><span class="spacer"></span>
      <span class="adm-td-muted">${rows.length} ${rows.length === 1 ? 'account' : 'accounts'}</span></div>
    <div class="adm-table-scroll">
      <table class="adm-table"><thead><tr>
        <th>Email</th><th>Access</th><th>Status</th><th>Last sign-in</th>
        ${canManage ? '<th>Action</th>' : ''}
      </tr></thead><tbody>
      ${rows.map((u) => {
        const isMe = String(u.email).toLowerCase() === me.email.toLowerCase();
        return `<tr>
          <td><span class="adm-code">${esc(u.email)}</span>
              ${isMe ? '<span class="adm-sub">this is you</span>' : ''}</td>
          <td><span class="adm-pill ${u.role === 'super_admin' ? 'blue' : u.role ? 'grey' : 'red'}">${
            esc(ROLE_LABEL[u.role] || 'No access')}</span></td>
          <td><span class="adm-pill ${u.confirmed === false ? 'amber' : 'green'}">${
            u.confirmed === false ? 'Unconfirmed' : 'Active'}</span></td>
          <td class="adm-td-muted">${fmtWhen(u.last_sign_in_at)}</td>
          ${canManage ? `<td><span class="adm-act">${
            // a super admin resets any admin's password and their own, never another super admin's
            (isMe || u.role !== 'super_admin') && u.id
              ? `<button class="adm-icon-btn" data-reset-user="${esc(u.id)}"
                         data-email="${esc(u.email)}" title="Set a new password">${ICON.key}</button>` : ''}${isMe
            ? ''
            : `<button class="adm-icon-btn danger" data-del-user="${esc(u.id || '')}"
                       data-email="${esc(u.email)}" title="Remove">${ICON.trash}</button>`}</span></td>` : ''}
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>`;

  card.querySelectorAll('[data-del-user]').forEach((b) =>
    b.addEventListener('click', () => removeUser(b.dataset.delUser, b.dataset.email)));
  card.querySelectorAll('[data-reset-user]').forEach((b) =>
    b.addEventListener('click', () => resetPassword(b.dataset.resetUser, b.dataset.email)));
}

function resetPassword(id, email) {
  openDrawer('Set a new password', `
    <p class="adm-td-muted" style="margin-bottom:20px;font-weight:600">${esc(email)}</p>
    <div class="adm-fields">
      ${field('New password', 'password', '', 'password')}
      ${field('Type it again', 'password2', '', 'password')}
    </div>`,
    async () => {
      const password = val('password');
      if (password.length < 8) throw new Error('Use at least 8 characters.');
      if (password !== val('password2')) throw new Error('The two passwords do not match.');
      const { ok, data } = await api('/api/users', 'PATCH', { id, password });
      if (!ok) throw new Error(apiError(data, 'Could not set that password.'));
    }, { mode: 'save', saveLabel: 'Set password', doneMsg: `New password set for ${email}` });
}

function addUser() {
  openDrawer('Add a staff account', `
    <div class="adm-fields">
      ${field('Email address', 'email', '', 'email')}
      ${field('Password', 'password', '', 'text')}
      ${select('Access level', 'role',
        [['admin', 'Admin — full content access'],
         ['super_admin', 'Super admin — content, plus manage accounts']], 'admin')}
    </div>`,
    async () => {
      const { ok, data } = await api('/api/users', 'POST', {
        email: val('email'),
        password: val('password'),
        role: val('role'),
      });
      if (!ok) throw new Error(apiError(data, 'Could not add that account.'));
      await loadUsers();
    }, { mode: 'save', saveLabel: 'Create account', doneMsg: 'Account created' });
}

function removeUser(id, email) {
  openDrawer('Remove this account?', `
    <p style="font-size:15px;line-height:1.65">
      <strong>${esc(email)}</strong> will no longer be able to sign in. Nothing they
      created is deleted, so products, articles and enquiries all stay.
    </p>
    <button class="adm-btn adm-btn-danger" id="confirmDelUser" style="margin-top:22px">
      Yes, remove this account</button>`, null);
  drawerBody.querySelector('#confirmDelUser').addEventListener('click', async () => {
    const { ok, data } = await api('/api/users', 'DELETE', { id });
    if (!ok) return toast(apiError(data, 'Could not remove that account'), true);
    closeDrawer();
    toast(`${email} removed`);
    loadUsers();
  });
}

/* --------------------------- settings --------------------------- */

function settings() {
  sb.auth.getUser().then(({ data }) => profileView((data && data.user) || null));
}

function profileView(user) {
  const md = (user && user.user_metadata) || {};
  const email = (user && user.email) || me.email;
  main.innerHTML = pageHead('Profile settings') + `
    <div class="adm-form-card">
      <span class="adm-label">Profile</span>
      <div class="adm-profile-photo">
        <span class="adm-avatar adm-avatar-lg" id="profAvatar">${avatarHtml(md.avatar_url, md.full_name || email)}</span>
        <div class="adm-profile-photo-actions">
          <label class="adm-btn adm-btn-soft">
            <input type="file" id="profPhoto" accept="image/jpeg,image/png,image/webp" hidden>
            Upload photo
          </label>
          ${md.avatar_url ? '<button type="button" class="adm-btn adm-btn-ghost" id="profPhotoDel">Remove</button>' : ''}
        </div>
      </div>
      <div class="adm-fields" style="margin-top:26px">
        ${field('Name', 'full_name', md.full_name || '', 'text', '')}
        ${field('Phone number', 'phone', md.phone || '', 'tel', '')}
        ${field('Email address', 'email', email, 'email')}
      </div>
      <button class="adm-btn adm-btn-primary" id="profSave" style="margin-top:26px">Save profile</button>
    </div>

    <div class="adm-form-card" style="margin-top:24px">
      <span class="adm-label">Change password</span>
      <div class="adm-fields" style="margin-top:18px">
        ${field('New password', 'new_password', '', 'password', '')}
        ${field('Type it again', 'new_password2', '', 'password', '')}
      </div>
      <button class="adm-btn adm-btn-primary" id="pwSave" style="margin-top:26px">Update password</button>
    </div>`;

  const q = (sel) => main.querySelector(sel);
  const v = (name) => (q(`[name="${name}"]`).value || '').trim();

  q('#profPhoto').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const small = await shrinkImage(file, 320);
      const url = await uploadTo('avatars', `${me.id}/${Date.now()}.jpg`, small);
      const { data, error } = await sb.auth.updateUser({ data: { avatar_url: url } });
      if (error) throw error;
      paintMe(data.user);
      profileView(data.user);
      toast('Photo updated');
    } catch (err) {
      toast(err.message || 'Could not upload that photo', true);
    }
  });

  const del = q('#profPhotoDel');
  if (del) del.addEventListener('click', async () => {
    const { data, error } = await sb.auth.updateUser({ data: { avatar_url: null } });
    if (error) return toast(error.message, true);
    paintMe(data.user);
    profileView(data.user);
    toast('Photo removed');
  });

  q('#profSave').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const nextEmail = v('email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) return toast('That email address does not look right.', true);
    const patch = { data: { full_name: v('full_name'), phone: v('phone') } };
    const emailChanged = nextEmail.toLowerCase() !== email.toLowerCase();
    if (emailChanged) patch.email = nextEmail;
    btn.disabled = true;
    const { data, error } = await sb.auth.updateUser(patch);
    btn.disabled = false;
    if (error) return toast(error.message, true);
    paintMe(data.user);
    toast(emailChanged
      ? 'Saved. The email changes once you click the confirmation link sent to it.'
      : 'Profile saved');
  });

  q('#pwSave').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const pw = q('[name="new_password"]').value;
    if (pw.length < 8) return toast('Use at least 8 characters.', true);
    if (pw !== q('[name="new_password2"]').value) return toast('The two passwords do not match.', true);
    btn.disabled = true;
    const { error } = await sb.auth.updateUser({ password: pw });
    btn.disabled = false;
    if (error) return toast(error.message, true);
    q('[name="new_password"]').value = q('[name="new_password2"]').value = '';
    toast('Password updated');
  });
}

/** Scale a photo down in the browser, so an avatar is a few KB, not a few MB. */
function shrinkImage(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(new File([b], 'avatar.jpg', { type: 'image/jpeg' })) : reject(new Error('Could not read that image'))),
        'image/jpeg', 0.88);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}

/* onAuthStateChange fires with the restored session on load */
sb.auth.getSession().then(({ data }) => { if (!data.session) loginView.hidden = false; });
