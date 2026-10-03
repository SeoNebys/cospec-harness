const params = new URLSearchParams(window.location.search);
const layout = document.querySelector('#filter-layout');
if (params.get('style') === 'sidebar') layout.classList.add('sidebar');

const cards = [...document.querySelectorAll('.filter-card')];
const buttons = [...document.querySelectorAll('.filter-button')];

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    let visible = 0;
    cards.forEach((card) => {
      const labels = card.dataset.labels.split(' ');
      card.hidden = filter !== 'all' && !labels.includes(filter);
      if (!card.hidden) visible += 1;
    });
    buttons.forEach((candidate) => candidate.classList.toggle('active', candidate.dataset.filter === filter));
    document.querySelector('#count').textContent = `${visible} ${visible === 1 ? 'bookmark' : 'bookmarks'}`;
  });
});
