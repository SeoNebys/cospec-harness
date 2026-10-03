// List hub (US2 base + US3 filter + US5 search + US6 read + US7 archive + US8 bulk + US10 sort).
import { api } from '../lib/api.js';
import { escapeHtml, truncate } from '../lib/dom.js';

const VIEW_META = {
  all: { heading: 'All bookmarks', empty: { title: 'No bookmarks yet', body: 'Save your first page to get started.', cta: true } },
  unread: { heading: 'Unread', empty: { title: 'Nothing unread', body: 'Bookmarks you mark unread appear here.' } },
  archive: { heading: 'Archive', empty: { title: 'Archive is empty', body: 'Archived bookmarks appear here.' } },
};

const SORT_OPTIONS = [
  ['date_added_desc', 'Newest first'],
  ['date_added_asc', 'Oldest first'],
  ['title_asc', 'Title A–Z'],
  ['title_desc', 'Title Z–A'],
];

export async function renderList(appEl, { view = 'all' } = {}) {
  const prefs = await api.getPreferences().catch(() => ({ default_sort: 'date_added_desc' }));
  const state = { view, q: '', tag: '', sort: prefs.default_sort, selection: new Set(), selectAllMatching: false };
  const meta = VIEW_META[view] || VIEW_META.all;

  appEl.innerHTML = `
    <section class="view">
      <div class="view-head">
        <h1 class="view-title">${escapeHtml(meta.heading)}</h1>
        <div class="toolbar">
          <input type="search" class="search-box" placeholder="Search title, description, notes, #tag…" aria-label="Search" />
          <select class="sort-select" aria-label="Sort">
            ${SORT_OPTIONS.map(([v, l]) => `<option value="${v}"${v === state.sort ? ' selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="active-filter" hidden></div>
        <div class="bulk-bar" hidden>
          <span class="bulk-count"></span>
          <button class="btn btn-small" data-bulk="select-matching">Select all matching</button>
          <span class="bulk-actions">
            <input class="bulk-tag" type="text" placeholder="tag" aria-label="Bulk tag" />
            <button class="btn btn-small" data-bulk="add_tag">+ Tag</button>
            <button class="btn btn-small" data-bulk="remove_tag">– Tag</button>
            <button class="btn btn-small" data-bulk="mark_read">Read</button>
            <button class="btn btn-small" data-bulk="mark_unread">Unread</button>
            <button class="btn btn-small" data-bulk="archive">Archive</button>
            <button class="btn btn-small btn-danger" data-bulk="delete">Delete</button>
          </span>
          <button class="btn btn-small" data-bulk="clear">Clear</button>
        </div>
      </div>
      <div class="results"><p class="loading">Loading…</p></div>
    </section>`;

  const searchBox = appEl.querySelector('.search-box');
  const sortSelect = appEl.querySelector('.sort-select');
  const resultsEl = appEl.querySelector('.results');
  const activeFilterEl = appEl.querySelector('.active-filter');
  const bulkBar = appEl.querySelector('.bulk-bar');

  async function load() {
    resultsEl.innerHTML = '<p class="loading">Loading…</p>';
    let data;
    try {
      data = await api.listBookmarks({ view: state.view, q: state.q, tag: state.tag, sort: state.sort });
    } catch (err) {
      resultsEl.innerHTML = `<div class="error-box">${escapeHtml(err.message)}</div>`;
      return;
    }
    renderResults(data.items);
  }

  function renderResults(items) {
    activeFilterEl.hidden = !state.tag;
    if (state.tag) {
      activeFilterEl.innerHTML = `Filtered by tag <span class="tag">${escapeHtml(state.tag)}</span> <button class="btn btn-small" data-clear-tag>Clear</button>`;
    }
    if (!items.length) {
      const isSearch = state.q || state.tag;
      resultsEl.innerHTML = isSearch
        ? `<div class="empty-state" data-empty="no-results"><h2>No results</h2><p>Nothing matched your search or filter.</p></div>`
        : `<div class="empty-state" data-empty="${state.view}"><h2>${escapeHtml(meta.empty.title)}</h2><p>${escapeHtml(meta.empty.body)}</p>${meta.empty.cta ? '<a class="btn btn-primary" href="#/new">+ Add your first bookmark</a>' : ''}</div>`;
      updateBulkBar();
      return;
    }
    resultsEl.innerHTML = `<ul class="bookmark-list">${items.map((b) => rowHtml(b, state)).join('')}</ul>`;
    updateBulkBar();
  }

  function updateBulkBar() {
    const n = state.selectAllMatching ? '(all matching)' : state.selection.size;
    const active = state.selectAllMatching || state.selection.size > 0;
    bulkBar.hidden = !active;
    if (active) bulkBar.querySelector('.bulk-count').textContent = `${n} selected`;
  }

  // --- events ---
  let debounce;
  searchBox.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.q = searchBox.value;
      state.selection.clear();
      state.selectAllMatching = false;
      load();
    }, 200);
  });
  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    load();
  });
  activeFilterEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-clear-tag]')) {
      state.tag = '';
      load();
    }
  });

  resultsEl.addEventListener('click', async (e) => {
    const row = e.target.closest('.bookmark');
    const id = row ? Number(row.dataset.id) : null;
    if (e.target.matches('.row-select')) {
      if (e.target.checked) state.selection.add(id);
      else state.selection.delete(id);
      state.selectAllMatching = false;
      updateBulkBar();
      return;
    }
    const tagChip = e.target.closest('[data-tag]');
    if (tagChip) {
      state.tag = tagChip.dataset.tag;
      state.q = '';
      searchBox.value = '';
      load();
      return;
    }
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn && id) {
      const action = actionBtn.dataset.action;
      try {
        if (action === 'read') await api.setRead(id, true);
        else if (action === 'unread') await api.setRead(id, false);
        else if (action === 'archive') await api.setArchived(id, true);
        else if (action === 'restore') await api.setArchived(id, false);
      } catch (err) {
        alert(err.message);
      }
      load();
    }
  });

  bulkBar.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-bulk]');
    if (!btn) return;
    const kind = btn.dataset.bulk;
    if (kind === 'clear') {
      state.selection.clear();
      state.selectAllMatching = false;
      load();
      return;
    }
    if (kind === 'select-matching') {
      state.selectAllMatching = true;
      updateBulkBar();
      return;
    }
    const payload = state.selectAllMatching
      ? { selector: { view: state.view, q: state.q, tag: state.tag } }
      : { ids: [...state.selection] };
    payload.action = kind;
    if (kind === 'add_tag' || kind === 'remove_tag') {
      payload.tag = bulkBar.querySelector('.bulk-tag').value.trim();
      if (!payload.tag) return alert('Enter a tag first.');
    }
    if (kind === 'delete') {
      if (!confirm('Permanently delete the selected bookmarks? This cannot be undone.')) return;
      payload.confirm = true;
    }
    try {
      await api.bulk(payload);
      state.selection.clear();
      state.selectAllMatching = false;
      load();
    } catch (err) {
      alert(err.message);
    }
  });

  await load();
}

function rowHtml(b, state) {
  const host = safeHost(b.url);
  const icon = b.icon_url
    ? `<img class="favicon" src="${escapeHtml(b.icon_url)}" alt="" width="16" height="16" loading="lazy" />`
    : `<span class="favicon favicon-fallback" aria-hidden="true">🔖</span>`;
  const tags = (b.tags || [])
    .map((t) => `<button type="button" class="tag tag-btn" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
    .join('');
  const desc = b.description
    ? `<p class="bm-desc" title="${escapeHtml(b.description)}">${escapeHtml(truncate(b.description))}</p>`
    : '';
  const checked = state.selection.has(b.id) ? ' checked' : '';
  const readAction = b.is_read
    ? `<button class="btn btn-small" data-action="unread">Mark unread</button>`
    : `<button class="btn btn-small" data-action="read">Mark read</button>`;
  const archiveAction = b.is_archived
    ? `<button class="btn btn-small" data-action="restore">Restore</button>`
    : `<button class="btn btn-small" data-action="archive">Archive</button>`;
  return `
    <li class="bookmark${b.is_read ? ' is-read' : ''}" data-id="${b.id}">
      <input type="checkbox" class="row-select" aria-label="Select"${checked} />
      <div class="bm-icon">${icon}</div>
      <div class="bm-main">
        <a class="bm-title" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(b.title)}">${escapeHtml(truncate(b.title, 120))}</a>
        ${b.is_read ? '' : '<span class="unread-dot" title="Unread" aria-label="Unread">●</span>'}
        <span class="bm-host" title="${escapeHtml(b.url)}">${escapeHtml(host)}</span>
        ${desc}
        <div class="bm-tags">${tags}</div>
      </div>
      <div class="bm-actions">
        <a class="btn btn-small" href="#/edit/${b.id}">Edit</a>
        ${readAction}
        ${archiveAction}
      </div>
    </li>`;
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
