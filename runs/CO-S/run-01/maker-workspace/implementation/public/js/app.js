import { buildQuery } from './search.js';
import { findExisting } from './urlkey.js';

// ---- state ---------------------------------------------------------------
let bookmarks = [];
let currentView = 'all';        // all | later | archived
let query = '';
let editingId = null;           // when set, Save updates this bookmark
let confirmingDeleteId = null;  // bookmark awaiting delete confirmation
let highlightId = null;

const el = (id) => document.getElementById(id);

// ---- api -----------------------------------------------------------------
const api = {
  async list() { const r = await fetch('/api/bookmarks'); return r.json(); },
  async create(data) { const r = await fetch('/api/bookmarks', mkOpts('POST', data)); return r.json(); },
  async update(id, data) { const r = await fetch('/api/bookmarks/' + id, mkOpts('PUT', data)); return r.json(); },
  async remove(id) { await fetch('/api/bookmarks/' + id, { method: 'DELETE' }); },
  async details(url) { const r = await fetch('/api/fetch-details?url=' + encodeURIComponent(url)); return r.json(); }
};
function mkOpts(method, data) {
  return { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) };
}
async function refresh() { bookmarks = await api.list(); render(); }

// ---- helpers -------------------------------------------------------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function isValidHttpUrl(u) {
  try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; }
}
function inView(b, view) {
  if (view === 'all') return !b.archived;
  if (view === 'later') return b.readLater && !b.archived;
  if (view === 'archived') return b.archived;
  return true;
}
function emptyMessage(view) {
  if (view === 'later') return 'No bookmarks marked “Read later” yet.';
  if (view === 'archived') return 'Nothing archived.';
  return 'Nothing here yet. Paste a link above to start.';
}

// ---- details fetch -------------------------------------------------------
async function getDetails() {
  const url = el('url').value.trim();
  if (!url) return;
  if (!isValidHttpUrl(url)) {
    setFetchState('', "That doesn't look like a link yet.");
    return;
  }
  setFetchState('loading', 'Getting details…');
  el('metaPreview').classList.remove('show');
  const res = await api.details(url);
  if (!res.ok) {
    // Couldn't get details — still let the user save manually (SCN-007).
    el('pSite').textContent = '';
    el('title').value = '';
    el('desc').value = '';
    el('metaPreview').classList.add('show');
    setFetchState('error', "Couldn't get this page's details. You can still add a title yourself and save.");
    el('title').focus();
    return;
  }
  el('pSite').textContent = res.meta.site || '';
  el('title').value = res.meta.title || '';
  el('desc').value = res.meta.desc || '';
  el('metaPreview').classList.add('show');
  setFetchState('done', 'Details picked up — edit anything before saving.');
}
function setFetchState(cls, text) {
  el('fetchState').className = 'fetch-state' + (cls ? ' ' + cls : '');
  el('fetchState').textContent = text;
}

// ---- editor --------------------------------------------------------------
function showForm(b) {
  el('url').value = b.url;
  el('title').value = b.title;
  el('desc').value = b.desc;
  el('tags').value = (b.tags || []).join(', ');
  el('note').value = b.note;
  el('pSite').textContent = b.site || '';
  el('metaPreview').classList.add('show');
}
function enterEditMode(id, fromDuplicate) {
  const b = bookmarks.find(x => String(x.id) === String(id));
  if (!b) return;
  editingId = b.id;
  showForm(b);
  el('formHeading').textContent = 'Update this bookmark';
  el('saveBtn').textContent = 'Update bookmark';
  el('cancelEditBtn').hidden = false;
  el('modeBanner').textContent = fromDuplicate
    ? 'You’ve already saved this link — here it is. Make your changes and press “Update bookmark”.'
    : 'Editing a saved bookmark. Make your changes and press “Update bookmark”.';
  el('modeBanner').classList.add('show');
  setFetchState('', '');
  highlightId = b.id;
  render();
  const node = el('bm-' + b.id);
  if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => { highlightId = null; render(); }, 2600);
}
function resetForm() {
  editingId = null;
  el('url').value = ''; el('title').value = ''; el('desc').value = '';
  el('tags').value = ''; el('note').value = ''; el('pSite').textContent = '';
  el('metaPreview').classList.remove('show');
  setFetchState('', '');
  el('formHeading').textContent = 'Save a link';
  el('saveBtn').textContent = 'Save bookmark';
  el('cancelEditBtn').hidden = true;
  el('modeBanner').classList.remove('show');
  el('modeBanner').textContent = '';
}

function collectForm() {
  return {
    url: el('url').value.trim(),
    title: el('title').value.trim() || el('url').value.trim(),
    site: el('pSite').textContent,
    desc: el('desc').value.trim(),
    tags: el('tags').value.split(',').map(t => t.trim()).filter(Boolean),
    note: el('note').value.trim()
  };
}

async function save() {
  const url = el('url').value.trim();
  if (!url) return;
  if (!isValidHttpUrl(url)) { setFetchState('', "That doesn't look like a link yet."); return; }

  if (editingId !== null) {
    await api.update(editingId, collectForm());
    resetForm();
    await refresh();
    flash('Updated.');
    return;
  }
  // New save: if the link already exists, go update it instead (SCN-002).
  const existing = findExisting(bookmarks, url);
  if (existing) { enterEditMode(existing.id, true); return; }

  await api.create(collectForm());
  resetForm();
  await refresh();
  flash('Saved.');
}
function flash(msg) {
  el('saveFlash').textContent = msg;
  setTimeout(() => { el('saveFlash').textContent = ''; }, 1800);
}

// ---- item actions --------------------------------------------------------
async function setLater(id, val) { await api.update(id, { readLater: val }); await refresh(); }
async function setArchived(id, val) { await api.update(id, { archived: val }); await refresh(); }
async function reallyDelete(id) {
  await api.remove(id);
  if (String(editingId) === String(id)) resetForm();
  confirmingDeleteId = null;
  await refresh();
}

// ---- render --------------------------------------------------------------
function render() {
  const q = query.trim();
  const pred = q ? buildQuery(q) : null;

  el('vc-all').textContent = '(' + bookmarks.filter(b => inView(b, 'all')).length + ')';
  el('vc-later').textContent = '(' + bookmarks.filter(b => inView(b, 'later')).length + ')';
  el('vc-archived').textContent = '(' + bookmarks.filter(b => inView(b, 'archived')).length + ')';

  const base = bookmarks.filter(b => inView(b, currentView));
  const visible = pred ? base.filter(pred) : base;

  el('count').textContent = q
    ? 'showing ' + visible.length + ' of ' + base.length
    : base.length + (base.length === 1 ? ' bookmark' : ' bookmarks');

  const list = el('list');
  if (base.length === 0) {
    list.innerHTML = '<div class="empty">' + escapeHtml(emptyMessage(currentView)) + '</div>';
    return;
  }
  if (visible.length === 0) {
    list.innerHTML = '<div class="empty">No bookmarks match “' + escapeHtml(q) + '” in this view.</div>';
    return;
  }
  list.innerHTML = visible.map(cardHtml).join('');
}

function cardHtml(b) {
  const later = b.readLater && !b.archived;
  const confirming = String(b.id) === String(confirmingDeleteId);
  const actions = confirming
    ? `<span class="confirm-text">Delete permanently? This can't be undone.</span>
       <button class="danger" data-act="confirmdelete" data-id="${b.id}" type="button">Delete</button>
       <button data-act="canceldelete" data-id="${b.id}" type="button">Cancel</button>`
    : `<button data-act="edit" data-id="${b.id}" type="button">Edit</button>
       ${b.archived
         ? `<button data-act="restore" data-id="${b.id}" type="button">Restore to All</button>`
         : `${b.readLater
             ? `<button class="on" data-act="markread" data-id="${b.id}" type="button">Mark as read</button>`
             : `<button data-act="later" data-id="${b.id}" type="button">Read later</button>`}
            <button data-act="archive" data-id="${b.id}" type="button">Archive</button>`}
       <button class="danger-ghost" data-act="delete" data-id="${b.id}" type="button">Delete</button>`;

  return `
    <div class="bm ${String(b.id) === String(highlightId) ? 'highlight' : ''} ${later ? 'is-later' : ''}" id="bm-${b.id}">
      <div class="title">${escapeHtml(b.title)}${later ? '<span class="flag">Read later</span>' : ''}</div>
      <div class="url"><a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.url)}</a></div>
      ${b.desc ? `<div class="desc">${escapeHtml(b.desc)}</div>` : ''}
      ${(b.tags && b.tags.length) ? `<div class="chips">${b.tags.map(t => `<span class="chip">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      ${b.note ? `<div class="note">${escapeHtml(b.note)}</div>` : ''}
      <div class="bm-actions">${actions}</div>
    </div>`;
}

// ---- events --------------------------------------------------------------
el('fetchBtn').addEventListener('click', getDetails);
el('url').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); getDetails(); } });
el('saveBtn').addEventListener('click', save);
el('cancelEditBtn').addEventListener('click', () => { resetForm(); });
el('search').addEventListener('input', (e) => { query = e.target.value; render(); });

document.querySelectorAll('.view-btn').forEach(btn =>
  btn.addEventListener('click', () => {
    currentView = btn.dataset.view;
    confirmingDeleteId = null;
    document.querySelectorAll('.view-btn').forEach(x => x.classList.toggle('active', x === btn));
    render();
  }));

el('list').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.dataset.id;
  switch (btn.dataset.act) {
    case 'edit': enterEditMode(id, false); break;
    case 'later': setLater(id, true); break;
    case 'markread': setLater(id, false); break;
    case 'archive': setArchived(id, true); break;
    case 'restore': setArchived(id, false); break;
    case 'delete': confirmingDeleteId = id; render(); break;
    case 'canceldelete': confirmingDeleteId = null; render(); break;
    case 'confirmdelete': reallyDelete(id); break;
  }
});

// ---- boot ----------------------------------------------------------------
(async function init() {
  await refresh();
  document.body.setAttribute('data-harness-ready', 'true');
})();
