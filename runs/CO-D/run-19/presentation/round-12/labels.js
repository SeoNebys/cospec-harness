const mode = new URLSearchParams(window.location.search).get('mode') || 'direct';
const card = document.querySelector('#label-card');
const display = document.querySelector('#bookmark-display');
const editForm = document.querySelector('#bookmark-edit-form');
const editButton = document.querySelector('#edit-button');
const cancelEdit = document.querySelector('#cancel-edit');
const labelsElement = document.querySelector('#labels');
const addLabelButton = document.querySelector('#add-label-button');
const quickForm = document.querySelector('#quick-label-form');
const quickInput = document.querySelector('#quick-label-input');
const editorLabelField = document.querySelector('#editor-label-field');
const editorLabelInput = document.querySelector('#editor-label-input');
const toast = document.querySelector('#toast');
const labels = ['design'];

if (mode === 'editor') addLabelButton.hidden = true;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function renderLabels() {
  labelsElement.replaceChildren(...labels.map((label) => {
    const chip = document.createElement('span');
    chip.className = 'label-chip';
    chip.textContent = label;
    return chip;
  }));
  document.querySelector('#editor-current-labels').textContent = labels.join(', ');
}

function addLabel(value) {
  const label = value.trim();
  if (label && !labels.some((existing) => existing.toLowerCase() === label.toLowerCase())) labels.push(label);
  renderLabels();
}

card.addEventListener('click', (event) => {
  if (event.target.closest('a, button, input, textarea, form')) return;
  window.open('https://alistapart.com/article/designing-for-long-form-content/', '_blank', 'noopener,noreferrer');
});

addLabelButton.addEventListener('click', () => {
  addLabelButton.hidden = true;
  quickForm.hidden = false;
  quickInput.focus();
});

document.querySelector('#cancel-label').addEventListener('click', () => {
  quickForm.hidden = true;
  addLabelButton.hidden = false;
});

quickForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addLabel(quickInput.value);
  quickInput.value = '';
  quickForm.hidden = true;
  addLabelButton.hidden = false;
  showToast('Label added.');
});

editButton.addEventListener('click', () => {
  display.hidden = true;
  document.querySelector('.label-area').hidden = true;
  editForm.hidden = false;
  editorLabelField.hidden = mode !== 'editor';
  document.querySelector('#edit-title').focus();
});

cancelEdit.addEventListener('click', () => {
  editForm.hidden = true;
  display.hidden = false;
  document.querySelector('.label-area').hidden = false;
  editButton.focus();
});

editForm.addEventListener('submit', (event) => {
  event.preventDefault();
  document.querySelector('#shown-title').textContent = document.querySelector('#edit-title').value;
  document.querySelector('#shown-description').textContent = document.querySelector('#edit-description').value;
  if (mode === 'editor') addLabel(editorLabelInput.value);
  editorLabelInput.value = '';
  editForm.hidden = true;
  display.hidden = false;
  document.querySelector('.label-area').hidden = false;
  showToast(mode === 'editor' ? 'Changes and labels saved.' : 'Changes saved.');
});
