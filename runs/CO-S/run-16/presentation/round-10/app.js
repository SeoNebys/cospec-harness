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
const noTags = document.querySelector('#no-tags');
const tagList = document.querySelector('#tag-list');
const toastTitle = document.querySelector('#toast-title');
const toastDetail = document.querySelector('#toast-detail');
const allNav = document.querySelector('#all-nav');
const readLaterNav = document.querySelector('#read-later-nav');
const readLaterCount = document.querySelector('#read-later-count');
const pageTitle = document.querySelector('#page-title');

const savedExample = {
  title: 'CSS grid layout',
  source: 'developer.mozilla.org',
  icon: 'M',
  description: 'CSS grid layout is a two-dimensional layout system for the web. It lets you organize content into rows and columns.',
  saved: 'Saved just now',
  readTime: '5 min read',
  visual: 'grid',
  tags: ['Development', 'Design'],
  readLater: false
};

const sampleBookmarks = [
  { ...savedExample, saved: 'Saved 2 days ago' },
  {
    title: 'Designing better empty states', source: 'uxdesign.cc', icon: 'U',
    description: 'Practical patterns for turning a blank screen into a useful and welcoming starting point.',
    saved: 'Saved 4 days ago', readTime: '8 min read', visual: 'design', tags: ['Design'], readLater: false
  },
  {
    title: 'A week of quick vegetarian dinners', source: 'smittenkitchen.com', icon: 'S',
    description: 'Seven flexible recipes for satisfying weeknight meals with simple pantry ingredients.',
    saved: 'Saved last week', readTime: '12 min read', visual: 'cooking', tags: ['Food'], readLater: false
  },
  {
    title: 'The Pomodoro technique, explained', source: 'todoist.com', icon: 'T',
    description: 'A simple time-management method that breaks focused work into short, manageable intervals.',
    saved: 'Saved 2 weeks ago', readTime: '6 min read', visual: 'focus', tags: ['Productivity'], readLater: false
  },
  {
    title: 'A quiet weekend in Copenhagen', source: 'afar.com', icon: 'A',
    description: 'A thoughtful guide to design museums, neighborhood bakeries, and walks along the harbor.',
    saved: 'Saved last month', readTime: '9 min read', visual: 'travel', tags: ['Travel', 'Design'], readLater: false
  }
];

let bookmarks = [];
let activeTag = '';
let tagEditingEnabled = false;
let readLaterEnabled = false;
let currentView = 'all';

const tagColors = {
  Development: '#6f8c78', Design: '#c67c62', Food: '#c39a45', Productivity: '#587e89', Travel: '#8c72a2'
};

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
        <div class="bookmark-tags">
          ${bookmark.tags.map(tag => `<span class="bookmark-tag">${tag}</span>`).join('')}
          ${tagEditingEnabled ? `<button class="add-tag" type="button" data-bookmark="${escapeHtml(bookmark.title)}">＋ Add tag</button>` : ''}
        </div>
        <div class="bookmark-meta"><span>${bookmark.saved}</span><span class="dot">•</span><span>${bookmark.readTime}</span></div>
      </div>
      <div class="card-actions">
        ${readLaterEnabled ? `
          <button class="read-later-toggle${bookmark.readLater ? ' active' : ''}" type="button" data-bookmark="${escapeHtml(bookmark.title)}" aria-label="${bookmark.readLater ? 'Remove from' : 'Add to'} Read later">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M12 7v5l3 2"/></svg>
          </button>` : ''}
        <button class="more" aria-label="Options for ${escapeHtml(bookmark.title)}">•••</button>
      </div>
      ${tagEditingEnabled ? `
        <form class="tag-editor" data-bookmark="${escapeHtml(bookmark.title)}" hidden>
          <label for="tag-${escapeHtml(bookmark.icon)}">Create and add a tag</label>
          <div class="tag-create-row">
            <input id="tag-${escapeHtml(bookmark.icon)}" name="tag" type="text" placeholder="e.g. Reference" autocomplete="off" required>
            <button type="submit">Create & add</button>
          </div>
          <p class="suggestion">The new tag will appear in your sidebar too.</p>
        </form>` : ''}
    </article>`;
}

function renderTags() {
  const counts = bookmarks.reduce((result, bookmark) => {
    bookmark.tags.forEach(tag => { result[tag] = (result[tag] || 0) + 1; });
    return result;
  }, {});
  const tags = Object.keys(counts).sort();
  noTags.hidden = tags.length > 0;
  tagList.hidden = tags.length === 0;
  tagList.innerHTML = tags.map(tag => `
    <button class="tag-filter${activeTag === tag ? ' active' : ''}" type="button" data-tag="${tag}">
      <span class="tag-dot" style="--tag-color:${tagColors[tag]}"></span>
      <span>${tag}</span>
      <span class="tag-count">${counts[tag]}</span>
    </button>`).join('');
}

function render(query = '') {
  const normalized = query.trim().toLowerCase();
  const matches = bookmarks.filter(bookmark =>
    [bookmark.title, bookmark.source, bookmark.description].some(value => value.toLowerCase().includes(normalized)) &&
    (!activeTag || bookmark.tags.includes(activeTag)) &&
    (currentView !== 'read-later' || bookmark.readLater)
  );

  navCount.textContent = String(bookmarks.length);
  const readLaterTotal = bookmarks.filter(bookmark => bookmark.readLater).length;
  readLaterCount.textContent = readLaterTotal ? String(readLaterTotal) : '';
  const viewTotal = currentView === 'read-later' ? readLaterTotal : bookmarks.length;
  totalLabel.textContent = `${viewTotal} ${viewTotal === 1 ? 'bookmark' : 'bookmarks'}`;
  pageTitle.textContent = currentView === 'read-later' ? 'Read later' : 'All bookmarks';
  allNav.classList.toggle('active', currentView === 'all');
  readLaterNav.classList.toggle('active', currentView === 'read-later');
  emptyState.hidden = bookmarks.length !== 0;
  resultsSummary.hidden = !normalized && !activeTag;
  resultCount.textContent = `${matches.length} ${matches.length === 1 ? 'result' : 'results'}`;
  resultQuery.textContent = [normalized ? `for “${query.trim()}”` : '', activeTag ? `tagged “${activeTag}”` : ''].filter(Boolean).join(' and ');
  noResults.hidden = matches.length !== 0 || (!normalized && !activeTag);
  bookmarkList.hidden = matches.length === 0;
  bookmarkList.innerHTML = matches.map(bookmark => cardMarkup(bookmark, query.trim())).join('');
  renderTags();
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
  activeTag = '';
  render();
  searchInput.focus();
});

tagList.addEventListener('click', event => {
  const button = event.target.closest('[data-tag]');
  if (!button) return;
  activeTag = activeTag === button.dataset.tag ? '' : button.dataset.tag;
  render(searchInput.value);
});

searchInput.addEventListener('input', () => render(searchInput.value));

bookmarkList.addEventListener('click', event => {
  const readLaterButton = event.target.closest('.read-later-toggle');
  if (readLaterButton) {
    const bookmark = bookmarks.find(item => item.title === readLaterButton.dataset.bookmark);
    if (!bookmark) return;
    bookmark.readLater = !bookmark.readLater;
    render(searchInput.value);
    toastTitle.textContent = bookmark.readLater ? 'Added to Read later' : 'Removed from Read later';
    toastDetail.textContent = bookmark.readLater ? 'It will be waiting in your reading list' : 'The bookmark remains in your collection';
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3200);
    return;
  }
  const addButton = event.target.closest('.add-tag');
  if (!addButton) return;
  bookmarkList.querySelectorAll('.tag-editor').forEach(editor => { editor.hidden = true; });
  bookmarkList.querySelectorAll('.bookmark-card').forEach(card => card.classList.remove('editing'));
  const card = addButton.closest('.bookmark-card');
  const editor = card.querySelector('.tag-editor');
  editor.hidden = false;
  card.classList.add('editing');
  editor.querySelector('input').focus();
});

allNav.addEventListener('click', event => {
  event.preventDefault();
  currentView = 'all';
  render(searchInput.value);
});

readLaterNav.addEventListener('click', event => {
  event.preventDefault();
  currentView = 'read-later';
  activeTag = '';
  searchInput.value = '';
  render();
});

bookmarkList.addEventListener('submit', event => {
  const editor = event.target.closest('.tag-editor');
  if (!editor) return;
  event.preventDefault();
  const tagName = editor.elements.tag.value.trim();
  if (!tagName) return;
  const bookmark = bookmarks.find(item => item.title === editor.dataset.bookmark);
  if (bookmark && !bookmark.tags.some(tag => tag.toLowerCase() === tagName.toLowerCase())) {
    bookmark.tags.push(tagName);
  }
  render(searchInput.value);
  toastTitle.textContent = `“${tagName}” added`;
  toastDetail.textContent = 'The bookmark and sidebar are updated';
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 3200);
});

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
    toastTitle.textContent = 'Bookmark saved';
    toastDetail.textContent = 'Title and preview added automatically';
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

const flow = new URLSearchParams(window.location.search).get('flow');
if (flow === 'search' || flow === 'tags' || flow === 'assign-tag' || flow === 'read-later') {
  bookmarks = [...sampleBookmarks];
  if (flow === 'assign-tag') tagEditingEnabled = true;
  if (flow === 'read-later') readLaterEnabled = true;
  modal.hidden = true;
  window.setTimeout(() => searchInput.focus(), 50);
} else {
  modal.hidden = false;
}
render();
