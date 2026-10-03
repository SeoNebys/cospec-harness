'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const api = async (url, opts = {}) => {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new Error((data && data.error) || res.statusText);
  return data;
};

const state = {
  view: 'all',
  sort: 'created_desc',
  q: '',
  bookmarks: [],
  selected: new Set(),
  editingId: null,
  prefs: {}
};

// ---- toast ----------------------------------------------------------------
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

// ---- rendering ------------------------------------------------------------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function fmtDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderList() {
  const list = $('#list');
  const empty = $('#empty');
  $('#resultCount').textContent =
    state.bookmarks.length + (state.bookmarks.length === 1 ? ' bookmark' : ' bookmarks');

  if (state.bookmarks.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    empty.innerHTML = state.q
      ? `No bookmarks match <strong>${esc(state.q)}</strong>.`
      : 'No bookmarks here yet. Click <strong>+ Add bookmark</strong> to get started.';
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = state.bookmarks.map((b) => {
    const sel = state.selected.has(b.id) ? ' sel' : '';
    const thumb = b.preview_image
      ? `<img class="thumb" src="${esc(b.preview_image)}" alt="" onerror="this.style.display='none'">`
      : '';
    const fav = b.icon
      ? `<img class="favicon" src="${esc(b.icon)}" alt="" onerror="this.style.display='none'">`
      : '';
    const badges = [];
    if (b.read_later) badges.push('<span class="badge later">Read later</span>');
    if (b.archived) badges.push('<span class="badge arch">Archived</span>');
    if (b.snapshot_count) badges.push(`<span class="badge snap">⧉ ${b.snapshot_count}</span>`);
    const tags = (b.tags || [])
      .map((t) => `<span class="tag" data-tag="${esc(t)}">${esc(t)}</span>`)
      .join('');
    return `
      <div class="card${sel}" data-id="${b.id}">
        <label class="pick"><input type="checkbox" class="rowpick" ${state.selected.has(b.id) ? 'checked' : ''}></label>
        ${thumb}
        <div class="body">
          <div class="row1">
            ${fav}
            <a class="title" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title || b.url)}</a>
            <span class="domain">· ${esc(b.domain)}</span>
          </div>
          ${b.description ? `<div class="desc">${esc(b.description)}</div>` : ''}
          <div class="meta">
            ${badges.join('')}
            <div class="tags">${tags}</div>
            <span class="domain">${fmtDate(b.created_at)}</span>
          </div>
        </div>
        <div class="actions">
          <button class="icon-btn" data-act="later" title="Toggle read later">◷</button>
          <button class="icon-btn" data-act="archive" title="Toggle archive">▤</button>
          <button class="icon-btn" data-act="edit" title="Edit">✎</button>
        </div>
      </div>`;
  }).join('');
}

// ---- data loading ---------------------------------------------------------
async function loadBookmarks() {
  const params = new URLSearchParams({ view: state.view, sort: state.sort, q: state.q });
  try {
    const data = await api('/api/bookmarks?' + params.toString());
    state.bookmarks = data.bookmarks;
    // prune selection to visible items
    const visible = new Set(data.bookmarks.map((b) => b.id));
    for (const id of [...state.selected]) if (!visible.has(id)) state.selected.delete(id);
    renderList();
    updateBulkBar();
  } catch (e) {
    toast(e.message);
  }
}

async function loadStats() {
  const s = await api('/api/stats');
  $('[data-count="all"]').textContent = s.all;
  $('[data-count="read_later"]').textContent = s.read_later;
  $('[data-count="archived"]').textContent = s.archived;
  $('#tagCloud').innerHTML = s.tags.length
    ? s.tags.map((t) => `<span class="tag-chip" data-tag="${esc(t.name)}">${esc(t.name)}<span class="n">${t.c}</span></span>`).join('')
    : '<span class="hint">No tags yet</span>';
}

async function loadSaved() {
  const { saved } = await api('/api/saved-searches');
  $('#savedSearches').innerHTML = saved.length
    ? saved.map((s) => `
        <div class="saved-item" data-id="${s.id}" data-q="${esc(s.query)}" data-view="${esc(s.view)}" data-sort="${esc(s.sort)}">
          <span class="s-name">🔍 ${esc(s.name)}</span>
          <span class="del icon-btn" data-del="${s.id}" title="Delete">✕</span>
        </div>`).join('')
    : '<span class="hint">None saved</span>';
}

// ---- selection / bulk -----------------------------------------------------
function updateBulkBar() {
  const bar = $('#bulkBar');
  const n = state.selected.size;
  $('#selCount').textContent = n;
  bar.classList.toggle('hidden', n === 0);
  const allVisible = state.bookmarks.length > 0 && state.bookmarks.every((b) => state.selected.has(b.id));
  $('#selectAll').checked = allVisible;
}

async function bulk(action) {
  const ids = [...state.selected];
  if (ids.length === 0) return;
  let value;
  if (action === 'add_tags') {
    const input = prompt('Add tags (comma separated):');
    if (input == null) return;
    value = input.split(',').map((s) => s.trim()).filter(Boolean);
    if (value.length === 0) return;
  }
  if (action === 'delete' && !confirm(`Delete ${ids.length} bookmark(s)? This cannot be undone.`)) return;
  await api('/api/bookmarks/bulk', {
    method: 'POST',
    body: JSON.stringify({ ids, action, value })
  });
  toast(`${ids.length} bookmark(s) updated`);
  if (action === 'delete') state.selected.clear();
  await refresh();
}

// ---- editor modal ---------------------------------------------------------
function openEditor(bookmark) {
  state.editingId = bookmark ? bookmark.id : null;
  $('#editTitle').textContent = bookmark ? 'Edit bookmark' : 'Add bookmark';
  $('#f_url').value = bookmark ? bookmark.url : '';
  $('#f_title').value = bookmark ? bookmark.title : '';
  $('#f_description').value = bookmark ? bookmark.description : '';
  $('#f_notes').value = bookmark ? bookmark.notes : '';
  $('#f_tags').value = bookmark ? (bookmark.tags || []).join(', ') : '';
  $('#f_icon').value = bookmark ? bookmark.icon : '';
  $('#f_preview_image').value = bookmark ? bookmark.preview_image : '';
  $('#f_read_later').checked = bookmark ? !!bookmark.read_later : false;
  $('#f_archived').checked = bookmark ? !!bookmark.archived : false;
  $('#dupNote').classList.add('hidden');
  $('#deleteBtn').classList.toggle('hidden', !bookmark);
  updatePreviewThumb();

  const snapSection = $('#snapSection');
  if (bookmark) { snapSection.classList.remove('hidden'); loadSnapshots(bookmark.id); }
  else { snapSection.classList.add('hidden'); $('#snapList').innerHTML = ''; }

  $('#editModal').classList.remove('hidden');
  if (!bookmark) $('#f_url').focus();
}

function updatePreviewThumb() {
  const img = $('#f_preview_img');
  const url = $('#f_preview_image').value.trim();
  if (url) { img.src = url; img.classList.remove('hidden'); }
  else img.classList.add('hidden');
}

function closeModals() {
  $$('.modal').forEach((m) => m.classList.add('hidden'));
  state.editingId = null;
}

function editorPayload() {
  return {
    url: $('#f_url').value.trim(),
    title: $('#f_title').value,
    description: $('#f_description').value,
    notes: $('#f_notes').value,
    icon: $('#f_icon').value.trim(),
    preview_image: $('#f_preview_image').value.trim(),
    read_later: $('#f_read_later').checked,
    archived: $('#f_archived').checked,
    tags: $('#f_tags').value.split(',').map((s) => s.trim()).filter(Boolean)
  };
}

async function fetchMeta() {
  const url = $('#f_url').value.trim();
  if (!url) { toast('Enter a URL first'); return; }
  const btn = $('#fetchMetaBtn');
  btn.textContent = '…'; btn.disabled = true;
  try {
    const meta = await api('/api/fetch-metadata', { method: 'POST', body: JSON.stringify({ url }) });
    if (meta.existing && meta.existing.id !== state.editingId) {
      // Duplicate URL: switch to editing the existing bookmark.
      toast('Already saved — opening existing bookmark');
      openEditor(meta.existing);
      return;
    }
    if (!$('#f_title').value) $('#f_title').value = meta.title || '';
    if (!$('#f_description').value) $('#f_description').value = meta.description || '';
    if (!$('#f_icon').value) $('#f_icon').value = meta.icon || '';
    if (!$('#f_preview_image').value) $('#f_preview_image').value = meta.preview_image || '';
    updatePreviewThumb();
    if (meta.error) toast('Fetched with limits: ' + meta.error);
    else toast('Metadata fetched');
  } catch (e) {
    toast(e.message);
  } finally {
    btn.textContent = 'Fetch'; btn.disabled = false;
  }
}

async function saveBookmark() {
  const payload = editorPayload();
  if (!payload.url) { toast('URL is required'); return; }
  try {
    if (state.editingId) {
      await api('/api/bookmarks/' + state.editingId, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Saved');
      closeModals();
    } else {
      const res = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify(payload) });
      if (res.duplicate) {
        toast('Already saved — opening existing bookmark');
        openEditor(res.bookmark);
        return;
      }
      toast('Bookmark added');
      closeModals();
    }
    await refresh();
  } catch (e) {
    toast(e.message);
  }
}

async function deleteBookmark() {
  if (!state.editingId) return;
  if (!confirm('Delete this bookmark? This cannot be undone.')) return;
  await api('/api/bookmarks/' + state.editingId, { method: 'DELETE' });
  toast('Deleted');
  closeModals();
  await refresh();
}

// New-bookmark flow: check for duplicate as soon as URL is entered.
async function checkDuplicateOnAdd() {
  if (state.editingId) return;
  const url = $('#f_url').value.trim();
  if (!url) return;
  try {
    const meta = await api('/api/fetch-metadata', { method: 'POST', body: JSON.stringify({ url }) });
    const note = $('#dupNote');
    if (meta.existing) {
      note.textContent = 'This URL is already saved — opening it for editing.';
      note.className = 'hint dup';
      note.classList.remove('hidden');
      setTimeout(() => openEditor(meta.existing), 400);
    }
  } catch { /* ignore */ }
}

// ---- snapshots ------------------------------------------------------------
async function loadSnapshots(id) {
  const { snapshots } = await api(`/api/bookmarks/${id}/snapshots`);
  $('#snapList').innerHTML = snapshots.length
    ? snapshots.map((s) => `
        <div class="snap-item" data-img="/snapshots/${esc(s.image_file)}" data-html="/snapshots/${esc(s.html_file)}" data-title="${esc(s.title)}">
          <img src="/snapshots/${esc(s.image_file)}" alt="snapshot" loading="lazy">
          <div class="cap"><span>${fmtDate(s.created_at)}</span><span class="del" data-delsnap="${s.id}" title="Delete">✕</span></div>
        </div>`).join('')
    : '<span class="hint">No snapshots yet. Capture one to archive the page as it looks today.</span>';
}

async function captureSnapshot() {
  if (!state.editingId) return;
  const btn = $('#snapBtn');
  btn.textContent = 'Capturing…'; btn.disabled = true;
  try {
    await api(`/api/bookmarks/${state.editingId}/snapshots`, { method: 'POST', body: '{}' });
    toast('Snapshot captured');
    await loadSnapshots(state.editingId);
    loadBookmarks();
  } catch (e) {
    toast(e.message);
  } finally {
    btn.textContent = 'Capture snapshot'; btn.disabled = false;
  }
}

// ---- preferences ----------------------------------------------------------
function applyPrefs(p) {
  state.prefs = p;
  document.documentElement.setAttribute('data-font', p.font_size || 'medium');
}

async function loadPrefs() {
  const p = await api('/api/preferences');
  applyPrefs(p);
  state.sort = p.default_sort || 'created_desc';
  state.view = p.default_view || 'all';
  $('#sort').value = state.sort;
  $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === state.view));
}

function openPrefs() {
  $('#p_sort').value = state.prefs.default_sort || 'created_desc';
  $('#p_view').value = state.prefs.default_view || 'all';
  $('#p_font').value = state.prefs.font_size || 'medium';
  $('#prefsModal').classList.remove('hidden');
}

async function savePrefs() {
  const p = await api('/api/preferences', {
    method: 'PUT',
    body: JSON.stringify({
      default_sort: $('#p_sort').value,
      default_view: $('#p_view').value,
      font_size: $('#p_font').value
    })
  });
  applyPrefs(p);
  toast('Preferences saved');
  closeModals();
}

// ---- saved searches -------------------------------------------------------
async function saveCurrentSearch() {
  const name = prompt('Name this saved search:', state.q || 'My search');
  if (!name) return;
  await api('/api/saved-searches', {
    method: 'POST',
    body: JSON.stringify({ name, query: state.q, view: state.view, sort: state.sort })
  });
  toast('Search saved');
  loadSaved();
}

// ---- import / export ------------------------------------------------------
async function doImport(file) {
  const text = await file.text();
  const isJson = file.name.toLowerCase().endsWith('.json') || text.trimStart().startsWith('{') || text.trimStart().startsWith('[');
  const result = await api('/api/import', {
    method: 'POST',
    body: JSON.stringify({ data: text, format: isJson ? 'json' : 'html' })
  });
  $('#importResult').textContent = `Imported ${result.imported}, skipped ${result.skipped} duplicate(s).`;
  toast(`Imported ${result.imported} bookmark(s)`);
  await refresh();
}

// ---- refresh --------------------------------------------------------------
async function refresh() {
  await Promise.all([loadBookmarks(), loadStats(), loadSaved()]);
}

// ---- events ---------------------------------------------------------------
function bindEvents() {
  // views
  $$('.nav-item').forEach((n) => n.addEventListener('click', () => {
    state.view = n.dataset.view;
    $$('.nav-item').forEach((x) => x.classList.toggle('active', x === n));
    loadBookmarks();
  }));

  // search (debounced)
  let searchTimer;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = e.target.value.trim(); loadBookmarks(); }, 250);
  });
  $('#searchHelp').addEventListener('click', () => $('#searchHelpBox').classList.toggle('hidden'));

  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; loadBookmarks(); });

  // add
  $('#addBtn').addEventListener('click', () => openEditor(null));

  // list interactions (delegated)
  $('#list').addEventListener('click', async (e) => {
    const tag = e.target.closest('.tag');
    if (tag) { setSearch(`tag:${quoteIfNeeded(tag.dataset.tag)}`); return; }
    const card = e.target.closest('.card');
    if (!card) return;
    const id = Number(card.dataset.id);
    const bm = state.bookmarks.find((b) => b.id === id);
    const pick = e.target.closest('.rowpick');
    if (pick) {
      if (pick.checked) state.selected.add(id); else state.selected.delete(id);
      card.classList.toggle('sel', pick.checked);
      updateBulkBar();
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act && bm) {
      const a = act.dataset.act;
      if (a === 'edit') openEditor(bm);
      else if (a === 'later') {
        await api('/api/bookmarks/' + id, { method: 'PUT', body: JSON.stringify({ read_later: !bm.read_later }) });
        await refresh();
      } else if (a === 'archive') {
        await api('/api/bookmarks/' + id, { method: 'PUT', body: JSON.stringify({ archived: !bm.archived }) });
        await refresh();
      }
    }
  });

  // select all
  $('#selectAll').addEventListener('change', (e) => {
    if (e.target.checked) state.bookmarks.forEach((b) => state.selected.add(b.id));
    else state.selected.clear();
    renderList(); updateBulkBar();
  });
  $('#selClear').addEventListener('click', () => { state.selected.clear(); renderList(); updateBulkBar(); });

  // bulk bar
  $$('#bulkBar [data-bulk]').forEach((b) => b.addEventListener('click', () => bulk(b.dataset.bulk)));

  // tag cloud + saved searches (delegated on sidebar)
  $('#tagCloud').addEventListener('click', (e) => {
    const chip = e.target.closest('.tag-chip');
    if (chip) setSearch(`tag:${quoteIfNeeded(chip.dataset.tag)}`);
  });
  $('#savedSearches').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      await api('/api/saved-searches/' + del.dataset.del, { method: 'DELETE' });
      loadSaved();
      return;
    }
    const item = e.target.closest('.saved-item');
    if (item) {
      state.q = item.dataset.q;
      state.view = item.dataset.view;
      state.sort = item.dataset.sort;
      $('#search').value = state.q;
      $('#sort').value = state.sort;
      $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === state.view));
      loadBookmarks();
    }
  });
  $('#saveSearchBtn').addEventListener('click', saveCurrentSearch);

  // editor
  $('#fetchMetaBtn').addEventListener('click', fetchMeta);
  $('#saveBtn').addEventListener('click', saveBookmark);
  $('#deleteBtn').addEventListener('click', deleteBookmark);
  $('#f_preview_image').addEventListener('input', updatePreviewThumb);
  $('#f_url').addEventListener('blur', checkDuplicateOnAdd);
  $('#snapBtn').addEventListener('click', captureSnapshot);
  $('#snapList').addEventListener('click', async (e) => {
    const del = e.target.closest('[data-delsnap]');
    if (del) {
      e.stopPropagation();
      await api('/api/snapshots/' + del.dataset.delsnap, { method: 'DELETE' });
      if (state.editingId) loadSnapshots(state.editingId);
      loadBookmarks();
      return;
    }
    const item = e.target.closest('.snap-item');
    if (item) openSnapViewer(item.dataset.img, item.dataset.html, item.dataset.title);
  });

  // preferences / io
  $('#prefsBtn').addEventListener('click', openPrefs);
  $('#savePrefsBtn').addEventListener('click', savePrefs);
  $('#ioBtn').addEventListener('click', () => { $('#importResult').textContent = ''; $('#ioModal').classList.remove('hidden'); });
  $('#importFile').addEventListener('change', (e) => { if (e.target.files[0]) doImport(e.target.files[0]); });

  // modal close
  $$('[data-close]').forEach((b) => b.addEventListener('click', closeModals));
  $$('.modal').forEach((m) => m.addEventListener('mousedown', (e) => { if (e.target === m) closeModals(); }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModals();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !$('#editModal').classList.contains('hidden')) saveBookmark();
  });
}

function openSnapViewer(img, html, title) {
  $('#snapViewerTitle').textContent = title || 'Snapshot';
  $('#snapViewerImg').src = img;
  $('#snapViewerHtml').href = html;
  $('#snapViewer').classList.remove('hidden');
}

function setSearch(q) {
  state.q = q;
  $('#search').value = q;
  loadBookmarks();
}
function quoteIfNeeded(s) {
  return /\s/.test(s) ? `"${s}"` : s;
}

// ---- init -----------------------------------------------------------------
async function init() {
  bindEvents();
  try {
    await loadPrefs();
    await refresh();
  } catch (e) {
    toast('Failed to load: ' + e.message);
  } finally {
    $('#app').setAttribute('data-harness-ready', 'true');
  }
}
init();
