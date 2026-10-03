// Bookmark Manager single-page client (no build step). Covers US1–US12.
const $ = (id) => document.getElementById(id);
const app = $('app');
const listEl = $('bookmark-list');
const emptyEl = $('empty-state');

let state = { view: 'normal', sort: 'newest', q: '', tag: '', lastTotal: 0 };
let selectedIds = new Set();
let matchingMode = false;

async function api(path, options = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.error && data.error.message) || `Request failed (${res.status})`);
  return data;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Tags (US3) ----------
async function loadTags() {
  const { tags } = await api('/api/tags');
  const filter = $('tag-filter');
  const current = filter.value;
  filter.innerHTML = '<option value="">All tags</option>' + tags.map((t) => `<option value="${esc(t.name)}">${esc(t.name)} (${t.count})</option>`).join('');
  filter.value = current;
  $('tag-datalist').innerHTML = tags.map((t) => `<option value="${esc(t.name)}"></option>`).join('');
}

// ---------- List / search (US2, US6, US8) ----------
function searchParamsForCurrent() {
  // Build query combining free text and an optional tag filter.
  let q = state.q.trim();
  if (state.tag) q = (q ? `${q} ` : '') + `#${state.tag}`;
  return q;
}

async function refresh() {
  let data;
  const q = searchParamsForCurrent();
  if (q) {
    const view = state.view === 'archived' ? 'normal' : state.view; // search never includes archived
    data = await api(`/api/search?${new URLSearchParams({ q, sort: state.sort, view })}`);
  } else {
    data = await api(`/api/bookmarks?${new URLSearchParams({ sort: state.sort, view: state.view })}`);
  }
  state.lastTotal = data.total;
  render(data.items);
  updateBulkBar();
}

function render(items) {
  listEl.innerHTML = '';
  if (!items.length) {
    emptyEl.hidden = false;
    emptyEl.textContent = state.q || state.tag
      ? 'No matching bookmarks.'
      : state.view === 'archived'
      ? 'No archived bookmarks.'
      : state.view === 'unread'
      ? 'Nothing unread — you are all caught up.'
      : 'No bookmarks yet. Paste a web address above to save your first one.';
    return;
  }
  emptyEl.hidden = true;
  const frag = document.createDocumentFragment();
  items.forEach((b) => frag.appendChild(bookmarkRow(b)));
  listEl.appendChild(frag);
}

function bookmarkRow(b) {
  const li = document.createElement('li');
  li.className = 'bookmark' + (b.isUnread ? ' unread' : '');
  li.dataset.id = b.id;
  const icon = b.iconUrl
    ? `<img class="icon" src="${esc(b.iconUrl)}" alt="" onerror="this.style.visibility='hidden'"/>`
    : '<div class="icon"></div>';
  const tags = (b.tags || []).map((t) => `<span class="tag" data-tag="${esc(t)}">#${esc(t)}</span>`).join('');
  const checked = selectedIds.has(b.id) ? 'checked' : '';
  const preservedLink = b.preservedCopyPath
    ? `<a href="/api/bookmarks/${b.id}/preserved" target="_blank" rel="noopener">Preserved copy</a>`
    : '';
  const iaLink = b.archiveOrgUrl ? `<a href="${esc(b.archiveOrgUrl)}" target="_blank" rel="noopener">Internet Archive</a>` : '';
  li.innerHTML = `
    <input type="checkbox" class="select" ${checked} />
    ${icon}
    <div class="body">
      <a class="title" href="${esc(b.address)}" target="_blank" rel="noopener noreferrer">${esc(b.title || b.address)}</a>
      ${b.isUnread ? '<span class="badge">unread</span>' : ''}
      <div class="addr">${esc(b.address)}</div>
      ${b.description ? `<div class="desc">${esc(b.description)}</div>` : ''}
      <div class="tags">${tags}</div>
      <div class="links">${preservedLink}${preservedLink && iaLink ? ' · ' : ''}${iaLink}</div>
      <div class="note-view" hidden></div>
      <div class="row-status status"></div>
    </div>
    <div class="actions">
      <button data-act="edit">Edit</button>
      <button data-act="note">Note</button>
      <button data-act="toggle-read">${b.isUnread ? 'Mark read' : 'Mark unread'}</button>
      <button data-act="toggle-archive">${b.isArchived ? 'Restore' : 'Archive'}</button>
      <button data-act="preserve">Save offline</button>
      <button data-act="archive-org">Archive.org</button>
      <button data-act="delete" class="danger">Delete</button>
    </div>`;
  return li;
}

// ---------- Selection & bulk actions (US7) ----------
function updateBulkBar() {
  const bar = $('bulk-bar');
  const count = matchingMode ? state.lastTotal : selectedIds.size;
  if (count > 0) {
    bar.hidden = false;
    $('bulk-count').textContent = matchingMode ? `All ${count} matching selected` : `${count} selected`;
  } else {
    bar.hidden = true;
  }
}

function currentSelect() {
  if (matchingMode) return { matching: { q: searchParamsForCurrent(), view: state.view } };
  return { ids: [...selectedIds] };
}

async function runBulk(action) {
  if (action.type === 'delete' && !confirm('Delete the selected bookmarks permanently?')) return;
  try {
    const res = await api('/api/bookmarks/bulk', { method: 'POST', body: JSON.stringify({ select: currentSelect(), action }) });
    selectedIds.clear();
    matchingMode = false;
    await loadTags();
    await refresh();
    flashAdd(`Updated ${res.affected} bookmark(s).`, true);
  } catch (err) {
    flashAdd(err.message, false);
  }
}

// ---------- Add (US1) ----------
$('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  flashAdd('Saving…', true);
  try {
    const data = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ address: $('add-address').value }) });
    if (data.existing) {
      flashAdd('You already saved that — opening it for editing.', true);
      openEdit(data.bookmark);
    } else {
      flashAdd('Saved.', true);
      $('add-address').value = '';
    }
    await loadTags();
    await refresh();
  } catch (err) {
    flashAdd(err.message, false);
  }
});
function flashAdd(msg, ok) {
  const el = $('add-status');
  el.className = 'status ' + (ok ? 'ok' : 'error');
  el.textContent = msg;
}

// ---------- Search / sort / view / tag filter ----------
let searchTimer;
$('search-input').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = $('search-input').value;
    matchingMode = false;
    refresh().catch((err) => {
      listEl.innerHTML = '';
      emptyEl.hidden = false;
      emptyEl.textContent = err.message;
    });
  }, 200);
});
$('sort-select').addEventListener('change', () => {
  state.sort = $('sort-select').value;
  refresh();
});
$('tag-filter').addEventListener('change', () => {
  state.tag = $('tag-filter').value;
  matchingMode = false;
  refresh();
});
document.querySelectorAll('.view-btn').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.view = btn.dataset.view;
    selectedIds.clear();
    matchingMode = false;
    refresh();
  })
);

// ---------- List interactions ----------
listEl.addEventListener('change', (e) => {
  if (e.target.classList.contains('select')) {
    const id = Number(e.target.closest('.bookmark').dataset.id);
    if (e.target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    matchingMode = false;
    updateBulkBar();
  }
});
listEl.addEventListener('click', async (e) => {
  const tagEl = e.target.closest('.tag[data-tag]');
  if (tagEl) {
    state.tag = tagEl.dataset.tag;
    $('tag-filter').value = state.tag;
    matchingMode = false;
    return refresh();
  }
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const row = btn.closest('.bookmark');
  const id = Number(row.dataset.id);
  const status = row.querySelector('.row-status');
  const act = btn.dataset.act;
  try {
    if (act === 'edit') {
      const { bookmark } = await api(`/api/bookmarks/${id}`);
      openEdit(bookmark);
    } else if (act === 'note') {
      const view = row.querySelector('.note-view');
      if (!view.hidden) { view.hidden = true; return; }
      const { noteHtml } = await api(`/api/bookmarks/${id}`);
      view.innerHTML = noteHtml || '<em>No note.</em>';
      view.hidden = false;
    } else if (act === 'toggle-read') {
      const isUnread = !row.classList.contains('unread');
      await api(`/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify({ isUnread }) });
      await refresh();
    } else if (act === 'toggle-archive') {
      const restoring = btn.textContent === 'Restore';
      await api(`/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify({ isArchived: !restoring }) });
      await refresh();
    } else if (act === 'preserve') {
      status.className = 'row-status status'; status.textContent = 'Saving an offline copy… (this can take a moment)';
      await api(`/api/bookmarks/${id}/preserve`, { method: 'POST' });
      status.className = 'row-status status ok'; status.textContent = 'Offline copy saved.';
      await refresh();
    } else if (act === 'archive-org') {
      status.className = 'row-status status'; status.textContent = 'Submitting to the Internet Archive…';
      await api(`/api/bookmarks/${id}/archive-org`, { method: 'POST' });
      status.className = 'row-status status ok'; status.textContent = 'Internet Archive snapshot saved.';
      await refresh();
    } else if (act === 'delete') {
      if (!confirm('Delete this bookmark permanently?')) return;
      await api(`/api/bookmarks/${id}?confirm=true`, { method: 'DELETE' });
      selectedIds.delete(id);
      await loadTags();
      await refresh();
    }
  } catch (err) {
    status.className = 'row-status status error';
    status.textContent = err.message;
  }
});

// ---------- Bulk bar ----------
$('bulk-select-matching').addEventListener('click', () => { matchingMode = true; updateBulkBar(); });
$('bulk-clear').addEventListener('click', () => { selectedIds.clear(); matchingMode = false; refresh(); });
$('bulk-bar').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-bulk]');
  if (!btn) return;
  const kind = btn.dataset.bulk;
  const tag = $('bulk-tag').value.trim();
  if (kind === 'addTags' || kind === 'removeTags') {
    if (!tag) return alert('Enter a tag first.');
    return runBulk({ type: kind, tags: [tag] });
  }
  if (kind === 'read') return runBulk({ type: 'setUnread', value: false });
  if (kind === 'unread') return runBulk({ type: 'setUnread', value: true });
  if (kind === 'archive') return runBulk({ type: 'setArchived', value: true });
  if (kind === 'restore') return runBulk({ type: 'setArchived', value: false });
  if (kind === 'delete') return runBulk({ type: 'delete', confirm: true });
});

// ---------- Edit dialog (US1, US4, US12) ----------
const editDialog = $('edit-dialog');
let editId = null;
function openEdit(b) {
  editId = b.id;
  $('edit-title').value = b.title || '';
  $('edit-address').value = b.address || '';
  $('edit-description').value = b.description || '';
  $('edit-note').value = b.note || '';
  $('edit-tags').value = (b.tags || []).join(', ');
  editDialog.showModal();
}
$('edit-cancel').addEventListener('click', () => editDialog.close());
$('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api(`/api/bookmarks/${editId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: $('edit-title').value,
        address: $('edit-address').value,
        description: $('edit-description').value,
        note: $('edit-note').value,
        tags: $('edit-tags').value.split(',').map((t) => t.trim()).filter(Boolean),
      }),
    });
    editDialog.close();
    await loadTags();
    await refresh();
  } catch (err) {
    alert(err.message);
  }
});

// ---------- Preferences (US8) ----------
const prefsDialog = $('prefs-dialog');
async function loadPreferences(applyOnly = false) {
  const p = await api('/api/preferences');
  document.documentElement.dataset.textSize = p.textSize;
  if (!applyOnly) {
    state.sort = p.defaultSort;
    $('sort-select').value = p.defaultSort;
    $('prefs-sort').value = p.defaultSort;
    $('prefs-items').value = p.itemsShown;
    $('prefs-textsize').value = p.textSize;
  }
  return p;
}
$('btn-prefs').addEventListener('click', async () => { await loadPreferences(); prefsDialog.showModal(); });
$('prefs-cancel').addEventListener('click', () => prefsDialog.close());
$('prefs-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const p = await api('/api/preferences', {
      method: 'PUT',
      body: JSON.stringify({
        defaultSort: $('prefs-sort').value,
        itemsShown: Number($('prefs-items').value),
        textSize: $('prefs-textsize').value,
      }),
    });
    document.documentElement.dataset.textSize = p.textSize;
    state.sort = p.defaultSort;
    $('sort-select').value = p.defaultSort;
    prefsDialog.close();
    await refresh();
  } catch (err) {
    alert(err.message);
  }
});

// ---------- Saved searches (US9) ----------
const savedDialog = $('saved-dialog');
async function renderSaved() {
  const { savedSearches } = await api('/api/saved-searches');
  $('saved-list').innerHTML = savedSearches.length
    ? savedSearches.map((s) => `<li data-id="${s.id}"><strong>${esc(s.name)}</strong>
        <span class="muted">${esc(s.queryText || '')} ${s.includedTags.map((t) => '+#' + esc(t)).join(' ')} ${s.excludedTags.map((t) => '-#' + esc(t)).join(' ')}</span>
        <button data-saved="run">Run</button><button data-saved="delete" class="danger">Delete</button></li>`).join('')
    : '<li class="muted">No saved searches yet.</li>';
}
$('btn-saved').addEventListener('click', async () => {
  $('saved-query').value = state.q;
  $('saved-include').value = state.tag || '';
  await renderSaved();
  savedDialog.showModal();
});
$('saved-close').addEventListener('click', () => savedDialog.close());
$('saved-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const parse = (v) => v.split(',').map((t) => t.trim()).filter(Boolean);
  try {
    await api('/api/saved-searches', {
      method: 'POST',
      body: JSON.stringify({
        name: $('saved-name').value,
        queryText: $('saved-query').value,
        includedTags: parse($('saved-include').value),
        excludedTags: parse($('saved-exclude').value),
      }),
    });
    $('saved-name').value = '';
    await renderSaved();
  } catch (err) {
    alert(err.message);
  }
});
$('saved-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-saved]');
  if (!btn) return;
  const id = Number(btn.closest('li').dataset.id);
  if (btn.dataset.saved === 'delete') {
    await api(`/api/saved-searches/${id}`, { method: 'DELETE' });
    await renderSaved();
  } else if (btn.dataset.saved === 'run') {
    const data = await api(`/api/saved-searches/${id}/run`);
    savedDialog.close();
    state.q = ''; state.tag = ''; $('search-input').value = ''; $('tag-filter').value = '';
    matchingMode = false; selectedIds.clear();
    state.lastTotal = data.total;
    render(data.items);
    updateBulkBar();
    showActiveFilter(`Saved search results (${data.total})`);
  }
});

function showActiveFilter(text) {
  const el = $('active-filter');
  if (!text) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `${esc(text)} <button id="clear-filter">Clear</button>`;
  $('clear-filter').addEventListener('click', () => { el.hidden = true; refresh(); });
}

// ---------- Import / Export (US10) ----------
const ioDialog = $('io-dialog');
$('btn-io').addEventListener('click', () => { $('io-status').textContent = ''; ioDialog.showModal(); });
$('io-close').addEventListener('click', () => ioDialog.close());
$('export-btn').addEventListener('click', () => { window.location.href = '/api/export'; });
$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const st = $('io-status');
  st.className = 'status'; st.textContent = 'Importing…';
  try {
    const res = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'text/html' }, body: text });
    const data = await res.json();
    if (!res.ok) throw new Error((data.error && data.error.message) || 'Import failed');
    st.className = 'status ok';
    st.textContent = `Imported ${data.added} new bookmark(s); skipped ${data.skipped} already present.`;
    await loadTags();
    await refresh();
  } catch (err) {
    st.className = 'status error';
    st.textContent = err.message;
  }
  e.target.value = '';
});

// ---------- Init ----------
(async function init() {
  try {
    await loadPreferences();
    await loadTags();
    await refresh();
  } catch {
    emptyEl.hidden = false;
    emptyEl.textContent = 'Could not load bookmarks.';
  } finally {
    app.dataset.harnessReady = 'true';
  }
})();
