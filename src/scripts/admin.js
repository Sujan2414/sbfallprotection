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

const URL = document.body.dataset.sbUrl;
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
let onSave = null;

function openDrawer(title, html, save) {
  drawerTitle.textContent = title;
  drawerBody.innerHTML = html;
  drawerSave.hidden = !save;
  onSave = save || null;
  drawer.classList.add('open');
}
function closeDrawer() {
  drawer.classList.remove('open');
  onSave = null;
}
drawer.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) closeDrawer(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

drawerSave.addEventListener('click', async () => {
  if (!onSave) return;
  drawerSave.disabled = true;
  drawerSave.textContent = 'Saving…';
  try {
    await onSave();
    closeDrawer();
    toast('Saved');
  } catch (err) {
    toast(err.message || 'Save failed', true);
  } finally {
    drawerSave.disabled = false;
    drawerSave.textContent = 'Save changes';
  }
});

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
        redirectTo: window.location.origin + '/admin/',
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
    document.getElementById('admWho').textContent = email;
    document.getElementById('admInitials').textContent =
      (email.slice(0, 2) || 'SB').toUpperCase();
    // the roster decides what the sidebar and Users tab allow
    sb.from('staff').select('role').eq('user_id', me.id).maybeSingle()
      .then(({ data }) => {
        if (data && data.role) { me.role = data.role; me.rostered = true; }
      })
      .catch(() => {})
      .finally(boot);
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

const db = { categories: [], families: [], products: [], inquiries: [], posts: [] };

async function loadAll() {
  const [c, f, p, i, po] = await Promise.all([
    sb.from('categories').select('*').order('sort_order'),
    sb.from('families').select('*').order('sort_order'),
    sb.from('products').select('*').order('sort_order').limit(2000),
    sb.from('inquiries').select('*').order('created_at', { ascending: false }).limit(500),
    sb.from('posts').select('*').order('published_at', { ascending: false }),
  ]);
  for (const r of [c, f, p, i, po]) if (r.error) throw r.error;
  db.categories = c.data; db.families = f.data; db.products = p.data;
  db.inquiries = i.data; db.posts = po.data;

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
  ({ overview, products, taxonomy, posts, inquiries, users, settings }[tab] || overview)();
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
      ${select('Status', 'published', [['true', 'Live on site'], ['false', 'Hidden']], String(!!p.published), '')}
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
    async () => {
      const specs = {};
      drawerBody.querySelectorAll('.spec-row').forEach((r) => {
        const k = r.querySelector('.sk').value.trim();
        if (k) specs[k] = r.querySelector('.sv').value.trim();
      });
      const patch = {
        sku: val('sku'), attachment: val('attachment') || null,
        category: val('category'), family: val('family') || null,
        image: val('image') || null, published: val('published') === 'true', specs,
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
      This permanently removes <strong>${esc(p.sku)}</strong> from the catalogue.
      Its page disappears from the site at the next publish.
    </p>
<button class="adm-btn adm-btn-danger" id="confirmDel" style="margin-top:22px">
      Yes, delete permanently</button>`, null);
  drawerBody.querySelector('#confirmDel').addEventListener('click', async () => {
    const { error } = await sb.from('products').delete().eq('id', id);
    if (error) return toast(error.message, true);
    db.products = db.products.filter((x) => x.id !== id);
    closeDrawer();
    toast(`${p.sku} deleted`);
    products();
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
    });
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
    });
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
      ${select('Status', 'published', [['true', 'Live'], ['false', 'Draft']], String(!!p.published), '')}
      ${select('Featured', 'featured', [['false', 'No'], ['true', 'Yes']], String(!!p.featured), '')}
      ${field('Body (Markdown)', 'body', p.body || '', 'textarea')}
    </div>`,
    async () => {
      const row = {
        slug: val('slug'), title: val('title'), topic: val('topic'), excerpt: val('excerpt'),
        image: val('image'), image_alt: val('image_alt'), author: val('author'),
        read_mins: parseInt(val('read_mins'), 10) || 5,
        published: val('published') === 'true', featured: val('featured') === 'true',
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
    });
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
const canManageUsers = () => me.role === 'super_admin' || !me.rostered;

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
        <th>Email</th><th>Access</th><th>Status</th><th>Last sign-in</th><th>Sign-in</th>
        ${canManage ? '<th>Action</th>' : ''}
      </tr></thead><tbody>
      ${rows.map((u) => {
        const isMe = String(u.email).toLowerCase() === me.email.toLowerCase();
        return `<tr>
          <td><span class="adm-code">${esc(u.email)}</span>
              ${isMe ? '<span class="adm-sub">this is you</span>' : ''}</td>
          <td><span class="adm-pill ${u.role === 'super_admin' ? 'blue' : 'grey'}">${
            esc(ROLE_LABEL[u.role] || 'Admin')}</span></td>
          <td><span class="adm-pill ${u.confirmed === false ? 'amber' : 'green'}">${
            u.confirmed === false ? 'Unconfirmed' : 'Active'}</span></td>
          <td class="adm-td-muted">${fmtWhen(u.last_sign_in_at)}</td>
          <td class="adm-td-muted">${esc((u.providers || []).join(', ') || 'password')}</td>
          ${canManage ? `<td><span class="adm-act">${isMe
            ? '<span class="adm-td-muted">-</span>'
            : `<button class="adm-icon-btn danger" data-del-user="${esc(u.id || '')}"
                       data-email="${esc(u.email)}" title="Remove">${ICON.trash}</button>`}</span></td>` : ''}
        </tr>`;
      }).join('')}
      </tbody></table>
    </div>`;

  card.querySelectorAll('[data-del-user]').forEach((b) =>
    b.addEventListener('click', () => removeUser(b.dataset.delUser, b.dataset.email)));
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
    });
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
  main.innerHTML = pageHead('Settings') + `
    <div class="adm-form-card">
      <span class="adm-label">Signed in as</span>
      <p style="font-size:16px;font-weight:700">${esc(document.getElementById('admWho').textContent)}</p>
</div>

    <div class="adm-form-card" style="margin-top:24px">
      <span class="adm-label">Publishing</span>
      <p class="adm-td-muted" style="margin-top:8px;line-height:1.65;font-weight:600">
        The public site is pre-rendered, so your edits reach visitors only after a
        rebuild. <strong>Publish to site</strong> triggers one. The deploy hook it
        calls is held on the server, not here.
      </p>
    </div>`;
}

document.getElementById('btnPublish').addEventListener('click', async () => {
  const btn = document.getElementById('btnPublish');
  btn.disabled = true;
  btn.textContent = 'Publishing...';
  const { ok, status, data } = await api('/api/publish', 'POST');
  btn.disabled = false;
  btn.textContent = 'Publish to site';
  if (ok) return toast('Rebuild triggered - the site updates in a minute or two');
  toast(apiError(data, 'Could not publish just now'), true);
});

/* onAuthStateChange fires with the restored session on load */
sb.auth.getSession().then(({ data }) => { if (!data.session) loginView.hidden = false; });
