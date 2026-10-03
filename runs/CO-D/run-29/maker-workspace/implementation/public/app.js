const state = {
  bookmarks: [],
  current: null,
  selectedTags: [],
  allTags: [],
  searchTimer: null,
  openMenu: null
};

const $ = selector => document.querySelector(selector);
const views = ['#collectionView', '#captureView', '#editorView'].map($);
const app = $('#app');
const collectionView = $('#collectionView');
const captureView = $('#captureView');
const editorView = $('#editorView');
const bookmarkList = $('#bookmarkList');
const searchInput = $('#searchInput');
const searchMessage = $('#searchMessage');
const emptyCollection = $('#emptyCollection');
const emptySearch = $('#emptySearch');
const collectionCount = $('#collectionCount');
const clearSearchButton = $('#clearSearchButton');
const captureForm = $('#captureForm');
const addressInput = $('#addressInput');
const captureError = $('#captureError');
const captureSubmit = $('#captureSubmit');
const editorForm = $('#editorForm');
const titleInput = $('#titleInput');
const descriptionInput = $('#descriptionInput');
const savedAddressInput = $('#savedAddressInput');
const editorAddressError = $('#editorAddressError');
const notesInput = $('#notesInput');
const notePreview = $('#notePreview');
const tagInput = $('#tagInput');
const selectedTags = $('#selectedTags');
const tagSuggestions = $('#tagSuggestions');
const saveChangesButton = $('#saveChangesButton');

function showView(target) {
  views.forEach(view => { view.hidden = view !== target; });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) }
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || 'Something went wrong.');
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function loadCollection() {
  showView(collectionView);
  const query = searchInput.value.trim();
  clearSearchButton.hidden = !query;
  try {
    const payload = await api(`/api/bookmarks?q=${encodeURIComponent(query)}`);
    if (payload.status === 'incomplete') {
      state.bookmarks = [];
      renderCollection();
      searchMessage.textContent = payload.message;
      searchMessage.hidden = false;
      emptySearch.hidden = true;
      collectionCount.textContent = 'Waiting for the rest of your search';
      return;
    }
    searchMessage.hidden = true;
    state.bookmarks = payload.results;
    renderCollection();
  } catch {
    searchMessage.textContent = 'The collection could not be loaded. Your saved bookmarks have not been changed.';
    searchMessage.hidden = false;
  }
}

function renderCollection() {
  bookmarkList.replaceChildren();
  const query = searchInput.value.trim();
  collectionCount.textContent = `${state.bookmarks.length} bookmark${state.bookmarks.length === 1 ? '' : 's'}`;
  emptyCollection.hidden = query || state.bookmarks.length > 0;
  emptySearch.hidden = !query || state.bookmarks.length > 0;
  state.bookmarks.forEach(bookmark => bookmarkList.append(createBookmarkCard(bookmark)));
}

function createBookmarkCard(bookmark) {
  const card = element('article', 'bookmark-card');
  const preview = element('div', 'card-preview');
  if (bookmark.previewUrl) {
    const image = document.createElement('img');
    image.src = bookmark.previewUrl;
    image.alt = '';
    image.addEventListener('error', () => replaceWithFallback(preview, bookmark.siteName));
    preview.append(image);
  } else {
    preview.append(fallbackLetter(bookmark.siteName));
  }

  const copy = element('div', 'card-copy');
  const site = element('div', 'card-site');
  if (bookmark.iconUrl) {
    const icon = element('img', 'favicon');
    icon.src = bookmark.iconUrl;
    icon.alt = '';
    icon.addEventListener('error', () => icon.replaceWith(faviconFallback(bookmark.siteName)));
    site.append(icon);
  } else site.append(faviconFallback(bookmark.siteName));
  site.append(document.createTextNode(bookmark.siteName || hostname(bookmark.address)));

  const link = element('a', 'card-title-link');
  link.href = bookmark.address;
  link.target = '_blank';
  link.rel = 'noreferrer';
  const title = element('h2', 'card-title');
  title.textContent = bookmark.title;
  link.append(title);

  const description = element('p', 'card-description');
  description.textContent = bookmark.description || 'No description yet.';
  const tags = element('div', 'card-tags');
  renderCardTags(tags, bookmark.tags);
  copy.append(site, link, description);
  if (bookmark.matchExcerpt) {
    const note = element('p', 'note-match');
    note.textContent = `Matched in your notes: ${bookmark.matchExcerpt}`;
    copy.append(note);
  }
  copy.append(tags);
  const address = element('span', 'card-address');
  address.textContent = hostname(bookmark.address);
  copy.append(address);

  const menu = element('div', 'card-menu');
  const trigger = element('button', 'menu-trigger');
  trigger.type = 'button';
  trigger.setAttribute('aria-label', `More actions for ${bookmark.title}`);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.append(element('span'), element('span'), element('span'));
  const actions = element('div', 'action-menu');
  actions.hidden = true;
  const edit = element('button');
  edit.type = 'button';
  edit.textContent = 'Edit bookmark';
  edit.addEventListener('click', () => openEditor(bookmark));
  actions.append(edit);
  trigger.addEventListener('click', event => {
    event.stopPropagation();
    closeOpenMenu();
    actions.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    state.openMenu = { actions, trigger };
  });
  menu.append(trigger, actions);
  card.append(preview, copy, menu);
  return card;
}

function renderCardTags(container, tags) {
  const render = expanded => {
    container.replaceChildren();
    const visible = expanded ? tags : tags.slice(0, 4);
    visible.forEach(tag => {
      const button = element('button', 'tag-pill');
      button.type = 'button';
      button.textContent = tag;
      button.addEventListener('click', () => {
        searchInput.value = `#${tag}`;
        loadCollection();
      });
      container.append(button);
    });
    if (!expanded && tags.length > 4) {
      const more = element('button', 'tag-pill more-tags');
      more.type = 'button';
      more.textContent = `+${tags.length - 4} more`;
      more.addEventListener('click', () => render(true));
      container.append(more);
    }
  };
  render(false);
}

function showCapture() {
  captureForm.reset();
  clearCaptureError();
  showView(captureView);
  addressInput.focus();
}

async function saveNewBookmark(event) {
  event.preventDefault();
  clearCaptureError();
  captureSubmit.disabled = true;
  captureSubmit.textContent = 'Saving safely…';
  try {
    const payload = await api('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ address: addressInput.value })
    });
    const notices = {
      existing: ['Already in your collection', 'We opened your existing bookmark—no second copy was made.', 'warning'],
      created: ['Bookmark saved', 'We found the page details for you.', 'success'],
      'created-basic': ['Saved with basic details', 'We couldn’t reach this page. Fill in the missing details now or later.', 'warning']
    };
    openEditor(payload.bookmark, notices[payload.outcome]);
  } catch (error) {
    captureError.textContent = error.message;
    captureError.hidden = false;
    $('#addressShell').classList.add('has-error');
    addressInput.setAttribute('aria-invalid', 'true');
    addressInput.focus();
  } finally {
    captureSubmit.disabled = false;
    captureSubmit.textContent = 'Save bookmark';
  }
}

async function openEditor(bookmark, notice = null) {
  state.current = bookmark;
  state.selectedTags = [...bookmark.tags];
  titleInput.value = bookmark.title;
  descriptionInput.value = bookmark.description;
  savedAddressInput.value = bookmark.address;
  notesInput.value = bookmark.notes;
  editorAddressError.hidden = true;
  $('#saveState').textContent = `Saved ${relativeTime(bookmark.updatedAt)}`;
  renderSelectedTags();
  renderNote();
  renderPagePreview(bookmark);
  await loadAllTags();
  setNotice(notice);
  showView(editorView);
}

function renderPagePreview(bookmark) {
  const image = $('#previewImage');
  const fallback = $('#previewFallback');
  if (bookmark.previewUrl) {
    image.src = bookmark.previewUrl;
    image.hidden = false;
    fallback.hidden = true;
    image.onerror = () => { image.hidden = true; fallback.hidden = false; };
  } else {
    image.hidden = true;
    fallback.hidden = false;
  }
  $('#siteName').textContent = bookmark.siteName || hostname(bookmark.address);
  const icon = $('#siteIcon');
  const initial = $('#siteInitial');
  if (bookmark.iconUrl) {
    icon.src = bookmark.iconUrl;
    icon.hidden = false;
    initial.hidden = true;
    icon.onerror = () => { icon.hidden = true; initial.hidden = false; };
  } else {
    icon.hidden = true;
    initial.hidden = false;
  }
  initial.textContent = (bookmark.siteName || hostname(bookmark.address) || '?')[0].toUpperCase();
}

function setNotice(notice) {
  const container = $('#editorNotice');
  if (!notice) { container.hidden = true; return; }
  const [title, text, kind] = notice;
  $('#noticeTitle').textContent = title;
  $('#noticeText').textContent = text;
  $('#noticeIcon').textContent = kind === 'warning' ? '!' : '✓';
  container.classList.toggle('warning', kind === 'warning');
  container.hidden = false;
}

async function saveChanges(event) {
  event.preventDefault();
  editorAddressError.hidden = true;
  saveChangesButton.disabled = true;
  saveChangesButton.textContent = 'Saving…';
  try {
    const payload = await api(`/api/bookmarks/${state.current.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: titleInput.value,
        description: descriptionInput.value,
        address: savedAddressInput.value,
        notes: notesInput.value,
        tags: state.selectedTags
      })
    });
    state.current = payload.bookmark;
    titleInput.value = payload.bookmark.title;
    savedAddressInput.value = payload.bookmark.address;
    $('#saveState').textContent = 'Saved just now';
    showToast('Changes saved');
  } catch (error) {
    editorAddressError.textContent = error.message;
    editorAddressError.hidden = false;
    savedAddressInput.focus();
  } finally {
    saveChangesButton.disabled = false;
    saveChangesButton.textContent = 'Save changes';
  }
}

async function loadAllTags() {
  try { state.allTags = (await api('/api/tags')).tags; }
  catch { state.allTags = []; }
}

function renderSelectedTags() {
  selectedTags.replaceChildren();
  state.selectedTags.forEach(tag => {
    const chip = element('span', 'selected-tag');
    chip.append(document.createTextNode(tag));
    const remove = element('button', 'remove-tag');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${tag} tag`);
    remove.addEventListener('click', () => {
      state.selectedTags = state.selectedTags.filter(value => value !== tag);
      renderSelectedTags();
      renderTagSuggestions();
    });
    chip.append(remove);
    selectedTags.append(chip);
  });
}

function renderTagSuggestions() {
  const query = tagInput.value.trim();
  tagSuggestions.replaceChildren();
  if (!query) return closeTagSuggestions();
  const existing = state.selectedTags.find(tag => tag.toLocaleLowerCase() === query.toLocaleLowerCase());
  if (existing) {
    const message = element('div', 'duplicate-tag-message');
    message.textContent = `${existing} is already added`;
    tagSuggestions.append(message);
    return openTagSuggestions();
  }
  const selectedKeys = new Set(state.selectedTags.map(tag => tag.toLocaleLowerCase()));
  const matches = state.allTags.filter(tag =>
    !selectedKeys.has(tag.toLocaleLowerCase()) && tag.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  matches.forEach(tag => {
    const button = element('button', 'tag-suggestion');
    button.type = 'button';
    const label = document.createElement('span');
    label.textContent = tag;
    const hint = document.createElement('small');
    hint.textContent = 'Used before';
    button.append(label, hint);
    button.addEventListener('click', () => addTag(tag));
    tagSuggestions.append(button);
  });
  matches.length ? openTagSuggestions() : closeTagSuggestions();
}

function addTag(value) {
  const cleaned = value.trim();
  if (!cleaned) return;
  const established = state.allTags.find(tag => tag.toLocaleLowerCase() === cleaned.toLocaleLowerCase());
  const spelling = established || cleaned;
  if (!state.selectedTags.some(tag => tag.toLocaleLowerCase() === spelling.toLocaleLowerCase())) state.selectedTags.push(spelling);
  tagInput.value = '';
  renderSelectedTags();
  closeTagSuggestions();
}

function renderNote() {
  notePreview.replaceChildren();
  const lines = notesInput.value.split(/\r?\n/);
  let list = null;
  let content = false;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      list = null;
      const heading = document.createElement('h3');
      appendInlineFormatting(heading, line.slice(3));
      notePreview.append(heading);
      content = true;
    } else if (line.startsWith('- ')) {
      if (!list) { list = document.createElement('ul'); notePreview.append(list); }
      const item = document.createElement('li');
      appendInlineFormatting(item, line.slice(2));
      list.append(item);
      content = true;
    } else if (line.trim()) {
      list = null;
      const paragraph = document.createElement('p');
      appendInlineFormatting(paragraph, line);
      notePreview.append(paragraph);
      content = true;
    } else list = null;
  }
  if (!content) {
    const placeholder = element('p', 'note-placeholder');
    placeholder.textContent = 'Your formatted note will appear here.';
    notePreview.append(placeholder);
  }
}

function appendInlineFormatting(container, text) {
  text.split(/(\*\*[^*]+\*\*)/g).forEach(piece => {
    if (piece.startsWith('**') && piece.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = piece.slice(2, -2);
      container.append(strong);
    } else container.append(document.createTextNode(piece));
  });
}

function applyFormatting(kind) {
  const start = notesInput.selectionStart;
  const end = notesInput.selectionEnd;
  const value = notesInput.value;
  if (kind === 'bold') {
    notesInput.setRangeText(`**${value.slice(start, end) || 'bold text'}**`, start, end, 'end');
  } else {
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const nextBreak = value.indexOf('\n', end);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const prefix = kind === 'heading' ? '## ' : '- ';
    const replacement = value.slice(lineStart, lineEnd).split('\n').map(line => line.startsWith(prefix) ? line : `${prefix}${line}`).join('\n');
    notesInput.setRangeText(replacement, lineStart, lineEnd, 'end');
  }
  notesInput.focus();
  renderNote();
}

function clearCaptureError() {
  captureError.hidden = true;
  $('#addressShell').classList.remove('has-error');
  addressInput.removeAttribute('aria-invalid');
}

function closeOpenMenu() {
  if (!state.openMenu) return;
  state.openMenu.actions.hidden = true;
  state.openMenu.trigger.setAttribute('aria-expanded', 'false');
  state.openMenu = null;
}

function closeTagSuggestions() {
  tagSuggestions.hidden = true;
  tagInput.setAttribute('aria-expanded', 'false');
}

function openTagSuggestions() {
  tagSuggestions.hidden = false;
  tagInput.setAttribute('aria-expanded', 'true');
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function element(tag, className = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function fallbackLetter(name) {
  const node = element('span', 'fallback-letter');
  node.textContent = (name || '?')[0].toUpperCase();
  return node;
}

function faviconFallback(name) {
  const node = element('span', 'favicon-fallback');
  node.textContent = (name || '?')[0].toUpperCase();
  return node;
}

function replaceWithFallback(container, name) {
  container.replaceChildren(fallbackLetter(name));
}

function hostname(address) {
  try { return new URL(address).hostname.replace(/^www\./, ''); }
  catch { return address; }
}

function relativeTime(value) {
  const delta = Date.now() - new Date(value).getTime();
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} minutes ago`;
  return new Date(value).toLocaleDateString();
}

$('#addBookmarkButton').addEventListener('click', showCapture);
$('.empty-add').addEventListener('click', showCapture);
$('#homeButton').addEventListener('click', () => { searchInput.value = ''; loadCollection(); });
document.querySelectorAll('.back-to-collection').forEach(button => button.addEventListener('click', loadCollection));
captureForm.addEventListener('submit', saveNewBookmark);
addressInput.addEventListener('input', clearCaptureError);
editorForm.addEventListener('submit', saveChanges);
notesInput.addEventListener('input', renderNote);
savedAddressInput.addEventListener('input', () => { editorAddressError.hidden = true; });
tagInput.addEventListener('input', renderTagSuggestions);
tagInput.addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const query = tagInput.value.trim();
  const existing = state.selectedTags.find(tag => tag.toLocaleLowerCase() === query.toLocaleLowerCase());
  if (existing) { renderTagSuggestions(); return; }
  const suggestion = state.allTags.find(tag => tag.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && !state.selectedTags.some(selected => selected.toLocaleLowerCase() === tag.toLocaleLowerCase()));
  addTag(suggestion || query);
});
$('.format-toolbar').querySelectorAll('button').forEach(button => button.addEventListener('click', () => applyFormatting(button.dataset.format)));
searchInput.addEventListener('input', () => {
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(loadCollection, 120);
});
clearSearchButton.addEventListener('click', () => { searchInput.value = ''; loadCollection(); searchInput.focus(); });
document.addEventListener('click', event => {
  if (!event.target.closest('.card-menu')) closeOpenMenu();
  if (!event.target.closest('.tag-field')) closeTagSuggestions();
});

await loadCollection();
app.dataset.harnessReady = 'true';
