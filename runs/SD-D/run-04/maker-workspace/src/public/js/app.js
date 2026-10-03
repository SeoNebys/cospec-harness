import { api } from './api.js';

// ---- Application state -----------------------------------------------------
const state = {
  view: 'active', // active | unread | archive
  q: '',
  includedTags: [],
  excludedTags: [],
  savedViewId: null,
  sort: 'added_desc',
  page: 1,
  pageSize: 25,
  selected: new Set(),
  selectAllMatching: false,
  hasItems: false,
  prefs: { default_sort: 'added_desc', items_per_page: 25, text_size: 'medium' },
  editing: null, // bookmark being edited
  editTags: [],
};

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2600);
}

// ---- Query building --------------------------------------------------------
function currentFilterParams() {
  const p = new URLSearchParams();
  if (state.savedViewId) {
    // saved view results endpoint is used separately; for list we pass id
    p.set('saved_view_id', state.savedViewId);
  } else {
    if (state.q) p.set('q', state.q);
    state.includedTags.forEach((t) => p.append('included_tags', t));
    state.excludedTags.forEach((t) => p.append('excluded_tags', t));
    p.set('view', state.view);
  }
  return p;
}

// Selector describing the complete current view for bulk actions (FR-025/025a).
function matchingSelector() {
  if (state.savedViewId) return { matching: { saved_view_id: state.savedViewId } };
  return {
    matching: {
      q: state.q,
      included_tags: state.includedTags,
      excluded_tags: state.excludedTags,
      view: state.view,
    },
  };
}

function currentSelector() {
  if (state.selectAllMatching) return matchingSelector();
  return { ids: [...state.selected] };
}

// ---- Rendering -------------------------------------------------------------
async function load() {
  const params = currentFilterParams();
  params.set('sort', state.sort);
  params.set('page', state.page);
  params.set('page_size', state.pageSize);
  let data;
  try {
    if (state.savedViewId) {
      const p2 = new URLSearchParams();
      p2.set('sort', state.sort);
      p2.set('page', state.page);
      p2.set('page_size', state.pageSize);
      data = await api.viewResults(state.savedViewId, p2);
    } else {
      data = await api.listBookmarks(params);
    }
  } catch (err) {
    if (err.status === 400) {
      renderError(err.message);
      markReady();
      return;
    }
    throw err;
  }
  renderList(data);
  await renderSidebar();
  renderActiveFilters();
  renderBulkBar();
  markReady();
}

function renderError(msg) {
  $('#bookmark-list').innerHTML = '';
  const empty = $('#empty-state');
  empty.classList.remove('hidden');
  empty.textContent = 'Search problem: ' + msg;
  $('#pager').innerHTML = '';
}

function renderList(data) {
  const listEl = $('#bookmark-list');
  listEl.innerHTML = '';
  const empty = $('#empty-state');
  if (data.items.length === 0) {
    empty.classList.remove('hidden');
    empty.textContent = emptyMessage();
  } else {
    empty.classList.add('hidden');
  }
  for (const b of data.items) {
    listEl.appendChild(renderBookmark(b));
  }
  state.hasItems = data.items.length > 0;
  renderPager(data);
}

function emptyMessage() {
  if (state.q || state.includedTags.length || state.excludedTags.length || state.savedViewId) {
    return 'No bookmarks match your search or filters.';
  }
  if (state.view === 'unread') return 'Nothing left to read — your unread list is empty.';
  if (state.view === 'archive') return 'Your archive is empty.';
  return 'No bookmarks yet. Paste a link above to save your first one.';
}

function renderBookmark(b) {
  const li = el('li', 'bookmark');
  li.dataset.id = b.id;
  if (state.selected.has(b.id) || state.selectAllMatching) li.classList.add('selected');

  const sel = el('input', 'sel');
  sel.type = 'checkbox';
  sel.checked = state.selected.has(b.id) || state.selectAllMatching;
  sel.addEventListener('change', () => {
    state.selectAllMatching = false;
    if (sel.checked) state.selected.add(b.id);
    else state.selected.delete(b.id);
    li.classList.toggle('selected', sel.checked);
    renderBulkBar();
  });
  li.appendChild(sel);

  if (b.icon_url) {
    const icon = el('img', 'favicon');
    icon.src = b.icon_url;
    icon.alt = '';
    icon.addEventListener('error', () => icon.remove());
    li.appendChild(icon);
  } else {
    li.appendChild(el('span', 'favicon'));
  }

  const body = el('div', 'body');
  const title = el('a', 'title', b.title || b.url);
  title.href = b.url;
  title.target = '_blank';
  title.rel = 'noopener';
  body.appendChild(title);
  body.appendChild(el('div', 'url', b.url));
  if (b.description) body.appendChild(el('div', 'desc', b.description));

  const meta = el('div', 'meta');
  if (!b.is_read) meta.appendChild(el('span', 'badge unread', 'Unread'));
  if (b.is_archived) meta.appendChild(el('span', 'badge archived', 'Archived'));
  for (const t of b.tags) {
    const tag = el('span', 'tag', t);
    tag.addEventListener('click', () => filterByTag(t));
    meta.appendChild(tag);
  }
  body.appendChild(meta);
  li.appendChild(body);

  if (b.preview_image_url) {
    const img = el('img', 'preview');
    img.src = b.preview_image_url;
    img.alt = '';
    img.addEventListener('error', () => img.remove());
    li.appendChild(img);
  }

  const actions = el('div', 'actions');
  const editBtn = el('button', '', 'Edit');
  editBtn.addEventListener('click', () => openEditor(b.id));
  actions.appendChild(editBtn);

  const readBtn = el('button', '', b.is_read ? 'Mark unread' : 'Mark read');
  readBtn.addEventListener('click', async () => {
    await api.updateBookmark(b.id, { is_read: !b.is_read });
    load();
  });
  actions.appendChild(readBtn);

  const archBtn = el('button', '', b.is_archived ? 'Restore' : 'Archive');
  archBtn.addEventListener('click', async () => {
    await api.updateBookmark(b.id, { is_archived: !b.is_archived });
    toast(b.is_archived ? 'Restored' : 'Archived');
    load();
  });
  actions.appendChild(archBtn);

  li.appendChild(actions);
  return li;
}

function renderPager(data) {
  const pager = $('#pager');
  pager.innerHTML = '';
  const pages = Math.max(1, Math.ceil(data.total / data.page_size));
  if (pages <= 1) return;
  const prev = el('button', '', '‹ Prev');
  prev.disabled = data.page <= 1;
  prev.addEventListener('click', () => { state.page--; load(); });
  const next = el('button', '', 'Next ›');
  next.disabled = data.page >= pages;
  next.addEventListener('click', () => { state.page++; load(); });
  pager.appendChild(prev);
  pager.appendChild(el('span', '', `Page ${data.page} of ${pages} · ${data.total} items`));
  pager.appendChild(next);
}

async function renderSidebar() {
  // Saved views
  const views = await api.listViews();
  const vlist = $('#saved-views');
  vlist.innerHTML = '';
  for (const v of views.views) {
    const li = el('li');
    const btn = el('button', '', v.name);
    btn.addEventListener('click', () => openSavedView(v.id));
    const del = el('button', '', '✕');
    del.title = 'Delete view';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      await api.deleteView(v.id);
      if (state.savedViewId === v.id) clearFilters();
      renderSidebar();
    });
    li.appendChild(btn);
    li.appendChild(del);
    vlist.appendChild(li);
  }
  const saveBtn = el('button', 'link-btn', '+ Save current search');
  saveBtn.addEventListener('click', saveCurrentView);
  vlist.appendChild(saveBtn);

  // Tags
  const tags = await api.listTags();
  const cloud = $('#tag-cloud');
  cloud.innerHTML = '';
  for (const t of tags.tags) {
    const li = el('li');
    const span = el('span', 'tag', `${t.name} (${t.count})`);
    span.addEventListener('click', () => filterByTag(t.name));
    li.appendChild(span);
    cloud.appendChild(li);
  }
}

function renderActiveFilters() {
  const box = $('#active-filters');
  box.innerHTML = '';
  const add = (label, onRemove) => {
    const chip = el('span', 'chip');
    chip.appendChild(el('span', '', label));
    const x = el('button', '', '✕');
    x.addEventListener('click', onRemove);
    chip.appendChild(x);
    box.appendChild(chip);
  };
  if (state.savedViewId) {
    add('Saved view', () => clearFilters());
    return;
  }
  state.includedTags.forEach((t) =>
    add('#' + t, () => { state.includedTags = state.includedTags.filter((x) => x !== t); state.page = 1; load(); })
  );
  state.excludedTags.forEach((t) =>
    add('-#' + t, () => { state.excludedTags = state.excludedTags.filter((x) => x !== t); state.page = 1; load(); })
  );
}

function renderBulkBar() {
  const bar = $('#bulk-bar');
  // The bar (and its "select all matching" control) is available whenever there
  // are items to act on, or an active selection exists.
  const show = state.hasItems || state.selectAllMatching || state.selected.size > 0;
  bar.classList.toggle('hidden', !show);
  $('#select-all-matching').checked = state.selectAllMatching;
  $('#bulk-count').textContent = state.selectAllMatching
    ? 'All matching selected'
    : `${state.selected.size} selected`;
}

// ---- Filters / navigation --------------------------------------------------
function filterByTag(tag) {
  state.savedViewId = null;
  if (!state.includedTags.includes(tag)) state.includedTags.push(tag);
  state.page = 1;
  clearSelection();
  load();
}

function clearFilters() {
  state.q = '';
  state.includedTags = [];
  state.excludedTags = [];
  state.savedViewId = null;
  state.page = 1;
  $('#search-box').value = '';
  clearSelection();
  load();
}

function openSavedView(id) {
  state.savedViewId = id;
  state.q = '';
  state.includedTags = [];
  state.excludedTags = [];
  state.page = 1;
  $('#search-box').value = '';
  clearSelection();
  load();
}

async function saveCurrentView() {
  const name = prompt('Name this view:');
  if (!name) return;
  await api.createView({
    name,
    query: state.q,
    included_tags: state.includedTags,
    excluded_tags: state.excludedTags,
  });
  toast('View saved');
  renderSidebar();
}

function clearSelection() {
  state.selected.clear();
  state.selectAllMatching = false;
  renderBulkBar();
}

// ---- Bulk actions ----------------------------------------------------------
async function runBulk(action) {
  const selector = currentSelector();
  if (action.delete) {
    const { affected } = await api.bulkCount(selector);
    if (!confirm(`Delete ${affected} bookmark(s)? This cannot be undone.`)) return;
    action.confirm = true;
  }
  const { affected } = await api.bulk(selector, action);
  toast(`Updated ${affected} bookmark(s)`);
  clearSelection();
  load();
}

// ---- Editor ----------------------------------------------------------------
async function openEditor(id) {
  const { bookmark } = await api.getBookmark(id);
  state.editing = bookmark;
  state.editTags = [...bookmark.tags];
  $('#editor-banner').classList.add('hidden');
  $('#edit-url').value = bookmark.url;
  $('#edit-title').value = bookmark.title;
  $('#edit-description').value = bookmark.description;
  $('#edit-note').innerHTML = bookmark.note_html || '';
  $('#edit-tags').value = '';
  renderEditTagChips();
  renderPreservedList(bookmark);
  $('#preserve-status').textContent = '';
  $('#editor-modal').classList.remove('hidden');
}

function renderEditTagChips() {
  const box = $('#edit-tag-chips');
  box.innerHTML = '';
  state.editTags.forEach((t) => {
    const chip = el('span', 'chip');
    chip.appendChild(el('span', '', t));
    const x = el('button', '', '✕');
    x.addEventListener('click', () => {
      state.editTags = state.editTags.filter((y) => y !== t);
      renderEditTagChips();
    });
    chip.appendChild(x);
    box.appendChild(chip);
  });
}

function renderPreservedList(bookmark) {
  const box = $('#preserved-list');
  box.innerHTML = '';
  for (const p of bookmark.preserved || []) {
    const link = el('a', '', `Preserved (${p.kind}) — ${new Date(p.captured_at).toLocaleString()}`);
    link.href = `/api/bookmarks/${bookmark.id}/preserved/${p.id}`;
    link.target = '_blank';
    box.appendChild(link);
  }
}

async function saveEditor() {
  const id = state.editing.id;
  const patch = {
    url: $('#edit-url').value.trim(),
    title: $('#edit-title').value,
    description: $('#edit-description').value,
    note_html: $('#edit-note').innerHTML,
    tags: state.editTags,
  };
  try {
    await api.updateBookmark(id, patch);
    $('#editor-modal').classList.add('hidden');
    toast('Saved');
    load();
  } catch (err) {
    if (err.status === 409) {
      const banner = $('#editor-banner');
      banner.classList.remove('hidden');
      banner.textContent = 'Another bookmark already uses this address.';
    } else if (err.status === 400) {
      const banner = $('#editor-banner');
      banner.classList.remove('hidden');
      banner.textContent = err.message;
    } else {
      throw err;
    }
  }
}

// ---- Tag input with suggestions -------------------------------------------
function setupTagInput() {
  const input = $('#edit-tags');
  const sugg = $('#tag-suggestions');
  let active = -1;
  let items = [];

  const hide = () => { sugg.classList.add('hidden'); active = -1; };
  const commit = (val) => {
    const t = (val || input.value).trim();
    if (t && !state.editTags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      state.editTags.push(t);
      renderEditTagChips();
    }
    input.value = '';
    hide();
  };

  input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (!q) return hide();
    const { tags } = await api.suggestTags(q);
    items = tags.filter((t) => !state.editTags.includes(t));
    sugg.innerHTML = '';
    items.forEach((t, i) => {
      const li = el('li', '', t);
      li.addEventListener('mousedown', (e) => { e.preventDefault(); commit(t); });
      sugg.appendChild(li);
    });
    sugg.classList.toggle('hidden', items.length === 0);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (active >= 0 && items[active]) commit(items[active]); else commit(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); highlight(); }
    else if (e.key === 'Escape') hide();
  });
  function highlight() {
    [...sugg.children].forEach((li, i) => li.classList.toggle('active', i === active));
  }
  input.addEventListener('blur', () => setTimeout(hide, 150));
}

// ---- Note editor toolbar ---------------------------------------------------
function setupNoteEditor() {
  document.querySelectorAll('.note-toolbar button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      const arg = btn.dataset.arg;
      if (cmd === 'createLink') {
        const url = prompt('Link URL:');
        if (url) document.execCommand('createLink', false, url);
      } else {
        document.execCommand(cmd, false, arg || null);
      }
      $('#edit-note').focus();
    });
  });
}

// ---- Preservation ----------------------------------------------------------
function setupPreserve() {
  $('#preserve-local').addEventListener('click', () => doPreserve('local'));
  $('#preserve-archive').addEventListener('click', () => doPreserve('archive_org'));
}
async function doPreserve(mode) {
  const status = $('#preserve-status');
  status.textContent = 'Preserving…';
  try {
    await api.preserve(state.editing.id, mode);
    const { bookmark } = await api.getBookmark(state.editing.id);
    state.editing = bookmark;
    renderPreservedList(bookmark);
    status.textContent = 'Preserved.';
  } catch (err) {
    status.textContent = 'Could not preserve: ' + err.message;
  }
}

// ---- Settings --------------------------------------------------------------
async function openSettings() {
  const p = await api.getPreferences();
  $('#pref-sort').value = p.default_sort;
  $('#pref-per-page').value = p.items_per_page;
  $('#pref-text-size').value = p.text_size;
  $('#settings-modal').classList.remove('hidden');
}
async function saveSettings() {
  const p = await api.updatePreferences({
    default_sort: $('#pref-sort').value,
    items_per_page: parseInt($('#pref-per-page').value, 10),
    text_size: $('#pref-text-size').value,
  });
  applyPrefs(p);
  $('#settings-modal').classList.add('hidden');
  toast('Preferences saved');
  load();
}
function applyPrefs(p) {
  state.prefs = p;
  state.sort = p.default_sort;
  state.pageSize = p.items_per_page;
  $('#sort-select').value = p.default_sort;
  document.documentElement.dataset.textSize = p.text_size;
}

// ---- Import / export -------------------------------------------------------
function setupImport() {
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const html = await file.text();
    const summary = await api.importFile(html);
    toast(`Imported: ${summary.added} added, ${summary.merged} merged, ${summary.skipped} skipped`);
    e.target.value = '';
    load();
  });
}

// ---- Wiring ----------------------------------------------------------------
function markReady() {
  const app = document.querySelector('.layout');
  if (app) app.setAttribute('data-harness-ready', 'true');
}

function setup() {
  // Add form
  $('#add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = $('#add-url').value.trim();
    if (!url) return;
    try {
      await api.createBookmark({ url });
      $('#add-url').value = '';
      toast('Saved');
      load();
    } catch (err) {
      if (err.status === 409 && err.data && err.data.bookmark) {
        $('#add-url').value = '';
        toast(err.data.archived ? 'Already bookmarked (archived) — opening' : 'Already bookmarked — opening');
        openEditor(err.data.bookmark.id);
      } else if (err.status === 400) {
        toast(err.message);
      } else {
        throw err;
      }
    }
  });

  // View nav
  document.querySelectorAll('.view-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-link').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.view = btn.dataset.view;
      state.savedViewId = null;
      state.page = 1;
      clearSelection();
      load();
    });
  });

  // Search box (debounced)
  let searchTimer;
  $('#search-box').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = e.target.value;
      state.savedViewId = null;
      state.page = 1;
      clearSelection();
      load();
    }, 250);
  });

  // Sort
  $('#sort-select').addEventListener('change', (e) => {
    state.sort = e.target.value;
    state.page = 1;
    load();
  });

  // Bulk bar
  $('#select-all-matching').addEventListener('change', (e) => {
    state.selectAllMatching = e.target.checked;
    if (e.target.checked) state.selected.clear();
    renderBulkBar();
    load();
  });
  $('#bulk-bar').addEventListener('click', (e) => {
    const kind = e.target.dataset.bulk;
    if (!kind) return;
    if (kind === 'addTag') {
      const t = $('#bulk-tag').value.trim();
      if (t) runBulk({ addTags: [t] });
    } else if (kind === 'read') runBulk({ is_read: true });
    else if (kind === 'unread') runBulk({ is_read: false });
    else if (kind === 'archive') runBulk({ is_archived: true });
    else if (kind === 'restore') runBulk({ is_archived: false });
    else if (kind === 'delete') runBulk({ delete: true });
  });

  // Editor modal
  $('#editor-cancel').addEventListener('click', () => $('#editor-modal').classList.add('hidden'));
  $('#editor-save').addEventListener('click', saveEditor);
  $('#editor-delete').addEventListener('click', async () => {
    if (!confirm('Delete this bookmark?')) return;
    await api.deleteBookmark(state.editing.id);
    $('#editor-modal').classList.add('hidden');
    toast('Deleted');
    load();
  });

  // Settings modal
  $('#settings-btn').addEventListener('click', openSettings);
  $('#settings-cancel').addEventListener('click', () => $('#settings-modal').classList.add('hidden'));
  $('#settings-save').addEventListener('click', saveSettings);

  setupTagInput();
  setupNoteEditor();
  setupPreserve();
  setupImport();
}

async function init() {
  setup();
  try {
    const prefs = await api.getPreferences();
    applyPrefs(prefs);
  } catch { /* use defaults */ }
  await load();
}

init();
