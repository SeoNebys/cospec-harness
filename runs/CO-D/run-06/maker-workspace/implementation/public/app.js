const state = {
  bookmarks: [],
  tagUsage: [],
  selectedTags: [],
  activeTag: '',
  search: '',
  metadata: null,
  metadataFailed: false,
  titleEdited: false,
  lookupController: null,
  lookupTimer: null,
  undoTimer: null
};

const elements = {
  app: document.querySelector('#app'),
  form: document.querySelector('#save-form'),
  url: document.querySelector('#url'),
  title: document.querySelector('#title'),
  tagInput: document.querySelector('#tag-input'),
  tagComposer: document.querySelector('#tag-composer'),
  selectedTags: document.querySelector('#selected-tags'),
  tagSuggestions: document.querySelector('#tag-suggestions'),
  tagHelp: document.querySelector('#tag-help'),
  lookupCard: document.querySelector('#lookup-card'),
  lookupIcon: document.querySelector('#lookup-icon'),
  lookupStatus: document.querySelector('#lookup-status'),
  lookupDescription: document.querySelector('#lookup-description'),
  formMessage: document.querySelector('#form-message'),
  saveButton: document.querySelector('#save-button'),
  collectionTools: document.querySelector('#collection-tools'),
  collectionCount: document.querySelector('#collection-count'),
  list: document.querySelector('#collection-list'),
  search: document.querySelector('#search'),
  tagFilters: document.querySelector('#tag-filters'),
  undoToast: document.querySelector('#undo-toast'),
  undoTitle: document.querySelector('#undo-title'),
  undoButton: document.querySelector('#undo-button')
};

function normalizeTag(value) {
  return String(value ?? '').trim().toLowerCase();
}

function setMessage(message = '', type = 'error') {
  elements.formMessage.textContent = message;
  elements.formMessage.classList.toggle('success', type === 'success');
}

function safeAddress(value) {
  try {
    const parsed = new URL(String(value).trim());
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
}

function fallbackIcon(container, text) {
  container.replaceChildren(document.createTextNode((text || '?').charAt(0).toUpperCase()));
}

function placeIcon(container, bookmark) {
  fallbackIcon(container, bookmark.iconText || bookmark.title);
  if (!bookmark.iconUrl) return;
  const image = new Image();
  image.alt = '';
  image.src = bookmark.iconUrl;
  image.addEventListener('load', () => container.replaceChildren(image), { once: true });
  image.addEventListener('error', () => fallbackIcon(container, bookmark.iconText || bookmark.title), { once: true });
}

function addSelectedTag(rawTag) {
  const tag = normalizeTag(rawTag);
  if (!tag || state.selectedTags.includes(tag)) return;
  state.selectedTags.push(tag);
  elements.tagInput.value = '';
  renderSelectedTags();
  renderTagSuggestions();
  elements.tagInput.focus();
}

function renderSelectedTags() {
  elements.selectedTags.replaceChildren();
  for (const tag of state.selectedTags) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.append(document.createTextNode(tag));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${tag} tag`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      state.selectedTags = state.selectedTags.filter((item) => item !== tag);
      renderSelectedTags();
      renderTagSuggestions();
      elements.tagInput.focus();
    });
    chip.append(remove);
    elements.selectedTags.append(chip);
  }
}

function matchingTagSuggestions() {
  const query = normalizeTag(elements.tagInput.value);
  if (!query) return [];
  return state.tagUsage.filter(({ name }) => name.includes(query) && !state.selectedTags.includes(name));
}

function renderTagSuggestions() {
  const matches = matchingTagSuggestions();
  elements.tagSuggestions.replaceChildren();
  for (const [index, tag] of matches.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `tag-suggestion${index === 0 ? ' active' : ''}`;
    button.setAttribute('role', 'option');
    const name = document.createElement('strong');
    name.textContent = tag.name;
    const usage = document.createElement('span');
    usage.textContent = `used ${tag.uses} ${tag.uses === 1 ? 'time' : 'times'}`;
    button.append(name, usage);
    button.addEventListener('click', () => addSelectedTag(tag.name));
    elements.tagSuggestions.append(button);
  }
  elements.tagSuggestions.hidden = matches.length === 0;
  elements.tagHelp.textContent = matches.length
    ? `${matches.length} existing ${matches.length === 1 ? 'tag' : 'tags'} found`
    : 'Previously used tags appear as you type.';
}

function renderLookup({ status, description = '', loading = false, failed = false, metadata = null }) {
  elements.lookupCard.hidden = false;
  elements.lookupCard.classList.toggle('loading', loading);
  elements.lookupCard.classList.toggle('failed', failed);
  elements.lookupStatus.textContent = status;
  elements.lookupDescription.textContent = description;
  if (loading) elements.lookupIcon.replaceChildren();
  else if (failed) elements.lookupIcon.textContent = '!';
  else if (metadata) placeIcon(elements.lookupIcon, metadata);
}

async function lookUpMetadata(address) {
  state.lookupController?.abort();
  const controller = new AbortController();
  state.lookupController = controller;
  state.metadata = null;
  state.metadataFailed = false;
  renderLookup({ status: 'Looking up page details…', description: 'Reading the title, description, and site icon', loading: true });

  try {
    const response = await fetch(`/api/metadata?url=${encodeURIComponent(address)}`, { signal: controller.signal });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    state.metadata = payload.metadata;
    if (!state.titleEdited) elements.title.value = payload.metadata.title;
    renderLookup({
      status: 'Page details found — you can edit the title',
      description: payload.metadata.description || 'No page description was provided.',
      metadata: payload.metadata
    });
  } catch (error) {
    if (error.name === 'AbortError') return;
    state.metadataFailed = true;
    renderLookup({
      status: 'We couldn’t load this page’s details',
      description: 'Add a title if you like, or save using the site name.',
      failed: true
    });
  }
}

function resetSaveForm() {
  elements.form.reset();
  state.selectedTags = [];
  state.metadata = null;
  state.metadataFailed = false;
  state.titleEdited = false;
  elements.lookupCard.hidden = true;
  elements.tagSuggestions.hidden = true;
  renderSelectedTags();
}

function recomputeTagUsage() {
  const counts = new Map();
  for (const bookmark of state.bookmarks) {
    for (const tag of bookmark.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  state.tagUsage = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, uses]) => ({ name, uses }));
}

function currentMatches() {
  const query = state.search.toLowerCase();
  return state.bookmarks.filter((bookmark) => {
    const tagMatches = !state.activeTag || bookmark.tags.includes(state.activeTag);
    const textMatches = !query || `${bookmark.title} ${bookmark.description} ${bookmark.url}`.toLowerCase().includes(query);
    return tagMatches && textMatches;
  });
}

function renderTagFilters() {
  elements.tagFilters.replaceChildren();
  if (!state.tagUsage.length) return;
  const all = document.createElement('button');
  all.type = 'button';
  all.className = `filter-chip${state.activeTag ? '' : ' active'}`;
  all.textContent = 'All tags';
  all.addEventListener('click', () => { state.activeTag = ''; renderCollection(); });
  elements.tagFilters.append(all);

  for (const tag of state.tagUsage) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filter-chip${state.activeTag === tag.name ? ' active' : ''}`;
    button.append(document.createTextNode(tag.name));
    const count = document.createElement('span');
    count.textContent = tag.uses;
    button.append(count);
    button.addEventListener('click', () => { state.activeTag = tag.name; renderCollection(); });
    elements.tagFilters.append(button);
  }
}

async function updateExistingTitle(bookmark, row, input, editor) {
  const title = input.value.trim();
  if (!title) return;
  const response = await fetch(`/api/bookmarks/${encodeURIComponent(bookmark.id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title })
  });
  const payload = await response.json();
  if (!response.ok) {
    setMessage(payload.error || 'The title could not be updated');
    return;
  }
  const index = state.bookmarks.findIndex((item) => item.id === bookmark.id);
  state.bookmarks[index] = payload.bookmark;
  editor.hidden = true;
  row.classList.remove('duplicate-focus');
  setMessage('The saved bookmark title has been updated.', 'success');
  renderCollection();
}

function buildBookmarkRow(bookmark) {
  const article = document.createElement('article');
  article.className = 'bookmark-row';
  article.dataset.id = bookmark.id;

  const icon = document.createElement('div');
  icon.className = 'site-icon';
  icon.setAttribute('aria-hidden', 'true');
  placeIcon(icon, bookmark);

  const main = document.createElement('div');
  main.className = 'bookmark-main';
  const title = document.createElement('a');
  title.className = 'bookmark-title';
  title.href = bookmark.url;
  title.target = '_blank';
  title.rel = 'noopener noreferrer';
  title.textContent = bookmark.title;
  main.append(title);
  if (bookmark.description) {
    const description = document.createElement('span');
    description.className = 'bookmark-description';
    description.textContent = bookmark.description;
    main.append(description);
  }
  const address = document.createElement('span');
  address.className = 'bookmark-url';
  address.textContent = bookmark.url;
  main.append(address);

  if (bookmark.tags.length) {
    const tags = document.createElement('div');
    tags.className = 'bookmark-tags';
    for (const tag of bookmark.tags) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bookmark-tag';
      button.textContent = tag;
      button.setAttribute('aria-label', `Show bookmarks tagged ${tag}`);
      button.addEventListener('click', () => {
        state.activeTag = tag;
        state.search = '';
        elements.search.value = '';
        renderCollection();
        document.querySelector('.collection').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      tags.append(button);
    }
    main.append(tags);
  }

  const actions = document.createElement('details');
  actions.className = 'item-actions';
  const summary = document.createElement('summary');
  summary.setAttribute('aria-label', `Actions for ${bookmark.title}`);
  summary.textContent = '•••';
  const menu = document.createElement('div');
  menu.className = 'item-menu';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Remove';
  remove.setAttribute('aria-label', `Remove ${bookmark.title}`);
  remove.addEventListener('click', () => removeBookmark(bookmark, actions));
  menu.append(remove);
  actions.append(summary, menu);

  const editor = document.createElement('form');
  editor.className = 'inline-editor';
  editor.hidden = true;
  const editInput = document.createElement('input');
  editInput.type = 'text';
  editInput.value = bookmark.title;
  editInput.setAttribute('aria-label', 'Edit bookmark title');
  const update = document.createElement('button');
  update.type = 'submit';
  update.textContent = 'Update title';
  editor.append(editInput, update);
  editor.addEventListener('submit', (event) => {
    event.preventDefault();
    updateExistingTitle(bookmark, article, editInput, editor);
  });

  article.append(icon, main, actions, editor);
  return article;
}

function renderCollection() {
  elements.list.replaceChildren();
  const total = state.bookmarks.length;
  elements.collectionTools.hidden = total === 0;

  if (total === 0) {
    elements.collectionCount.textContent = '0 bookmarks';
    elements.list.append(document.querySelector('#empty-template').content.cloneNode(true));
    return;
  }

  renderTagFilters();
  const matches = currentMatches();
  const filtered = Boolean(state.search || state.activeTag);
  elements.collectionCount.textContent = filtered
    ? `${matches.length} of ${total} bookmarks`
    : `${total} ${total === 1 ? 'bookmark' : 'bookmarks'}`;

  if (!matches.length) {
    elements.list.append(document.querySelector('#no-results-template').content.cloneNode(true));
    return;
  }
  for (const bookmark of matches) elements.list.append(buildBookmarkRow(bookmark));
}

async function removeBookmark(bookmark, actions) {
  actions.open = false;
  const index = state.bookmarks.findIndex((item) => item.id === bookmark.id);
  const response = await fetch(`/api/bookmarks/${encodeURIComponent(bookmark.id)}`, { method: 'DELETE' });
  if (!response.ok) {
    setMessage('The bookmark could not be removed');
    return;
  }
  state.bookmarks.splice(index, 1);
  recomputeTagUsage();
  if (state.activeTag && !state.tagUsage.some((tag) => tag.name === state.activeTag)) state.activeTag = '';
  renderCollection();

  clearTimeout(state.undoTimer);
  elements.undoTitle.textContent = bookmark.title;
  elements.undoToast.hidden = false;
  const timerBar = elements.undoToast.querySelector('.undo-timer');
  timerBar.style.animation = 'none';
  requestAnimationFrame(() => { timerBar.style.animation = ''; });

  elements.undoButton.onclick = async () => {
    clearTimeout(state.undoTimer);
    const restoreResponse = await fetch(`/api/bookmarks/${encodeURIComponent(bookmark.id)}/restore`, { method: 'POST' });
    if (!restoreResponse.ok) {
      elements.undoToast.hidden = true;
      return;
    }
    const payload = await restoreResponse.json();
    state.bookmarks.splice(index, 0, payload.bookmark);
    recomputeTagUsage();
    elements.undoToast.hidden = true;
    renderCollection();
  };
  state.undoTimer = setTimeout(() => { elements.undoToast.hidden = true; }, 8000);
}

function focusExistingBookmark(bookmark) {
  state.activeTag = '';
  state.search = '';
  elements.search.value = '';
  renderCollection();
  requestAnimationFrame(() => {
    const row = elements.list.querySelector(`[data-id="${CSS.escape(bookmark.id)}"]`);
    if (!row) return;
    row.classList.add('duplicate-focus');
    const editor = row.querySelector('.inline-editor');
    const input = editor.querySelector('input');
    editor.hidden = false;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus({ preventScroll: true });
    input.select();
  });
}

async function saveBookmark(event) {
  event.preventDefault();
  setMessage();
  const parsed = safeAddress(elements.url.value);
  if (!parsed) {
    setMessage('Enter a complete web address, such as https://example.com');
    elements.url.focus();
    return;
  }

  elements.saveButton.disabled = true;
  try {
    const response = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: parsed.href,
        title: elements.title.value,
        description: state.metadata?.description ?? '',
        iconUrl: state.metadata?.iconUrl ?? '',
        iconText: state.metadata?.iconText ?? parsed.hostname.replace(/^www\./, '').charAt(0),
        tags: state.selectedTags
      })
    });
    const payload = await response.json();
    if (response.status === 409) {
      resetSaveForm();
      setMessage('Already in your collection — the saved bookmark is ready to edit below.', 'success');
      focusExistingBookmark(payload.bookmark);
      return;
    }
    if (!response.ok) throw new Error(payload.error || 'The bookmark could not be saved');
    state.bookmarks.unshift(payload.bookmark);
    recomputeTagUsage();
    resetSaveForm();
    setMessage('Bookmark saved.', 'success');
    renderCollection();
    elements.url.focus();
  } catch (error) {
    setMessage(error.message || 'The bookmark could not be saved');
  } finally {
    elements.saveButton.disabled = false;
  }
}

async function loadCollection() {
  try {
    const response = await fetch('/api/bookmarks');
    if (!response.ok) throw new Error('Unable to load bookmarks');
    const payload = await response.json();
    state.bookmarks = payload.bookmarks;
    state.tagUsage = payload.tags;
    renderCollection();
    elements.app.dataset.harnessReady = 'true';
  } catch {
    elements.list.innerHTML = '<div class="load-error"><strong>Your bookmarks could not be loaded.</strong><br>Please check the connection and try again.<br><button type="button">Try again</button></div>';
    elements.list.querySelector('button').addEventListener('click', loadCollection);
  }
}

elements.url.addEventListener('input', () => {
  clearTimeout(state.lookupTimer);
  state.lookupController?.abort();
  state.metadata = null;
  state.metadataFailed = false;
  state.titleEdited = false;
  elements.lookupCard.hidden = true;
  setMessage();
  const parsed = safeAddress(elements.url.value);
  if (!parsed) return;
  state.lookupTimer = setTimeout(() => lookUpMetadata(parsed.href), 450);
});

elements.title.addEventListener('input', () => { state.titleEdited = true; });
elements.tagInput.addEventListener('input', renderTagSuggestions);
elements.tagInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ',') return;
  event.preventDefault();
  const first = elements.tagSuggestions.querySelector('.tag-suggestion');
  if (first && !elements.tagSuggestions.hidden) first.click();
  else addSelectedTag(elements.tagInput.value.replace(/,$/, ''));
});

elements.search.addEventListener('input', () => {
  state.search = elements.search.value.trim();
  renderCollection();
});

elements.form.addEventListener('submit', saveBookmark);

document.addEventListener('click', (event) => {
  if (!elements.tagComposer.contains(event.target) && !elements.tagSuggestions.contains(event.target)) {
    elements.tagSuggestions.hidden = true;
  }
  document.querySelectorAll('.item-actions[open]').forEach((details) => {
    if (!details.contains(event.target)) details.open = false;
  });
});

loadCollection();
