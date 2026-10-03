const params = new URLSearchParams(window.location.search);
const requestedMode = params.get('mode');
const mode = requestedMode === 'pick' ? 'pick' : requestedMode === 'suggest' ? 'suggest' : 'type';
const panel = document.querySelector('#tag-panel');
const scrim = document.querySelector('#scrim');
const selectedTags = document.querySelector('#selected-tags');
const tagInput = document.querySelector('#tag-input');
const suggestionBox = document.querySelector('#tag-suggestions');
const existingTags = [
  { name: 'animals', count: 4 },
  { name: 'animal behavior', count: 2 },
  { name: 'nature', count: 7 },
  { name: 'research', count: 3 },
];
let tags = ['science'];

document.querySelector('#type-method').hidden = mode === 'pick';
document.querySelector('#pick-method').hidden = mode !== 'pick';

function drawSelectedTags() {
  selectedTags.innerHTML = '';
  tags.forEach((tag) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tag = tag;
    button.innerHTML = `${tag} <span aria-label="Remove ${tag}">×</span>`;
    button.addEventListener('click', () => {
      tags = tags.filter((item) => item !== tag);
      drawSelectedTags();
      syncChoices();
    });
    selectedTags.append(button);
  });
}

function syncChoices() {
  document.querySelectorAll('[data-choice]').forEach((choice) => {
    choice.classList.toggle('selected', tags.includes(choice.dataset.choice));
  });
}

function addTypedTag() {
  const tag = tagInput.value.trim().toLowerCase();
  if (tag && !tags.includes(tag)) tags.push(tag);
  tagInput.value = '';
  drawSelectedTags();
  renderSuggestions();
}

function chooseSuggestedTag(tag) {
  if (!tags.includes(tag)) tags.push(tag);
  tagInput.value = '';
  drawSelectedTags();
  renderSuggestions();
  tagInput.focus();
}

function renderSuggestions() {
  const query = tagInput.value.trim().toLowerCase();
  const matches = mode === 'suggest' && query
    ? existingTags.filter((tag) => tag.name.includes(query) && !tags.includes(tag.name))
    : [];
  suggestionBox.innerHTML = '';
  matches.forEach((tag) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.innerHTML = `<strong>${tag.name}</strong><span>used on ${tag.count} bookmarks</span>`;
    option.addEventListener('click', () => chooseSuggestedTag(tag.name));
    suggestionBox.append(option);
  });
  suggestionBox.hidden = matches.length === 0;
  tagInput.setAttribute('aria-expanded', String(matches.length > 0));
}

function closePanel() { panel.hidden = true; scrim.hidden = true; }

document.querySelector('#edit-tags-button').addEventListener('click', () => {
  panel.hidden = false;
  scrim.hidden = false;
  if (mode === 'type') tagInput.focus();
});
document.querySelector('#close-panel').addEventListener('click', closePanel);
document.querySelector('.cancel-edit').addEventListener('click', closePanel);
scrim.addEventListener('click', closePanel);
document.querySelector('#add-tag-button').addEventListener('click', addTypedTag);
tagInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addTypedTag(); } });
tagInput.addEventListener('input', renderSuggestions);
document.querySelectorAll('[data-choice]').forEach((choice) => {
  choice.addEventListener('click', () => {
    const tag = choice.dataset.choice;
    tags = tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
    drawSelectedTags();
    syncChoices();
  });
});
document.querySelector('#tag-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const row = document.querySelector('#card-tags');
  row.innerHTML = tags.map((tag) => `<span class="tag-pill">${tag}</span>`).join('');
  document.querySelector('#sidebar-tags').innerHTML = tags.map((tag) => `<a href="#"><span class="tag-dot"></span>${tag}<span>1</span></a>`).join('');
  closePanel();
  const toast = document.querySelector('#tag-toast');
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 2500);
});

drawSelectedTags();
syncChoices();
