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
const archiveNav = document.querySelector('#archive-nav');
const archiveCount = document.querySelector('#archive-count');
const noteModal = document.querySelector('#note-modal');
const noteForm = document.querySelector('#note-form');
const noteText = document.querySelector('#note-text');
const noteBookmarkTitle = document.querySelector('#note-bookmark-title');
const duplicateWarning = document.querySelector('#duplicate-warning');

const savedExample = {
  title: 'CSS grid layout',
  source: 'developer.mozilla.org',
  icon: 'M',
  description: 'CSS grid layout is a two-dimensional layout system for the web. It lets you organize content into rows and columns.',
  saved: 'Saved just now',
  readTime: '5 min read',
  visual: 'grid',
  tags: ['Development', 'Design'],
  readLater: false,
  archived: false,
  note: ''
};

const sampleBookmarks = [
  { ...savedExample, saved: 'Saved 2 days ago' },
  {
    title: 'Designing better empty states', source: 'uxdesign.cc', icon: 'U',
    description: 'Practical patterns for turning a blank screen into a useful and welcoming starting point.',
    saved: 'Saved 4 days ago', readTime: '8 min read', visual: 'design', tags: ['Design'], readLater: false, archived: false, note: ''
  },
  {
    title: 'A week of quick vegetarian dinners', source: 'smittenkitchen.com', icon: 'S',
    description: 'Seven flexible recipes for satisfying weeknight meals with simple pantry ingredients.',
    saved: 'Saved last week', readTime: '12 min read', visual: 'cooking', tags: ['Food'], readLater: false, archived: false, note: ''
  },
  {
    title: 'The Pomodoro technique, explained', source: 'todoist.com', icon: 'T',
    description: 'A simple time-management method that breaks focused work into short, manageable intervals.',
    saved: 'Saved 2 weeks ago', readTime: '6 min read', visual: 'focus', tags: ['Productivity'], readLater: false, archived: false, note: ''
  },
  {
    title: 'A quiet weekend in Copenhagen', source: 'afar.com', icon: 'A',
    description: 'A thoughtful guide to design museums, neighborhood bakeries, and walks along the harbor.',
    saved: 'Saved last month', readTime: '9 min read', visual: 'travel', tags: ['Travel', 'Design'], readLater: false, archived: false, note: ''
  }
];

let bookmarks = [];
let activeTag = '';
let tagEditingEnabled = false;
let readLaterEnabled = false;
let archiveEnabled = false;
let noteEnabled = false;
let currentView = 'all';
let noteBookmark = null;
let duplicateFlow = false;

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
        ${bookmark.note ? `<div class="bookmark-note"><span>✎</span><div>${highlight(bookmark.note, query)}</div></div>` : ''}
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
            <span>${bookmark.readLater ? 'In Read later' : 'Read later'}</span>
          </button>` : ''}
        <button class="more" aria-label="Options for ${escapeHtml(bookmark.title)}">•••</button>
      </div>
      ${archiveEnabled || noteEnabled ? `
        <div class="card-menu" hidden>
          ${noteEnabled ? `<button class="note-action" type="button" data-bookmark="${escapeHtml(bookmark.title)}"><span>✎</span>${bookmark.note ? 'Edit note' : 'Add note'}</button>` : ''}
          ${archiveEnabled ? `<button class="archive-action" type="button" data-bookmark="${escapeHtml(bookmark.title)}"><span>⌑</span>${bookmark.archived ? 'Restore to collection' : 'Archive bookmark'}</button>` : ''}
        </div>` : ''}
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
  const tagBookmarks = archiveEnabled ? bookmarks.filter(bookmark => !bookmark.archived) : bookmarks;
  const counts = tagBookmarks.reduce((result, bookmark) => {
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
    [bookmark.title, bookmark.source, bookmark.description, bookmark.note].some(value => value.toLowerCase().includes(normalized)) &&
    (!activeTag || bookmark.tags.includes(activeTag)) &&
    (currentView !== 'read-later' || bookmark.readLater) &&
    (currentView !== 'archive' || bookmark.archived) &&
    (currentView !== 'all' || !archiveEnabled || !bookmark.archived)
  );

  navCount.textContent = String(bookmarks.length);
  const readLaterTotal = bookmarks.filter(bookmark => bookmark.readLater).length;
  const archivedTotal = bookmarks.filter(bookmark => bookmark.archived).length;
  readLaterCount.textContent = readLaterTotal ? String(readLaterTotal) : '';
  archiveCount.textContent = archivedTotal ? String(archivedTotal) : '';
  const mainTotal = archiveEnabled ? bookmarks.length - archivedTotal : bookmarks.length;
  const viewTotal = currentView === 'read-later' ? readLaterTotal : currentView === 'archive' ? archivedTotal : mainTotal;
  totalLabel.textContent = `${viewTotal} ${viewTotal === 1 ? 'bookmark' : 'bookmarks'}`;
  pageTitle.textContent = currentView === 'read-later' ? 'Read later' : currentView === 'archive' ? 'Archive' : 'All bookmarks';
  allNav.classList.toggle('active', currentView === 'all');
  readLaterNav.classList.toggle('active', currentView === 'read-later');
  archiveNav.classList.toggle('active', currentView === 'archive');
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
document.querySelector('#view-existing').addEventListener('click', () => {
  closeModal();
  const existing = [...bookmarkList.querySelectorAll('.bookmark-card')].find(card => card.textContent.includes('CSS grid layout'));
  if (existing) {
    existing.classList.add('located');
    existing.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
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
  const moreButton = event.target.closest('.more');
  if (moreButton && (archiveEnabled || noteEnabled)) {
    const menu = moreButton.closest('.bookmark-card').querySelector('.card-menu');
    bookmarkList.querySelectorAll('.card-menu').forEach(item => { if (item !== menu) item.hidden = true; });
    menu.hidden = !menu.hidden;
    return;
  }
  const archiveButton = event.target.closest('.archive-action');
  if (archiveButton) {
    const bookmark = bookmarks.find(item => item.title === archiveButton.dataset.bookmark);
    if (!bookmark) return;
    bookmark.archived = !bookmark.archived;
    const isArchived = bookmark.archived;
    render(searchInput.value);
    toastTitle.textContent = isArchived ? 'Bookmark archived' : 'Bookmark restored';
    toastDetail.textContent = isArchived ? 'It is tucked away, not deleted' : 'It is back in your main collection';
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3200);
    return;
  }
  const noteButton = event.target.closest('.note-action');
  if (noteButton) {
    noteBookmark = bookmarks.find(item => item.title === noteButton.dataset.bookmark);
    if (!noteBookmark) return;
    noteBookmarkTitle.textContent = noteBookmark.title;
    noteText.value = noteBookmark.note;
    noteModal.hidden = false;
    noteButton.closest('.card-menu').hidden = true;
    window.setTimeout(() => noteText.focus(), 0);
    return;
  }
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

archiveNav.addEventListener('click', event => {
  event.preventDefault();
  currentView = 'archive';
  activeTag = '';
  searchInput.value = '';
  render();
});

function closeNoteModal() {
  noteModal.hidden = true;
  noteBookmark = null;
}

document.querySelector('#close-note').addEventListener('click', closeNoteModal);
document.querySelector('#cancel-note').addEventListener('click', closeNoteModal);
noteModal.addEventListener('click', event => {
  if (event.target === noteModal) closeNoteModal();
});

noteForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!noteBookmark) return;
  noteBookmark.note = noteText.value.trim();
  render(searchInput.value);
  noteModal.hidden = true;
  toastTitle.textContent = 'Note saved';
  toastDetail.textContent = 'It will stay with this bookmark';
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 3200);
  noteBookmark = null;
});

bookmarkList.addEventListener('submit', event => {
  const editor = event.target.closest('.tag-editor');
  if (!editor) return;
  event.preventDefault();
  const enteredTag = editor.elements.tag.value.trim();
  if (!enteredTag) return;
  const bookmark = bookmarks.find(item => item.title === editor.dataset.bookmark);
  const existingTag = bookmarks.flatMap(item => item.tags).find(tag => tag.toLowerCase() === enteredTag.toLowerCase());
  const tagName = existingTag || enteredTag;
  const alreadyAssigned = bookmark && bookmark.tags.some(tag => tag.toLowerCase() === tagName.toLowerCase());
  if (bookmark && !alreadyAssigned) {
    bookmark.tags.push(tagName);
  }
  render(searchInput.value);
  toastTitle.textContent = alreadyAssigned ? `“${tagName}” is already assigned` : `“${tagName}” added`;
  toastDetail.textContent = alreadyAssigned ? 'No changes were made' : existingTag ? 'Your existing tag was reused' : 'The bookmark and sidebar are updated';
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

  if (duplicateFlow) {
    window.setTimeout(() => {
      duplicateWarning.hidden = false;
      saveButton.disabled = false;
      saveButton.textContent = 'Save bookmark';
    }, 500);
    return;
  }

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
if (flow === 'search' || flow === 'tags' || flow === 'assign-tag' || flow === 'reuse-tag' || flow === 'read-later' || flow === 'archive' || flow === 'note' || flow === 'search-note' || flow === 'duplicate') {
  bookmarks = [...sampleBookmarks];
  if (flow === 'assign-tag' || flow === 'reuse-tag') tagEditingEnabled = true;
  if (flow === 'read-later') readLaterEnabled = true;
  if (flow === 'archive') archiveEnabled = true;
  if (flow === 'note') noteEnabled = true;
  if (flow === 'search-note') {
    bookmarks[0] = { ...bookmarks[0], note: 'Review this before rebuilding my layout.' };
    window.setTimeout(() => searchInput.focus(), 50);
  }
  if (flow === 'duplicate') {
    duplicateFlow = true;
  }
  modal.hidden = flow !== 'duplicate';
  window.setTimeout(() => searchInput.focus(), 50);
} else {
  modal.hidden = false;
}
render();
