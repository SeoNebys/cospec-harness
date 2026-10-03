const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') === 'star' ? 'star' : 'button';
const cards = [...document.querySelectorAll('.organize-card')];
const list = document.querySelector('#saved-result-list');
const input = document.querySelector('#saved-search-input');
const sortSelect = document.querySelector('#saved-sort-select');
const dialog = document.querySelector('#save-view-dialog');
const orderLabels = { newest: 'Newest first', oldest: 'Oldest first', az: 'Title A–Z', za: 'Title Z–A' };
let filter = 'all';
let savedView = null;

document.querySelector('#button-save').hidden = mode !== 'button';
document.querySelector('#star-save').hidden = mode !== 'star';

function render() {
  const query = input.value.trim().toLowerCase();
  const visible = cards.filter((card) => {
    const tagMatch = filter === 'all' || card.dataset.tags.split(' ').includes(filter);
    const textMatch = !query || card.dataset.search.includes(query);
    return tagMatch && textMatch;
  });
  cards.forEach((card) => { card.hidden = !visible.includes(card); });
  const sort = sortSelect.value;
  visible.sort((a, b) => {
    if (sort === 'newest') return b.dataset.date.localeCompare(a.dataset.date);
    if (sort === 'oldest') return a.dataset.date.localeCompare(b.dataset.date);
    if (sort === 'az') return a.dataset.title.localeCompare(b.dataset.title);
    return b.dataset.title.localeCompare(a.dataset.title);
  }).forEach((card) => list.append(card));
  document.querySelector('#saved-result-count').textContent = `${visible.length} ${visible.length === 1 ? 'bookmark' : 'bookmarks'}`;
  document.querySelector('#saved-result-context').textContent = orderLabels[sort];
}

function setFilter(next) {
  filter = next;
  document.querySelectorAll('.filter-chip').forEach((chip) => chip.classList.toggle('active', chip.dataset.filter === filter));
  render();
}

function openDialog() {
  document.querySelector('.view-summary').innerHTML = `<span>${input.value.trim() || 'Any search'}</span><span>${filter === 'all' ? 'All tags' : filter}</span><span>${orderLabels[sortSelect.value]}</span>`;
  dialog.showModal();
  document.querySelector('#view-name').focus();
  document.querySelector('#view-name').select();
}

document.querySelectorAll('.filter-chip').forEach((chip) => chip.addEventListener('click', () => setFilter(chip.dataset.filter)));
input.addEventListener('input', render);
sortSelect.addEventListener('change', render);
document.querySelector('#button-save').addEventListener('click', openDialog);
document.querySelector('#star-save').addEventListener('click', openDialog);

document.querySelector('#save-view-form').addEventListener('submit', (event) => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  const name = document.querySelector('#view-name').value.trim();
  if (!name) return;
  savedView = { name, query: input.value, filter, sort: sortSelect.value };
  const section = document.querySelector('#saved-view-section');
  const savedList = document.querySelector('#saved-view-list');
  section.hidden = false;
  savedList.innerHTML = `<a id="saved-view-link" class="active-view" href="#"><span aria-hidden="true">⌕</span><span>${name}</span></a>`;
  savedList.querySelector('a').addEventListener('click', (clickEvent) => {
    clickEvent.preventDefault();
    input.value = savedView.query;
    sortSelect.value = savedView.sort;
    setFilter(savedView.filter);
    document.querySelector('#view-eyebrow').textContent = 'SAVED VIEW';
    document.querySelector('#view-heading').textContent = savedView.name;
    document.querySelector('#all-bookmarks').classList.remove('active');
    savedList.querySelector('a').classList.add('active-view');
  });
  dialog.close();
  const toast = document.querySelector('#saved-view-toast');
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 2200);
});

document.querySelector('#all-bookmarks').addEventListener('click', (event) => {
  event.preventDefault();
  input.value = '';
  sortSelect.value = 'newest';
  setFilter('all');
  document.querySelector('#view-eyebrow').textContent = 'LIBRARY';
  document.querySelector('#view-heading').textContent = 'All bookmarks';
  event.currentTarget.classList.add('active');
  document.querySelector('#saved-view-link')?.classList.remove('active-view');
});

render();
