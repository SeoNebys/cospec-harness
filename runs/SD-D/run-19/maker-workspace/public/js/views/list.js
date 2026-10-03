import { api } from '../api.js';
import { bookmarkRow } from '../components/bookmarkRow.js';
import { openEditBookmark } from './edit.js';

const SORT_LABELS = {
  date_added_desc: 'Newest first', date_added_asc: 'Oldest first',
  title_asc: 'Title A–Z', title_desc: 'Title Z–A',
};

/**
 * Render a bookmark list view for a scope (all|unread|archive).
 * `state` is a shared object carrying query/sort/paging/selection and prefs.
 */
export async function renderListView(container, scope, state) {
  state.scope = scope;
  container.innerHTML = '';

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  toolbar.innerHTML = `
    <input type="search" id="search" placeholder='Search: text, #tag, "phrase", AND/OR/NOT, ( )' value="${escapeAttr(state.q)}" />
    <select id="sort">${Object.entries(SORT_LABELS).map(([v, l]) => `<option value="${v}" ${state.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <button id="save-search" type="button">Save search</button>`;
  const searchError = document.createElement('p');
  searchError.className = 'search-error'; searchError.hidden = true;

  const filterTags = document.createElement('div');
  filterTags.className = 'filter-tags';

  const bulkBar = document.createElement('div');
  bulkBar.className = 'bulk-bar'; bulkBar.hidden = true;

  const listEl = document.createElement('ul');
  listEl.className = 'bookmark-list';
  const pager = document.createElement('div');
  pager.className = 'pagination';

  container.append(toolbar, searchError, filterTags, bulkBar, listEl, pager);

  const search = toolbar.querySelector('#search');
  let searchTimer;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = search.value; state.page = 1; load(); }, 300);
  });
  toolbar.querySelector('#sort').addEventListener('change', (e) => { state.sort = e.target.value; load(); });
  toolbar.querySelector('#save-search').onclick = () => saveCurrentSearch(state);

  async function load() {
    listEl.innerHTML = '<li class="loading">Loading…</li>';
    let data;
    try {
      data = await api.listBookmarks({
        q: state.q, includeTags: state.includeTags, excludeTags: state.excludeTags,
        scope, sort: state.sort, page: state.page, pageSize: state.pageSize,
      });
      searchError.hidden = true;
    } catch (err) {
      listEl.innerHTML = '';
      searchError.hidden = false;
      searchError.textContent = err.code ? `Invalid search: ${err.message}` : err.message;
      markReady();
      return;
    }
    renderFilterTags();
    renderList(data);
    renderBulkBar(data);
    renderPager(data);
    markReady();
  }

  function renderList(data) {
    listEl.innerHTML = '';
    if (!data.items.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = emptyMessage(scope, state);
      listEl.appendChild(li);
      return;
    }
    for (const b of data.items) {
      listEl.appendChild(bookmarkRow(b, {
        selected: state.selection.has(b.id), scope,
        onToggleSelect: (id, on) => { on ? state.selection.add(id) : state.selection.delete(id); state.selectAllMatching = false; load(); },
        onEdit: (id) => openEditBookmark(id, load),
        onToggleRead: async (bm) => { await api.updateBookmark(bm.id, { isRead: !bm.isRead }); load(); },
        onArchive: async (id) => { await api.updateBookmark(id, { isArchived: true }); load(); },
        onRestore: async (id) => { await api.updateBookmark(id, { isArchived: false }); load(); },
        onDelete: async (id) => { if (confirm('Permanently delete this bookmark? This cannot be undone.')) { await api.deleteBookmark(id); state.selection.delete(id); load(); } },
      }));
    }
  }

  function renderFilterTags() {
    filterTags.innerHTML = '';
    const mk = (name, cls, onRemove) => {
      const s = document.createElement('span'); s.className = `tag ${cls}`; s.textContent = `#${name}`;
      const x = document.createElement('button'); x.textContent = ' ×'; x.style.cssText = 'border:none;background:none;cursor:pointer;color:inherit';
      x.onclick = onRemove; s.appendChild(x); return s;
    };
    if (state.includeTags.length || state.excludeTags.length) {
      const label = document.createElement('span'); label.textContent = 'Filters: '; filterTags.appendChild(label);
    }
    state.includeTags.forEach((t) => filterTags.appendChild(mk(t, '', () => { state.includeTags = state.includeTags.filter((x) => x !== t); load(); })));
    state.excludeTags.forEach((t) => filterTags.appendChild(mk(t, 'exclude', () => { state.excludeTags = state.excludeTags.filter((x) => x !== t); load(); })));
  }

  function renderBulkBar(data) {
    const selCount = state.selectAllMatching ? data.total : state.selection.size;
    if (!selCount) { bulkBar.hidden = true; return; }
    bulkBar.hidden = false;
    bulkBar.innerHTML = `<span class="count">${selCount} selected</span>`;
    if (!state.selectAllMatching && data.total > state.selection.size) {
      const all = mkBtn(`Select all ${data.total} matching`, () => { state.selectAllMatching = true; load(); });
      bulkBar.appendChild(all);
    }
    bulkBar.appendChild(mkBtn('Clear', () => { state.selection.clear(); state.selectAllMatching = false; load(); }));
    bulkBar.appendChild(mkBtn('Add tag', async () => { const t = prompt('Tag to add:'); if (t) { await runBulk('addTags', { tags: [t] }); } }));
    bulkBar.appendChild(mkBtn('Remove tag', async () => { const t = prompt('Tag to remove:'); if (t) { await runBulk('removeTags', { tags: [t] }); } }));
    bulkBar.appendChild(mkBtn('Mark read', () => runBulk('markRead')));
    bulkBar.appendChild(mkBtn('Mark unread', () => runBulk('markUnread')));
    if (scope === 'archive') bulkBar.appendChild(mkBtn('Restore', () => runBulk('restore')));
    else bulkBar.appendChild(mkBtn('Archive', () => runBulk('archive')));
    const del = mkBtn('Delete', async () => { if (confirm(`Permanently delete ${selCount} bookmark(s)? This cannot be undone.`)) await runBulk('delete', { confirmed: true }); }, 'danger');
    bulkBar.appendChild(del);
  }

  async function runBulk(action, extra = {}) {
    const selection = state.selectAllMatching
      ? { matchAll: { q: state.q, includeTags: state.includeTags, excludeTags: state.excludeTags, scope } }
      : { ids: [...state.selection] };
    await api.bulk(selection, action, extra);
    state.selection.clear(); state.selectAllMatching = false;
    load();
  }

  function renderPager(data) {
    pager.innerHTML = '';
    const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
    if (pages <= 1) return;
    pager.appendChild(mkBtn('‹ Prev', () => { state.page = Math.max(1, state.page - 1); load(); }));
    const info = document.createElement('span'); info.textContent = `Page ${data.page} of ${pages} (${data.total})`; pager.appendChild(info);
    pager.appendChild(mkBtn('Next ›', () => { state.page = Math.min(pages, state.page + 1); load(); }));
  }

  state._reload = load;
  await load();
}

async function saveCurrentSearch(state) {
  const name = prompt('Name this saved search:');
  if (!name) return;
  await api.createSavedSearch({ name, queryText: state.q, includeTags: state.includeTags, excludeTags: state.excludeTags });
  alert('Saved search created.');
}

function emptyMessage(scope, state) {
  if (state.q || state.includeTags.length || state.excludeTags.length) return 'No matching bookmarks.';
  if (scope === 'unread') return 'Nothing unread — you are all caught up.';
  if (scope === 'archive') return 'The archive is empty.';
  return 'No bookmarks yet. Add your first one!';
}

function mkBtn(label, onClick, cls = '') { const b = document.createElement('button'); b.type = 'button'; if (cls) b.className = cls; b.textContent = label; b.onclick = onClick; return b; }
function escapeAttr(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
function markReady() { document.querySelector('#app')?.setAttribute('data-harness-ready', 'true'); }
