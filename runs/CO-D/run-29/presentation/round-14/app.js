const captureView = document.querySelector('#captureView');
const libraryView = document.querySelector('#libraryView');
const detailView = document.querySelector('#detailView');
const saveForm = document.querySelector('#saveForm');
const urlInput = document.querySelector('#urlInput');
const savedUrl = document.querySelector('#savedUrl');
const saveButton = document.querySelector('#saveButton');
const updateButton = document.querySelector('#updateButton');
const backButton = document.querySelector('#backButton');
const toast = document.querySelector('#toast');
const directEditButton = document.querySelector('#directEditButton');
const menuEditButton = document.querySelector('#menuEditButton');
const moreButton = document.querySelector('#moreButton');
const actionMenu = document.querySelector('#actionMenu');
const addButton = document.querySelector('#addButton');
const rowTitle = document.querySelector('#rowTitle');
const rowDescription = document.querySelector('#rowDescription');
const titleInput = document.querySelector('#titleInput');
const descriptionInput = document.querySelector('#descriptionInput');
const chipTagInput = document.querySelector('#chipTagInput');
const commaTagInput = document.querySelector('#commaTagInput');
const editorTags = document.querySelector('#editorTags');
const rowTags = document.querySelector('#rowTags');
const tagSuggestions = document.querySelector('#tagSuggestions');

const params = new URLSearchParams(window.location.search);
const editVariant = params.get('edit') === 'direct' ? 'direct' : 'menu';
const tagVariant = params.get('tagstyle') === 'commas' ? 'commas' : 'chips';
const defaultUrl = 'https://afar.com/magazine/a-perfect-day-in-rome';
let tags = [];
const knownTags = ['travel', 'article', 'book', 'Rome'];

function normaliseTags(values) {
  const unique = [];
  values.map(value => value.trim()).filter(Boolean).forEach(value => {
    if (!unique.some(tag => tag.toLowerCase() === value.toLowerCase())) unique.push(value);
  });
  return unique;
}

function renderEditorTags() {
  editorTags.replaceChildren();
  tags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'editor-tag';
    chip.append(document.createTextNode(tag));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-tag';
    remove.setAttribute('aria-label', `Remove ${tag} tag`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      tags = tags.filter(value => value !== tag);
      renderEditorTags();
    });
    chip.append(remove);
    editorTags.append(chip);
  });
}

function renderRowTags() {
  rowTags.replaceChildren();
  tags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag';
    chip.textContent = tag;
    rowTags.append(chip);
  });
}

function addTag(value) {
  tags = normaliseTags([...tags, value]);
  chipTagInput.value = '';
  renderEditorTags();
  renderSuggestions();
}

function matchingSuggestions() {
  const query = chipTagInput.value.trim().toLowerCase();
  if (!query) return [];
  return knownTags.filter(tag =>
    tag.toLowerCase().includes(query) &&
    !tags.some(selected => selected.toLowerCase() === tag.toLowerCase())
  );
}

function renderSuggestions() {
  const matches = matchingSuggestions();
  tagSuggestions.replaceChildren();
  matches.forEach(tag => {
    const suggestion = document.createElement('button');
    suggestion.type = 'button';
    suggestion.className = 'tag-suggestion';
    suggestion.setAttribute('role', 'option');
    const name = document.createElement('span');
    name.textContent = tag;
    const note = document.createElement('span');
    note.textContent = 'Used before';
    suggestion.append(name, note);
    suggestion.addEventListener('click', () => addTag(tag));
    tagSuggestions.append(suggestion);
  });
  tagSuggestions.hidden = matches.length === 0;
  chipTagInput.setAttribute('aria-expanded', String(matches.length > 0));
}

function showView(view) {
  captureView.hidden = view !== captureView;
  libraryView.hidden = view !== libraryView;
  detailView.hidden = view !== detailView;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 1800);
}

function openEditor() {
  savedUrl.value = savedUrl.value || defaultUrl;
  titleInput.value = rowTitle.textContent;
  descriptionInput.value = rowDescription.textContent;
  renderEditorTags();
  commaTagInput.value = tags.join(', ');
  document.querySelector('.saved-banner').hidden = true;
  showView(detailView);
  titleInput.focus();
}

if (editVariant === 'menu') {
  document.querySelector('.direct-action').hidden = true;
  document.querySelector('.menu-action').hidden = false;
}

if (tagVariant === 'commas') {
  document.querySelector('.chips-tag-editor').hidden = true;
  document.querySelector('.comma-tag-editor').hidden = false;
}

if (params.get('mode') === 'library') {
  savedUrl.value = defaultUrl;
  showView(libraryView);
}

saveForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!saveForm.reportValidity()) return;

  saveButton.disabled = true;
  saveButton.textContent = 'Finding details…';

  window.setTimeout(() => {
    savedUrl.value = urlInput.value;
    document.querySelector('.saved-banner').hidden = false;
    showView(detailView);
    saveButton.disabled = false;
    saveButton.textContent = 'Save bookmark';
    titleInput.focus();
  }, 650);
});

updateButton.addEventListener('click', () => {
  if (!savedUrl.reportValidity()) return;
  if (tagVariant === 'commas') {
    tags = normaliseTags(commaTagInput.value.split(','));
  }
  rowTitle.textContent = titleInput.value;
  rowDescription.textContent = descriptionInput.value;
  document.querySelector('#bookmarkLink').href = savedUrl.value;
  try {
    document.querySelector('.row-url').textContent = new URL(savedUrl.value).hostname.replace(/^www\./, '');
  } catch {
    document.querySelector('.row-url').textContent = savedUrl.value;
  }
  renderRowTags();
  showToast('Changes saved');
});

chipTagInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const matches = matchingSuggestions();
  addTag(matches[0] || chipTagInput.value);
});

chipTagInput.addEventListener('input', renderSuggestions);

backButton.addEventListener('click', () => showView(libraryView));

addButton.addEventListener('click', () => {
  showView(captureView);
  urlInput.focus();
});

directEditButton.addEventListener('click', openEditor);
menuEditButton.addEventListener('click', openEditor);
moreButton.addEventListener('click', () => {
  const willOpen = actionMenu.hidden;
  actionMenu.hidden = !willOpen;
  moreButton.setAttribute('aria-expanded', String(willOpen));
});
