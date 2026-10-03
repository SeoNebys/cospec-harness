const bookmarks = [
  { title: 'Designing for Long-Form Content', description: 'Practical ways to create thoughtful reading experiences for longer articles on the web.', site: 'A List Apart', url: 'https://alistapart.com/article/designing-for-long-form-content/', labels: ['design', 'typography'], icon: 'A', color: '#1f4056', later: false, archived: false },
  { title: 'CSS grid layout', description: 'A two-dimensional layout system for arranging content in rows and columns.', site: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout', labels: ['web development', 'reference'], icon: 'M', color: '#4d3b75', later: false, archived: false },
  { title: 'James Webb Space Telescope', description: 'Explore the mission and latest images from the world’s premier space observatory.', site: 'NASA', url: 'https://www.nasa.gov/missions/webb/', labels: ['space', 'research'], icon: 'N', color: '#274f88', later: true, archived: false },
  { title: 'An old typography reference', description: 'A reference kept for history, but no longer needed in the everyday library.', site: 'Type Archive', url: 'https://example.com/old-type-reference', labels: ['typography'], icon: 'T', color: '#6d6256', later: false, archived: true }
];

const mode = new URLSearchParams(window.location.search).get('mode') || 'menu';
const results = document.querySelector('#archive-results');
const empty = document.querySelector('#archive-empty');
const toast = document.querySelector('#archive-toast');
let currentView = 'all';

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2300);
}

function moveBookmark(bookmark) {
  if (bookmark.archived) {
    bookmark.archived = false;
    showToast('Restored to All bookmarks.');
  } else {
    bookmark.archived = true;
    bookmark.later = false;
    showToast('Moved to Archive — you can restore it anytime.');
  }
  render();
}

function cardFor(bookmark) {
  const article = document.createElement('article');
  article.className = 'bookmark-card';
  article.innerHTML = `<div class="site-icon" style="background:${bookmark.color}" aria-hidden="true">${bookmark.icon}</div><div class="bookmark-copy"><div class="bookmark-meta"><span class="site-name">${bookmark.site}</span><span>•</span><span>Saved previously</span></div><h3>${bookmark.title}</h3><p class="description">${bookmark.description}</p><a class="bookmark-url" href="${bookmark.url}" target="_blank" rel="noreferrer">${bookmark.url}</a><div class="label-area"><div class="labels">${bookmark.labels.map((label) => `<span class="label-chip">${label}</span>`).join('')}</div></div></div><div class="archive-action-slot"></div>`;
  const slot = article.querySelector('.archive-action-slot');
  if (currentView === 'archive') {
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'archive-text-button';
    restore.textContent = '↩ Restore';
    restore.addEventListener('click', () => moveBookmark(bookmark));
    slot.append(restore);
  } else if (mode === 'button') {
    const archive = document.createElement('button');
    archive.type = 'button';
    archive.className = 'archive-text-button';
    archive.textContent = 'Archive';
    archive.addEventListener('click', () => moveBookmark(bookmark));
    slot.append(archive);
  } else {
    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'more-button';
    menuButton.setAttribute('aria-label', 'More bookmark actions');
    menuButton.textContent = '•••';
    const menu = document.createElement('div');
    menu.className = 'card-menu';
    menu.hidden = true;
    const archive = document.createElement('button');
    archive.type = 'button';
    archive.textContent = 'Move to Archive';
    archive.addEventListener('click', () => moveBookmark(bookmark));
    menu.append(archive);
    menuButton.addEventListener('click', () => { menu.hidden = !menu.hidden; });
    slot.classList.add('menu-slot');
    slot.append(menuButton, menu);
  }
  return article;
}

function visibleBookmarks() {
  if (currentView === 'archive') return bookmarks.filter((bookmark) => bookmark.archived);
  if (currentView === 'later') return bookmarks.filter((bookmark) => bookmark.later && !bookmark.archived);
  return bookmarks.filter((bookmark) => !bookmark.archived);
}

function render() {
  const visible = visibleBookmarks();
  results.replaceChildren(...visible.map(cardFor));
  results.hidden = visible.length === 0;
  empty.hidden = visible.length !== 0;
  const allTotal = bookmarks.filter((bookmark) => !bookmark.archived).length;
  const laterTotal = bookmarks.filter((bookmark) => bookmark.later && !bookmark.archived).length;
  const archiveTotal = bookmarks.filter((bookmark) => bookmark.archived).length;
  document.querySelector('#all-count').textContent = allTotal;
  document.querySelector('#archive-later-count').textContent = laterTotal;
  document.querySelector('#archive-count').textContent = archiveTotal;
  document.querySelector('#archive-view-count').textContent = `${visible.length} ${visible.length === 1 ? 'bookmark' : 'bookmarks'}`;
  document.querySelector('#archive-eyebrow').textContent = currentView === 'archive' ? 'ARCHIVE' : currentView === 'later' ? 'READ LATER' : 'ALL BOOKMARKS';
  document.querySelector('#archive-heading').textContent = currentView === 'archive' ? 'Set aside, not lost' : currentView === 'later' ? 'Your reading queue' : 'Your saved links';
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
  currentView = button.dataset.view;
  document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === button));
  render();
}));
render();
