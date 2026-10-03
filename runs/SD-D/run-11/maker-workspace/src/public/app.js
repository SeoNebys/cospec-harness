// Bookmark Manager SPA. Talks to the /api endpoints and renders all views.

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  view: 'main',
  q: '',
  sort: 'date_added_desc',
  page: 1,
  pageSize: 25,
  includedTags: [],
  excludedTags: [],
  selected: new Set(),
  allTags: [],
  editingId: null,
};

// ---- API helper ------------------------------------------------------------

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message = (data && data.error && data.error.message) || `Request failed (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

function toast(message, isError = false) {
  const el = $('#toast');
  el.textContent = message;
  el.className = 'toast' + (isError ? ' error' : '');
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.hidden = true), 3500);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Loading / rendering the list ------------------------------------------

async function loadTags() {
  const { tags } = await api('/tags');
  state.allTags = tags;
}

function buildListQuery() {
  const params = new URLSearchParams();
  params.set('view', state.view);
  if (state.q) params.set('q', state.q);
  params.set('sort', state.sort);
  params.set('page', String(state.page));
  params.set('pageSize', String(state.pageSize));
  for (const t of state.includedTags) params.append('tag', t);
  for (const t of state.excludedTags) params.append('nottag', t);
  return params.toString();
}

async function loadList() {
  $('#search-error').hidden = true;
  let data;
  try {
    data = await api('/bookmarks?' + buildListQuery());
  } catch (e) {
    if (e.status === 400) {
      $('#search-error').textContent = `Search problem: ${e.message}`;
      $('#search-error').hidden = false;
      renderList({ items: [], total: 0, page: 1, pageSize: state.pageSize });
      return;
    }
    toast(e.message, true);
    return;
  }
  renderList(data);
}

function renderList(data) {
  const list = $('#list');
  const empty = $('#empty-state');
  list.innerHTML = '';

  if (data.total === 0) {
    empty.hidden = false;
    if (state.q || state.includedTags.length || state.excludedTags.length) {
      empty.textContent = 'No bookmarks match your search.';
    } else if (state.view === 'unread') {
      empty.textContent = 'Nothing to read later. Save a bookmark and choose “Read later”.';
    } else if (state.view === 'archive') {
      empty.textContent = 'The archive is empty.';
    } else {
      empty.textContent = 'No bookmarks yet — paste a URL above to save your first one.';
    }
  } else {
    empty.hidden = true;
  }

  for (const b of data.items) {
    list.appendChild(renderCard(b));
  }
  renderPager(data);
  updateBulkBar();
}

function renderCard(b) {
  const card = document.createElement('div');
  card.className = 'card' + (b.isUnread ? ' unread' : '');
  card.dataset.id = b.id;

  const checked = state.selected.has(b.id) ? 'checked' : '';
  const iconHtml = b.iconUrl
    ? `<img class="card-icon" src="${escapeHtml(b.iconUrl)}" alt="" onerror="this.style.visibility='hidden'" />`
    : `<span class="card-icon"></span>`;

  const tagsHtml = (b.tags || [])
    .map((t) => `<button class="tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`)
    .join('');

  const badges =
    (b.isUnread ? '<span class="badge">unread</span>' : '') +
    (b.isArchived ? '<span class="badge">archived</span>' : '') +
    (b.preservedKind ? `<span class="badge">preserved ${b.preservedKind}</span>` : '') +
    (b.archiveOrgUrl ? '<span class="badge">archive.org</span>' : '');

  card.innerHTML = `
    <input type="checkbox" class="card-select" ${checked} />
    ${iconHtml}
    <div class="card-body">
      <p class="card-title">
        <a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.title || b.url)}</a>
        ${badges}
      </p>
      ${b.description ? `<p class="card-desc">${escapeHtml(b.description)}</p>` : ''}
      <div class="card-url">${escapeHtml(b.url)}</div>
      <div class="card-tags">${tagsHtml}</div>
    </div>
    <div class="card-actions">
      <button data-act="edit">Edit</button>
      <button data-act="read">${b.isUnread ? 'Mark read' : 'Mark unread'}</button>
      <button data-act="archive">${b.isArchived ? 'Restore' : 'Archive'}</button>
    </div>`;

  card.querySelector('.card-select').addEventListener('change', (e) => {
    if (e.target.checked) state.selected.add(b.id);
    else state.selected.delete(b.id);
    updateBulkBar();
  });
  card.querySelectorAll('.tag').forEach((t) =>
    t.addEventListener('click', () => {
      if (!state.includedTags.includes(t.dataset.tag)) {
        state.includedTags.push(t.dataset.tag);
      }
      state.page = 1;
      loadList();
    })
  );
  card.querySelector('[data-act="edit"]').addEventListener('click', () => openEditor(b.id));
  card.querySelector('[data-act="read"]').addEventListener('click', async () => {
    await api(`/bookmarks/${b.id}`, { method: 'PATCH', body: JSON.stringify({ isUnread: !b.isUnread }) });
    loadList();
  });
  card.querySelector('[data-act="archive"]').addEventListener('click', async () => {
    await api(`/bookmarks/${b.id}`, { method: 'PATCH', body: JSON.stringify({ isArchived: !b.isArchived }) });
    toast(b.isArchived ? 'Restored' : 'Archived');
    loadList();
  });

  return card;
}

function renderPager(data) {
  const pager = $('#pager');
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  if (totalPages <= 1) {
    pager.hidden = true;
    return;
  }
  pager.hidden = false;
  pager.innerHTML = `
    <button class="ghost" ${data.page <= 1 ? 'disabled' : ''} id="prev">Prev</button>
    <span>Page ${data.page} of ${totalPages} · ${data.total} bookmarks</span>
    <button class="ghost" ${data.page >= totalPages ? 'disabled' : ''} id="next">Next</button>`;
  pager.querySelector('#prev')?.addEventListener('click', () => { state.page--; loadList(); });
  pager.querySelector('#next')?.addEventListener('click', () => { state.page++; loadList(); });
}

// ---- Bulk actions ----------------------------------------------------------

function updateBulkBar() {
  const bar = $('#bulk-bar');
  const applyAll = $('#apply-all-matching').checked;
  const count = state.selected.size;
  if (count === 0 && !applyAll) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  $('#bulk-count').textContent = applyAll
    ? 'All matching items'
    : `${count} selected`;
}

async function runBulk(spec) {
  const applyAll = $('#apply-all-matching').checked;
  const [action, rawValue] = spec.split(':');
  const body = { action };

  if (action === 'addTags' || action === 'removeTags') {
    const tags = $('#bulk-tags').value.split(',').map((t) => t.trim()).filter(Boolean);
    if (!tags.length) return toast('Enter one or more tags first.', true);
    body.tags = tags;
  }
  if (action === 'setUnread' || action === 'setArchived') {
    body.value = rawValue === '1';
  }
  if (action === 'delete') {
    if (!confirm('Permanently delete the selected bookmarks? This cannot be undone.')) return;
    body.confirm = true;
  }

  if (applyAll) {
    body.match = {
      view: state.view,
      q: state.q,
      tags: state.includedTags,
      notTags: state.excludedTags,
    };
  } else {
    body.ids = [...state.selected];
  }

  try {
    const res = await api('/bookmarks/bulk', { method: 'POST', body: JSON.stringify(body) });
    let msg = `Updated ${res.updated} bookmark(s).`;
    if (res.failures && res.failures.length) msg += ` ${res.failures.length} failed.`;
    toast(msg, res.failures && res.failures.length > 0);
    state.selected.clear();
    $('#apply-all-matching').checked = false;
    await loadTags();
    loadList();
  } catch (e) {
    toast(e.message, true);
  }
}

// ---- Editor ----------------------------------------------------------------

const editor = $('#editor');
let editorDraft = null; // for a brand-new bookmark not yet saved

function renderTagSuggestions(inputValue) {
  const box = $('#tag-suggestions');
  const current = inputValue.split(',').map((t) => t.trim().toLowerCase());
  const typed = current[current.length - 1] || '';
  const matches = state.allTags
    .filter((t) => t.name.toLowerCase().includes(typed) && !current.includes(t.name.toLowerCase()))
    .slice(0, 8);
  box.innerHTML = matches
    .map((t) => `<button type="button" class="tag" data-suggest="${escapeHtml(t.name)}">#${escapeHtml(t.name)} (${t.count})</button>`)
    .join('');
  box.querySelectorAll('[data-suggest]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const parts = $('#f-tags').value.split(',').map((t) => t.trim()).filter(Boolean);
      parts.pop();
      parts.push(btn.dataset.suggest);
      $('#f-tags').value = parts.join(', ') + ', ';
      $('#f-tags').focus();
      renderTagSuggestions($('#f-tags').value);
    })
  );
}

function fillEditor(b) {
  $('#f-url').value = b.url || '';
  $('#f-title').value = b.title || '';
  $('#f-description').value = b.description || '';
  $('#f-tags').value = (b.tags || []).join(', ');
  $('#f-note').innerHTML = b.noteHtml || '';
  $('#f-readlater').checked = !!b.isUnread;
  const img = $('#editor-preview-img');
  if (b.previewImageUrl) {
    img.src = b.previewImageUrl;
    img.hidden = false;
    img.onerror = () => (img.hidden = true);
  } else {
    img.hidden = true;
  }
  $('#editor-status').textContent = '';
  const isSaved = !!b.id;
  $('#editor-delete').hidden = !isSaved;
  $('#editor-preserve').hidden = !isSaved;
  $('#editor-archiveorg').hidden = !isSaved;
  $('#editor-open-preserved').hidden = !(isSaved && b.preservedKind);
  $('#f-readlater').closest('label').style.display = isSaved ? 'none' : 'flex';
  renderTagSuggestions($('#f-tags').value);
}

async function openEditor(id) {
  const { bookmark } = await api(`/bookmarks/${id}`);
  state.editingId = id;
  editorDraft = null;
  $('#editor-title').textContent = 'Edit bookmark';
  fillEditor(bookmark);
  editor.showModal();
}

function openEditorForNew(meta) {
  state.editingId = null;
  editorDraft = meta;
  $('#editor-title').textContent = 'Save bookmark';
  fillEditor({
    url: meta.url,
    title: meta.title,
    description: meta.description,
    iconUrl: meta.iconUrl,
    previewImageUrl: meta.previewImageUrl,
    tags: [],
    noteHtml: '',
    isUnread: false,
  });
  editor.showModal();
}

function collectEditorFields() {
  return {
    url: $('#f-url').value.trim(),
    title: $('#f-title').value.trim(),
    description: $('#f-description').value.trim(),
    tags: $('#f-tags').value.split(',').map((t) => t.trim()).filter(Boolean),
    noteHtml: $('#f-note').innerHTML,
  };
}

async function saveEditor() {
  const fields = collectEditorFields();
  try {
    if (state.editingId) {
      await api(`/bookmarks/${state.editingId}`, { method: 'PATCH', body: JSON.stringify(fields) });
      toast('Saved');
    } else {
      const body = { ...fields, iconUrl: editorDraft?.iconUrl, previewImageUrl: editorDraft?.previewImageUrl, readLater: $('#f-readlater').checked };
      await api('/bookmarks', { method: 'POST', body: JSON.stringify(body) });
      toast('Bookmark saved');
    }
    editor.close();
    await loadTags();
    loadList();
  } catch (e) {
    if (e.status === 409 && e.data && e.data.existingId) {
      $('#editor-status').textContent = 'That address is already bookmarked — opening it…';
      setTimeout(() => { editor.close(); openEditor(e.data.existingId); }, 700);
      return;
    }
    $('#editor-status').textContent = e.message;
  }
}

// ---- Quick add -------------------------------------------------------------

async function quickAdd(url) {
  try {
    const meta = await api('/metadata', { method: 'POST', body: JSON.stringify({ url }) });
    if (meta.existingId) {
      toast('Already bookmarked — opening it for editing.');
      openEditor(meta.existingId);
      return;
    }
    openEditorForNew(meta);
  } catch (e) {
    toast(e.message || 'Could not read that URL.', true);
  }
}

// ---- Saved searches --------------------------------------------------------

async function loadSavedSearches() {
  const { items } = await api('/saved-searches');
  const sel = $('#saved-search-select');
  sel.innerHTML = '<option value="">Saved searches…</option>' +
    items.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  sel._items = items;
}

// ---- Preferences -----------------------------------------------------------

async function loadPreferences() {
  const prefs = await api('/preferences');
  state.sort = prefs.defaultSort;
  state.pageSize = prefs.itemsPerView;
  $('#sort-select').value = prefs.defaultSort;
  $('#pref-sort').value = prefs.defaultSort;
  $('#pref-items').value = prefs.itemsPerView;
  $('#pref-textsize').value = prefs.textSize;
  document.documentElement.dataset.textSize = prefs.textSize;
}

// ---- View switching --------------------------------------------------------

function switchView(view) {
  state.view = view;
  state.page = 1;
  state.selected.clear();
  $$('.view-tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  const isPrefs = view === 'preferences';
  $('#controls').hidden = isPrefs;
  $('#bulk-bar').hidden = isPrefs || state.selected.size === 0;
  $('#list-region').hidden = isPrefs;
  $('#preferences-region').hidden = !isPrefs;
  if (!isPrefs) loadList();
}

// ---- Wiring ----------------------------------------------------------------

function wire() {
  $('#quick-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = $('#quick-url').value.trim();
    if (!url) return;
    quickAdd(url);
    $('#quick-url').value = '';
  });

  $$('.view-tab').forEach((tab) =>
    tab.addEventListener('click', () => switchView(tab.dataset.view))
  );

  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.q = $('#search-input').value.trim();
    state.page = 1;
    loadList();
  });
  $('#clear-search').addEventListener('click', () => {
    $('#search-input').value = '';
    state.q = '';
    state.includedTags = [];
    state.excludedTags = [];
    state.page = 1;
    loadList();
  });
  $('#sort-select').addEventListener('change', (e) => {
    state.sort = e.target.value;
    state.page = 1;
    loadList();
  });

  // Bulk
  $$('#bulk-bar button[data-bulk]').forEach((btn) =>
    btn.addEventListener('click', () => runBulk(btn.dataset.bulk))
  );
  $('#apply-all-matching').addEventListener('change', updateBulkBar);

  // Editor
  $('#editor-save').addEventListener('click', saveEditor);
  $('#editor-cancel').addEventListener('click', () => editor.close());
  $('#f-tags').addEventListener('input', (e) => renderTagSuggestions(e.target.value));
  $$('.note-toolbar button').forEach((btn) =>
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd === 'createLink') {
        const url = prompt('Link URL:');
        if (url) document.execCommand('createLink', false, url);
      } else {
        document.execCommand(cmd, false, null);
      }
      $('#f-note').focus();
    })
  );
  $('#editor-delete').addEventListener('click', async () => {
    if (!state.editingId) return;
    if (!confirm('Permanently delete this bookmark? This cannot be undone.')) return;
    await api(`/bookmarks/${state.editingId}?confirm=true`, { method: 'DELETE' });
    editor.close();
    toast('Deleted');
    await loadTags();
    loadList();
  });
  $('#editor-preserve').addEventListener('click', async () => {
    if (!state.editingId) return;
    $('#editor-status').textContent = 'Preserving a local copy…';
    try {
      const r = await api(`/bookmarks/${state.editingId}/preserve`, { method: 'POST' });
      $('#editor-status').textContent = `Preserved as ${r.preservedKind}.`;
      $('#editor-open-preserved').hidden = false;
    } catch (e) {
      $('#editor-status').textContent = e.message;
    }
  });
  $('#editor-open-preserved').addEventListener('click', () => {
    if (state.editingId) window.open(`/api/bookmarks/${state.editingId}/preserved`, '_blank');
  });
  $('#editor-archiveorg').addEventListener('click', async () => {
    if (!state.editingId) return;
    $('#editor-status').textContent = 'Submitting to the Internet Archive…';
    try {
      const r = await api(`/bookmarks/${state.editingId}/archive-org`, { method: 'POST' });
      $('#editor-status').textContent = 'Saved to the Internet Archive.';
      toast('Saved to Internet Archive');
    } catch (e) {
      $('#editor-status').textContent = e.message;
    }
  });

  // Saved searches
  $('#saved-search-select').addEventListener('change', (e) => {
    const id = e.target.value;
    if (!id) return;
    const item = e.target._items.find((s) => String(s.id) === id);
    if (!item) return;
    state.q = item.query || '';
    state.includedTags = item.includedTags || [];
    state.excludedTags = item.excludedTags || [];
    $('#search-input').value = state.q;
    state.page = 1;
    loadList();
  });
  $('#save-search-btn').addEventListener('click', async () => {
    const name = prompt('Name this saved search:');
    if (!name) return;
    try {
      await api('/saved-searches', {
        method: 'POST',
        body: JSON.stringify({
          name,
          query: state.q,
          includedTags: state.includedTags,
          excludedTags: state.excludedTags,
        }),
      });
      toast('Saved search created');
      loadSavedSearches();
    } catch (e) {
      toast(e.message, true);
    }
  });
  $('#delete-search-btn').addEventListener('click', async () => {
    const id = $('#saved-search-select').value;
    if (!id) return toast('Select a saved search to delete.', true);
    await api(`/saved-searches/${id}`, { method: 'DELETE' });
    toast('Saved search deleted');
    loadSavedSearches();
  });

  // Import / export
  $('#export-btn').addEventListener('click', () => { window.location.href = '/api/export'; });
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/import', { method: 'POST', body: fd, credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Import failed');
      toast(`Imported ${data.imported}, skipped ${data.skippedDuplicates} duplicate(s).`);
      await loadTags();
      loadList();
    } catch (err) {
      toast(err.message, true);
    }
    e.target.value = '';
  });

  // Preferences
  $('#pref-save').addEventListener('click', async () => {
    const prefs = await api('/preferences', {
      method: 'PUT',
      body: JSON.stringify({
        defaultSort: $('#pref-sort').value,
        itemsPerView: Number($('#pref-items').value),
        textSize: $('#pref-textsize').value,
      }),
    });
    state.sort = prefs.defaultSort;
    state.pageSize = prefs.itemsPerView;
    $('#sort-select').value = prefs.defaultSort;
    document.documentElement.dataset.textSize = prefs.textSize;
    $('#pref-status').textContent = 'Saved.';
    setTimeout(() => ($('#pref-status').textContent = ''), 2000);
  });
}

// ---- Boot ------------------------------------------------------------------

async function boot() {
  wire();
  try {
    await loadPreferences();
    await loadSavedSearches();
    await loadTags();
    await loadList();
  } catch (e) {
    toast('Failed to load: ' + e.message, true);
  } finally {
    // Signal presentation readiness (initial UI + data attempt complete).
    document.body.setAttribute('data-harness-ready', 'true');
  }
}

boot();
