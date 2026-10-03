const form = document.querySelector('#save-form');
const urlInput = document.querySelector('#url');
const emptyState = document.querySelector('#empty-state');
const list = document.querySelector('#bookmark-list');
const count = document.querySelector('#count');
const toast = document.querySelector('#toast');
const template = document.querySelector('#bookmark-template');

const samples = [
  {
    url: 'https://alistapart.com/article/designing-for-long-form-content/',
    title: 'Designing for Long-Form Content',
    description: 'Practical ways to create thoughtful reading experiences for longer articles on the web.',
    site: 'A List Apart', icon: 'A', color: '#1f4056'
  },
  {
    url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout',
    title: 'CSS grid layout',
    description: 'A two-dimensional layout system for arranging content in rows and columns.',
    site: 'MDN Web Docs', icon: 'M', color: '#4d3b75'
  },
  {
    url: 'https://www.nasa.gov/missions/webb/',
    title: 'James Webb Space Telescope',
    description: 'Explore the mission, discoveries, and latest images from the world’s premier space observatory.',
    site: 'NASA', icon: 'N', color: '#274f88'
  }
];

const showDuplicateScenario = new URLSearchParams(window.location.search).get('scenario') === 'duplicates';
const bookmarks = showDuplicateScenario ? samples.map((bookmark) => ({ ...bookmark })) : [];

function normalizedUrl(value) {
  const parsed = new URL(value);
  parsed.hash = '';
  return parsed.href;
}

function detailsFor(url) {
  const known = samples.find((sample) => normalizedUrl(sample.url) === normalizedUrl(url));
  if (known) return { ...known, url: normalizedUrl(url) };
  const parsed = new URL(url);
  const site = parsed.hostname.replace(/^www\./, '');
  return {
    url: parsed.href,
    title: `A saved page from ${site}`,
    description: 'Page details were added automatically so this bookmark is easy to recognize later.',
    site,
    icon: site.charAt(0).toUpperCase(),
    color: '#315d52'
  };
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function beginEdit(card) {
  const display = card.querySelector('.bookmark-display');
  const editForm = card.querySelector('.card-edit-form');
  display.hidden = true;
  editForm.hidden = false;
  editForm.querySelector('.title-input').focus();
}

function createCard(bookmark) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector('.bookmark-card');
  const link = card.querySelector('.bookmark-url');
  const display = card.querySelector('.bookmark-display');
  const editForm = card.querySelector('.card-edit-form');
  const editButton = card.querySelector('.card-edit-button');
  const cancelButton = card.querySelector('.cancel-card-edit');

  card.dataset.url = normalizedUrl(bookmark.url);
  card.querySelector('.site-icon').textContent = bookmark.icon;
  card.querySelector('.site-icon').style.background = bookmark.color;
  card.querySelector('.site-name').textContent = bookmark.site;
  display.querySelector('h3').textContent = bookmark.title;
  display.querySelector('.description').textContent = bookmark.description;
  link.textContent = bookmark.url;
  link.href = bookmark.url;
  editForm.querySelector('.title-input').value = bookmark.title;
  editForm.querySelector('.description-input').value = bookmark.description;

  const openOriginal = () => window.open(bookmark.url, '_blank', 'noopener,noreferrer');
  card.addEventListener('click', (event) => {
    if (event.target.closest('a, button, input, textarea, form')) return;
    openOriginal();
  });
  card.addEventListener('keydown', (event) => {
    if (event.target !== card || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    openOriginal();
  });
  editButton.addEventListener('click', () => beginEdit(card));
  cancelButton.addEventListener('click', () => {
    editForm.hidden = true;
    display.hidden = false;
    editButton.focus();
  });
  editForm.addEventListener('submit', (event) => {
    event.preventDefault();
    bookmark.title = editForm.querySelector('.title-input').value;
    bookmark.description = editForm.querySelector('.description-input').value;
    display.querySelector('h3').textContent = bookmark.title;
    display.querySelector('.description').textContent = bookmark.description;
    editForm.hidden = true;
    display.hidden = false;
    showToast('Changes saved.');
  });

  return fragment;
}

function render() {
  list.replaceChildren(...bookmarks.map(createCard));
  emptyState.classList.toggle('hidden', bookmarks.length > 0);
  count.textContent = `${bookmarks.length} saved`;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  const url = normalizedUrl(urlInput.value);
  button.disabled = true;
  button.textContent = 'Getting page details…';

  window.setTimeout(() => {
    const existing = bookmarks.find((bookmark) => normalizedUrl(bookmark.url) === url);
    if (existing) {
      const card = [...list.querySelectorAll('.bookmark-card')]
        .find((candidate) => candidate.dataset.url === url);
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('duplicate-found');
      window.setTimeout(() => card.classList.remove('duplicate-found'), 1800);
      beginEdit(card);
      showToast('Already saved — opened your existing bookmark.');
    } else {
      bookmarks.unshift(detailsFor(url));
      render();
      showToast('Bookmark saved — page details added.');
    }

    button.disabled = false;
    button.textContent = 'Save bookmark';
    urlInput.value = '';
  }, 700);
});

render();
