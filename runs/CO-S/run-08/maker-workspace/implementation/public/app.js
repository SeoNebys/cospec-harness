'use strict';

// Production frontend for the bookmark app. Talks to the JSON API in
// src/server.js. Behaviour is defined by approved scenarios SCN-001..SCN-011.

const UNCATEGORIZED = 'Uncategorized'; // SCN-007 fallback label

const state = {
  bookmarks: [],
  activeTopic: 'All',
  editingId: null,
  confirmingDeleteId: null,
};

// ---------- helpers ----------
async function api(method, url, body) {
  const opts = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }
  return { status: res.status, ok: res.ok, data };
}

function el(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
function highlight(s, q) {
  const safe = escapeHtml(s);
  if (!q) return safe;
  const idx = safe.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return safe;
  return safe.slice(0, idx) + '<mark>' + safe.slice(idx, idx + q.length) + '</mark>' + safe.slice(idx + q.length);
}
function topicOf(b) { return (b.topic && b.topic.trim()) ? b.topic : UNCATEGORIZED; }
function markReady() { document.body.setAttribute('data-harness-ready', 'true'); }

// ---------- view switching ----------
function showAuth(accountExists) {
  el('app-view').hidden = true;
  el('auth-view').hidden = false;
  setAuthMode(accountExists ? 'signin' : 'register');
  markReady();
}

async function showApp(email) {
  el('auth-view').hidden = true;
  el('app-view').hidden = false;
  el('account-email').textContent = email || '';
  await loadBookmarks();
  markReady();
}

// ---------- auth (SCN-011) ----------
let authMode = 'signin';
function setAuthMode(mode) {
  authMode = mode;
  const msg = el('auth-msg');
  msg.className = 'auth-msg';
  msg.textContent = '';
  el('auth-confirm-row').hidden = mode !== 'register';
  if (mode === 'register') {
    el('auth-heading').textContent = 'Create your account';
    el('auth-sub').textContent = 'Set up your account once, then sign in from any device.';
    el('auth-submit').textContent = 'Create account';
    el('auth-toggle').innerHTML = 'Already have an account? <a id="auth-toggle-link">Sign in</a>';
  } else {
    el('auth-heading').textContent = 'Welcome back';
    el('auth-sub').textContent = 'Sign in to see your bookmarks on this device.';
    el('auth-submit').textContent = 'Sign in';
    el('auth-toggle').innerHTML = 'First time here? <a id="auth-toggle-link">Create your account</a>';
  }
  el('auth-toggle-link').onclick = () => setAuthMode(authMode === 'signin' ? 'register' : 'signin');
}

function authError(text) {
  const msg = el('auth-msg');
  msg.className = 'auth-msg err';
  msg.textContent = text;
}

async function submitAuth() {
  const email = el('auth-email').value.trim();
  const password = el('auth-password').value;
  const stay = el('auth-stay').checked;
  if (!email || !password) { authError('Please enter your email and password.'); return; }

  if (authMode === 'register') {
    const confirm = el('auth-confirm').value;
    if (password !== confirm) { authError("The two passwords don't match."); return; }
    const r = await api('POST', '/api/register', { email, password, confirm, stay });
    if (r.ok) { await showApp(r.data.email); return; }
    if (r.data && r.data.error === 'account_exists') { authError('An account already exists. Please sign in.'); setAuthMode('signin'); return; }
    authError('Could not create the account. Please try again.');
    return;
  }

  const r = await api('POST', '/api/login', { email, password, stay });
  if (r.ok) { await showApp(r.data.email); return; }
  authError('That email or password is not correct.'); // SCN-011 wrong credentials
}

async function signOut() {
  await api('POST', '/api/logout');
  state.bookmarks = [];
  state.activeTopic = 'All';
  el('auth-email').value = '';
  el('auth-password').value = '';
  showAuth(true);
}

// ---------- bookmarks ----------
async function loadBookmarks() {
  const r = await api('GET', '/api/bookmarks');
  if (r.status === 401) { showAuth(true); return; }
  state.bookmarks = (r.data && r.data.bookmarks) || [];
  renderChips();
  render();
}

function allTopics() {
  return [...new Set(state.bookmarks.map(topicOf))].sort((a, b) => a.localeCompare(b));
}

function renderChips() {
  const c = el('chips');
  c.innerHTML = '';
  if (state.bookmarks.length === 0) return;
  if (state.activeTopic !== 'All' && !allTopics().includes(state.activeTopic)) state.activeTopic = 'All';
  ['All', ...allTopics()].forEach((t) => {
    const b = document.createElement('button');
    b.className = 'chip' + (t === state.activeTopic ? ' active' : '');
    b.textContent = t;
    b.onclick = () => {
      state.activeTopic = t;
      if (t === 'All') el('search').value = ''; // SCN-003 refinement: All clears search
      renderChips();
      render();
    };
    c.appendChild(b);
  });
}

function render(flashId) {
  const list = el('list');
  const meta = el('search-meta');
  const q = el('search').value.trim().toLowerCase();
  list.innerHTML = '';

  if (state.bookmarks.length === 0) { // SCN-006 empty state
    list.innerHTML = '<div class="empty">No links saved yet.<br>Add your first one above.</div>';
    meta.textContent = '';
    return;
  }

  let matches = state.bookmarks.slice();
  if (state.activeTopic !== 'All') matches = matches.filter((b) => topicOf(b) === state.activeTopic); // SCN-003
  if (q) { // SCN-002
    matches = matches.filter((b) =>
      (b.title || '').toLowerCase().includes(q) ||
      (b.url || '').toLowerCase().includes(q) ||
      (b.topic || '').toLowerCase().includes(q));
    meta.textContent = matches.length + (matches.length === 1 ? ' link found' : ' links found');
  } else {
    meta.textContent = '';
  }

  if (q && matches.length === 0) { // SCN-002 no matches (distinct wording from empty state)
    list.innerHTML = '<div class="empty">No links match "' + escapeHtml(q) + '".<br>Try a different word.</div>';
    return;
  }

  const groups = {};
  matches.forEach((b) => { (groups[topicOf(b)] ||= []).push(b); });
  Object.keys(groups).sort((a, b) => a.localeCompare(b)).forEach((topic) => { // SCN-001 alphabetical
    const group = document.createElement('div');
    group.className = 'topic-group';
    group.innerHTML = `<h2 class="topic-head">${escapeHtml(topic)} <span class="topic-count">${groups[topic].length}</span></h2>`;
    groups[topic].forEach((b) => {
      const row = document.createElement('div');
      row.className = 'bm';
      if (b.id === state.editingId) renderEditForm(row, b, q);
      else if (b.id === state.confirmingDeleteId) renderDeleteConfirm(row, b);
      else renderRow(row, b, q);
      group.appendChild(row);
    });
    list.appendChild(group);
  });

  if (flashId != null) {
    const node = list.querySelector(`[data-id="${flashId}"]`);
    if (node) { node.style.transition = 'background 1.2s'; node.style.background = 'var(--accent-soft)'; setTimeout(() => { node.style.background = ''; }, 50); }
  }
}

function renderRow(row, b, q) {
  row.setAttribute('data-id', b.id);
  row.innerHTML = `<div class="bm-main">
      <a href="${escapeAttr(b.url)}" target="_blank" rel="noopener">${highlight(b.title || b.url, q)}</a>
      <div class="bm-url">${highlight(b.url, q)}</div>
    </div>
    <div class="bm-actions">
      <button class="edit-btn">Edit</button>
      <button class="del-btn">Delete</button>
    </div>`;
  row.querySelector('.edit-btn').onclick = () => { state.editingId = b.id; state.confirmingDeleteId = null; render(); };
  row.querySelector('.del-btn').onclick = () => { state.confirmingDeleteId = b.id; state.editingId = null; render(); };
}

function renderEditForm(row, b) { // SCN-004
  row.innerHTML = `<div class="edit-form">
      <div class="add-row">
        <div class="field"><label>Link address</label><input class="e-url" type="text"></div>
        <div class="field"><label>Title</label><input class="e-title" type="text"></div>
        <div class="field"><label>Topic</label><input class="e-topic" type="text"></div>
      </div>
      <div class="edit-error"></div>
      <div class="edit-actions">
        <button class="save-edit">Save changes</button>
        <button class="cancel-edit">Cancel</button>
      </div>
    </div>`;
  row.querySelector('.e-url').value = b.url || '';
  row.querySelector('.e-title').value = b.title || '';
  row.querySelector('.e-topic').value = b.topic || '';
  row.querySelector('.save-edit').onclick = async () => {
    const url = row.querySelector('.e-url').value.trim();
    if (!url) { row.querySelector('.e-url').focus(); return; } // SCN-004/010
    const r = await api('PUT', '/api/bookmarks/' + b.id, {
      url,
      title: row.querySelector('.e-title').value.trim(),
      topic: row.querySelector('.e-topic').value.trim(),
    });
    if (r.status === 409) { row.querySelector('.edit-error').textContent = 'You already have another link with that address.'; return; }
    if (!r.ok) { row.querySelector('.edit-error').textContent = 'Could not save the change.'; return; }
    const i = state.bookmarks.findIndex((x) => x.id === b.id);
    if (i !== -1) state.bookmarks[i] = r.data.bookmark;
    state.editingId = null;
    renderChips();
    render();
  };
  row.querySelector('.cancel-edit').onclick = () => { state.editingId = null; render(); };
}

function renderDeleteConfirm(row, b) { // SCN-005
  row.innerHTML = `<div class="confirm-del">
      <span>Delete "${escapeHtml(b.title || b.url)}"?</span>
      <button class="yes">Delete</button>
      <button class="no">Keep</button>
    </div>`;
  row.querySelector('.yes').onclick = async () => {
    const r = await api('DELETE', '/api/bookmarks/' + b.id);
    if (r.ok) state.bookmarks = state.bookmarks.filter((x) => x.id !== b.id);
    state.confirmingDeleteId = null;
    renderChips();
    render();
  };
  row.querySelector('.no').onclick = () => { state.confirmingDeleteId = null; render(); };
}

function showSaveNotice(msg) { const n = el('save-notice'); n.textContent = msg; n.classList.add('show'); }
function clearSaveNotice() { el('save-notice').classList.remove('show'); }

async function saveLink() {
  const url = el('url').value.trim();
  const title = el('title').value.trim();
  const topic = el('topic').value.trim();
  if (!url) { el('url').focus(); return; } // SCN-010
  const r = await api('POST', '/api/bookmarks', { url, title, topic });
  if (!r.ok && r.status !== 200) { showSaveNotice('Could not save the link. Please try again.'); return; }

  if (r.data && r.data.duplicate) { // SCN-008
    const existing = r.data.bookmark;
    const i = state.bookmarks.findIndex((x) => x.id === existing.id);
    if (i === -1) state.bookmarks.push(existing); else state.bookmarks[i] = existing;
    showSaveNotice('You already saved this link — opening it so you can edit it instead.');
    state.editingId = existing.id;
    state.confirmingDeleteId = null;
    renderChips();
    render();
    return;
  }

  // created (SCN-001, SCN-009 normalization applied server-side)
  state.bookmarks.push(r.data.bookmark);
  clearSaveNotice();
  el('url').value = '';
  el('title').value = '';
  el('topic').value = '';
  el('url').focus();
  renderChips();
  render(r.data.bookmark.id);
}

// ---------- wiring ----------
function wire() {
  el('auth-submit').onclick = submitAuth;
  el('auth-password').addEventListener('keydown', (e) => { if (e.key === 'Enter' && authMode === 'signin') submitAuth(); });
  el('auth-confirm').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAuth(); });
  el('signout').onclick = signOut;
  el('save').onclick = saveLink;
  el('search').addEventListener('input', () => render());
}

async function boot() {
  wire();
  const r = await api('GET', '/api/session');
  const s = r.data || { authenticated: false, accountExists: false };
  if (s.authenticated) await showApp(s.email);
  else showAuth(s.accountExists);
}

boot();
