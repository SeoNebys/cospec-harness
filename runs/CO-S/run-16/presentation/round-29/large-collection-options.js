const titles = ['CSS grid layout','Designing better empty states','A week of quick vegetarian dinners','The Pomodoro technique, explained','A quiet weekend in Copenhagen','Making sense of type scales','A field guide to urban trees','Building calmer morning routines'];

function itemMarkup(offset, count = 6) {
  return Array.from({ length: count }, (_, index) => {
    const position = offset + index;
    const title = titles[position % titles.length];
    return `<article class="item"><div class="thumb"></div><div><h3>${title}</h3><p>Saved bookmark ${position + 1}</p></div></article>`;
  }).join('');
}

const pages = document.querySelector('[data-option="pages"]');
pages.querySelector('.items').innerHTML = itemMarkup(0);
pages.querySelectorAll('.page').forEach((button, index) => button.addEventListener('click', () => {
  pages.querySelectorAll('.page').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  pages.querySelector('.items').innerHTML = itemMarkup(index * 20);
  pages.classList.add('selected');
}));
pages.querySelector('.next').addEventListener('click', () => pages.querySelectorAll('.page')[1].click());

const more = document.querySelector('[data-option="more"]');
more.querySelector('.items').innerHTML = itemMarkup(0);
more.querySelector('.load-more').addEventListener('click', () => {
  more.querySelector('.items').insertAdjacentHTML('beforeend', itemMarkup(20, 3));
  more.querySelector('.shown').textContent = 'Showing 40 of 237';
  more.classList.add('selected');
});

const continuous = document.querySelector('[data-option="scroll"]');
const scrollArea = continuous.querySelector('.scroll-area');
continuous.querySelector('.items').innerHTML = itemMarkup(0, 9);
let loaded = false;
scrollArea.addEventListener('scroll', () => {
  if (loaded || scrollArea.scrollTop + scrollArea.clientHeight < scrollArea.scrollHeight - 20) return;
  loaded = true;
  continuous.querySelector('.items').insertAdjacentHTML('beforeend', itemMarkup(9, 4));
  continuous.querySelector('.loading').textContent = 'More bookmarks loaded';
  continuous.classList.add('selected');
});
