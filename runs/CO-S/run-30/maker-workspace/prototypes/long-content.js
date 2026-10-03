const search = document.querySelector('#boundary-search');
const cards = [...document.querySelectorAll('.boundary-card')];

search.addEventListener('input', () => {
  const query = search.value.trim().toLocaleLowerCase();
  let visible = 0;
  cards.forEach((card) => {
    card.hidden = Boolean(query) && !card.dataset.search.toLocaleLowerCase().includes(query);
    if (!card.hidden) visible += 1;
  });
  document.querySelector('#count').textContent = `${visible} ${visible === 1 ? 'bookmark' : 'bookmarks'}`;
  document.querySelector('#result-note').textContent = query ? `Showing ${visible} matching “${search.value.trim()}”` : 'Showing all bookmarks';
});
