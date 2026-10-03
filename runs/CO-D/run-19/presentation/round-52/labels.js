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
const quickSubmit = document.querySelector('#quick-add-submit');
const editorLabelField = document.querySelector('#editor-label-field');
const editorLabelInput = document.querySelector('#editor-label-input');
const suggestions = document.querySelector('#label-suggestions');
const toast = document.querySelector('#toast');
const labels = ['design'];
const labelLibrary = ['design', 'typography', 'design systems', 'reading', 'research'];

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
    const text = document.createElement('span');
    text.textContent = label;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-label';
    remove.setAttribute('aria-label', `Remove ${label} from bookmark`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      labels.splice(labels.indexOf(label), 1);
      renderLabels();
      showToast('Label removed from this bookmark.');
    });
    chip.append(text, remove);
    return chip;
  }));
  document.querySelector('#editor-current-labels').textContent = labels.join(', ');
}

renderLabels();

function addLabel(value) {
  const label = value.trim();
  if (!label || labels.some((existing) => existing.toLowerCase() === label.toLowerCase())) return false;
  labels.push(label);
  renderLabels();
  return true;
}

function hideSuggestions() {
  suggestions.hidden = true;
  quickInput.setAttribute('aria-expanded', 'false');
}

function chooseSuggestion(label) {
  addLabel(label);
  quickInput.value = '';
  quickForm.hidden = true;
  addLabelButton.hidden = false;
  hideSuggestions();
  showToast('Existing label added.');
}

function updateSuggestions() {
  const query = quickInput.value.trim().toLowerCase();
  const matches = labelLibrary.filter((label) => label.includes(query) && !labels.includes(label));
  suggestions.replaceChildren(...matches.map((label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'label-suggestion';
    button.setAttribute('role', 'option');
    button.innerHTML = `<span>${label}</span><small>Use existing</small>`;
    button.addEventListener('click', () => chooseSuggestion(label));
    return button;
  }));
  suggestions.hidden = !query || matches.length === 0;
  quickInput.setAttribute('aria-expanded', String(!suggestions.hidden));
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

quickInput.addEventListener('input', updateSuggestions);
quickInput.addEventListener('input', () => { quickSubmit.disabled = !quickInput.value.trim(); });

document.querySelector('#cancel-label').addEventListener('click', () => {
  quickForm.hidden = true;
  addLabelButton.hidden = false;
  hideSuggestions();
});

quickForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const added = addLabel(quickInput.value);
  quickInput.value = '';
  quickSubmit.disabled = true;
  quickForm.hidden = true;
  addLabelButton.hidden = false;
  hideSuggestions();
  showToast(added ? 'Label added.' : 'That label is already on this bookmark.');
});

editButton.addEventListener('click', () => {
  display.hidden = true;
  document.querySelector('.label-area').hidden = true;
  editForm.hidden = false;
  editorLabelField.hidden = mode === 'direct';
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
  const labelAdded = mode !== 'direct' && editorLabelInput.value.trim() ? addLabel(editorLabelInput.value) : null;
  editorLabelInput.value = '';
  editForm.hidden = true;
  display.hidden = false;
  document.querySelector('.label-area').hidden = false;
  showToast(labelAdded === false ? 'Changes saved. That label was already attached.' : mode !== 'direct' ? 'Changes and labels saved.' : 'Changes saved.');
});
