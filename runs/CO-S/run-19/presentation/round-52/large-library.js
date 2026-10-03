const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') === 'load' ? 'load' : 'pages';
const list = document.querySelector('#large-list');
const titles = [
  'The surprising intelligence of octopuses',
  'A field guide to getting lost',
  'The forgotten maps that changed cities',
  'A calmer way to plan your week',
  'How forests talk to each other beneath the soil',
  'The extraordinarily long and winding history of the tiny decisions that quietly reshaped modern public libraries',
  'Why whales sing',
  'The art of the perfect loaf',
];
const palettes = ['#174a40','#a84f3f','#506076','#6b9da4','#486c4c','#8c6648','#397388','#c28c3f'];
let page = 1;
let shown = 8;

function cardMarkup(index) {
  const item = index % titles.length;
  const number = index + 1;
  const long = item === 5;
  const title = page > 1 && mode === 'pages' ? `${titles[item]} — collection note ${number}` : titles[item];
  return `<article class="large-card"><div class="large-art" style="background:${palettes[item]}">${['✦','⌁','⌘','◇','♧','◈','≈','◒'][item]}</div><div class="large-body"><div class="bookmark-meta"><span class="site-icon">${['N','A','B','N','S','L','O','K'][item]}</span><span>${['NATIONAL GEOGRAPHIC','THE ATLANTIC','BLOOMBERG CITYLAB','NESS LABS','SMITHSONIAN','LONGFORM JOURNAL','OCEANOGRAPHIC','KING ARTHUR BAKING'][item]}</span><span>•</span><span>Saved ${number} days ago</span></div><h2>${title}</h2><p>${long ? 'An unusually detailed description that keeps going well beyond a comfortable card length so the library must remain scannable without losing access to the full saved wording.' : 'A saved description with enough context to recognize the page again later.'}</p><div class="large-tag-row"><span>${['animals','reading','design','planning','nature','research','animals','baking'][item]}</span>${long ? '<span>history</span><span class="tag-overflow">+3</span>' : ''}</div></div></article>`;
}

function renderPage() {
  const start = (page - 1) * 8;
  list.innerHTML = Array.from({length: 8}, (_, offset) => cardMarkup(start + offset)).join('');
  document.querySelector('#range-label').textContent = `Showing ${start + 1}–${start + 8}`;
  document.querySelector('#previous-page').disabled = page === 1;
  document.querySelectorAll('#page-controls div button').forEach((button, index) => button.classList.toggle('current-page', index === Math.min(page - 1, 3)));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderLoaded() {
  list.innerHTML = Array.from({length: shown}, (_, index) => cardMarkup(index)).join('');
  document.querySelector('#range-label').textContent = `Showing 1–${shown}`;
  document.querySelector('#load-progress').textContent = `Showing ${shown} of 347`;
}

document.querySelector('#page-controls').hidden = mode !== 'pages';
document.querySelector('#load-controls').hidden = mode !== 'load';
document.querySelector('#next-page').addEventListener('click', () => { page += 1; renderPage(); });
document.querySelector('#previous-page').addEventListener('click', () => { page = Math.max(1, page - 1); renderPage(); });
document.querySelector('#load-more').addEventListener('click', () => { shown = Math.min(347, shown + 8); renderLoaded(); });

if (mode === 'pages') renderPage(); else renderLoaded();
