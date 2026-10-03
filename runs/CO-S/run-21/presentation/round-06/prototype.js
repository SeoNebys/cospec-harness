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
