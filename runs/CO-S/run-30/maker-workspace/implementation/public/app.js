import { matchesBookmark, uniqueLabels } from './domain.js';

const state = {
  bookmarks: [],
  view: 'library',
  label: 'all',
  search: ''
};

const elements = {
  app: document.querySelector('#app'),
  saveForm: document.querySelector('#save-form'),
  url: document.querySelector('#url'),
  initialLabel: document.querySelector('#initial-label'),
  saveButton: document.querySelector('#save-button'),
  urlError: document.querySelector('#url-error'),
  saveFeedback: document.querySelector('#save-feedback'),
  summary: document.querySelector('#summary'),
  libraryCount: document.querySelector('#library-count'),
  archiveCount: document.querySelector('#archive-count'),
  labelNav: document.querySelector('#label-nav'),
  viewKicker: document.querySelector('#view-kicker'),
  viewTitle: document.querySelector('#view-title'),
  visibleCount: document.querySelector('#visible-count'),
  search: document.querySelector('#search'),
  filterSummary: document.querySelector('#filter-summary'),
  list: document.querySelector('#bookmark-list'),
  empty: document.querySelector('#empty-state'),
  emptyTitle: document.querySelector('#empty-title'),
  emptyCopy: document.querySelector('#empty-copy'),
  clearSearch: document.querySelector('#clear-search'),
  globalNotice: document.querySelector('#global-notice'),
  duplicateNotice: document.querySelector('#duplicate-notice')
};

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.body ? { 'content-type': 'application/json', ...(options.headers ?? {}) } : options.headers
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.message ?? 'Request failed.');
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function loadBookmarks() {
  const { bookmarks } = await api('/api/bookmarks');
  state.bookmarks = bookmarks;
  render();
}

function currentCollection() {
  const archived = state.view === 'archive';
  return state.bookmarks.filter((bookmark) => bookmark.archived === archived);
}

function formatCount(value) {
  return `${value} ${value === 1 ? 'bookmark' : 'bookmarks'}`;
}

function savedWhen(iso) {
  const elapsed = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return 'Saved just now';
  if (minutes < 60) return `Saved ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Saved ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Saved ${days}d ago`;
}

function actionButton(label, className, handler) {
  const button = node('button', className, label);
  button.type = 'button';
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { await handler(); } finally { button.disabled = false; }
  });
  return button;
}

function makeCard(bookmark) {
  const item = node('section', 'bookmark-item');
  item.dataset.bookmarkId = bookmark.id;
  const card = node('article', 'bookmark-card');

  const link = node('a', 'card-link');
  link.href = bookmark.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `Open ${bookmark.title} in a new tab`);
  link.append(node('span', 'sr-only', `Open ${bookmark.title}`));

  const mark = node('div', 'site-mark', (bookmark.source[0] ?? 'B').toUpperCase());
  mark.setAttribute('aria-hidden', 'true');
  const copy = node('div', 'bookmark-copy');
  copy.append(node('p', 'source', bookmark.source), node('h3', '', bookmark.title), node('p', 'description', bookmark.description));
  if (bookmark.labels.length) {
    const tags = node('div', 'tag-list');
    bookmark.labels.forEach((label) => tags.append(node('span', 'tag', label)));
    copy.append(tags);
  }
  copy.append(node('p', 'saved-time', state.view === 'archive' ? `Archived · ${savedWhen(bookmark.updatedAt).replace('Saved ', '')}` : savedWhen(bookmark.createdAt)));

  const actions = node('div', 'card-actions');
  const status = node('span', `status${bookmark.read ? ' read' : ''}`, bookmark.read ? 'Read' : 'Read later');
  actions.append(status);

  if (state.view === 'library') {
    actions.append(actionButton(bookmark.read ? 'Mark unread' : 'Mark as read', '', async () => {
      await api(`/api/bookmarks/${bookmark.id}/read-status`, { method: 'POST', body: JSON.stringify({ read: !bookmark.read }) });
      await loadBookmarks();
    }));
    actions.append(actionButton('Archive', 'archive-action', async () => {
      await api(`/api/bookmarks/${bookmark.id}/archive`, { method: 'POST' });
      setGlobalNotice('Bookmark archived. It is out of your main library, not deleted.');
      await loadBookmarks();
    }));
  } else {
    actions.append(actionButton('Restore', '', async () => {
      await api(`/api/bookmarks/${bookmark.id}/restore`, { method: 'POST' });
      setGlobalNotice('Bookmark restored. It is back in your main library.');
      await loadBookmarks();
    }));
  }

  card.append(link, mark, copy, actions);
  item.append(card);

  if (state.view === 'library') {
    const labelForm = node('form', 'label-editor');
    const field = node('div');
    const id = `label-${bookmark.id}`;
    const label = node('label', '', bookmark.labels.length ? 'Add another label' : 'Add a label to this bookmark');
    label.htmlFor = id;
    const input = node('input');
    input.id = id;
    input.name = 'label';
    input.autocomplete = 'off';
    input.placeholder = 'e.g. reference';
    const add = node('button', '', 'Add label');
    add.type = 'submit';
    field.append(label, input);
    labelForm.append(field, add);
    const feedback = node('p', 'label-feedback');
    feedback.hidden = true;
    labelForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      add.disabled = true;
      try {
        const result = await api(`/api/bookmarks/${bookmark.id}/labels`, { method: 'POST', body: JSON.stringify({ label: input.value }) });
        if (!result.added) {
          feedback.textContent = `This bookmark already has the “${input.value.trim()}” label.`;
          feedback.hidden = false;
        } else {
          await loadBookmarks();
        }
      } catch (error) {
        feedback.textContent = error.message;
        feedback.hidden = false;
      } finally {
        add.disabled = false;
      }
    });
    item.append(labelForm, feedback);
  }
  return item;
}

function renderSidebar(collection) {
  const activeCount = state.bookmarks.filter((bookmark) => !bookmark.archived).length;
  const archivedCount = state.bookmarks.length - activeCount;
  elements.libraryCount.textContent = activeCount;
  elements.archiveCount.textContent = archivedCount;
  elements.summary.textContent = `${activeCount} in your library · ${archivedCount} archived`;
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view));

  elements.labelNav.replaceChildren();
  const all = node('button', `nav-item${state.label === 'all' ? ' active' : ''}`, 'All labels');
  all.type = 'button';
  all.addEventListener('click', () => { state.label = 'all'; render(); });
  elements.labelNav.append(all);
  for (const label of uniqueLabels(collection)) {
    const button = node('button', `nav-item${state.label.toLocaleLowerCase() === label.toLocaleLowerCase() ? ' active' : ''}`, label);
    button.type = 'button';
    button.addEventListener('click', () => { state.label = label; render(); });
    elements.labelNav.append(button);
  }
}

function renderEmpty(collection, visible) {
  elements.empty.hidden = visible.length > 0;
  elements.clearSearch.hidden = true;
  if (visible.length) return;
  if (collection.length && (state.search || state.label !== 'all')) {
    elements.emptyTitle.textContent = 'No bookmarks found';
    elements.emptyCopy.textContent = 'Try another word, clear your search, or choose another label.';
    elements.clearSearch.hidden = !state.search;
  } else if (state.view === 'archive') {
    elements.emptyTitle.textContent = 'Your archive is empty';
    elements.emptyCopy.textContent = 'Bookmarks you tuck away will remain available here.';
  } else {
    elements.emptyTitle.textContent = 'Your library is ready';
    elements.emptyCopy.textContent = 'Saved pages will appear here with their title and a short description.';
  }
}

function render() {
  const collection = currentCollection();
  if (state.label !== 'all' && !uniqueLabels(collection).some((label) => label.toLocaleLowerCase() === state.label.toLocaleLowerCase())) state.label = 'all';
  const visible = collection.filter((bookmark) => matchesBookmark(bookmark, state.search, state.label));
  renderSidebar(collection);
  elements.viewKicker.textContent = state.view === 'archive' ? 'TUCKED AWAY' : 'YOUR COLLECTION';
  elements.viewTitle.textContent = state.view === 'archive' ? 'Archive' : 'All bookmarks';
  elements.visibleCount.textContent = formatCount(visible.length);
  const filters = [];
  if (state.search) filters.push(`matching “${state.search}”`);
  if (state.label !== 'all') filters.push(`labeled “${state.label}”`);
  elements.filterSummary.textContent = filters.length ? `Showing ${visible.length} ${filters.join(' and ')}` : `Showing all ${collection.length ? formatCount(collection.length) : 'bookmarks'}`;
  elements.list.replaceChildren(...visible.map(makeCard));
  renderEmpty(collection, visible);
}

function setGlobalNotice(message) {
  elements.globalNotice.textContent = message;
  elements.globalNotice.hidden = false;
}

function clearSaveFeedback() {
  elements.urlError.hidden = true;
  elements.url.removeAttribute('aria-invalid');
  elements.saveFeedback.replaceChildren();
}

function validateUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname;
  } catch { return false; }
}

function duplicateButtons(result) {
  const wrap = node('div', 'notice-actions');
  const keep = actionButton(result.location === 'archive' ? 'Keep archived' : 'Keep as is', 'secondary', async () => {
    elements.duplicateNotice.hidden = true;
  });
  const update = actionButton(result.location === 'archive' ? 'Restore bookmark' : 'Update bookmark', '', async () => {
    const action = result.location === 'archive' ? 'restore-refresh' : 'refresh';
    await api(`/api/bookmarks/${result.bookmark.id}/${action}`, { method: 'POST' });
    elements.duplicateNotice.hidden = true;
    elements.url.value = '';
    elements.initialLabel.value = '';
    setGlobalNotice(result.location === 'archive' ? 'Bookmark restored and refreshed.' : 'Bookmark updated with the latest page details.');
    await loadBookmarks();
  });
  wrap.append(keep, update);
  return wrap;
}

function showDuplicate(result) {
  const copy = node('div');
  copy.append(
    node('strong', '', result.location === 'archive' ? 'This link is in your archive' : 'This link is already saved'),
    node('span', '', result.location === 'archive' ? 'Restore the existing bookmark and refresh its page details?' : 'Refresh its title and description instead of creating another copy?')
  );
  elements.duplicateNotice.replaceChildren(copy, duplicateButtons(result));
  elements.duplicateNotice.hidden = false;
  elements.duplicateNotice.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

elements.saveForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearSaveFeedback();
  elements.globalNotice.hidden = true;
  elements.duplicateNotice.hidden = true;
  if (!validateUrl(elements.url.value.trim())) {
    elements.urlError.textContent = 'Enter a full web address, such as https://example.com';
    elements.urlError.hidden = false;
    elements.url.setAttribute('aria-invalid', 'true');
    elements.url.focus();
    return;
  }

  elements.saveButton.disabled = true;
  elements.saveButton.textContent = 'Getting details…';
  try {
    const result = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: elements.url.value, label: elements.initialLabel.value }) });
    elements.url.value = '';
    elements.initialLabel.value = '';
    setGlobalNotice('Bookmark saved with its page title and description.');
    await loadBookmarks();
  } catch (error) {
    if (error.status === 409) showDuplicate(error.body);
    else if (error.body?.error === 'INVALID_URL') {
      elements.urlError.textContent = error.message;
      elements.urlError.hidden = false;
      elements.url.setAttribute('aria-invalid', 'true');
    } else {
      const message = node('p', 'inline-error', `${error.message} Your address and label are still here. Check that the page is available, then try saving again.`);
      elements.saveFeedback.replaceChildren(message);
      elements.saveButton.textContent = 'Try again';
    }
  } finally {
    elements.saveButton.disabled = false;
    if (elements.saveButton.textContent === 'Getting details…') elements.saveButton.textContent = 'Save link';
  }
});

elements.search.addEventListener('input', () => { state.search = elements.search.value; render(); });
elements.clearSearch.addEventListener('click', () => { state.search = ''; elements.search.value = ''; render(); elements.search.focus(); });
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
  state.view = button.dataset.view;
  state.label = 'all';
  state.search = '';
  elements.search.value = '';
  elements.globalNotice.hidden = true;
  elements.duplicateNotice.hidden = true;
  render();
}));

loadBookmarks().then(() => {
  elements.app.dataset.harnessReady = 'true';
}).catch((error) => {
  elements.summary.textContent = 'Could not load your library';
  elements.empty.hidden = false;
  elements.emptyTitle.textContent = 'Your library could not be loaded';
  elements.emptyCopy.textContent = error.message;
});
