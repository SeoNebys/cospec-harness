const form = document.querySelector('#existing-label-form');
const input = document.querySelector('#existing-label');
const multipleMode = new URLSearchParams(window.location.search).get('multiple') === '1';
const duplicateMode = new URLSearchParams(window.location.search).get('duplicate') === '1';

if (multipleMode || duplicateMode) {
  document.querySelector('#tag-row').hidden = false;
  document.querySelector('#saved-label').textContent = 'learning';
  input.value = duplicateMode ? 'Learning' : 'reference';
  document.querySelector('.label-editor label').textContent = 'Add another label to this bookmark';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const label = input.value.trim();
  if (!label) return;
  const tagRow = document.querySelector('#tag-row');
  const existingLabels = [...tagRow.querySelectorAll('.tag-chip')].map((chip) => chip.textContent.toLocaleLowerCase());
  if (existingLabels.includes(label.toLocaleLowerCase())) {
    document.querySelector('#duplicate-label-note').hidden = false;
    return;
  }
  if (multipleMode) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.textContent = label;
    tagRow.append(chip);
  } else {
    document.querySelector('#saved-label').textContent = label;
  }
  tagRow.hidden = false;
  form.hidden = true;
});
