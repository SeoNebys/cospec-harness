const form = document.querySelector('#save-form');
const input = document.querySelector('#url');
const button = document.querySelector('#save-button');
const emptyState = document.querySelector('#empty-state');
const card = document.querySelector('#bookmark-card');
const count = document.querySelector('#count');
const displayUrl = document.querySelector('#display-url');
const bookmarkTitle = document.querySelector('#bookmark-title');
const bookmarkDescription = document.querySelector('#bookmark-description');
const toast = document.querySelector('#toast');
const inlineEditTrigger = document.querySelector('#inline-edit-trigger');
const moreButton = document.querySelector('.more-button');
const panel = document.querySelector('#edit-panel');
const editTitleInput = document.querySelector('#edit-title-input');
const editDescriptionInput = document.querySelector('#edit-description-input');
const inlineEditor = document.querySelector('#inline-editor');
const inlineTitleInput = document.querySelector('#inline-title-input');
const inlineDescriptionInput = document.querySelector('#inline-description-input');
const tagArea = document.querySelector('#tag-area');
const addTagTrigger = document.querySelector('#add-tag-trigger');
const tagEditor = document.querySelector('#tag-editor');
const tagInput = document.querySelector('#tag-input');
const tagSuggestions = document.querySelector('#tag-suggestions');
const assignedTags = document.querySelector('#assigned-tags');

const mode = new URLSearchParams(window.location.search).get('mode');

function showExistingBookmark() {
  emptyState.hidden = true;
  card.hidden = false;
  count.textContent = '1 saved';
  displayUrl.textContent = 'https://example.com/articles/calm-bookmarking';
}

if (mode === 'inline' || mode === 'panel') {
  showExistingBookmark();
  document.querySelector('.hero').hidden = true;
  document.querySelector('.prototype-badge').textContent = 'Editing prototype';
}

if (mode === 'duplicate') {
  showExistingBookmark();
  input.value = 'https://example.com/articles/calm-bookmarking';
  inlineEditTrigger.hidden = false;
  moreButton.hidden = true;
  document.querySelector('.prototype-badge').textContent = 'Duplicate-link prototype';
}

if (mode === 'tags-dropdown' || mode === 'tags-chips' || mode === 'tags-new') {
  showExistingBookmark();
  document.querySelector('.hero').hidden = true;
  inlineEditTrigger.hidden = true;
  moreButton.hidden = true;
  tagArea.hidden = false;
  document.querySelector('.prototype-badge').textContent = 'Tagging prototype';
  if (mode === 'tags-chips') tagSuggestions.classList.add('chip-style');
}

if (mode === 'inline') {
  inlineEditTrigger.hidden = false;
  moreButton.hidden = true;
}

if (mode === 'panel') {
  moreButton.setAttribute('aria-label', 'Edit bookmark details');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!input.reportValidity()) return;

  if (mode === 'duplicate' && input.value === displayUrl.textContent) {
    toast.querySelector('span:last-child').textContent = 'Already saved — showing your existing bookmark';
    toast.hidden = false;
    card.classList.add('is-existing');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      toast.hidden = true;
      card.classList.remove('is-existing');
    }, 3200);
    return;
  }

  button.disabled = true;
  button.querySelector('span:first-child').textContent = 'Gathering details…';

  window.setTimeout(() => {
    const enteredUrl = input.value;
    emptyState.hidden = true;
    card.hidden = false;
    count.textContent = '1 saved';
    displayUrl.textContent = enteredUrl;
    bookmarkTitle.href = enteredUrl;
    button.disabled = false;
    button.querySelector('span:first-child').textContent = 'Save link';
    toast.hidden = false;
    window.setTimeout(() => { toast.hidden = true; }, 3200);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 850);
});

function openPanel() {
  editTitleInput.value = bookmarkTitle.textContent;
  editDescriptionInput.value = bookmarkDescription.textContent;
  panel.hidden = false;
  editTitleInput.focus();
}

inlineEditTrigger.addEventListener('click', () => {
  inlineTitleInput.value = bookmarkTitle.textContent;
  inlineDescriptionInput.value = bookmarkDescription.textContent;
  bookmarkTitle.parentElement.hidden = true;
  bookmarkDescription.hidden = true;
  inlineEditTrigger.hidden = true;
  inlineEditor.hidden = false;
  inlineTitleInput.focus();
});
moreButton.addEventListener('click', () => {
  if (mode === 'panel') openPanel();
});

function closePanel() { panel.hidden = true; }
document.querySelector('#close-panel').addEventListener('click', closePanel);
document.querySelector('#cancel-edit').addEventListener('click', closePanel);
document.querySelector('#apply-edit').addEventListener('click', () => {
  bookmarkTitle.textContent = editTitleInput.value;
  bookmarkDescription.textContent = editDescriptionInput.value;
  closePanel();
  toast.querySelector('span:last-child').textContent = 'Bookmark details updated';
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 2600);
});

function closeInlineEditor() {
  inlineEditor.hidden = true;
  bookmarkTitle.parentElement.hidden = false;
  bookmarkDescription.hidden = false;
  inlineEditTrigger.hidden = false;
}

document.querySelector('#inline-cancel').addEventListener('click', closeInlineEditor);
document.querySelector('#inline-apply').addEventListener('click', () => {
  bookmarkTitle.textContent = inlineTitleInput.value;
  bookmarkDescription.textContent = inlineDescriptionInput.value;
  closeInlineEditor();
  toast.querySelector('span:last-child').textContent = 'Bookmark details updated';
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 2600);
});

const existingTags = ['Design', 'Development', 'Research', 'Reading', 'Inspiration'];

function renderTagSuggestions(query = '') {
  const matches = existingTags.filter((tag) => tag.toLowerCase().includes(query.toLowerCase()));
  tagSuggestions.innerHTML = '';
  const attachTag = (tag, isNew = false) => {
    const pill = document.createElement('span');
    pill.className = 'tag-pill';
    pill.textContent = tag;
    assignedTags.appendChild(pill);
    tagEditor.hidden = true;
    addTagTrigger.hidden = false;
    toast.querySelector('span:last-child').textContent = isNew ? `Created and added “${tag}”` : `Added existing tag “${tag}”`;
    toast.hidden = false;
    window.setTimeout(() => { toast.hidden = true; }, 2600);
  };
  matches.forEach((tag) => {
    const suggestion = document.createElement('button');
    suggestion.type = 'button';
    suggestion.className = 'suggestion';
    suggestion.setAttribute('role', 'option');
    suggestion.innerHTML = `<span>${tag}</span><small>existing tag</small>`;
    suggestion.addEventListener('click', () => attachTag(tag));
    tagSuggestions.appendChild(suggestion);
  });
  const cleanedQuery = query.trim();
  const exactMatch = existingTags.some((tag) => tag.toLowerCase() === cleanedQuery.toLowerCase());
  if (mode === 'tags-new' && cleanedQuery && !exactMatch) {
    const create = document.createElement('button');
    create.type = 'button';
    create.className = 'suggestion create-new';
    create.innerHTML = `<span>Create “${cleanedQuery}”</span><small>new tag</small>`;
    create.addEventListener('click', () => attachTag(cleanedQuery, true));
    tagSuggestions.appendChild(create);
  }
}

addTagTrigger.addEventListener('click', () => {
  addTagTrigger.hidden = true;
  tagEditor.hidden = false;
  tagInput.value = '';
  renderTagSuggestions();
  tagInput.focus();
});

tagInput.addEventListener('input', () => renderTagSuggestions(tagInput.value));
