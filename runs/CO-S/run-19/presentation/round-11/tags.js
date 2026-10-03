const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') === 'pick' ? 'pick' : 'type';
const panel = document.querySelector('#tag-panel');
const scrim = document.querySelector('#scrim');
const selectedTags = document.querySelector('#selected-tags');
const tagInput = document.querySelector('#tag-input');
let tags = ['science'];

document.querySelector('#type-method').hidden = mode !== 'type';
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
