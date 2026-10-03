'use strict';

// ---------- tiny helpers ----------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const api = async (url, opts) => {
  const res = await fetch(url, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.error) || res.statusText);
  return data;
};
function toast(msg, isErr) {
  const t = $('#toast');
  t.textContent = msg; t.classList.toggle('err', !!isErr); t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2600);
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return days + 'd ago';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ---------- minimal markdown ----------
function mdToHtml(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  let html = '', i = 0;
  const inline = (t) => {
    t = esc(t);
    t = t.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, txt, url) => `<a href="${url}" target="_blank" rel="noopener">${txt}</a>`);
    return t;
  };
  while (i < lines.length) {
    let line = lines[i];
    if (/^```/.test(line)) {
      i++; let code = '';
      while (i < lines.length && !/^```/.test(lines[i])) { code += lines[i] + '\n'; i++; }
      i++; html += `<pre><code>${esc(code)}</code></pre>`; continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { const n = h[1].length; html += `<h${n}>${inline(h[2])}</h${n}>`; i++; continue; }
    if (/^\s*>/.test(line)) {
      let q = '';
      while (i < lines.length && /^\s*>/.test(lines[i])) { q += lines[i].replace(/^\s*>\s?/, '') + ' '; i++; }
      html += `<blockquote>${inline(q.trim())}</blockquote>`; continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      html += '<ul>';
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { html += `<li>${inline(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`; i++; }
      html += '</ul>'; continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      html += '<ol>';
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { html += `<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`; i++; }
      html += '</ol>'; continue;
    }
    if (line.trim() === '') { i++; continue; }
    let para = '';
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|\s*[-*+]\s|\s*\d+\.\s|\s*>|```)/.test(lines[i])) {
      para += (para ? '<br>' : '') + inline(lines[i]); i++;
    }
    html += `<p>${para}</p>`;
  }
  return html;
}

// ---------- state ----------
const state = {
  view: 'all', query: '', sort: 'created_desc', page: 1, pageSize: 25,
  activeTag: null, items: [], total: 0, counts: {}, prefs: {},
  selected: new Set(), selectAllMatching: false, editingId: null
};

function effectiveQuery() {
  return [state.query.trim(), state.activeTag ? `tag:"${state.activeTag}"` : ''].filter(Boolean).join(' AND ');
}

// ---------- data loading ----------
async function loadList() {
  const params = new URLSearchParams({
    view: state.view, query: effectiveQuery(), sort: state.sort,
    page: state.page, pageSize: state.pageSize
  });
  const data = await api('/api/bookmarks?' + params);
  state.items = data.items; state.total = data.total; state.counts = data.counts;
  renderList(); renderPager(); renderCounts();
  loadTags();
}
async function loadTags() {
  const tags = await api('/api/tags');
  const el = $('#tagList');
  if (!tags.length) { el.innerHTML = '<div class="empty-mini">No tags</div>'; return; }
  el.innerHTML = tags.map((t) => `
    <div class="tag-item ${state.activeTag === t.name ? 'active' : ''}" data-tag="${esc(t.name)}">
      <span>#${esc(t.name)}</span><span class="tcount">${t.count}</span>
    </div>`).join('');
}
async function loadSaved() {
  const rows = await api('/api/saved-searches');
  const el = $('#savedSearches');
  if (!rows.length) { el.innerHTML = '<div class="empty-mini">None yet</div>'; return; }
  el.innerHTML = rows.map((s) => `
    <div class="saved-item" data-saved='${esc(JSON.stringify({ query: s.query, view: s.view, sort: s.sort }))}' title="${esc(s.query || '(empty)')}">
      <span>🔍 ${esc(s.name)}</span>
      <button class="del" data-del-saved="${s.id}" title="Delete">✕</button>
    </div>`).join('');
}
async function loadPrefs() {
  const p = await api('/api/preferences');
  state.prefs = p;
  state.pageSize = parseInt(p.page_size, 10); if (isNaN(state.pageSize)) state.pageSize = 25;
  state.sort = p.default_sort || 'created_desc';
  state.view = p.default_view || 'all';
  document.documentElement.dataset.text = p.text_size || 'medium';
  $('#sortSelect').value = state.sort;
  $('#pDefaultView').value = p.default_view || 'all';
  $('#pDefaultSort').value = p.default_sort || 'created_desc';
  $('#pPageSize').value = String(state.pageSize);
  $('#pTextSize').value = p.text_size || 'medium';
  $$('.view-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
}

// ---------- rendering ----------
function renderCounts() {
  for (const [k, v] of Object.entries(state.counts || {})) {
    const el = $(`.count[data-count="${k}"]`); if (el) el.textContent = v;
  }
}
function faviconHtml(b) {
  if (b.favicon) return `<img src="${esc(b.favicon)}" alt="" onerror="this.style.display='none';this.parentNode.textContent='🔗'">`;
  return '🔗';
}
function renderList() {
  const list = $('#list'), empty = $('#emptyState');
  if (!state.items.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    empty.innerHTML = `<h3>Nothing here</h3><p>${effectiveQuery() ? 'No bookmarks match your search.' : 'Add your first bookmark to get started.'}</p>`;
    updateBulk(); return;
  }
  empty.classList.add('hidden');
  list.innerHTML = state.items.map((b) => {
    const sel = state.selected.has(b.id) || state.selectAllMatching;
    const tags = (b.tags || []).map((t) => `<span class="chip" data-tag="${esc(t)}">#${esc(t)}</span>`).join('');
    const snap = b.has_snapshot ? '<span class="chip badge" title="Local copy saved">💾</span>' : '';
    const arch = b.archive_url ? `<a class="chip" href="${esc(b.archive_url)}" target="_blank" rel="noopener" title="Internet Archive">🏛</a>` : '';
    return `
    <div class="card ${sel ? 'selected' : ''} ${b.unread && !b.archived ? 'is-unread' : ''}" data-id="${b.id}">
      <div class="pick"><input type="checkbox" class="row-pick" ${sel ? 'checked' : ''}></div>
      <div class="fav">${faviconHtml(b)}</div>
      <div class="content">
        <div class="title-row">
          <a class="title" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title || b.url)}</a>
        </div>
        <div class="url">${esc(b.url)}</div>
        ${b.description ? `<div class="desc">${esc(b.description)}</div>` : ''}
        <div class="meta">
          ${tags}${snap}${arch}
          <span class="date">${fmtDate(b.created_at)}</span>
        </div>
      </div>
      <div class="actions">
        <button class="star ${b.favorite ? 'on' : ''}" data-act="favorite" title="Favorite">${b.favorite ? '★' : '☆'}</button>
        <div class="row-actions">
          <button class="icon-btn" data-act="read" title="${b.unread ? 'Mark read' : 'Mark unread'}">${b.unread ? '📖' : '✓'}</button>
          <button class="icon-btn" data-act="archive" title="${b.archived ? 'Unarchive' : 'Archive'}">${b.archived ? '📤' : '🗄'}</button>
          <button class="icon-btn" data-act="edit" title="Edit">✏️</button>
        </div>
      </div>
    </div>`;
  }).join('');
  updateBulk();
}
function renderPager() {
  const pager = $('#pager');
  if (state.pageSize <= 0 || state.total <= state.pageSize) { pager.innerHTML = ''; return; }
  const pages = Math.ceil(state.total / state.pageSize);
  pager.innerHTML = `
    <button class="btn small" ${state.page <= 1 ? 'disabled' : ''} data-page="prev">← Prev</button>
    <span class="pinfo">Page ${state.page} of ${pages} · ${state.total} bookmarks</span>
    <button class="btn small" ${state.page >= pages ? 'disabled' : ''} data-page="next">Next →</button>`;
}
function updateBulk() {
  const n = state.selectAllMatching ? state.total : state.selected.size;
  const bar = $('#bulkBar'), banner = $('#matchAllBanner');
  bar.classList.toggle('hidden', n === 0);
  $('#selCount').textContent = `${n} selected`;
  const pageAllPicked = state.items.length && state.items.every((b) => state.selected.has(b.id));
  $('#selAll').checked = state.selectAllMatching || (pageAllPicked && state.items.length > 0);
  if (state.selectAllMatching) {
    banner.classList.remove('hidden');
    banner.innerHTML = `All <b>${state.total}</b> bookmarks matching this filter are selected. <a data-clear-all>Clear selection</a>`;
  } else if (pageAllPicked && state.pageSize > 0 && state.total > state.items.length) {
    banner.classList.remove('hidden');
    banner.innerHTML = `All ${state.items.length} on this page selected. <a data-select-all-matching>Select all ${state.total} matching this filter</a>`;
  } else {
    banner.classList.add('hidden');
  }
}

// ---------- selection ----------
function clearSelection() { state.selected.clear(); state.selectAllMatching = false; renderList(); }

// ---------- modal: add / edit ----------
function openEdit(bookmark) {
  state.editingId = bookmark ? bookmark.id : null;
  $('#editTitle').textContent = bookmark ? 'Edit bookmark' : 'Add bookmark';
  $('#fUrl').value = bookmark ? bookmark.url : '';
  $('#fTitle').value = bookmark ? bookmark.title : '';
  $('#fDesc').value = bookmark ? bookmark.description : '';
  $('#fTags').value = bookmark ? (bookmark.tags || []).join(', ') : '';
  $('#fNotes').value = bookmark ? bookmark.notes : '';
  $('#fFavorite').checked = bookmark ? bookmark.favorite : false;
  $('#fUnread').checked = bookmark ? bookmark.unread : true;
  $('#fetchNote').textContent = '';
  $('#deleteBtn').classList.toggle('hidden', !bookmark);
  $('#editExtra').classList.toggle('hidden', !bookmark);
  setNoteTab('edit');
  renderSnapLinks(bookmark);
  $('#snapStatus').textContent = '';
  $('#editModal').classList.remove('hidden');
  $('#fUrl').focus();
}
function renderSnapLinks(b) {
  const el = $('#snapLinks');
  if (!b) { el.innerHTML = ''; return; }
  const parts = [];
  if (b.snapshot_html) parts.push(`<a href="/api/bookmarks/${b.id}/snapshot/html" target="_blank" rel="noopener">📄 Local HTML</a>`);
  if (b.snapshot_pdf) parts.push(`<a href="/api/bookmarks/${b.id}/snapshot/pdf" target="_blank" rel="noopener">📕 Local PDF</a>`);
  if (b.archive_url) parts.push(`<a href="${esc(b.archive_url)}" target="_blank" rel="noopener">🏛 Internet Archive</a>`);
  el.innerHTML = parts.join('');
}
function setNoteTab(which) {
  $$('.tab[data-notetab]').forEach((t) => t.classList.toggle('active', t.dataset.notetab === which));
  const editing = which === 'edit';
  $('#fNotes').classList.toggle('hidden', !editing);
  const prev = $('#notesPreview');
  prev.classList.toggle('hidden', editing);
  if (!editing) prev.innerHTML = mdToHtml($('#fNotes').value) || '<p style="color:var(--text-dim)">Nothing to preview</p>';
}
function closeModals() { $$('.modal').forEach((m) => m.classList.add('hidden')); }

async function saveBookmark() {
  const url = $('#fUrl').value.trim();
  if (!url) { toast('URL is required', true); return; }
  const payload = {
    url, title: $('#fTitle').value.trim(), description: $('#fDesc').value,
    notes: $('#fNotes').value,
    tags: $('#fTags').value.split(',').map((s) => s.trim()).filter(Boolean),
    favorite: $('#fFavorite').checked, unread: $('#fUnread').checked
  };
  try {
    if (state.editingId) {
      await api('/api/bookmarks/' + state.editingId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      toast('Saved');
      closeModals();
    } else {
      const res = await api('/api/bookmarks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.duplicate) {
        toast('Already saved — opening the existing bookmark');
        openEdit(res.bookmark); // switch into edit mode on the existing one
        return;
      }
      toast('Bookmark added');
      closeModals();
    }
    await loadList();
  } catch (e) { toast(e.message, true); }
}

async function fetchMeta() {
  const url = $('#fUrl').value.trim();
  if (!url) { toast('Enter a URL first', true); return; }
  const note = $('#fetchNote');
  note.textContent = 'Fetching…';
  try {
    const meta = await api('/api/fetch-metadata', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    if (meta.ok) {
      if (meta.title && !$('#fTitle').value.trim()) $('#fTitle').value = meta.title;
      if (meta.description && !$('#fDesc').value.trim()) $('#fDesc').value = meta.description;
      $('#fetchNote').dataset.favicon = meta.favicon || '';
      note.textContent = 'Details fetched. You can still edit them.';
    } else {
      note.textContent = 'Could not fetch (' + (meta.error || 'unavailable') + ') — enter details manually.';
    }
  } catch (e) { note.textContent = 'Could not fetch — enter details manually.'; }
}

// ---------- per-row quick actions ----------
async function rowAction(id, act) {
  const b = state.items.find((x) => x.id === id); if (!b) return;
  const map = {
    favorite: { favorite: !b.favorite },
    read: { unread: !b.unread },
    archive: { archived: !b.archived }
  };
  await api('/api/bookmarks/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(map[act]) });
  await loadList();
}

// ---------- bulk ----------
async function bulk(action) {
  let tag;
  if (action === 'addTag' || action === 'removeTag') {
    tag = prompt(action === 'addTag' ? 'Tag to add to selected bookmarks:' : 'Tag to remove from selected bookmarks:');
    if (!tag) return;
  }
  if (action === 'delete') {
    const n = state.selectAllMatching ? state.total : state.selected.size;
    if (!confirm(`Permanently delete ${n} bookmark(s)? This cannot be undone.`)) return;
  }
  const body = state.selectAllMatching
    ? { all: true, view: state.view, query: effectiveQuery(), action, tag }
    : { ids: [...state.selected], action, tag };
  const res = await api('/api/bookmarks/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  toast(`${res.affected} bookmark(s) updated`);
  clearSelection();
  await loadList();
}

// ---------- events ----------
function bindEvents() {
  // search
  $('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); state.query = $('#searchInput').value; state.page = 1; loadList(); });
  let sT; $('#searchInput').addEventListener('input', () => { clearTimeout(sT); sT = setTimeout(() => { state.query = $('#searchInput').value; state.page = 1; loadList(); }, 350); });

  // views
  $$('.view-btn').forEach((b) => b.addEventListener('click', () => {
    state.view = b.dataset.view; state.page = 1; state.activeTag = null;
    $$('.view-btn').forEach((x) => x.classList.toggle('active', x === b));
    clearSelection(); loadList();
  }));

  // sort
  $('#sortSelect').addEventListener('change', () => { state.sort = $('#sortSelect').value; state.page = 1; loadList(); });

  // sidebar tags + saved (delegated)
  $('#tagList').addEventListener('click', (e) => {
    const item = e.target.closest('[data-tag]'); if (!item) return;
    const t = item.dataset.tag;
    state.activeTag = state.activeTag === t ? null : t;
    state.page = 1; clearSelection(); loadList();
  });
  $('#savedSearches').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del-saved]');
    if (del) { await api('/api/saved-searches/' + del.dataset.delSaved, { method: 'DELETE' }); loadSaved(); return; }
    const item = e.target.closest('[data-saved]'); if (!item) return;
    const s = JSON.parse(item.dataset.saved);
    state.query = s.query || ''; state.view = s.view || 'all'; state.sort = s.sort || 'created_desc';
    state.activeTag = null; state.page = 1;
    $('#searchInput').value = state.query; $('#sortSelect').value = state.sort;
    $$('.view-btn').forEach((x) => x.classList.toggle('active', x.dataset.view === state.view));
    clearSelection(); loadList();
  });

  // list interactions (delegated)
  $('#list').addEventListener('click', (e) => {
    const card = e.target.closest('.card'); if (!card) return;
    const id = Number(card.dataset.id);
    if (e.target.closest('.row-pick')) {
      if (state.selectAllMatching) state.selectAllMatching = false;
      if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
      renderList(); return;
    }
    const actBtn = e.target.closest('[data-act]');
    if (actBtn) { e.preventDefault(); if (actBtn.dataset.act === 'edit') { const b = state.items.find((x) => x.id === id); openEdit(b); } else rowAction(id, actBtn.dataset.act); return; }
    const chip = e.target.closest('.chip[data-tag]');
    if (chip) { state.activeTag = chip.dataset.tag; state.page = 1; clearSelection(); loadList(); }
  });

  // select all (page)
  $('#selAll').addEventListener('change', (e) => {
    if (e.target.checked) state.items.forEach((b) => state.selected.add(b.id));
    else { state.selected.clear(); state.selectAllMatching = false; }
    renderList();
  });
  $('#matchAllBanner').addEventListener('click', (e) => {
    if (e.target.closest('[data-select-all-matching]')) { state.selectAllMatching = true; renderList(); }
    if (e.target.closest('[data-clear-all]')) clearSelection();
  });
  $('#bulkBar').addEventListener('click', (e) => { const b = e.target.closest('[data-bulk]'); if (b) bulk(b.dataset.bulk); });

  // pager
  $('#pager').addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]'); if (!b) return;
    state.page += b.dataset.page === 'next' ? 1 : -1; loadList();
  });

  // add / modal
  $('#addBtn').addEventListener('click', () => openEdit(null));
  $('#saveBtn').addEventListener('click', saveBookmark);
  $('#fetchMetaBtn').addEventListener('click', fetchMeta);
  $$('[data-close]').forEach((b) => b.addEventListener('click', closeModals));
  $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
  $$('.tab[data-notetab]').forEach((t) => t.addEventListener('click', () => setNoteTab(t.dataset.notetab)));
  $('#deleteBtn').addEventListener('click', async () => {
    if (!state.editingId) return;
    if (!confirm('Permanently delete this bookmark?')) return;
    await api('/api/bookmarks/' + state.editingId, { method: 'DELETE' });
    toast('Deleted'); closeModals(); loadList();
  });

  // snapshot + archive.org
  $('#snapBtn').addEventListener('click', async () => {
    if (!state.editingId) return;
    const s = $('#snapStatus'); s.textContent = 'Saving local copy (this can take a moment)…';
    try {
      const res = await api('/api/bookmarks/' + state.editingId + '/snapshot', { method: 'POST' });
      s.textContent = 'Local copy saved.'; renderSnapLinks(res.bookmark); loadList();
    } catch (e) { s.textContent = e.message; }
  });
  $('#archiveOrgBtn').addEventListener('click', async () => {
    if (!state.editingId) return;
    const s = $('#snapStatus'); s.textContent = 'Submitting to the Internet Archive…';
    try {
      const res = await api('/api/bookmarks/' + state.editingId + '/archive-org', { method: 'POST' });
      s.textContent = 'Saved to the Internet Archive.'; renderSnapLinks(res.bookmark); loadList();
    } catch (e) { s.textContent = e.message; }
  });

  // saved search create
  $('#saveSearchBtn').addEventListener('click', async () => {
    const name = prompt('Name this search:', state.query || state.activeTag || '');
    if (!name) return;
    await api('/api/saved-searches', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, query: effectiveQuery(), view: state.view, sort: state.sort }) });
    toast('Search saved'); loadSaved();
  });

  // help + settings + theme
  $('#searchHelpBtn').addEventListener('click', () => $('#helpModal').classList.remove('hidden'));
  $('#settingsBtn').addEventListener('click', () => $('#settingsModal').classList.remove('hidden'));
  ['pDefaultView', 'pDefaultSort', 'pPageSize', 'pTextSize'].forEach((id) => {
    $('#' + id).addEventListener('change', savePrefs);
  });
  $('#themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme;
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; localStorage.setItem('theme', next);
  });

  // import / export
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    e.target.value = '';
    try {
      const res = await api('/api/import', { method: 'POST', headers: { 'Content-Type': 'text/html' }, body: text });
      toast(`Imported ${res.imported} bookmark(s)${res.skipped ? `, ${res.skipped} duplicate(s) skipped` : ''}`);
      loadList();
    } catch (err) { toast(err.message, true); }
  });
  $('#exportBtn').addEventListener('click', () => { window.location = '/api/export'; });

  // mobile menu
  $('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  // keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModals();
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault(); $('#searchInput').focus();
    }
  });
}

async function savePrefs() {
  const body = {
    default_view: $('#pDefaultView').value, default_sort: $('#pDefaultSort').value,
    page_size: $('#pPageSize').value, text_size: $('#pTextSize').value
  };
  const p = await api('/api/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  state.prefs = p;
  state.pageSize = parseInt(p.page_size, 10); if (isNaN(state.pageSize)) state.pageSize = 25;
  document.documentElement.dataset.text = p.text_size;
  state.page = 1;
  loadList();
}

// ---------- init ----------
async function init() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  bindEvents();
  try {
    await loadPrefs();
    await Promise.all([loadList(), loadSaved()]);
  } catch (e) {
    toast('Failed to load: ' + e.message, true);
  } finally {
    document.getElementById('app').setAttribute('data-harness-ready', 'true');
  }
}
init();
