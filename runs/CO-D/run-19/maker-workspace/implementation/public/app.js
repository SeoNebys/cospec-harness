import { matchesSearch, tokenizeQuery } from './search.js';

const state = {
  bookmarks: [], labels: [], view: 'all', query: '', matchMode: 'all',
  labelStates: new Map(), expanded: new Set(), pendingDelete: null
};

const elements = {
  app: document.querySelector('#app'), list: document.querySelector('#bookmark-list'),
  saveForm: document.querySelector('#save-form'), urlInput: document.querySelector('#url-input'),
  saveButton: document.querySelector('#save-button'), urlError: document.querySelector('#url-error'),
  searchInput: document.querySelector('#search-input'), searchMessage: document.querySelector('#search-message'),
  clearConditions: document.querySelector('#clear-conditions'),
  labelFilter: document.querySelector('#label-filter'), labelFilterList: document.querySelector('#label-filter-list'),
  empty: document.querySelector('#empty-state'), emptyTitle: document.querySelector('#empty-title'),
  emptyCopy: document.querySelector('#empty-copy'), clearSearch: document.querySelector('#clear-search'),
  heading: document.querySelector('#library-heading'), eyebrow: document.querySelector('#view-eyebrow'),
  resultCount: document.querySelector('#result-count'), toast: document.querySelector('#toast'),
  deleteDialog: document.querySelector('#delete-dialog'), deleteTitle: document.querySelector('#delete-title')
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.body ? { 'content-type': 'application/json', ...(options.headers || {}) } : options.headers
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || 'Something went wrong.');
    error.code = payload.code;
    throw error;
  }
  return payload;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => elements.toast.classList.remove('show'), 2600);
}

function normalizeLabel(value) {
  return value.trim();
}

function bookmarkById(id) {
  return state.bookmarks.find((bookmark) => bookmark.id === id);
}

function rebuildLabels() {
  const labels = [];
  for (const bookmark of state.bookmarks) {
    for (const label of bookmark.labels) {
      if (!labels.some((existing) => existing.toLowerCase() === label.toLowerCase())) labels.push(label);
    }
  }
  state.labels = labels.sort((a, b) => a.localeCompare(b));
}

async function updateBookmark(id, changes, message) {
  const updated = await api(`/api/bookmarks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(changes) });
  const index = state.bookmarks.findIndex((bookmark) => bookmark.id === id);
  state.bookmarks[index] = updated;
  rebuildLabels();
  render();
  if (message) showToast(message);
  return updated;
}

function visibleInView(bookmark) {
  if (state.view === 'archive') return bookmark.archived;
  if (state.view === 'later') return bookmark.readLater && !bookmark.archived;
  return !bookmark.archived;
}

function filteredBookmarks() {
  return state.bookmarks
    .filter(visibleInView)
    .filter((bookmark) => matchesSearch(bookmark, state.query, state.matchMode, state.labelStates));
}

function updateCounts() {
  const all = state.bookmarks.filter((bookmark) => !bookmark.archived).length;
  const later = state.bookmarks.filter((bookmark) => bookmark.readLater && !bookmark.archived).length;
  const archive = state.bookmarks.filter((bookmark) => bookmark.archived).length;
  document.querySelector('#all-count').textContent = all;
  document.querySelector('#later-count').textContent = later;
  document.querySelector('#archive-count').textContent = archive;
}

function cycleLabel(label) {
  const current = state.labelStates.get(label);
  if (!current) state.labelStates.set(label, 'include');
  else if (current === 'include') state.labelStates.set(label, 'exclude');
  else state.labelStates.delete(label);
  render();
}

function renderLabelFilters() {
  elements.labelFilter.hidden = state.labels.length === 0;
  elements.labelFilterList.replaceChildren(...state.labels.map((label) => {
    const button = element('button', 'filter-label', label);
    button.type = 'button';
    const status = state.labelStates.get(label);
    if (status) button.classList.add(status);
    if (status === 'exclude') button.textContent = `Not ${label}`;
    button.setAttribute('aria-pressed', status ? 'true' : 'false');
    button.addEventListener('click', () => cycleLabel(label));
    return button;
  }));
}

function renderSearchMessage() {
  const parsed = tokenizeQuery(state.query);
  let message = '';
  let warning = false;
  if (parsed.unclosedQuote) {
    message = 'Finish with another quotation mark to search for exact wording.';
    warning = true;
  } else if (/^\s*"[^"]+"\s*$/.test(state.query)) {
    message = `Exact wording: ${state.query.trim().slice(1, -1)}`;
  } else if (state.query || state.labelStates.size) {
    message = 'Showing bookmarks that meet your search conditions.';
  }
  elements.searchMessage.hidden = !message;
  elements.searchMessage.textContent = message;
  elements.searchMessage.classList.toggle('warning', warning);
  elements.clearConditions.hidden = !(state.query || state.labelStates.size);
}

function makeIcon(bookmark) {
  const icon = element('div', 'site-icon');
  icon.textContent = (bookmark.site || new URL(bookmark.url).hostname).charAt(0).toUpperCase();
  if (bookmark.icon) {
    const image = document.createElement('img');
    image.src = bookmark.icon;
    image.alt = '';
    image.addEventListener('error', () => image.remove());
    icon.append(image);
  }
  return icon;
}

function makeMetadataWarning(bookmark, openEditor) {
  const wrapper = element('div');
  const warning = element('div', 'metadata-warning');
  warning.append(element('span', '', '!'));
  const copy = element('div');
  copy.append(element('strong', '', 'We couldn’t load this page’s details'));
  copy.append(element('p', '', 'The link is saved. Try again or add the title and description yourself.'));
  warning.append(copy);
  const actions = element('div', 'failure-actions');
  const retry = element('button', 'secondary-button', 'Try again');
  retry.type = 'button';
  retry.addEventListener('click', async (event) => {
    event.stopPropagation();
    retry.disabled = true;
    retry.textContent = 'Trying…';
    const updated = await api(`/api/bookmarks/${encodeURIComponent(bookmark.id)}/retry`, { method: 'POST' });
    state.bookmarks[state.bookmarks.findIndex((item) => item.id === bookmark.id)] = updated;
    render();
    showToast(updated.metadataStatus === 'complete' ? 'Page details added.' : 'Still unable to reach the page. Your link is safe.');
  });
  const manual = element('button', '', 'Add details');
  manual.type = 'button';
  manual.addEventListener('click', (event) => { event.stopPropagation(); openEditor(); });
  actions.append(retry, manual);
  wrapper.append(warning, actions);
  return wrapper;
}

function makeSuggestions(input, bookmark, container, choose) {
  const query = input.value.trim().toLowerCase();
  const matches = state.labels.filter((label) => label.toLowerCase().includes(query)
    && !bookmark.labels.some((attached) => attached.toLowerCase() === label.toLowerCase()));
  container.replaceChildren(...matches.map((label) => {
    const button = element('button');
    button.type = 'button';
    button.append(element('span', '', label), element('small', '', 'Use existing'));
    button.addEventListener('click', () => choose(label));
    return button;
  }));
  container.hidden = !query || matches.length === 0;
}

function makeQuickLabels(bookmark) {
  const wrap = element('div', 'quick-label');
  const add = element('button', 'add-label-button', '+ Add label');
  add.type = 'button';
  const form = element('form', 'label-entry');
  form.hidden = true;
  const input = document.createElement('input');
  input.placeholder = 'Type a label';
  input.setAttribute('aria-label', 'New label');
  const submit = element('button', '', 'Add');
  submit.type = 'submit';
  submit.disabled = true;
  const suggestions = element('div', 'suggestions');
  suggestions.hidden = true;

  async function attach(label) {
    const normalized = normalizeLabel(label);
    if (!normalized) return;
    if (bookmark.labels.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) {
      showToast('That label is already on this bookmark.');
      return;
    }
    await updateBookmark(bookmark.id, { labels: [...bookmark.labels, normalized] }, 'Label added.');
  }

  add.addEventListener('click', (event) => { event.stopPropagation(); add.hidden = true; form.hidden = false; input.focus(); });
  input.addEventListener('click', (event) => event.stopPropagation());
  input.addEventListener('input', () => { submit.disabled = !input.value.trim(); makeSuggestions(input, bookmark, suggestions, attach); });
  form.addEventListener('click', (event) => event.stopPropagation());
  form.addEventListener('submit', async (event) => { event.preventDefault(); await attach(input.value); });
  form.append(input, submit, suggestions);
  wrap.append(add, form);
  return wrap;
}

function makeLabels(bookmark, expanded = false) {
  const labels = element('div', 'labels');
  bookmark.labels.forEach((label, index) => {
    const chip = element('span', `label-chip${index >= 3 && !expanded ? ' overflow-label' : ''}`);
    const filter = element('button', 'label-chip clickable', label);
    filter.type = 'button';
    filter.setAttribute('aria-label', `Show bookmarks labeled ${label}`);
    filter.addEventListener('click', (event) => {
      event.stopPropagation();
      state.labelStates.set(label, 'include');
      state.view = 'all';
      render();
      document.querySelector('.library').scrollIntoView({ behavior: 'smooth' });
    });
    const remove = element('button', 'remove-label', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${label} from bookmark`);
    remove.addEventListener('click', async (event) => {
      event.stopPropagation();
      await updateBookmark(bookmark.id, { labels: bookmark.labels.filter((item) => item !== label) }, 'Label removed from this bookmark.');
    });
    chip.append(filter, remove);
    labels.append(chip);
  });
  labels.append(makeQuickLabels(bookmark));
  return labels;
}

function makeEditForm(bookmark, close) {
  const form = element('form', 'edit-form');
  form.hidden = true;
  const titleLabel = element('label', '', 'Title');
  const title = document.createElement('input');
  title.value = bookmark.title;
  titleLabel.append(title);
  const descriptionLabel = element('label', '', 'Description');
  const description = document.createElement('textarea');
  description.rows = 3;
  description.value = bookmark.description;
  descriptionLabel.append(description);
  const current = element('div', 'editor-labels');
  bookmark.labels.forEach((label) => current.append(element('span', 'label-chip', label)));
  const newLabelLabel = element('label', '', 'Add a label while editing');
  const newLabel = document.createElement('input');
  newLabel.placeholder = 'Optional label';
  newLabelLabel.append(newLabel);
  const actions = element('div', 'edit-actions');
  const cancel = element('button', 'secondary-button', 'Cancel');
  cancel.type = 'button';
  cancel.addEventListener('click', (event) => { event.stopPropagation(); close(); });
  const save = element('button', '', 'Save changes');
  save.type = 'submit';
  actions.append(cancel, save);
  form.append(titleLabel, descriptionLabel, current, newLabelLabel, actions);
  form.addEventListener('click', (event) => event.stopPropagation());
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const entered = normalizeLabel(newLabel.value);
    const labels = [...bookmark.labels];
    if (entered && !labels.some((label) => label.toLowerCase() === entered.toLowerCase())) labels.push(entered);
    await updateBookmark(bookmark.id, { title: title.value, description: description.value, labels }, entered && labels.length === bookmark.labels.length ? 'Changes saved. That label was already attached.' : 'Changes saved.');
  });
  return { form, title };
}

function requestDelete(bookmark) {
  state.pendingDelete = bookmark.id;
  elements.deleteTitle.textContent = bookmark.title;
  elements.deleteDialog.showModal();
}

function makeCard(bookmark) {
  const expanded = state.expanded.has(bookmark.id);
  const isLong = bookmark.title.length > 90 || bookmark.description.length > 180 || bookmark.labels.length > 3;
  const card = element('article', `bookmark-card${isLong && !expanded ? ' compact' : ''}`);
  card.dataset.bookmarkId = bookmark.id;
  card.tabIndex = 0;
  card.setAttribute('role', 'link');
  card.setAttribute('aria-label', `Open ${bookmark.title}`);
  card.append(makeIcon(bookmark));
  const copy = element('div', 'bookmark-copy');
  const meta = element('div', 'bookmark-meta');
  meta.append(element('span', 'site-name', bookmark.site), element('span', '', '•'), element('span', '', `Saved ${new Date(bookmark.createdAt).toLocaleDateString()}`));
  const display = element('div', 'bookmark-display');
  display.append(element('h3', '', bookmark.title), element('p', 'description', bookmark.description || 'No description yet.'));
  const url = element('a', 'bookmark-url', bookmark.url);
  url.href = bookmark.url;
  url.target = '_blank';
  url.rel = 'noreferrer';
  display.append(url);
  copy.append(meta, display);

  let edit;
  const openEditor = () => {
    display.hidden = true;
    bottom.hidden = true;
    if (metadataArea) metadataArea.hidden = true;
    edit.form.hidden = false;
    edit.title.focus();
  };
  const closeEditor = () => {
    edit.form.hidden = true;
    display.hidden = false;
    bottom.hidden = false;
    if (metadataArea) metadataArea.hidden = false;
  };
  edit = makeEditForm(bookmark, closeEditor);
  copy.append(edit.form);

  let metadataArea = null;
  if (bookmark.metadataStatus === 'failed') {
    metadataArea = makeMetadataWarning(bookmark, openEditor);
    copy.append(metadataArea);
  }

  const bottom = element('div', 'card-bottom');
  bottom.append(makeLabels(bookmark, expanded));
  if (bookmark.archived) {
    const restore = element('button', 'restore-button', '↩ Restore');
    restore.type = 'button';
    restore.addEventListener('click', async (event) => { event.stopPropagation(); await updateBookmark(bookmark.id, { archived: false }, 'Restored to All bookmarks.'); });
    bottom.append(restore);
  } else {
    const later = element('button', `later-button${bookmark.readLater ? ' active' : ''}`, bookmark.readLater ? '✓ In Read later' : '＋ Read later');
    later.type = 'button';
    later.addEventListener('click', async (event) => {
      event.stopPropagation();
      await updateBookmark(bookmark.id, { readLater: !bookmark.readLater }, bookmark.readLater ? 'Removed from Read later.' : 'Added to Read later.');
    });
    bottom.append(later);
  }
  copy.append(bottom);
  if (isLong) {
    const expand = element('button', 'expand-button', expanded ? 'Show less −' : 'Show full details ＋');
    expand.type = 'button';
    expand.addEventListener('click', (event) => {
      event.stopPropagation();
      if (expanded) state.expanded.delete(bookmark.id); else state.expanded.add(bookmark.id);
      render();
      document.querySelector(`[data-bookmark-id="${CSS.escape(bookmark.id)}"]`)?.scrollIntoView({ block: 'center' });
    });
    copy.append(expand);
  }
  card.append(copy);

  const tools = element('div', 'card-tools');
  const editButton = element('button', 'icon-button', '✎');
  editButton.type = 'button';
  editButton.title = 'Edit bookmark';
  editButton.setAttribute('aria-label', 'Edit bookmark');
  editButton.addEventListener('click', (event) => { event.stopPropagation(); openEditor(); });
  const menuButton = element('button', 'more-button', '•••');
  menuButton.type = 'button';
  menuButton.setAttribute('aria-label', 'More bookmark actions');
  const menu = element('div', 'card-menu');
  menu.hidden = true;
  if (!bookmark.archived) {
    const archive = element('button', '', 'Move to Archive');
    archive.type = 'button';
    archive.addEventListener('click', async (event) => { event.stopPropagation(); await updateBookmark(bookmark.id, { archived: true }, 'Moved to Archive — you can restore it anytime.'); });
    menu.append(archive);
  }
  const remove = element('button', 'danger-action', 'Delete permanently');
  remove.type = 'button';
  remove.addEventListener('click', (event) => { event.stopPropagation(); requestDelete(bookmark); });
  menu.append(remove);
  menuButton.addEventListener('click', (event) => { event.stopPropagation(); menu.hidden = !menu.hidden; });
  menu.addEventListener('click', (event) => event.stopPropagation());
  tools.append(editButton, menuButton, menu);
  card.append(tools);
  card.addEventListener('click', (event) => {
    if (event.target.closest('a,button,input,textarea,form') || !edit.form.hidden) return;
    window.open(bookmark.url, '_blank', 'noopener,noreferrer');
  });
  card.addEventListener('keydown', (event) => {
    if (event.target === card && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      window.open(bookmark.url, '_blank', 'noopener,noreferrer');
    }
  });
  return card;
}

function renderEmpty(matches) {
  const currentTotal = state.bookmarks.filter(visibleInView).length;
  const filtered = state.query || state.labelStates.size;
  elements.empty.hidden = matches.length !== 0;
  elements.clearSearch.hidden = !filtered;
  if (matches.length) return;
  if (filtered) {
    elements.emptyTitle.textContent = `Nothing found in ${state.view === 'archive' ? 'Archive' : state.view === 'later' ? 'Read later' : 'All bookmarks'}`;
    elements.emptyCopy.textContent = state.view === 'archive' ? 'Try another search within your Archive.' : 'Try another word or clear the search to see this part of your library again.';
  } else if (state.view === 'later') {
    elements.emptyTitle.textContent = 'You’re all caught up';
    elements.emptyCopy.textContent = 'Your Read Later list is empty. Finished bookmarks are still safe in All bookmarks.';
  } else if (state.view === 'archive') {
    elements.emptyTitle.textContent = 'Nothing set aside';
    elements.emptyCopy.textContent = 'Bookmarks you archive will stay safe here until you restore them.';
  } else if (!currentTotal) {
    elements.emptyTitle.textContent = 'Your shelf is ready';
    elements.emptyCopy.textContent = 'Paste your first link above. Its readable page details will appear here.';
  }
}

function render() {
  updateCounts();
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view));
  document.querySelectorAll('[data-match]').forEach((button) => button.classList.toggle('selected', button.dataset.match === state.matchMode));
  renderLabelFilters();
  renderSearchMessage();
  const matches = filteredBookmarks();
  elements.list.replaceChildren(...matches.map(makeCard));
  elements.list.hidden = matches.length === 0;
  renderEmpty(matches);
  const names = {
    all: ['ALL BOOKMARKS', 'Your saved links'], later: ['READ LATER', 'Your reading queue'], archive: ['ARCHIVE', 'Set aside, not lost']
  };
  elements.eyebrow.textContent = names[state.view][0];
  elements.heading.textContent = (state.query || state.labelStates.size) ? 'Search results' : names[state.view][1];
  elements.resultCount.textContent = `${matches.length} ${matches.length === 1 ? 'bookmark' : 'bookmarks'}`;
}

function validAddress(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

elements.saveForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const value = elements.urlInput.value.trim();
  if (!validAddress(value)) {
    elements.urlInput.setAttribute('aria-invalid', 'true');
    elements.urlError.textContent = 'Please enter a complete web address, such as https://example.com/article.';
    elements.urlError.hidden = false;
    elements.urlInput.focus();
    return;
  }
  elements.urlError.hidden = true;
  elements.urlInput.removeAttribute('aria-invalid');
  elements.saveButton.disabled = true;
  elements.saveButton.textContent = 'Getting page details…';
  try {
    const result = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: value }) });
    const fresh = await api('/api/state');
    state.bookmarks = fresh.bookmarks;
    state.labels = fresh.labels;
    state.view = result.bookmark.archived ? 'archive' : 'all';
    state.query = '';
    state.labelStates.clear();
    elements.searchInput.value = '';
    elements.urlInput.value = '';
    render();
    const card = document.querySelector(`[data-bookmark-id="${CSS.escape(result.bookmark.id)}"]`);
    card?.classList.add('highlight');
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (result.duplicate) {
      card?.querySelector('[aria-label="Edit bookmark"]')?.click();
      showToast('Already saved — opened your existing bookmark.');
    } else if (result.bookmark.metadataStatus === 'failed') showToast('Link saved without page details.');
    else showToast('Bookmark saved — page details added.');
    window.setTimeout(() => card?.classList.remove('highlight'), 1800);
  } catch (error) {
    elements.urlError.textContent = error.message;
    elements.urlError.hidden = false;
  } finally {
    elements.saveButton.disabled = false;
    elements.saveButton.textContent = 'Save bookmark';
  }
});

elements.urlInput.addEventListener('input', () => { elements.urlInput.removeAttribute('aria-invalid'); elements.urlError.hidden = true; });
elements.searchInput.addEventListener('input', () => { state.query = elements.searchInput.value; render(); });
document.querySelectorAll('[data-match]').forEach((button) => button.addEventListener('click', () => { state.matchMode = button.dataset.match; render(); }));
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => { state.view = button.dataset.view; document.querySelector('.sidebar').classList.remove('open'); render(); }));
elements.clearSearch.addEventListener('click', () => { state.query = ''; state.labelStates.clear(); elements.searchInput.value = ''; render(); });
elements.clearConditions.addEventListener('click', () => { state.query = ''; state.labelStates.clear(); elements.searchInput.value = ''; render(); });
document.querySelector('#mobile-nav-toggle').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
document.addEventListener('keydown', (event) => { if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); elements.searchInput.focus(); } });
document.addEventListener('click', (event) => { if (!event.target.closest('.card-tools')) document.querySelectorAll('.card-menu').forEach((menu) => { menu.hidden = true; }); });

document.querySelector('#confirm-delete').addEventListener('click', async () => {
  if (!state.pendingDelete) return;
  const id = state.pendingDelete;
  state.pendingDelete = null;
  await api(`/api/bookmarks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  state.bookmarks = state.bookmarks.filter((bookmark) => bookmark.id !== id);
  rebuildLabels();
  window.setTimeout(() => { render(); showToast('Bookmark deleted permanently.'); }, 0);
});

async function initialize() {
  try {
    const initial = await api('/api/state');
    state.bookmarks = initial.bookmarks;
    state.labels = initial.labels;
    render();
    elements.app.setAttribute('aria-busy', 'false');
    elements.app.dataset.harnessReady = 'true';
  } catch {
    elements.app.innerHTML = '<main class="loading"><h1>Keep couldn’t start</h1><p>Please refresh the page to try again.</p></main>';
  }
}

initialize();
