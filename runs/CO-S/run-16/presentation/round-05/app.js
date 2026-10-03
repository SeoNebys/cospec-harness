const modal = document.querySelector('#modal');
const form = document.querySelector('#bookmark-form');
const urlInput = document.querySelector('#url');
const emptyState = document.querySelector('#empty-state');
const bookmarkList = document.querySelector('#bookmark-list');
const toast = document.querySelector('#toast');
const totalLabel = document.querySelector('#total-label');
const navCount = document.querySelector('#nav-count');
const searchInput = document.querySelector('#search-input');
const resultsSummary = document.querySelector('#results-summary');
const resultCount = document.querySelector('#result-count');
const resultQuery = document.querySelector('#result-query');
const noResults = document.querySelector('#no-results');

const savedExample = {
  title: 'CSS grid layout',
  source: 'developer.mozilla.org',
  icon: 'M',
  description: 'CSS grid layout is a two-dimensional layout system for the web. It lets you organize content into rows and columns.',
  saved: 'Saved just now',
  readTime: '5 min read',
  visual: 'grid'
};

const sampleBookmarks = [
  { ...savedExample, saved: 'Saved 2 days ago' },
  {
    title: 'Designing better empty states', source: 'uxdesign.cc', icon: 'U',
    description: 'Practical patterns for turning a blank screen into a useful and welcoming starting point.',
    saved: 'Saved 4 days ago', readTime: '8 min read', visual: 'design'
  },
  {
    title: 'A week of quick vegetarian dinners', source: 'smittenkitchen.com', icon: 'S',
    description: 'Seven flexible recipes for satisfying weeknight meals with simple pantry ingredients.',
    saved: 'Saved last week', readTime: '12 min read', visual: 'cooking'
  },
  {
    title: 'The Pomodoro technique, explained', source: 'todoist.com', icon: 'T',
    description: 'A simple time-management method that breaks focused work into short, manageable intervals.',
    saved: 'Saved 2 weeks ago', readTime: '6 min read', visual: 'focus'
  },
  {
    title: 'A quiet weekend in Copenhagen', source: 'afar.com', icon: 'A',
    description: 'A thoughtful guide to design museums, neighborhood bakeries, and walks along the harbor.',
    saved: 'Saved last month', readTime: '9 min read', visual: 'travel'
  }
];

let bookmarks = [];

function escapeHtml(text) {
  return text.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function highlight(text, query) {
  const safe = escapeHtml(text);
  if (!query) return safe;
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${safeQuery})`, 'ig'), '<mark>$1</mark>');
}

function cardMarkup(bookmark, query = '') {
  const visual = bookmark.visual === 'grid'
    ? '<div class="grid-visual"><span></span><span></span><span></span><span></span><span></span><span></span></div>'
    : '';
  return `
    <article class="bookmark-card">
      <div class="preview-image ${bookmark.visual}">${visual}</div>
      <div class="bookmark-body">
        <div class="bookmark-source"><span class="source-icon">${bookmark.icon}</span> ${bookmark.source}</div>
        <h2>${highlight(bookmark.title, query)}</h2>
        <p>${highlight(bookmark.description, query)}</p>
        <div class="bookmark-meta"><span>${bookmark.saved}</span><span class="dot">•</span><span>${bookmark.readTime}</span></div>
      </div>
      <button class="more" aria-label="Options for ${escapeHtml(bookmark.title)}">•••</button>
    </article>`;
}

function render(query = '') {
  const normalized = query.trim().toLowerCase();
  const matches = bookmarks.filter(bookmark =>
    [bookmark.title, bookmark.source, bookmark.description].some(value => value.toLowerCase().includes(normalized))
  );

  navCount.textContent = String(bookmarks.length);
  totalLabel.textContent = `${bookmarks.length} ${bookmarks.length === 1 ? 'bookmark' : 'bookmarks'}`;
  emptyState.hidden = bookmarks.length !== 0;
  resultsSummary.hidden = !normalized;
  resultCount.textContent = `${matches.length} ${matches.length === 1 ? 'result' : 'results'}`;
  resultQuery.textContent = normalized ? `for “${query.trim()}”` : '';
  noResults.hidden = matches.length !== 0 || !normalized;
  bookmarkList.hidden = matches.length === 0;
  bookmarkList.innerHTML = matches.map(bookmark => cardMarkup(bookmark, query.trim())).join('');
}

function openModal() {
  modal.hidden = false;
  window.setTimeout(() => urlInput.select(), 0);
}

function closeModal() {
  modal.hidden = true;
}

document.querySelector('#add-top').addEventListener('click', openModal);
document.querySelector('#close-modal').addEventListener('click', closeModal);
document.querySelector('#cancel-modal').addEventListener('click', closeModal);
document.querySelector('#clear-search').addEventListener('click', () => {
  searchInput.value = '';
  render();
  searchInput.focus();
});

searchInput.addEventListener('input', () => render(searchInput.value));

modal.addEventListener('click', event => {
  if (event.target === modal) closeModal();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  const saveButton = document.querySelector('#save-button');
  saveButton.disabled = true;
  saveButton.textContent = 'Getting page details…';

  window.setTimeout(() => {
    bookmarks.unshift(savedExample);
    searchInput.value = '';
    render();
    closeModal();
    saveButton.disabled = false;
    saveButton.textContent = 'Save bookmark';
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3200);
  }, 650);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !modal.hidden) closeModal();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchInput.focus();
  }
});

const searchFlow = new URLSearchParams(window.location.search).get('flow') === 'search';
if (searchFlow) {
  bookmarks = [...sampleBookmarks];
  modal.hidden = true;
  window.setTimeout(() => searchInput.focus(), 50);
} else {
  modal.hidden = false;
}
render();
