const params = new URLSearchParams(window.location.search);
const searchInput = document.querySelector('#search');
const cards = [...document.querySelectorAll('.search-card')];
const filterButtons = [...document.querySelectorAll('.filter-button')];
let activeLabel = 'all';

function refreshResults() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  let visible = 0;
  cards.forEach((card) => {
    const matchesWords = !query || card.dataset.search.toLocaleLowerCase().includes(query);
    const matchesLabel = activeLabel === 'all' || card.dataset.labels.split(' ').includes(activeLabel);
    card.hidden = !(matchesWords && matchesLabel);
    if (!card.hidden) visible += 1;
  });
  document.querySelector('#count').textContent = `${visible} ${visible === 1 ? 'bookmark' : 'bookmarks'}`;
  const parts = [];
  if (query) parts.push(`matching “${searchInput.value.trim()}”`);
  if (activeLabel !== 'all') parts.push(`labeled “${activeLabel}”`);
  document.querySelector('#result-note').textContent = parts.length ? `Showing ${visible} ${parts.join(' and ')}` : 'Showing all bookmarks';
}

searchInput.addEventListener('input', refreshResults);
filterButtons.forEach((button) => button.addEventListener('click', () => {
  activeLabel = button.dataset.filter;
  filterButtons.forEach((candidate) => candidate.classList.toggle('active', candidate === button));
  refreshResults();
}));

if (params.get('mode') === 'combine') {
  searchInput.value = 'guide';
  refreshResults();
}
