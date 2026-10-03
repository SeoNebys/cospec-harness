const app = document.querySelector('#app');

const state = {
  section: 'all',
  query: '',
  tag: '',
  sort: 'newest',
  page: 1,
  data: null,
  bookmarks: new Map(),
  activeBookmark: null,
  activeTags: [],
  failedUrl: '',
  duplicateId: null,
  activeViewName: '',
  toastTimer: null,
};

const elements = {
  libraryScreen: document.querySelector('#library-screen'),
  readerScreen: document.querySelector('#reader-screen'),
  pageKicker: document.querySelector('#page-kicker'),
  pageTitle: document.querySelector('#page-title'),
  pageSubtitle: document.querySelector('#page-subtitle'),
  saveForm: document.querySelector('#save-form'),
  saveUrl: document.querySelector('#save-url'),
  saveSubmit: document.querySelector('#save-submit'),
  saveError: document.querySelector('#save-error'),
  saveFailure: document.querySelector('#save-failure'),
  saveFailureCopy: document.querySelector('#save-failure-copy'),
  saveFailureUrl: document.querySelector('#save-failure-url'),
  duplicateMessage: document.querySelector('#duplicate-message'),
  duplicateCopy: document.querySelector('#duplicate-copy'),
  search: document.querySelector('#search-input'),
  clearSearch: document.querySelector('#clear-search'),
  sort: document.querySelector('#sort-select'),
  tagFilters: document.querySelector('#tag-filters'),
  grid: document.querySelector('#bookmark-grid'),
  resultCount: document.querySelector('#result-count'),
  resultRange: document.querySelector('#result-range'),
  empty: document.querySelector('#empty-state'),
  emptyTitle: document.querySelector('#empty-title'),
  emptyCopy: document.querySelector('#empty-copy'),
  emptyAction: document.querySelector('#empty-action'),
  pagination: document.querySelector('#pagination'),
  detailsDialog: document.querySelector('#details-dialog'),
  tagsDialog: document.querySelector('#tags-dialog'),
  manualDialog: document.querySelector('#manual-dialog'),
  saveViewDialog: document.querySelector('#save-view-dialog'),
  deleteDialog: document.querySelector('#delete-dialog'),
  toast: document.querySelector('#toast'),
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function safeImage(value) {
  const image = String(value ?? '');
  return /^(data:image\/(png|jpeg|gif|webp);base64,|https:\/\/)/i.test(image) ? image : '';
}

function formatSavedDate(value) {
  const date = new Date(value);
  const elapsedDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (elapsedDays <= 0) return 'Saved today';
  if (elapsedDays === 1) return 'Saved yesterday';
  if (elapsedDays < 7) return `Saved ${elapsedDays} days ago`;
  return `Saved ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).format(date)}`;
}

function formatCaptureDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.message ?? 'Something went wrong.');
    error.code = body.error?.code;
    error.details = body.error;
    error.status = response.status;
    throw error;
  }
  return body;
}

function toast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.querySelector('p').textContent = message;
  elements.toast.hidden = false;
  state.toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 2800);
}

function sectionCopy() {
  if (state.activeViewName) return ['SAVED VIEW', state.activeViewName, 'Your saved search, filter, and order restored together.'];
  if (state.section === 'later') return ['QUEUE', 'Read later', 'Pages waiting for your attention.'];
  if (state.section === 'archive') return ['TUCKED AWAY', 'Archive', 'Safe from the everyday list until you need them.'];
  return ['LIBRARY', 'All bookmarks', 'Everything you’ve kept, ready to find again.'];
}

function buildStateUrl() {
  const parameters = new URLSearchParams({
    section: state.section,
    q: state.query,
    tag: state.tag,
    sort: state.sort,
    page: String(state.page),
  });
  return `/api/state?${parameters}`;
}

async function loadState({ highlight } = {}) {
  const data = await api(buildStateUrl());
  state.data = data;
  state.page = data.page;
  state.bookmarks = new Map(data.items.map((bookmark) => [bookmark.id, bookmark]));
  render({ highlight });
  app.removeAttribute('aria-busy');
  app.dataset.harnessReady = 'true';
}

function renderNavigation() {
  const { counts, tags, savedViews } = state.data.navigation;
  document.querySelector('#count-all').textContent = counts.all;
  document.querySelector('#count-later').textContent = counts.later;
  document.querySelector('#count-archive').textContent = counts.archive;
  document.querySelectorAll('[data-section]').forEach((button) => button.classList.toggle('is-active', button.dataset.section === state.section));

  const savedSection = document.querySelector('#saved-views-section');
  const savedList = document.querySelector('#saved-views-list');
  savedSection.hidden = savedViews.length === 0;
  savedList.innerHTML = savedViews.map((view) => `
    <button type="button" data-view-id="${view.id}"><span class="saved-symbol" aria-hidden="true">⌕</span><span>${escapeHtml(view.name)}</span></button>
  `).join('');

  const tagSection = document.querySelector('#sidebar-tags-section');
  const sidebarTags = document.querySelector('#sidebar-tags');
  tagSection.hidden = tags.length === 0;
  sidebarTags.innerHTML = tags.map((tag) => `
    <button type="button" data-side-tag="${escapeHtml(tag.name)}" class="${state.tag === tag.name ? 'is-active' : ''}"><span class="side-bullet" aria-hidden="true"></span><span>${escapeHtml(tag.name)}</span><strong>${tag.count}</strong></button>
  `).join('');
}

function renderFilters() {
  const tags = state.data.navigation.tags;
  elements.tagFilters.innerHTML = [
    `<button class="filter-chip ${state.tag ? '' : 'is-active'}" type="button" data-tag="">All <small>${state.data.navigation.counts[state.section === 'later' ? 'later' : state.section === 'archive' ? 'archive' : 'all']}</small></button>`,
    ...tags.map((tag) => `<button class="filter-chip ${state.tag === tag.name ? 'is-active' : ''}" type="button" data-tag="${escapeHtml(tag.name)}">${escapeHtml(tag.name)} <small>${tag.count}</small></button>`),
  ].join('');
  elements.search.value = state.query;
  elements.clearSearch.hidden = !state.query;
  elements.sort.value = state.sort;
}

function cardMarkup(bookmark, highlight) {
  const tags = bookmark.tags ?? [];
  const shownTags = tags.slice(0, 2).map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('');
  const moreTags = tags.length > 2 ? `<span class="tag-pill more">+${tags.length - 2}</span>` : '';
  const image = safeImage(bookmark.preview_image);
  const art = image
    ? `<img src="${escapeHtml(image)}" alt="" />`
    : `<span aria-hidden="true">${escapeHtml((bookmark.site_name || bookmark.source_host || 'K').charAt(0).toUpperCase())}</span>`;
  const readAction = state.section === 'archive'
    ? `<button type="button" data-action="restore">↩ Restore</button>`
    : `<button class="later-button ${bookmark.read_later ? 'is-on' : ''}" type="button" data-action="later">${state.section === 'later' ? '✓ Mark as read' : bookmark.read_later ? '✓ In Read later' : '◷ Read later'}</button>`;
  return `
    <article class="bookmark-card ${highlight === bookmark.id ? 'is-highlighted' : ''}" data-bookmark-id="${bookmark.id}">
      <div class="bookmark-image">${art}</div>
      <div class="bookmark-body">
        <div class="bookmark-meta"><span class="site-mark">${escapeHtml((bookmark.site_name || bookmark.source_host || 'K').charAt(0).toUpperCase())}</span><span>${escapeHtml(bookmark.site_name || bookmark.source_host)}</span><span>•</span><span>${escapeHtml(formatSavedDate(bookmark.created_at))}</span></div>
        <button class="bookmark-title" type="button" data-action="open">${escapeHtml(bookmark.title)}</button>
        ${bookmark.description ? `<p class="bookmark-description">${escapeHtml(bookmark.description)}</p>` : ''}
        ${tags.length ? `<div class="bookmark-tags">${shownTags}${moreTags}</div>` : ''}
        ${bookmark.capture_status === 'none' ? '<div class="copy-status"><span aria-hidden="true">!</span> No saved page copy</div>' : ''}
        <div class="card-footer">
          <span>${escapeHtml(bookmark.source_host)}</span>
          <div class="card-actions">
            ${readAction}
            ${state.section !== 'archive' ? '<button type="button" data-action="edit">Edit details</button><button type="button" data-action="tags">Tags</button>' : ''}
            <button type="button" data-action="menu" aria-label="More actions">•••</button>
            <div class="action-menu" hidden>
              ${state.section === 'archive' ? '' : '<button type="button" data-action="archive"><span aria-hidden="true">□</span> Archive</button>'}
              <button type="button" data-action="delete"><span aria-hidden="true">⌫</span> Delete permanently</button>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderEmpty() {
  const noResults = Boolean(state.query || state.tag);
  elements.empty.hidden = state.data.total !== 0;
  elements.grid.hidden = state.data.total === 0;
  if (state.data.total !== 0) return;
  if (noResults) {
    elements.emptyTitle.textContent = 'No bookmarks found';
    elements.emptyCopy.textContent = 'Try different words or clear the current tag filter. Nothing in your library has changed.';
    elements.emptyAction.hidden = false;
    elements.emptyAction.textContent = 'Clear search and filters';
    elements.emptyAction.dataset.emptyAction = 'clear';
  } else if (state.section === 'later') {
    elements.emptyTitle.textContent = 'You’re all caught up';
    elements.emptyCopy.textContent = 'Bookmarks you mark as read remain safely in All bookmarks.';
    elements.emptyAction.hidden = false;
    elements.emptyAction.textContent = 'Back to all bookmarks';
    elements.emptyAction.dataset.emptyAction = 'all';
  } else if (state.section === 'archive') {
    elements.emptyTitle.textContent = 'Archive is empty';
    elements.emptyCopy.textContent = 'Bookmarks you tuck away will wait here without being deleted.';
    elements.emptyAction.hidden = false;
    elements.emptyAction.textContent = 'Back to all bookmarks';
    elements.emptyAction.dataset.emptyAction = 'all';
  } else {
    elements.emptyTitle.textContent = 'Your library is ready';
    elements.emptyCopy.textContent = 'Paste a page above to save your first recognizable bookmark.';
    elements.emptyAction.hidden = true;
  }
}

function renderPagination() {
  const { page, totalPages } = state.data;
  elements.pagination.hidden = totalPages <= 1;
  if (totalPages <= 1) return;
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= totalPages));
  const ordered = [...pages].sort((a, b) => a - b);
  const buttons = [];
  buttons.push(`<button type="button" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>← Previous</button>`);
  let previous = 0;
  for (const number of ordered) {
    if (previous && number - previous > 1) buttons.push('<span>…</span>');
    buttons.push(`<button type="button" data-page="${number}" class="${number === page ? 'is-current' : ''}" ${number === page ? 'aria-current="page"' : ''}>${number}</button>`);
    previous = number;
  }
  buttons.push(`<button type="button" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>Next →</button>`);
  elements.pagination.innerHTML = buttons.join('');
}

function render({ highlight } = {}) {
  const [kicker, title, subtitle] = sectionCopy();
  elements.pageKicker.textContent = kicker;
  elements.pageTitle.textContent = title;
  elements.pageSubtitle.textContent = subtitle;
  renderNavigation();
  renderFilters();
  elements.resultCount.textContent = `${state.data.total} ${state.data.total === 1 ? 'bookmark' : 'bookmarks'}`;
  const start = state.data.total ? (state.data.page - 1) * state.data.perPage + 1 : 0;
  const end = Math.min(state.data.total, state.data.page * state.data.perPage);
  elements.resultRange.textContent = state.data.total > state.data.perPage ? `Showing ${start}–${end}` : '';
  elements.grid.innerHTML = state.data.items.map((bookmark) => cardMarkup(bookmark, highlight)).join('');
  renderEmpty();
  renderPagination();
}

function setSection(section) {
  state.section = section;
  state.activeViewName = '';
  state.page = 1;
  state.tag = '';
  state.query = '';
  loadState().catch(showFatal);
}

function showFatal(error) {
  app.removeAttribute('aria-busy');
  app.dataset.harnessReady = 'true';
  elements.empty.hidden = false;
  elements.grid.hidden = true;
  elements.emptyTitle.textContent = 'Keepwell could not load';
  elements.emptyCopy.textContent = error.message;
}

function validWebAddress(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

function showSaveError(message) {
  elements.saveError.textContent = message;
  elements.saveError.hidden = false;
  elements.saveUrl.classList.add('invalid');
}

async function saveBookmark(url) {
  elements.saveFailure.hidden = true;
  elements.duplicateMessage.hidden = true;
  elements.saveError.hidden = true;
  elements.saveUrl.classList.remove('invalid');
  elements.saveSubmit.disabled = true;
  elements.saveSubmit.textContent = 'Capturing page…';
  try {
    const bookmark = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url }) });
    elements.saveUrl.value = '';
    state.section = 'all'; state.query = ''; state.tag = ''; state.sort = 'newest'; state.page = 1;
    await loadState({ highlight: bookmark.id });
    toast('Bookmark saved with page details and a readable copy');
  } catch (error) {
    if (error.code === 'invalid_url') {
      showSaveError(error.message);
    } else if (error.code === 'duplicate') {
      state.duplicateId = error.details.bookmark.id;
      elements.duplicateCopy.textContent = `Saved ${formatCaptureDate(error.details.bookmark.created_at)}. The existing details and saved date were kept.`;
      elements.duplicateMessage.hidden = false;
    } else if (error.code === 'capture_failed') {
      state.failedUrl = error.details.url || url;
      elements.saveFailureCopy.textContent = `${error.message} Nothing has been saved yet.`;
      elements.saveFailureUrl.textContent = state.failedUrl;
      elements.saveFailure.hidden = false;
    } else {
      showSaveError(error.message);
    }
  } finally {
    elements.saveSubmit.disabled = false;
    elements.saveSubmit.textContent = 'Save bookmark';
  }
}

elements.saveForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const url = elements.saveUrl.value.trim();
  if (!validWebAddress(url)) {
    showSaveError('Enter a complete web address, such as https://example.com/article');
    return;
  }
  saveBookmark(url);
});
elements.saveUrl.addEventListener('input', () => { elements.saveError.hidden = true; elements.saveUrl.classList.remove('invalid'); });
document.querySelector('#retry-save').addEventListener('click', () => saveBookmark(state.failedUrl));
document.querySelector('#open-manual').addEventListener('click', () => {
  document.querySelector('#manual-url').value = state.failedUrl;
  document.querySelector('#manual-title').value = '';
  document.querySelector('#manual-description').value = '';
  elements.manualDialog.showModal();
  document.querySelector('#manual-title').focus();
});
document.querySelector('#show-duplicate').addEventListener('click', async () => {
  state.section = 'all'; state.query = ''; state.tag = ''; state.sort = 'newest'; state.page = 1;
  await loadState({ highlight: state.duplicateId });
  elements.duplicateMessage.hidden = true;
  document.querySelector(`[data-bookmark-id="${state.duplicateId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

let searchTimer;
elements.search.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  state.query = elements.search.value;
  state.activeViewName = '';
  state.page = 1;
  searchTimer = window.setTimeout(() => loadState().catch(showFatal), 160);
});
elements.clearSearch.addEventListener('click', () => { state.query = ''; state.activeViewName = ''; state.page = 1; loadState().catch(showFatal); });
elements.sort.addEventListener('change', () => { state.sort = elements.sort.value; state.activeViewName = ''; state.page = 1; loadState().catch(showFatal); });
elements.tagFilters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-tag]');
  if (!button) return;
  state.tag = button.dataset.tag;
  state.activeViewName = '';
  state.page = 1;
  loadState().catch(showFatal);
});
elements.pagination.addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (!button || button.disabled) return;
  state.page = Number(button.dataset.page);
  loadState().then(() => window.scrollTo({ top: 0, behavior: 'smooth' })).catch(showFatal);
});
elements.emptyAction.addEventListener('click', () => {
  if (elements.emptyAction.dataset.emptyAction === 'clear') {
    state.query = ''; state.tag = ''; state.page = 1; loadState().catch(showFatal);
  } else setSection('all');
});

document.querySelector('.primary-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-section]');
  if (button) setSection(button.dataset.section);
});
document.querySelector('#home-button').addEventListener('click', () => setSection('all'));
document.querySelector('#saved-views-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-view-id]');
  if (!button) return;
  const view = state.data.navigation.savedViews.find((item) => item.id === Number(button.dataset.viewId));
  if (!view) return;
  state.section = 'all'; state.query = view.query; state.tag = view.tag; state.sort = view.sort; state.page = 1; state.activeViewName = view.name;
  loadState().catch(showFatal);
});
document.querySelector('#sidebar-tags').addEventListener('click', (event) => {
  const button = event.target.closest('[data-side-tag]');
  if (!button) return;
  state.section = 'all'; state.tag = button.dataset.sideTag; state.query = ''; state.page = 1; state.activeViewName = '';
  loadState().catch(showFatal);
});

elements.grid.addEventListener('click', async (event) => {
  const card = event.target.closest('[data-bookmark-id]');
  const action = event.target.closest('[data-action]');
  if (!card || !action) return;
  const id = Number(card.dataset.bookmarkId);
  const bookmark = state.bookmarks.get(id);
  if (!bookmark) return;
  if (action.dataset.action === 'menu') {
    const menu = action.nextElementSibling;
    document.querySelectorAll('.action-menu').forEach((other) => { if (other !== menu) other.hidden = true; });
    menu.hidden = !menu.hidden;
    return;
  }
  document.querySelectorAll('.action-menu').forEach((menu) => { menu.hidden = true; });
  if (action.dataset.action === 'open') return openReader(id);
  if (action.dataset.action === 'edit') return openDetails(bookmark);
  if (action.dataset.action === 'tags') return openTags(bookmark);
  if (action.dataset.action === 'delete') return openDelete(bookmark);
  try {
    if (action.dataset.action === 'later') {
      const value = state.section === 'later' ? false : !bookmark.read_later;
      await api(`/api/bookmarks/${id}/read-later`, { method: 'PATCH', body: JSON.stringify({ value }) });
      toast(value ? 'Added to Read later' : state.section === 'later' ? 'Marked as read · bookmark kept' : 'Removed from Read later');
    } else if (action.dataset.action === 'archive') {
      await api(`/api/bookmarks/${id}/archive`, { method: 'POST', body: '{}' });
      toast('Moved to Archive · not deleted');
    } else if (action.dataset.action === 'restore') {
      await api(`/api/bookmarks/${id}/restore`, { method: 'POST', body: '{}' });
      toast('Restored to All bookmarks');
    }
    await loadState();
  } catch (error) { toast(error.message); }
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-action="menu"], .action-menu')) document.querySelectorAll('.action-menu').forEach((menu) => { menu.hidden = true; });
});

async function openReader(id) {
  const bookmark = await api(`/api/bookmarks/${id}`);
  elements.libraryScreen.hidden = true;
  elements.readerScreen.hidden = false;
  document.querySelector('#reader-title').textContent = bookmark.title;
  document.querySelector('#reader-description').textContent = bookmark.description;
  document.querySelector('#reader-source').textContent = bookmark.site_name || bookmark.source_host;
  document.querySelector('#reader-source-mark').textContent = (bookmark.site_name || bookmark.source_host || 'K').charAt(0).toUpperCase();
  document.querySelector('#reader-published').textContent = bookmark.published_at ? `• ${bookmark.published_at}` : '';
  document.querySelector('#reader-author').textContent = bookmark.author ? `By ${bookmark.author}` : '';
  document.querySelector('#reader-captured').textContent = bookmark.captured_at ? `Copy captured ${formatCaptureDate(bookmark.captured_at)}` : '';
  document.querySelector('#reader-domain').textContent = `Saved from ${bookmark.source_host}`;
  const original = document.querySelector('#reader-original');
  original.href = bookmark.url;
  const image = safeImage(bookmark.preview_image);
  const readerImage = document.querySelector('#reader-image');
  readerImage.hidden = !image;
  if (image) readerImage.src = image;
  const content = document.querySelector('#reader-content');
  const notice = document.querySelector('#reader-notice');
  if (bookmark.capture_status === 'captured') {
    content.innerHTML = bookmark.content_html || '<p>The saved page did not contain additional readable text.</p>';
    notice.innerHTML = `<span><strong>Showing your saved copy.</strong> Captured ${escapeHtml(formatCaptureDate(bookmark.captured_at))}; it stays unchanged if the original page changes.</span>`;
    api(`/api/bookmarks/${id}/availability`).then((availability) => {
      if (!availability.available) notice.innerHTML = `<span><strong>The original page is unavailable.</strong> Showing the copy captured ${escapeHtml(formatCaptureDate(bookmark.captured_at))}.</span>`;
    }).catch(() => {});
  } else {
    content.innerHTML = '<p>This bookmark was saved with manually entered details. No readable page copy is available.</p>';
    notice.innerHTML = '<span><strong>No saved page copy.</strong> The address and details you entered are still available.</span>';
  }
  window.scrollTo(0, 0);
}
document.querySelector('#reader-back').addEventListener('click', () => { elements.readerScreen.hidden = true; elements.libraryScreen.hidden = false; window.scrollTo(0, 0); });

function openDetails(bookmark) {
  state.activeBookmark = bookmark;
  document.querySelector('#details-context').textContent = bookmark.source_host;
  document.querySelector('#details-title').value = bookmark.title;
  document.querySelector('#details-description').value = bookmark.description;
  document.querySelector('#details-title-error').hidden = true;
  elements.detailsDialog.showModal();
  document.querySelector('#details-title').focus();
}
document.querySelector('#details-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = document.querySelector('#details-title').value.trim();
  if (!title) {
    document.querySelector('#details-title').classList.add('invalid');
    document.querySelector('#details-title-error').hidden = false;
    return;
  }
  await api(`/api/bookmarks/${state.activeBookmark.id}`, { method: 'PATCH', body: JSON.stringify({ title, description: document.querySelector('#details-description').value }) });
  elements.detailsDialog.close();
  await loadState();
  toast('Details updated');
});
document.querySelector('#details-title').addEventListener('input', (event) => { event.target.classList.remove('invalid'); document.querySelector('#details-title-error').hidden = true; });

function drawSelectedTags() {
  document.querySelector('#selected-tags').innerHTML = state.activeTags.map((tag) => `<button type="button" data-remove-tag="${escapeHtml(tag)}">${escapeHtml(tag)} <span aria-hidden="true">×</span></button>`).join('');
}
function addActiveTag(value) {
  const tag = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (tag && !state.activeTags.includes(tag)) state.activeTags.push(tag);
  document.querySelector('#tag-entry').value = '';
  document.querySelector('#tag-suggestions').hidden = true;
  drawSelectedTags();
}
function openTags(bookmark) {
  state.activeBookmark = bookmark;
  state.activeTags = [...bookmark.tags];
  document.querySelector('#tags-context').textContent = bookmark.title;
  document.querySelector('#tag-entry').value = '';
  drawSelectedTags();
  elements.tagsDialog.showModal();
  document.querySelector('#tag-entry').focus();
}
document.querySelector('#selected-tags').addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-tag]');
  if (!button) return;
  state.activeTags = state.activeTags.filter((tag) => tag !== button.dataset.removeTag);
  drawSelectedTags();
});
document.querySelector('#add-tag').addEventListener('click', () => addActiveTag(document.querySelector('#tag-entry').value));
document.querySelector('#tag-entry').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addActiveTag(event.target.value); } });
let suggestionTimer;
document.querySelector('#tag-entry').addEventListener('input', (event) => {
  window.clearTimeout(suggestionTimer);
  const query = event.target.value.trim();
  suggestionTimer = window.setTimeout(async () => {
    const box = document.querySelector('#tag-suggestions');
    if (!query) { box.hidden = true; return; }
    const suggestions = await api(`/api/tags/suggest?q=${encodeURIComponent(query)}&exclude=${encodeURIComponent(state.activeTags.join(','))}`);
    box.innerHTML = suggestions.map((tag) => `<button type="button" data-suggest-tag="${escapeHtml(tag.name)}"><strong>${escapeHtml(tag.name)}</strong><small>used on ${tag.count} ${tag.count === 1 ? 'bookmark' : 'bookmarks'}</small></button>`).join('');
    box.hidden = suggestions.length === 0;
  }, 120);
});
document.querySelector('#tag-suggestions').addEventListener('click', (event) => { const button = event.target.closest('[data-suggest-tag]'); if (button) addActiveTag(button.dataset.suggestTag); });
document.querySelector('#tags-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  await api(`/api/bookmarks/${state.activeBookmark.id}/tags`, { method: 'PUT', body: JSON.stringify({ tags: state.activeTags }) });
  elements.tagsDialog.close();
  await loadState();
  toast('Tags updated');
});

document.querySelector('#manual-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const titleInput = document.querySelector('#manual-title');
  const title = titleInput.value.trim();
  if (!title) { titleInput.classList.add('invalid'); document.querySelector('#manual-title-error').hidden = false; return; }
  const bookmark = await api('/api/bookmarks/manual', { method: 'POST', body: JSON.stringify({ url: document.querySelector('#manual-url').value, title, description: document.querySelector('#manual-description').value }) });
  elements.manualDialog.close();
  elements.saveFailure.hidden = true;
  elements.saveUrl.value = '';
  state.section = 'all'; state.page = 1; state.query = ''; state.tag = '';
  await loadState({ highlight: bookmark.id });
  toast('Bookmark saved without a page copy');
});
document.querySelector('#manual-title').addEventListener('input', (event) => { event.target.classList.remove('invalid'); document.querySelector('#manual-title-error').hidden = true; });

document.querySelector('#save-view-button').addEventListener('click', () => {
  const suggested = state.query || state.tag ? [state.query, state.tag].filter(Boolean).join(' · ') : 'My saved view';
  document.querySelector('#saved-view-name').value = suggested;
  document.querySelector('#saved-view-error').hidden = true;
  document.querySelector('#saved-view-summary').innerHTML = [state.query || 'Any search', state.tag || 'All tags', elements.sort.selectedOptions[0].textContent].map((item) => `<span>${escapeHtml(item)}</span>`).join('');
  elements.saveViewDialog.showModal();
  document.querySelector('#saved-view-name').select();
});
document.querySelector('#save-view-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.querySelector('#saved-view-name');
  const name = input.value.trim();
  if (!name) { input.classList.add('invalid'); document.querySelector('#saved-view-error').hidden = false; return; }
  await api('/api/views', { method: 'POST', body: JSON.stringify({ name, query: state.query, tag: state.tag, sort: state.sort }) });
  elements.saveViewDialog.close();
  await loadState();
  toast('View saved to the sidebar');
});
document.querySelector('#saved-view-name').addEventListener('input', (event) => { event.target.classList.remove('invalid'); document.querySelector('#saved-view-error').hidden = true; });

function openDelete(bookmark) {
  state.activeBookmark = bookmark;
  document.querySelector('#delete-title').textContent = bookmark.title;
  elements.deleteDialog.showModal();
}
document.querySelector('#delete-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  await api(`/api/bookmarks/${state.activeBookmark.id}`, { method: 'DELETE' });
  elements.deleteDialog.close();
  await loadState();
  toast('Bookmark permanently deleted');
});

document.querySelectorAll('.dialog-close').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));

loadState().catch(showFatal);
