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

const savedExample = {
  title: 'CSS grid layout',
  source: 'developer.mozilla.org',
  icon: 'M',
  description: 'CSS grid layout is a two-dimensional layout system for the web. It lets you organize content into rows and columns.',
  saved: 'Saved just now',
  readTime: '5 min read',
  visual: 'grid',
  tags: ['Development', 'Design']
};

const sampleBookmarks = [
  { ...savedExample, saved: 'Saved 2 days ago' },
  {
    title: 'Designing better empty states', source: 'uxdesign.cc', icon: 'U',
    description: 'Practical patterns for turning a blank screen into a useful and welcoming starting point.',
    saved: 'Saved 4 days ago', readTime: '8 min read', visual: 'design', tags: ['Design']
  },
  {
    title: 'A week of quick vegetarian dinners', source: 'smittenkitchen.com', icon: 'S',
    description: 'Seven flexible recipes for satisfying weeknight meals with simple pantry ingredients.',
    saved: 'Saved last week', readTime: '12 min read', visual: 'cooking', tags: ['Food']
  },
  {
    title: 'The Pomodoro technique, explained', source: 'todoist.com', icon: 'T',
    description: 'A simple time-management method that breaks focused work into short, manageable intervals.',
    saved: 'Saved 2 weeks ago', readTime: '6 min read', visual: 'focus', tags: ['Productivity']
  },
  {
    title: 'A quiet weekend in Copenhagen', source: 'afar.com', icon: 'A',
    description: 'A thoughtful guide to design museums, neighborhood bakeries, and walks along the harbor.',
    saved: 'Saved last month', readTime: '9 min read', visual: 'travel', tags: ['Travel', 'Design']
  }
];

let bookmarks = [];
let activeTag = '';
let tagEditingEnabled = false;

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
      <button class="more" aria-label="Options for ${escapeHtml(bookmark.title)}">•••</button>
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
    (!activeTag || bookmark.tags.includes(activeTag))
  );

  navCount.textContent = String(bookmarks.length);
  totalLabel.textContent = `${bookmarks.length} ${bookmarks.length === 1 ? 'bookmark' : 'bookmarks'}`;
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
if (flow === 'search' || flow === 'tags' || flow === 'assign-tag') {
  bookmarks = [...sampleBookmarks];
  if (flow === 'assign-tag') tagEditingEnabled = true;
  modal.hidden = true;
  window.setTimeout(() => searchInput.focus(), 50);
} else {
  modal.hidden = false;
}
render();
