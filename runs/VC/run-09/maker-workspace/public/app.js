'use strict';

const state = {
  scope: 'active',
  q: '',
  sort: 'created_desc',
  include: new Set(),
  exclude: new Set(),
  activeView: null,
  selection: new Set(),
  bookmarks: [],
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    ...opts,
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 2600);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function hostOf(url) {
  try { return new URL(url).host; } catch { return url; }
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/* --------------------------------------------------------------- loading */

async function refresh() {
  await Promise.all([loadBookmarks(), loadTags()]);
}

async function loadBookmarks() {
  const p = new URLSearchParams();
  p.set('scope', state.scope);
  p.set('sort', state.sort);
  if (state.q.trim()) p.set('q', state.q.trim());
  state.include.forEach((t) => p.append('include', t));
  state.exclude.forEach((t) => p.append('exclude', t));
  try {
    const data = await api('/api/bookmarks?' + p.toString());
    state.bookmarks = data.bookmarks || [];
    // Drop selections that are no longer visible.
    const visible = new Set(state.bookmarks.map((b) => b.id));
    state.selection.forEach((id) => { if (!visible.has(id)) state.selection.delete(id); });
    renderList(data.error);
    renderBulk();
  } catch (err) {
    toast(err.message);
  }
}

async function loadTags() {
  const tags = await api('/api/tags');
  const ul = $('#tags-list');
  ul.innerHTML = '';
  if (!tags.length) {
    ul.innerHTML = '<li class="hint" style="cursor:default">No tags yet</li>';
  }
  for (const t of tags) {
    const li = document.createElement('li');
    const state3 = state.include.has(t.name) ? 'include' : state.exclude.has(t.name) ? 'exclude' : '';
    if (state3) li.className = state3;
    const mark = state3 === 'include' ? '＋' : state3 === 'exclude' ? '−' : '';
    li.innerHTML = `<span><span class="tag-state">${mark}</span>${escapeHtml(t.name)}</span><span class="tag-count">${t.count}</span>`;
    li.onclick = () => cycleTag(t.name);
    ul.appendChild(li);
  }
}

async function loadViews() {
  const views = await api('/api/views');
  const ul = $('#views-list');
  ul.innerHTML = '';
  if (!views.length) ul.innerHTML = '<li class="hint" style="cursor:default">None saved</li>';
  for (const v of views) {
    const li = document.createElement('li');
    if (state.activeView === v.id) li.classList.add('active');
    li.innerHTML = `<span>${escapeHtml(v.name)}</span><span class="view-del" title="Delete view">✕</span>`;
    li.querySelector('span').onclick = () => applyView(v);
    li.onclick = (e) => { if (!e.target.classList.contains('view-del')) applyView(v); };
    li.querySelector('.view-del').onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete saved view "${v.name}"?`)) return;
      await api('/api/views/' + v.id, { method: 'DELETE' });
      if (state.activeView === v.id) state.activeView = null;
      loadViews();
    };
    ul.appendChild(li);
  }
}

/* -------------------------------------------------------------- filtering */

function cycleTag(name) {
  if (state.include.has(name)) { state.include.delete(name); state.exclude.add(name); }
  else if (state.exclude.has(name)) { state.exclude.delete(name); }
  else { state.include.add(name); }
  state.activeView = null;
  loadTags(); loadViews(); renderActiveFilters(); loadBookmarks();
}

function renderActiveFilters() {
  const box = $('#active-filters');
  const chips = [];
  state.include.forEach((t) =>
    chips.push(`<span class="filter-chip">#${escapeHtml(t)} <button data-inc="${escapeHtml(t)}">✕</button></span>`)
  );
  state.exclude.forEach((t) =>
    chips.push(`<span class="filter-chip exclude">−#${escapeHtml(t)} <button data-exc="${escapeHtml(t)}">✕</button></span>`)
  );
  if (!chips.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = chips.join('') + '<button class="link-btn" id="clear-filters">Clear all</button>';
  box.querySelectorAll('[data-inc]').forEach((b) => (b.onclick = () => { state.include.delete(b.dataset.inc); afterFilterChange(); }));
  box.querySelectorAll('[data-exc]').forEach((b) => (b.onclick = () => { state.exclude.delete(b.dataset.exc); afterFilterChange(); }));
  $('#clear-filters').onclick = () => { state.include.clear(); state.exclude.clear(); afterFilterChange(); };
}

function afterFilterChange() {
  state.activeView = null;
  loadTags(); loadViews(); renderActiveFilters(); loadBookmarks();
}

function applyView(v) {
  state.activeView = v.id;
  state.q = v.query || '';
  state.scope = v.scope || 'active';
  state.sort = v.sort || 'created_desc';
  state.include = new Set(v.include_tags || []);
  state.exclude = new Set(v.exclude_tags || []);
  $('#search').value = state.q;
  $('#sort').value = state.sort;
  syncScopeButtons();
  loadTags(); loadViews(); renderActiveFilters(); loadBookmarks();
}

function syncScopeButtons() {
  $$('.scope').forEach((b) => b.classList.toggle('active', b.dataset.scope === state.scope));
}

/* ----------------------------------------------------------------- render */

function renderList(error) {
  const list = $('#list');
  const empty = $('#empty');
  list.innerHTML = '';
  if (error) {
    empty.hidden = false;
    empty.innerHTML = `<h3>Search error</h3><p>${escapeHtml(error)}</p>`;
    return;
  }
  if (!state.bookmarks.length) {
    empty.hidden = false;
    empty.innerHTML = `<h3>Nothing here</h3><p>No bookmarks match the current filters.</p>`;
    return;
  }
  empty.hidden = true;
  for (const b of state.bookmarks) list.appendChild(renderCard(b));
}

function renderCard(b) {
  const el = document.createElement('div');
  el.className = 'card' + (state.selection.has(b.id) ? ' selected' : '') + (b.archived ? ' archived' : '');

  const thumb = b.preview_image
    ? `<img class="card-thumb" src="${escapeHtml(b.preview_image)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'card-thumb placeholder',textContent:'🔗'}))" />`
    : `<div class="card-thumb placeholder">🔗</div>`;

  const favicon = b.favicon
    ? `<img class="card-favicon" src="${escapeHtml(b.favicon)}" alt="" onerror="this.style.display='none'" />`
    : '';

  const tags = b.tags.map((t) => `<span class="chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('');

  const badges =
    (b.read_later ? '<span class="badge read">Read later</span>' : '') +
    (b.snapshot_url ? '<span class="badge snap">Snapshot</span>' : '');

  el.innerHTML = `
    <input type="checkbox" class="card-check" ${state.selection.has(b.id) ? 'checked' : ''} />
    ${thumb}
    <div class="card-body">
      <div class="card-title">${favicon}<a href="${escapeHtml(b.url)}" target="_blank" rel="noopener">${escapeHtml(b.title || b.url)}</a></div>
      <div class="card-url">${escapeHtml(hostOf(b.url))}</div>
      ${b.description ? `<p class="card-desc">${escapeHtml(b.description)}</p>` : ''}
      <div class="card-tags">${tags}</div>
      <div class="card-meta">${badges}<span>Added ${fmtDate(b.created_at)}</span></div>
    </div>
    <div class="card-actions">
      <div class="row">
        <button class="icon-btn ${b.favorite ? 'on-fav' : ''}" data-act="favorite" title="Favorite">${b.favorite ? '★' : '☆'}</button>
        <button class="icon-btn ${b.read_later ? 'on-read' : ''}" data-act="read_later" title="Read later">${b.read_later ? '📖' : '📕'}</button>
      </div>
      <div class="row">
        ${b.snapshot_url ? `<a class="icon-btn" href="${escapeHtml(b.snapshot_url)}" target="_blank" title="View snapshot">🗎</a>` : ''}
        <button class="icon-btn" data-act="edit" title="Edit">✎</button>
        <button class="icon-btn" data-act="archive" title="${b.archived ? 'Unarchive' : 'Archive'}">${b.archived ? '📤' : '📥'}</button>
        <button class="icon-btn" data-act="delete" title="Delete">🗑</button>
      </div>
    </div>`;

  el.querySelector('.card-check').onchange = (e) => {
    if (e.target.checked) state.selection.add(b.id); else state.selection.delete(b.id);
    el.classList.toggle('selected', e.target.checked);
    renderBulk();
  };
  el.querySelectorAll('[data-tag]').forEach((c) => (c.onclick = () => {
    if (!state.include.has(c.dataset.tag) && !state.exclude.has(c.dataset.tag)) {
      state.include.add(c.dataset.tag);
      afterFilterChange();
    }
  }));
  el.querySelectorAll('[data-act]').forEach((btn) => (btn.onclick = () => cardAction(btn.dataset.act, b)));
  return el;
}

async function cardAction(act, b) {
  try {
    if (act === 'edit') return openModal(b);
    if (act === 'delete') {
      if (!confirm('Delete this bookmark?')) return;
      await api('/api/bookmarks/' + b.id, { method: 'DELETE' });
      toast('Deleted'); return refresh();
    }
    if (act === 'favorite') await api('/api/bookmarks/' + b.id, { method: 'PATCH', body: JSON.stringify({ favorite: !b.favorite }) });
    if (act === 'read_later') await api('/api/bookmarks/' + b.id, { method: 'PATCH', body: JSON.stringify({ read_later: !b.read_later }) });
    if (act === 'archive') {
      await api('/api/bookmarks/' + b.id, { method: 'PATCH', body: JSON.stringify({ archived: !b.archived }) });
      toast(b.archived ? 'Unarchived' : 'Archived');
    }
    refresh();
  } catch (err) { toast(err.message); }
}

/* --------------------------------------------------------------- bulk bar */

function renderBulk() {
  const n = state.selection.size;
  $('#bulk-actions').hidden = n === 0;
  $('#select-count').textContent = n === 0 ? 'Select all' : `${n} selected`;
  const visibleIds = state.bookmarks.map((b) => b.id);
  const all = visibleIds.length > 0 && visibleIds.every((id) => state.selection.has(id));
  $('#select-all').checked = all;
}

async function bulk(action) {
  const ids = [...state.selection];
  if (!ids.length) return;
  try {
    let body = { ids, action };
    if (action === 'favorite') body.value = true;
    else if (action === 'read_later') body.value = true;
    else if (action === 'archived') { body.value = true; }
    else if (action === 'unarchive') { body.action = 'archived'; body.value = false; }
    else if (action === 'delete') { if (!confirm(`Delete ${ids.length} bookmark(s)?`)) return; }
    else if (action === 'add_tags' || action === 'remove_tags') {
      const input = prompt(`${action === 'add_tags' ? 'Add' : 'Remove'} tags (comma separated):`);
      if (!input) return;
      body.tags = input.split(',').map((t) => t.trim()).filter(Boolean);
    }
    const r = await api('/api/bookmarks/bulk', { method: 'POST', body: JSON.stringify(body) });
    toast(`Updated ${r.count} bookmark(s)`);
    if (action === 'delete') state.selection.clear();
    refresh();
  } catch (err) { toast(err.message); }
}

/* ----------------------------------------------------------------- modal */

function openModal(b) {
  const isEdit = !!b;
  $('#modal-title').textContent = isEdit ? 'Edit bookmark' : 'Add bookmark';
  $('#f-id').value = isEdit ? b.id : '';
  $('#f-url').value = isEdit ? b.url : '';
  $('#f-title').value = isEdit ? b.title : '';
  $('#f-description').value = isEdit ? b.description : '';
  $('#f-notes').value = isEdit ? b.notes : '';
  $('#f-tags').value = isEdit ? b.tags.join(', ') : '';
  $('#f-favorite').checked = isEdit ? b.favorite : false;
  $('#f-read_later').checked = isEdit ? b.read_later : false;
  $('#f-archived').checked = isEdit ? b.archived : false;
  $('#f-favicon').value = isEdit ? b.favicon : '';
  $('#f-preview_image').value = isEdit ? b.preview_image : '';
  $('#f-delete').hidden = !isEdit;
  $('#dup-note').hidden = true;
  $('#f-status').textContent = '';
  updatePreview();
  updateSnapshotRow(isEdit ? b.snapshot_url : '');
  $('#modal').hidden = false;
  $('#f-url').focus();
}

function closeModal() { $('#modal').hidden = true; }

function updatePreview() {
  const url = $('#f-preview_image').value.trim();
  $('#f-preview').hidden = !url;
  if (url) $('#f-preview-img').src = url;
}

function updateSnapshotRow(snapUrl) {
  const row = $('#f-snapshot-row');
  row.hidden = !snapUrl;
  if (snapUrl) $('#f-snapshot-link').href = snapUrl;
}

function currentFormPayload() {
  return {
    url: $('#f-url').value,
    title: $('#f-title').value,
    description: $('#f-description').value,
    notes: $('#f-notes').value,
    tags: $('#f-tags').value.split(',').map((t) => t.trim()).filter(Boolean),
    favorite: $('#f-favorite').checked,
    read_later: $('#f-read_later').checked,
    archived: $('#f-archived').checked,
    favicon: $('#f-favicon').value,
    preview_image: $('#f-preview_image').value,
  };
}

async function submitForm(e) {
  e.preventDefault();
  const id = $('#f-id').value;
  const payload = currentFormPayload();
  const save = $('#f-save');
  save.disabled = true;
  try {
    if (id) {
      await api('/api/bookmarks/' + id, { method: 'PATCH', body: JSON.stringify(payload) });
      toast('Saved');
      closeModal();
      refresh();
    } else {
      $('#f-status').textContent = 'Saving' + (payload.title ? '' : ' and fetching metadata') + '…';
      const r = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ ...payload, snapshot: true }) });
      if (r.duplicate) {
        // Duplicate URL -> switch to editing the existing bookmark.
        openModal(r.bookmark);
        $('#dup-note').hidden = false;
        $('#dup-note').textContent = 'This URL is already bookmarked — editing the existing one.';
        return;
      }
      toast(r.fetch_error ? 'Added (metadata: ' + r.fetch_error + ')' : 'Added');
      closeModal();
      refresh();
    }
  } catch (err) {
    $('#f-status').textContent = err.message;
    toast(err.message);
  } finally {
    save.disabled = false;
  }
}

async function fetchMetadataForForm() {
  const url = $('#f-url').value.trim();
  if (!url) return toast('Enter a URL first');
  const id = $('#f-id').value;
  $('#f-status').textContent = 'Fetching…';
  try {
    let meta;
    if (id) {
      meta = await api('/api/bookmarks/' + id + '/metadata', { method: 'POST' });
    } else {
      // For a new bookmark, create a throwaway fetch via a temporary POST is
      // overkill; reuse the same endpoint after a peek is not possible, so we
      // ask the server through a lightweight metadata-only call.
      meta = await api('/api/peek?url=' + encodeURIComponent(url));
    }
    if (meta.title && !$('#f-title').value) $('#f-title').value = meta.title;
    if (meta.description && !$('#f-description').value) $('#f-description').value = meta.description;
    if (meta.favicon && !$('#f-favicon').value) $('#f-favicon').value = meta.favicon;
    if (meta.preview_image && !$('#f-preview_image').value) $('#f-preview_image').value = meta.preview_image;
    updatePreview();
    $('#f-status').textContent = meta.error ? 'Metadata: ' + meta.error : 'Metadata filled into empty fields';
  } catch (err) {
    $('#f-status').textContent = err.message;
  }
}

async function saveSnapshotForForm() {
  const id = $('#f-id').value;
  if (!id) return toast('Save the bookmark first, then snapshot');
  $('#f-status').textContent = 'Saving snapshot…';
  try {
    const r = await api('/api/bookmarks/' + id + '/snapshot', { method: 'POST' });
    updateSnapshotRow(r.snapshot_url);
    $('#f-status').textContent = 'Snapshot saved';
    toast('Snapshot saved');
  } catch (err) {
    $('#f-status').textContent = err.message;
  }
}

async function deleteFromForm() {
  const id = $('#f-id').value;
  if (!id || !confirm('Delete this bookmark?')) return;
  await api('/api/bookmarks/' + id, { method: 'DELETE' });
  toast('Deleted');
  closeModal();
  refresh();
}

/* ------------------------------------------------------------ save a view */

async function saveCurrentView() {
  const name = prompt('Name this view:');
  if (!name || !name.trim()) return;
  await api('/api/views', {
    method: 'POST',
    body: JSON.stringify({
      name: name.trim(),
      query: state.q,
      scope: state.scope,
      sort: state.sort,
      include_tags: [...state.include],
      exclude_tags: [...state.exclude],
    }),
  });
  toast('View saved');
  loadViews();
}

/* --------------------------------------------------------------- imports */

async function doImport(file) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = await api('/api/import', { method: 'POST', body: fd });
    toast(`Imported ${r.imported}, skipped ${r.skipped} of ${r.total}`);
    refresh();
    loadViews();
  } catch (err) { toast(err.message); }
}

/* ------------------------------------------------------------------- wire */

function init() {
  $('#add-btn').onclick = () => openModal(null);
  $('#modal-close').onclick = closeModal;
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

  $('#bookmark-form').onsubmit = submitForm;
  $('#f-fetch').onclick = fetchMetadataForForm;
  $('#f-snapshot').onclick = saveSnapshotForForm;
  $('#f-delete').onclick = deleteFromForm;
  $('#f-preview_image').oninput = updatePreview;

  let searchTimer;
  $('#search').oninput = (e) => {
    state.q = e.target.value;
    state.activeView = null;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { loadViews(); loadBookmarks(); }, 250);
  };

  $('#sort').onchange = (e) => { state.sort = e.target.value; state.activeView = null; loadViews(); loadBookmarks(); };

  $$('.scope').forEach((b) => (b.onclick = () => {
    state.scope = b.dataset.scope;
    state.activeView = null;
    syncScopeButtons(); loadViews(); loadBookmarks();
  }));

  $('#save-view-btn').onclick = saveCurrentView;

  $('#select-all').onchange = (e) => {
    if (e.target.checked) state.bookmarks.forEach((b) => state.selection.add(b.id));
    else state.selection.clear();
    renderList(); renderBulk();
  };
  $('#clear-select').onclick = () => { state.selection.clear(); renderList(); renderBulk(); };
  $$('[data-bulk]').forEach((b) => (b.onclick = () => bulk(b.dataset.bulk)));

  $('#export-btn').onclick = () => (window.location = '/api/export');
  $('#import-btn').onclick = () => $('#import-file').click();
  $('#import-file').onchange = (e) => { if (e.target.files[0]) doImport(e.target.files[0]); e.target.value = ''; };

  syncScopeButtons();
  loadViews();
  refresh().then(() => document.body.setAttribute('data-harness-ready', 'true'));
}

document.addEventListener('DOMContentLoaded', init);
