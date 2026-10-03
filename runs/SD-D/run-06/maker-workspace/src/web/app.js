import { attachTagAutocomplete } from '/search.js';

// ---------- state ----------
const state = {
  mode: 'browse',       // 'browse' | 'search' | 'savedview'
  view: 'all',          // for browse: all | unread | archive
  tag: null,            // for browse: tag filter
  query: '',            // for search
  viewId: null,         // for savedview
  sort: 'newest',
  prefs: { defaultSort: 'newest', itemsPerView: 25, textSize: 'medium' },
  selection: new Set(),
  selectAllMatching: false, // true = act on the entire filter/search, beyond the page
  items: [],
  total: 0,                 // total matching the current filter/search (all pages)
};

// The server-side selector describing the entire current filter/search/saved view
// (FR-022 "select all matching"). Used for bulk actions beyond the visible page.
function currentSelector() {
  if (state.mode === 'search') return { matchQuery: state.query, matchView: 'all' };
  if (state.mode === 'savedview') return { matchViewId: state.viewId };
  const sel = { matchView: state.view };
  if (state.tag) sel.matchIncludedTags = [state.tag];
  return sel;
}

function clearSelection() {
  state.selection.clear();
  state.selectAllMatching = false;
}

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of [].concat(children)) node.append(c);
  return node;
};

async function api(method, url, body, isForm = false) {
  const opts = { method };
  if (body !== undefined) {
    if (isForm) opts.body = body;
    else { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: res.ok, status: res.status, data };
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 3200);
}

const parseTags = (str) => (str || '').split(',').map((s) => s.trim()).filter(Boolean);

// ---------- data loading ----------
async function refresh() {
  let url;
  const q = new URLSearchParams({ sort: state.sort, pageSize: String(state.prefs.itemsPerView) });
  if (state.mode === 'search') {
    q.set('q', state.query);
    url = `/api/search?${q}`;
  } else if (state.mode === 'savedview') {
    url = `/api/views/${state.viewId}/results?sort=${state.sort}`;
  } else {
    q.set('view', state.view);
    if (state.tag) q.set('tag', state.tag);
    url = `/api/bookmarks?${q}`;
  }
  const { ok, data } = await api('GET', url);
  if (!ok) { renderList([], 'Something went wrong.'); return; }
  state.items = data.items;
  state.total = data.total;
  state.selectAllMatching = false; // a new result set invalidates a prior "all matching"
  renderList(data.items, null, data.total);
  updateBulkBar();
}

async function loadSidebar() {
  const [tagsRes, viewsRes] = await Promise.all([
    api('GET', '/api/tags'),
    api('GET', '/api/views'),
  ]);
  renderTags(tagsRes.data?.tags || []);
  renderSavedViews(viewsRes.data?.views || []);
}

// ---------- rendering ----------
function renderTags(tags) {
  const ul = $('#tag-list');
  ul.innerHTML = '';
  if (!tags.length) { ul.append(el('li', { className: 'tag-count', textContent: 'No tags yet' })); return; }
  for (const t of tags) {
    const btn = el('button', { textContent: t.name });
    if (state.mode === 'browse' && state.tag === t.name) btn.classList.add('active');
    btn.append(el('span', { className: 'tag-count', textContent: ` ${t.count}` }));
    btn.addEventListener('click', () => {
      state.mode = 'browse';
      state.tag = state.tag === t.name ? null : t.name;
      state.view = state.view === 'archive' ? 'all' : state.view;
      clearSelection();
      setActiveNav();
      loadSidebar();
      refresh();
    });
    ul.append(el('li', {}, btn));
  }
}

function renderSavedViews(views) {
  const ul = $('#saved-views');
  ul.innerHTML = '';
  if (!views.length) { ul.append(el('li', { className: 'tag-count', textContent: 'None saved' })); return; }
  for (const v of views) {
    const open = el('button', { className: 'view-open', textContent: v.name });
    open.addEventListener('click', () => { state.mode = 'savedview'; state.viewId = v.id; clearSelection(); setActiveNav(); refresh(); });
    const del = el('button', { className: 'view-del', textContent: '✕', title: 'Delete view' });
    del.addEventListener('click', async () => { await api('DELETE', `/api/views/${v.id}`); loadSidebar(); });
    ul.append(el('li', {}, [open, del]));
  }
}

function renderList(items, error, total) {
  const list = $('#list');
  const empty = $('#empty');
  list.innerHTML = '';
  $('#select-all').checked = false;

  const summary = $('#result-summary');
  if (error) { summary.textContent = ''; }
  else if (state.mode === 'search') summary.textContent = `${total} result${total === 1 ? '' : 's'} for “${state.query}”`;
  else summary.textContent = `${total ?? items.length} bookmark${(total ?? items.length) === 1 ? '' : 's'}`;

  if (error) { empty.hidden = false; empty.textContent = error; return; }
  if (!items.length) {
    empty.hidden = false;
    empty.textContent = state.mode === 'search'
      ? 'No bookmarks match your search.'
      : state.view === 'archive'
        ? 'The archive is empty.'
        : state.view === 'unread'
          ? 'Nothing left to read — inbox zero!'
          : state.tag
            ? `No bookmarks tagged “${state.tag}”.`
            : 'No bookmarks yet. Paste a URL above to save your first one.';
    return;
  }
  empty.hidden = true;
  for (const b of items) list.append(renderCard(b));
}

function statusLabel(label, status) {
  const cls = status === 'ready' ? 'ok' : status === 'failed' ? 'fail' : status === 'pending' ? 'pending' : '';
  return el('span', {}, [`${label}: `, el('span', { className: cls, textContent: status })]);
}

function renderCard(b) {
  const sel = el('input', { type: 'checkbox', className: 'sel-box', checked: state.selection.has(b.id) });
  sel.addEventListener('change', () => {
    if (sel.checked) state.selection.add(b.id); else state.selection.delete(b.id);
    updateBulkBar();
    card.classList.toggle('selected', sel.checked);
  });

  const title = el('a', { className: 'title', href: b.url, target: '_blank', rel: 'noopener', textContent: b.title });
  const titleRow = el('div', { className: 'title-row' }, title);
  if (!b.isRead && !b.isArchived) titleRow.append(el('span', { className: 'badge unread', textContent: 'unread' }));
  if (b.isArchived) titleRow.append(el('span', { className: 'badge', textContent: 'archived' }));

  const main = el('div', { className: 'main' }, titleRow);
  if (b.description) main.append(el('div', { className: 'desc', textContent: b.description }));
  main.append(el('div', { className: 'url', textContent: b.url }));

  if (b.tags.length) {
    const tags = el('div', { className: 'tags' });
    for (const t of b.tags) tags.append(el('span', { className: 'tag', textContent: '#' + t }));
    main.append(tags);
  }

  if (b.notesHtml) {
    const notes = el('div', { className: 'notes' });
    notes.innerHTML = b.notesHtml;
    main.append(notes);
  }

  // status line
  const status = el('div', { className: 'status' }, [
    statusLabel('metadata', b.metadataStatus), ' · ',
    statusLabel('local copy', b.preserved.status), ' · ',
    statusLabel('archive.org', b.archiveOrg.status),
  ]);
  main.append(status);

  // actions
  const actions = el('div', { className: 'actions' });
  const act = (label, fn, cls) => { const bn = el('button', { textContent: label }); if (cls) bn.className = cls; bn.addEventListener('click', fn); actions.append(bn); return bn; };

  act(b.isRead ? 'Mark unread' : 'Mark read', async () => {
    await api('POST', `/api/bookmarks/${b.id}/read`, { isRead: !b.isRead }); refresh();
  });
  act('Edit', () => openEditModal(b));
  if (b.isArchived) act('Restore', async () => { await api('POST', `/api/bookmarks/${b.id}/archive`, { archived: false }); refresh(); });
  else act('Archive', async () => { await api('POST', `/api/bookmarks/${b.id}/archive`, { archived: true }); refresh(); });
  if (b.preserved.status === 'ready') act('Local copy', () => window.open(b.preserved.href, '_blank'));
  else act('Preserve', async () => { await api('POST', `/api/bookmarks/${b.id}/preserve/local`); toast('Preserving local copy…'); pollStatus(b.id); });
  if (b.archiveOrg.status === 'ready') act('archive.org', () => window.open(b.archiveOrg.url, '_blank'));
  else act('Send to archive.org', async () => { await api('POST', `/api/bookmarks/${b.id}/preserve/archive-org`); toast('Submitting to Internet Archive…'); pollStatus(b.id); });
  act('Delete', () => confirmDelete(b), 'danger');

  main.append(actions);

  const card = el('div', { className: 'card' + (state.selection.has(b.id) ? ' selected' : '') });
  card.append(el('div', { className: 'sel' }, sel));
  if (b.iconUrl) card.append(el('img', { className: 'icon', src: b.iconUrl, alt: '', loading: 'lazy', onerror() { this.style.visibility = 'hidden'; } }));
  else card.append(el('div', { className: 'icon' }));
  card.append(main);
  if (b.previewImageUrl) card.append(el('img', { className: 'preview', src: b.previewImageUrl, alt: '', loading: 'lazy', onerror() { this.remove(); } }));
  return card;
}

// Poll async metadata/preservation status a few times, then refresh.
function pollStatus(id, tries = 0) {
  if (tries > 15) { refresh(); return; }
  setTimeout(async () => {
    const { ok, data } = await api('GET', `/api/bookmarks/${id}/preserve/status`);
    const done = ok && data.preserved.status !== 'pending' && data.archiveOrg.status !== 'pending' && data.metadataStatus !== 'pending';
    if (done) refresh(); else pollStatus(id, tries + 1);
  }, 2000);
}

// ---------- bulk ----------
function selectedCount() {
  return state.selectAllMatching ? state.total : state.selection.size;
}

function updateBulkBar() {
  const bar = $('#bulk-bar');
  const active = state.selectAllMatching || state.selection.size > 0;
  bar.hidden = !active;

  $('#bulk-count').textContent = state.selectAllMatching
    ? `All ${state.total} matching selected`
    : `${state.selection.size} selected`;

  // Escalation control: offered when only the visible page is selected but more
  // results match the current filter/search beyond this page (FR-022).
  let esc = $('#bulk-escalate');
  const canEscalate = !state.selectAllMatching && state.selection.size > 0 && state.total > state.items.length;
  if (canEscalate) {
    if (!esc) {
      esc = el('button', { id: 'bulk-escalate', type: 'button', className: 'link-btn', style: 'width:auto;color:var(--accent)' });
      esc.addEventListener('click', () => { state.selectAllMatching = true; updateBulkBar(); });
      $('#bulk-count').after(esc);
    }
    esc.textContent = `Select all ${state.total} matching`;
    esc.hidden = false;
  } else if (esc) {
    esc.hidden = true;
  }
}

async function runBulk(action) {
  const useMatching = state.selectAllMatching;
  const ids = [...state.selection];
  if (!useMatching && !ids.length) return;

  const body = { action, selection: useMatching ? currentSelector() : { ids } };
  if (action === 'addTags' || action === 'removeTags') {
    body.tags = parseTags($('#bulk-tags').value);
    if (!body.tags.length) { toast('Enter tags first.'); return; }
  }
  if (action === 'delete') {
    if (!confirm(`Permanently delete ${selectedCount()} bookmark(s)? This cannot be undone.`)) return;
    body.confirm = true;
  }
  const { ok, data } = await api('POST', '/api/bookmarks/bulk', body);
  if (ok) { toast(`Applied to ${data.affected} bookmark(s).`); clearSelection(); loadSidebar(); refresh(); }
}

// ---------- modals ----------
function closeModal() { $('#modal-root').innerHTML = ''; }
function modal(title, contentNodes, footerNodes) {
  const box = el('div', { className: 'modal' }, [el('h2', { textContent: title }), ...contentNodes, el('div', { className: 'row' }, footerNodes)]);
  const backdrop = el('div', { className: 'modal-backdrop' }, box);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) closeModal(); });
  $('#modal-root').append(backdrop);
  return box;
}

function openEditModal(b) {
  const url = el('input', { type: 'text', value: b.url });
  const title = el('input', { type: 'text', value: b.title });
  const desc = el('textarea', { rows: 2, value: b.description || '' });
  const tags = el('input', { type: 'text', value: b.tags.join(', ') });
  const suggest = el('div', { className: 'tag-suggest', hidden: true });
  const notes = el('textarea', { rows: 4, value: b.notesMarkdown || '' });
  const save = el('button', { textContent: 'Save' });
  save.style.cssText = 'background:var(--accent);color:#fff;border-color:var(--accent)';
  save.addEventListener('click', async () => {
    const { ok, status, data } = await api('PATCH', `/api/bookmarks/${b.id}`, {
      url: url.value, title: title.value, description: desc.value,
      tags: parseTags(tags.value), notesMarkdown: notes.value,
    });
    if (ok) { closeModal(); loadSidebar(); refresh(); toast('Saved.'); }
    else if (status === 409) toast('Another bookmark already has that address.');
    else if (status === 400) toast(data?.error?.message || 'Invalid address.');
    else toast('Could not save.');
  });
  modal('Edit bookmark',
    [el('label', { textContent: 'Address' }), url,
     el('label', { textContent: 'Title' }), title,
     el('label', { textContent: 'Description' }), desc,
     el('label', { textContent: 'Tags (comma-separated)' }), tags, suggest,
     el('label', { textContent: 'Notes (Markdown)' }), notes],
    [el('button', { textContent: 'Cancel', onclick: closeModal }), save]);
  attachTagAutocomplete(tags, suggest);
}

function confirmDelete(b) {
  const del = el('button', { textContent: 'Delete permanently', className: 'danger' });
  del.addEventListener('click', async () => {
    await api('DELETE', `/api/bookmarks/${b.id}?confirm=true`);
    closeModal(); loadSidebar(); refresh(); toast('Deleted.');
  });
  modal('Delete bookmark',
    [el('p', { textContent: `Permanently delete “${b.title}”? Consider archiving instead — that is reversible.` })],
    [el('button', { textContent: 'Cancel', onclick: closeModal }), del]);
}

function openSaveViewModal() {
  const name = el('input', { type: 'text', placeholder: 'View name' });
  const inc = el('input', { type: 'text', placeholder: 'included tags (comma-separated)' });
  const exc = el('input', { type: 'text', placeholder: 'excluded tags (comma-separated)' });
  const searchText = state.mode === 'search' ? state.query : '';
  const st = el('input', { type: 'text', value: searchText, placeholder: 'search text (optional)' });
  if (state.mode === 'browse' && state.tag) inc.value = state.tag;
  const save = el('button', { textContent: 'Save view' });
  save.style.cssText = 'background:var(--accent);color:#fff;border-color:var(--accent)';
  save.addEventListener('click', async () => {
    if (!name.value.trim()) { toast('Name is required.'); return; }
    const { ok } = await api('POST', '/api/views', {
      name: name.value.trim(), searchText: st.value,
      includedTags: parseTags(inc.value), excludedTags: parseTags(exc.value),
    });
    if (ok) { closeModal(); loadSidebar(); toast('View saved.'); }
  });
  modal('Save current view',
    [el('label', { textContent: 'Name' }), name,
     el('label', { textContent: 'Search text' }), st,
     el('label', { textContent: 'Included tags' }), inc,
     el('label', { textContent: 'Excluded tags' }), exc],
    [el('button', { textContent: 'Cancel', onclick: closeModal }), save]);
}

async function openPrefsModal() {
  const { data } = await api('GET', '/api/preferences');
  const sort = el('select', {}, ['newest', 'oldest', 'title', 'recently_modified'].map((v) => el('option', { value: v, textContent: v, selected: v === data.defaultSort })));
  const items = el('input', { type: 'number', min: '1', max: '500', value: String(data.itemsPerView) });
  const size = el('select', {}, ['small', 'medium', 'large'].map((v) => el('option', { value: v, textContent: v, selected: v === data.textSize })));
  const save = el('button', { textContent: 'Save' });
  save.style.cssText = 'background:var(--accent);color:#fff;border-color:var(--accent)';
  save.addEventListener('click', async () => {
    const { ok, data: p } = await api('PUT', '/api/preferences', {
      defaultSort: sort.value, itemsPerView: Number(items.value), textSize: size.value,
    });
    if (ok) { applyPrefs(p); closeModal(); refresh(); toast('Preferences saved.'); }
  });
  modal('Display preferences',
    [el('label', { textContent: 'Default sort' }), sort,
     el('label', { textContent: 'Items per view' }), items,
     el('label', { textContent: 'Text size' }), size],
    [el('button', { textContent: 'Cancel', onclick: closeModal }), save]);
}

function applyPrefs(p) {
  state.prefs = p;
  document.documentElement.setAttribute('data-text-size', p.textSize);
  // Only adopt the default sort when the user has not overridden it this session.
  if (!state._sortTouched) { state.sort = p.defaultSort; $('#sort-select').value = p.defaultSort; }
}

// ---------- wiring ----------
function setActiveNav() {
  document.querySelectorAll('.nav').forEach((n) => n.classList.toggle('active', state.mode === 'browse' && !state.tag && n.dataset.view === state.view));
}

function wire() {
  $('#add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = $('#add-url').value.trim();
    const title = $('#add-title').value.trim();
    if (!url) return;
    const { ok, status, data } = await api('POST', '/api/bookmarks', { url, title: title || undefined });
    if (status === 400) { toast(data?.error?.message || 'Invalid address.'); return; }
    if (!ok) { toast('Could not save.'); return; }
    $('#add-url').value = ''; $('#add-title').value = '';
    if (data.duplicate) { toast('Already bookmarked — opening it to edit.'); openEditModal(data.bookmark); }
    else { toast('Saved. Fetching details…'); pollStatus(data.bookmark.id); }
    loadSidebar(); refresh();
  });

  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#search-input').value.trim();
    if (!q) { state.mode = 'browse'; } else { state.mode = 'search'; state.query = q; }
    state.tag = null; clearSelection(); setActiveNav(); refresh();
  });
  $('#search-clear').addEventListener('click', () => {
    $('#search-input').value = ''; state.mode = 'browse'; state.query = ''; clearSelection(); setActiveNav(); refresh();
  });

  document.querySelectorAll('.nav').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.mode = 'browse'; state.view = btn.dataset.view; state.tag = null;
      clearSelection(); setActiveNav(); loadSidebar(); refresh();
    });
  });

  $('#sort-select').addEventListener('change', (e) => { state.sort = e.target.value; state._sortTouched = true; refresh(); });

  $('#select-all').addEventListener('change', (e) => {
    const checked = e.target.checked;
    state.selectAllMatching = false;
    if (checked) state.items.forEach((b) => state.selection.add(b.id));
    else state.selection.clear();
    renderList(state.items, null, state.total);
    $('#select-all').checked = checked; // renderList resets it; restore intent
    updateBulkBar();
  });

  document.querySelectorAll('#bulk-bar [data-bulk]').forEach((b) => b.addEventListener('click', () => runBulk(b.dataset.bulk)));

  $('#save-view-btn').addEventListener('click', openSaveViewModal);
  $('#prefs-btn').addEventListener('click', openPrefsModal);
  $('#export-btn').addEventListener('click', () => { window.location = '/api/export'; });
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    const { ok, data } = await api('POST', '/api/import', fd, true);
    e.target.value = '';
    if (ok) { toast(`Imported ${data.imported}, reconciled ${data.reconciled}, skipped ${data.skipped}.`); loadSidebar(); refresh(); }
    else toast('Import failed.');
  });
}

// ---------- boot ----------
async function boot() {
  wire();
  const { data } = await api('GET', '/api/preferences');
  if (data) applyPrefs(data);
  await Promise.all([loadSidebar(), refresh()]);
  document.body.setAttribute('data-harness-ready', 'true');
}

boot();
