const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') === 'panel' ? 'panel' : 'bar';
const cards = [...document.querySelectorAll('.organize-card')];
const list = document.querySelector('#organize-list');
const resultCount = document.querySelector('#result-count');
const resultOrder = document.querySelector('#result-order');
const orderLabels = { newest: 'Newest first', oldest: 'Oldest first', az: 'Title A–Z', za: 'Title Z–A' };
let filter = 'all';
let sort = 'newest';

document.querySelector('#bar-controls').hidden = mode !== 'bar';
document.querySelector('#panel-controls').hidden = mode !== 'panel';

function applyControls() {
  const visible = cards.filter((card) => filter === 'all' || card.dataset.tags.split(' ').includes(filter));
  cards.forEach((card) => { card.hidden = !visible.includes(card); });
  visible.sort((a, b) => {
    if (sort === 'newest') return b.dataset.date.localeCompare(a.dataset.date);
    if (sort === 'oldest') return a.dataset.date.localeCompare(b.dataset.date);
    if (sort === 'az') return a.dataset.title.localeCompare(b.dataset.title);
    return b.dataset.title.localeCompare(a.dataset.title);
  }).forEach((card) => list.append(card));
  resultCount.textContent = `${visible.length} ${visible.length === 1 ? 'bookmark' : 'bookmarks'}`;
  resultOrder.textContent = orderLabels[sort];
  document.querySelector('#panel-summary').textContent = `${filter === 'all' ? 'All bookmarks' : filter} · ${orderLabels[sort]}`;
  const badge = document.querySelector('#active-filter-count');
  badge.hidden = filter === 'all';
}

document.querySelectorAll('.filter-chip').forEach((chip) => chip.addEventListener('click', () => {
  filter = chip.dataset.filter;
  document.querySelectorAll('.filter-chip').forEach((item) => item.classList.toggle('active', item === chip));
  applyControls();
}));
document.querySelector('#sort-select').addEventListener('change', (event) => { sort = event.target.value; applyControls(); });

const panel = document.querySelector('#organize-panel');
const scrim = document.querySelector('#scrim');
function closePanel() { panel.hidden = true; scrim.hidden = true; }
document.querySelector('#open-organize-panel').addEventListener('click', () => { panel.hidden = false; scrim.hidden = false; });
document.querySelector('#close-panel').addEventListener('click', closePanel);
scrim.addEventListener('click', closePanel);
document.querySelector('#reset-controls').addEventListener('click', () => {
  document.querySelector('input[name="tag"][value="all"]').checked = true;
  document.querySelector('input[name="sort"][value="newest"]').checked = true;
});
document.querySelector('#organize-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  filter = data.get('tag');
  sort = data.get('sort');
  applyControls();
  closePanel();
});

applyControls();
