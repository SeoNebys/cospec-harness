const PAGE_SIZE = 20;

const state = {
  bookmarks: [],
  view: 'all',
  query: '',
  tag: '',
  page: 1,
  expanded: new Set(),
  openMenu: '',
  openTagEditor: '',
  duplicateId: '',
  editor: null
};

const elements = {
  app: document.querySelector('#app'),
  loading: document.querySelector('#loading-screen'),
  list: document.querySelector('#bookmark-list'),
  pagination: document.querySelector('#pagination'),
  search: document.querySelector('#search-input'),
  viewTitle: document.querySelector('#view-title'),
  collectionTotal: document.querySelector('#collection-total'),
  allCount: document.querySelector('#all-count'),
  readLaterCount: document.querySelector('#read-later-count'),
  archiveCount: document.querySelector('#archive-count'),
  tagNav: document.querySelector('#tag-nav'),
  tagEmpty: document.querySelector('#tag-empty'),
  tagTotal: document.querySelector('#tag-total'),
  filterSummary: document.querySelector('#filter-summary'),
  resultCount: document.querySelector('#result-count'),
  filterDescription: document.querySelector('#filter-description'),
  emptyCollection: document.querySelector('#empty-collection'),
  emptyResults: document.querySelector('#empty-results'),
  emptyView: document.querySelector('#empty-view'),
  emptyViewSymbol: document.querySelector('#empty-view-symbol'),
  emptyViewTitle: document.querySelector('#empty-view-title'),
  emptyViewCopy: document.querySelector('#empty-view-copy'),
  addModal: document.querySelector('#add-modal'),
  addForm: document.querySelector('#add-form'),
  urlInput: document.querySelector('#bookmark-url'),
  urlShell: document.querySelector('#url-shell'),
  urlError: document.querySelector('#url-error'),
  duplicateAlert: document.querySelector('#duplicate-alert'),
  duplicateTitle: document.querySelector('#duplicate-title'),
  saveBookmark: document.querySelector('#save-bookmark'),
  editorModal: document.querySelector('#editor-modal'),
  editorForm: document.querySelector('#editor-form'),
  editorOverline: document.querySelector('#editor-overline'),
  editorTitle: document.querySelector('#editor-title'),
  editorLabel: document.querySelector('#editor-label'),
  editorValue: document.querySelector('#editor-value'),
  editorTitleValue: document.querySelector('#editor-title-value'),
  editorHelp: document.querySelector('#editor-help'),
  editingBookmark: document.querySelector('#editing-bookmark'),
  saveEditor: document.querySelector('#save-editor'),
  toast: document.querySelector('#toast'),
  toastTitle: document.querySelector('#toast-title'),
  toastDetail: document.querySelector('#toast-detail'),
  workspace: document.querySelector('#workspace')
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlighted(value, query) {
  const safe = escapeHtml(value || '');
  const term = query.trim();
  if (!term) return safe;
  return safe.replace(new RegExp(`(${escapeRegExp(term)})`, 'ig'), '<mark>$1</mark>');
}

function validWebUrl(value) {
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
  } catch { return false; }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.message || 'Something went wrong.'), {
    status: response.status,
    payload
  });
  return payload;
}

function showToast(title, detail = '', tone = 'success') {
  elements.toastTitle.textContent = title;
  elements.toastDetail.textContent = detail;
  elements.toast.querySelector('.toast-icon').textContent = tone === 'error' ? '!' : '✓';
  elements.toast.querySelector('.toast-icon').style.background = tone === 'error' ? 'var(--danger)' : 'var(--green)';
  elements.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove('show'), 3300);
}

function counts() {
  return {
    all: state.bookmarks.filter(item => !item.archived).length,
    readLater: state.bookmarks.filter(item => item.readLater && !item.archived).length,
    archive: state.bookmarks.filter(item => item.archived).length
  };
}

function tags() {
  const map = new Map();
  state.bookmarks.filter(item => !item.archived).forEach(bookmark => {
    bookmark.tags.forEach(tag => map.set(tag, (map.get(tag) || 0) + 1));
  });
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}

function filteredBookmarks() {
  const term = state.query.trim().toLocaleLowerCase();
  return state.bookmarks.filter(bookmark => {
    const inView = state.view === 'archive' ? bookmark.archived
      : state.view === 'read-later' ? bookmark.readLater && !bookmark.archived
        : !bookmark.archived;
    if (!inView) return false;
    if (state.tag && !bookmark.tags.includes(state.tag)) return false;
    if (!term) return true;
    return [bookmark.title, bookmark.source, bookmark.description, bookmark.note]
      .some(value => String(value || '').toLocaleLowerCase().includes(term));
  });
}

function pageData(items) {
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  state.page = Math.min(Math.max(state.page, 1), pageCount);
  const start = (state.page - 1) * PAGE_SIZE;
  return { items: items.slice(start, start + PAGE_SIZE), pageCount };
}

function formatDate(iso) {
  const date = new Date(iso);
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return 'Saved today';
  if (days === 1) return 'Saved yesterday';
  if (days < 7) return `Saved ${days} days ago`;
  if (days < 30) return `Saved ${Math.floor(days / 7)} weeks ago`;
  return `Saved ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}`;
}

function needsExpansion(bookmark) {
  return bookmark.title.length > 95 || bookmark.description.length > 210 || bookmark.note.length > 150 || bookmark.tags.length > 4;
}

function tagColor(tag) {
  const colors = ['#f29b78', '#8aa8d6', '#85bfa5', '#c39ad9', '#d8b467', '#83b9bd'];
  let hash = 0;
  for (const character of tag) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

function cardMarkup(bookmark) {
  const expanded = state.expanded.has(bookmark.id);
  const preview = bookmark.image
    ? `<div class="preview has-image"><img src="${escapeHtml(bookmark.image)}" alt="" loading="lazy"><span class="basic-badge" hidden></span></div>`
    : `<div class="preview"><span class="preview-letter">${escapeHtml((bookmark.title || bookmark.source || '?')[0].toUpperCase())}</span>${bookmark.isBasic ? '<span class="basic-badge">Basic card</span>' : ''}</div>`;
  const note = bookmark.note
    ? `<div class="note-block"><span aria-hidden="true">✎ </span>${highlighted(bookmark.note, state.query)}</div>` : '';
  const tagButtons = bookmark.tags.map(tag => `<button class="card-tag" type="button" data-card-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('');
  const reading = bookmark.readingMinutes ? `<i></i><span>${bookmark.readingMinutes} min read</span>` : '';
  const menuOpen = state.openMenu === bookmark.id;
  const tagEditorOpen = state.openTagEditor === bookmark.id;
  const basicUrl = bookmark.isBasic ? `<div class="basic-url">${escapeHtml(bookmark.url)}</div>` : '';

  return `<article class="bookmark-card${expanded ? ' expanded' : ''}" data-id="${bookmark.id}" id="bookmark-${bookmark.id}">
    ${preview}
    <div class="card-content">
      <div class="source-line"><span class="source-favicon">${escapeHtml(bookmark.source[0] || '?')}</span><span>${highlighted(bookmark.source, state.query)}</span></div>
      <h3 class="card-title"><a href="${escapeHtml(bookmark.url)}" target="_blank" rel="noopener noreferrer">${highlighted(bookmark.title, state.query)}</a></h3>
      <p class="card-description">${highlighted(bookmark.description, state.query)}</p>
      ${basicUrl}${note}
      <div class="tag-row">${tagButtons}<button class="add-tag-button" type="button" data-action="open-tag">＋ Add tag</button></div>
      <div class="card-meta"><span>${formatDate(bookmark.updatedAt || bookmark.capturedAt)}</span>${reading}</div>
      ${needsExpansion(bookmark) ? `<button class="show-more" type="button" data-action="expand">${expanded ? 'Show less' : 'Show more'}</button>` : ''}
    </div>
    <div class="card-actions">
      ${!bookmark.archived ? `<button class="read-later-button${bookmark.readLater ? ' active' : ''}" type="button" data-action="read-later" aria-label="${bookmark.readLater ? 'Remove from' : 'Add to'} Read later"><span aria-hidden="true">◷</span><span>${bookmark.readLater ? 'In Read later' : 'Read later'}</span></button>` : ''}
      <button class="icon-button menu-button" type="button" data-action="menu" aria-label="Options for ${escapeHtml(bookmark.title)}">•••</button>
    </div>
    <div class="card-menu" ${menuOpen ? '' : 'hidden'}>
      <button type="button" data-action="note"><span>✎</span>${bookmark.note ? 'Edit note' : 'Add note'}</button>
      ${bookmark.isBasic ? '<button type="button" data-action="title"><span>T</span>Edit title</button>' : ''}
      <button type="button" data-action="refresh"><span>↻</span>Refresh page details</button>
      <button type="button" data-action="archive"><span>□</span>${bookmark.archived ? 'Restore to collection' : 'Archive bookmark'}</button>
    </div>
    <form class="tag-popover" ${tagEditorOpen ? '' : 'hidden'}>
      <label for="tag-${bookmark.id}">Create or reuse a tag</label>
      <div class="tag-entry"><input id="tag-${bookmark.id}" name="tag" autocomplete="off" placeholder="e.g. Reference" required><button type="submit">Add tag</button></div>
      <p>Matching tag names are reused automatically.</p>
    </form>
  </article>`;
}

function renderSidebar() {
  const collectionCounts = counts();
  elements.allCount.textContent = collectionCounts.all;
  elements.readLaterCount.textContent = collectionCounts.readLater || '';
  elements.archiveCount.textContent = collectionCounts.archive || '';
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));

  const collectionTags = tags();
  elements.tagEmpty.hidden = collectionTags.length > 0;
  elements.tagTotal.textContent = collectionTags.length ? collectionTags.length : '';
  elements.tagNav.innerHTML = collectionTags.map(tag => `<button class="tag-button${state.tag === tag.name ? ' active' : ''}" type="button" data-tag="${escapeHtml(tag.name)}" style="--tag-color:${tagColor(tag.name)}"><span class="tag-dot"></span><span>${escapeHtml(tag.name)}</span><small>${tag.count}</small></button>`).join('');
}

function paginationMarkup(pageCount) {
  const candidates = new Set([1, pageCount, state.page - 1, state.page, state.page + 1]);
  const pages = [...candidates].filter(page => page >= 1 && page <= pageCount).sort((a, b) => a - b);
  let last = 0;
  let middle = '';
  for (const page of pages) {
    if (page - last > 1) middle += '<span class="page-ellipsis">…</span>';
    middle += `<button class="page-button${page === state.page ? ' active' : ''}" type="button" data-page="${page}" aria-label="Page ${page}" ${page === state.page ? 'aria-current="page"' : ''}>${page}</button>`;
    last = page;
  }
  return `<button class="page-button" type="button" data-page="${state.page - 1}" aria-label="Previous page" ${state.page === 1 ? 'disabled' : ''}>‹</button>${middle}<button class="page-button" type="button" data-page="${state.page + 1}" aria-label="Next page" ${state.page === pageCount ? 'disabled' : ''}>›</button>`;
}

function render() {
  renderSidebar();
  const collectionCounts = counts();
  const items = filteredBookmarks();
  const { items: pageItems, pageCount } = pageData(items);
  const viewNames = { all: 'All bookmarks', 'read-later': 'Read later', archive: 'Archive' };
  const viewTotal = state.view === 'all' ? collectionCounts.all : state.view === 'read-later' ? collectionCounts.readLater : collectionCounts.archive;
  elements.viewTitle.textContent = viewNames[state.view];
  elements.collectionTotal.textContent = `${viewTotal} ${viewTotal === 1 ? 'bookmark' : 'bookmarks'}`;
  elements.search.value = state.query;

  const hasFilters = Boolean(state.query.trim() || state.tag);
  elements.filterSummary.hidden = !hasFilters;
  elements.resultCount.textContent = `${items.length} ${items.length === 1 ? 'result' : 'results'}`;
  elements.filterDescription.textContent = [state.query.trim() ? `for “${state.query.trim()}”` : '', state.tag ? `tagged “${state.tag}”` : ''].filter(Boolean).join(' and ');

  const emptyWholeCollection = state.bookmarks.length === 0;
  const emptyDedicatedView = !hasFilters && items.length === 0 && state.view !== 'all' && !emptyWholeCollection;
  const noResults = hasFilters && items.length === 0;
  elements.emptyCollection.hidden = !emptyWholeCollection;
  elements.emptyResults.hidden = !noResults;
  elements.emptyView.hidden = !emptyDedicatedView;
  if (state.view === 'archive') {
    elements.emptyViewSymbol.textContent = '□';
    elements.emptyViewTitle.textContent = 'Archive is empty';
    elements.emptyViewCopy.textContent = 'Bookmarks you tuck away will appear here, ready to restore whenever you need them.';
  } else {
    elements.emptyViewSymbol.textContent = '◷';
    elements.emptyViewTitle.textContent = 'Nothing waiting to be read';
    elements.emptyViewCopy.textContent = 'Use Read later on a card and it will wait here without leaving your collection.';
  }

  elements.list.hidden = emptyWholeCollection || emptyDedicatedView || noResults;
  elements.list.innerHTML = pageItems.map(cardMarkup).join('');
  elements.pagination.hidden = pageCount <= 1 || items.length === 0;
  elements.pagination.innerHTML = pageCount > 1 ? paginationMarkup(pageCount) : '';
}

function openAdd() {
  elements.addForm.reset();
  elements.urlError.hidden = true;
  elements.duplicateAlert.hidden = true;
  elements.urlShell.classList.remove('invalid');
  state.duplicateId = '';
  elements.addModal.hidden = false;
  setTimeout(() => elements.urlInput.focus(), 0);
}

function closeAdd() { elements.addModal.hidden = true; }

function setAddBusy(busy) {
  elements.saveBookmark.disabled = busy;
  elements.saveBookmark.textContent = busy ? 'Getting page details…' : 'Save bookmark';
}

function openEditor(bookmark, mode) {
  state.editor = { bookmarkId: bookmark.id, mode };
  elements.editingBookmark.textContent = bookmark.title;
  const editingTitle = mode === 'title';
  elements.editorOverline.textContent = editingTitle ? 'Basic bookmark' : 'Personal note';
  elements.editorTitle.textContent = editingTitle ? 'Give this link a title' : bookmark.note ? 'Edit note' : 'Add a note';
  elements.editorLabel.textContent = editingTitle ? 'Bookmark title' : 'Your note';
  elements.editorHelp.textContent = editingTitle ? 'A clear title makes this basic card recognizable.' : 'This stays with the bookmark and becomes searchable.';
  elements.saveEditor.textContent = editingTitle ? 'Save title' : 'Save note';
  elements.editorValue.hidden = editingTitle;
  elements.editorTitleValue.hidden = !editingTitle;
  if (editingTitle) elements.editorTitleValue.value = bookmark.title === 'Untitled bookmark' ? '' : bookmark.title;
  else elements.editorValue.value = bookmark.note || '';
  elements.editorModal.hidden = false;
  setTimeout(() => (editingTitle ? elements.editorTitleValue : elements.editorValue).focus(), 0);
}

function closeEditor() {
  state.editor = null;
  elements.editorModal.hidden = true;
}

async function patchBookmark(id, body) {
  const payload = await api(`/api/bookmarks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
  const index = state.bookmarks.findIndex(item => item.id === id);
  if (index !== -1) state.bookmarks[index] = payload.bookmark;
  return payload;
}

async function refreshBookmark(bookmark) {
  state.openMenu = '';
  render();
  let confirmOverwrite = false;
  if (bookmark.isBasic && bookmark.manualTitle) {
    confirmOverwrite = window.confirm('Refreshing will replace the title you entered. Your note and tags will stay unchanged. Continue?');
    if (!confirmOverwrite) return;
  }
  showToast('Refreshing page details…', 'Your note and tags will stay untouched');
  try {
    const payload = await api(`/api/bookmarks/${encodeURIComponent(bookmark.id)}/refresh`, {
      method: 'POST', body: JSON.stringify({ confirmOverwrite })
    });
    const index = state.bookmarks.findIndex(item => item.id === bookmark.id);
    state.bookmarks[index] = payload.bookmark;
    render();
    showToast('Page details refreshed', 'Title, preview, description, and reading time updated');
  } catch (error) {
    showToast('Refresh couldn’t finish', error.message, 'error');
  }
}

elements.addForm.addEventListener('submit', async event => {
  event.preventDefault();
  elements.urlError.hidden = true;
  elements.duplicateAlert.hidden = true;
  elements.urlShell.classList.remove('invalid');
  const url = elements.urlInput.value.trim();
  if (!validWebUrl(url)) {
    elements.urlError.hidden = false;
    elements.urlShell.classList.add('invalid');
    elements.urlInput.focus();
    return;
  }
  setAddBusy(true);
  try {
    const payload = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url }) });
    state.bookmarks.unshift(payload.bookmark);
    state.view = 'all';
    state.query = '';
    state.tag = '';
    state.page = 1;
    closeAdd();
    render();
    if (payload.metadataStatus === 'basic') {
      showToast('Link saved as a basic card', 'The page couldn’t be reached; you can give it a title yourself');
    } else {
      showToast('Bookmark saved', 'Page title, preview, description, and reading time added');
    }
  } catch (error) {
    if (error.payload?.code === 'invalid_url') {
      elements.urlError.hidden = false;
      elements.urlShell.classList.add('invalid');
      elements.urlInput.focus();
    } else if (error.payload?.code === 'duplicate') {
      state.duplicateId = error.payload.bookmarkId;
      elements.duplicateTitle.textContent = `${error.payload.bookmark.title} is already in your collection.`;
      elements.duplicateAlert.hidden = false;
    } else {
      showToast('Couldn’t save this link', error.message, 'error');
    }
  } finally { setAddBusy(false); }
});

document.querySelector('#view-existing').addEventListener('click', () => {
  const bookmark = state.bookmarks.find(item => item.id === state.duplicateId);
  if (!bookmark) return;
  closeAdd();
  state.view = bookmark.archived ? 'archive' : 'all';
  state.query = '';
  state.tag = '';
  state.page = 1;
  render();
  setTimeout(() => {
    const card = document.querySelector(`#bookmark-${CSS.escape(bookmark.id)}`);
    if (!card) return;
    card.classList.add('located');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => card.classList.remove('located'), 3000);
  }, 0);
});

elements.editorForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!state.editor) return;
  const { bookmarkId, mode } = state.editor;
  const value = (mode === 'title' ? elements.editorTitleValue.value : elements.editorValue.value).trim();
  if (!value) {
    (mode === 'title' ? elements.editorTitleValue : elements.editorValue).focus();
    return;
  }
  try {
    await patchBookmark(bookmarkId, mode === 'title' ? { title: value } : { note: value });
    closeEditor();
    render();
    showToast(mode === 'title' ? 'Title saved' : 'Note saved', mode === 'title' ? 'This basic card is now easier to recognize' : 'It will stay with this bookmark and remain searchable');
  } catch (error) { showToast('Couldn’t save your change', error.message, 'error'); }
});

elements.list.addEventListener('click', async event => {
  const card = event.target.closest('.bookmark-card');
  if (!card) return;
  const bookmark = state.bookmarks.find(item => item.id === card.dataset.id);
  if (!bookmark) return;
  const cardTag = event.target.closest('[data-card-tag]');
  if (cardTag) {
    state.view = 'all';
    state.tag = cardTag.dataset.cardTag;
    state.page = 1;
    render();
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'menu') {
    state.openMenu = state.openMenu === bookmark.id ? '' : bookmark.id;
    state.openTagEditor = '';
    render();
  } else if (action === 'open-tag') {
    state.openTagEditor = state.openTagEditor === bookmark.id ? '' : bookmark.id;
    state.openMenu = '';
    render();
    if (state.openTagEditor) setTimeout(() => document.querySelector(`#tag-${CSS.escape(bookmark.id)}`)?.focus(), 0);
  } else if (action === 'expand') {
    state.expanded.has(bookmark.id) ? state.expanded.delete(bookmark.id) : state.expanded.add(bookmark.id);
    render();
  } else if (action === 'read-later') {
    try {
      const nextState = !bookmark.readLater;
      await patchBookmark(bookmark.id, { readLater: nextState });
      render();
      showToast(nextState ? 'Added to Read later' : 'Removed from Read later', nextState ? 'It will be waiting in your reading list' : 'The bookmark remains in All bookmarks');
    } catch (error) { showToast('Couldn’t update Read later', error.message, 'error'); }
  } else if (action === 'note') {
    state.openMenu = '';
    openEditor(bookmark, 'note');
  } else if (action === 'title') {
    state.openMenu = '';
    openEditor(bookmark, 'title');
  } else if (action === 'archive') {
    try {
      const nextState = !bookmark.archived;
      await patchBookmark(bookmark.id, { archived: nextState });
      state.openMenu = '';
      render();
      showToast(nextState ? 'Bookmark archived' : 'Bookmark restored', nextState ? 'It is tucked away, not deleted' : 'It is back in All bookmarks with its details intact');
    } catch (error) { showToast('Couldn’t update Archive', error.message, 'error'); }
  } else if (action === 'refresh') {
    refreshBookmark(bookmark);
  }
});

elements.list.addEventListener('submit', async event => {
  const form = event.target.closest('.tag-popover');
  if (!form) return;
  event.preventDefault();
  const card = form.closest('.bookmark-card');
  const bookmark = state.bookmarks.find(item => item.id === card.dataset.id);
  const entered = new FormData(form).get('tag')?.trim();
  if (!bookmark || !entered) return;
  try {
    const payload = await patchBookmark(bookmark.id, { addTag: entered });
    state.openTagEditor = '';
    render();
    if (payload.tag.added) {
      showToast(`“${payload.tag.name}” added`, payload.tag.reused ? 'Your existing tag was reused' : 'The bookmark and sidebar are updated');
    } else {
      showToast(`“${payload.tag.name}” is already assigned`, 'No changes were made');
    }
  } catch (error) { showToast('Couldn’t add that tag', error.message, 'error'); }
});

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  state.view = button.dataset.view;
  state.tag = '';
  state.query = '';
  state.page = 1;
  state.openMenu = '';
  state.openTagEditor = '';
  render();
}));

elements.tagNav.addEventListener('click', event => {
  const button = event.target.closest('[data-tag]');
  if (!button) return;
  state.view = 'all';
  state.tag = state.tag === button.dataset.tag ? '' : button.dataset.tag;
  state.page = 1;
  render();
});

elements.search.addEventListener('input', () => {
  state.query = elements.search.value;
  state.page = 1;
  render();
  elements.search.focus();
  elements.search.setSelectionRange(state.query.length, state.query.length);
});

elements.pagination.addEventListener('click', event => {
  const button = event.target.closest('[data-page]');
  if (!button || button.disabled) return;
  state.page = Number(button.dataset.page);
  render();
  elements.workspace.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function clearFilters() {
  state.query = '';
  state.tag = '';
  state.page = 1;
  render();
  elements.search.focus();
}

document.querySelector('#clear-filters').addEventListener('click', clearFilters);
document.querySelectorAll('[data-clear-filters]').forEach(button => button.addEventListener('click', clearFilters));
document.querySelector('#open-add').addEventListener('click', openAdd);
document.querySelector('#empty-add').addEventListener('click', openAdd);
document.querySelectorAll('[data-close-add]').forEach(button => button.addEventListener('click', closeAdd));
document.querySelectorAll('[data-close-editor]').forEach(button => button.addEventListener('click', closeEditor));
elements.addModal.addEventListener('click', event => { if (event.target === elements.addModal) closeAdd(); });
elements.editorModal.addEventListener('click', event => { if (event.target === elements.editorModal) closeEditor(); });

document.addEventListener('click', event => {
  if (!event.target.closest('.bookmark-card') && (state.openMenu || state.openTagEditor)) {
    state.openMenu = '';
    state.openTagEditor = '';
    render();
  }
});

document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    elements.search.focus();
  }
  if (event.key === 'Escape') {
    if (!elements.editorModal.hidden) closeEditor();
    else if (!elements.addModal.hidden) closeAdd();
    else if (state.openMenu || state.openTagEditor) {
      state.openMenu = '';
      state.openTagEditor = '';
      render();
    }
  }
});

async function initialize() {
  try {
    const payload = await api('/api/bookmarks');
    state.bookmarks = payload.bookmarks;
    render();
    elements.loading.hidden = true;
    elements.app.hidden = false;
    elements.app.dataset.harnessReady = 'true';
  } catch (error) {
    elements.loading.querySelector('p').textContent = 'Lattice couldn’t open your collection. Please reload the page.';
    showToast('Couldn’t load the collection', error.message, 'error');
  }
}

initialize();
