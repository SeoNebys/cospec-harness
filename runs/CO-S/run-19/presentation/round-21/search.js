const input = document.querySelector('#search-input');
const clearButton = document.querySelector('#clear-search');
const cards = [...document.querySelectorAll('.search-card')];
const count = document.querySelector('#result-count');
const context = document.querySelector('#result-context');
const noResults = document.querySelector('#no-results');

function render() {
  const query = input.value.trim().toLowerCase();
  let visible = 0;

  cards.forEach((card) => {
    const matches = !query || card.dataset.search.includes(query);
    card.hidden = !matches;
    card.classList.toggle('match', Boolean(query && matches));
    visible += matches ? 1 : 0;
  });

  count.textContent = `${visible} ${visible === 1 ? 'bookmark' : 'bookmarks'}`;
  context.textContent = query ? `Matching “${input.value.trim()}”` : 'Newest first';
  clearButton.hidden = !query;
  noResults.hidden = visible !== 0;
  document.querySelector('#bookmark-list').hidden = visible === 0;
}

input.addEventListener('input', render);
clearButton.addEventListener('click', () => { input.value = ''; render(); input.focus(); });
