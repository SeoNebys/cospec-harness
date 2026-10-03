const bookmarks = [
  { title: 'Designing for Long-Form Content', description: 'Practical ways to create thoughtful reading experiences for longer articles on the web.', site: 'A List Apart', url: 'https://alistapart.com/article/designing-for-long-form-content/', labels: ['design', 'typography'], icon: 'A', color: '#1f4056', later: false, archived: false },
  { title: 'CSS grid layout', description: 'A two-dimensional layout system for arranging content in rows and columns.', site: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout', labels: ['web development', 'reference'], icon: 'M', color: '#4d3b75', later: false, archived: false },
  { title: 'James Webb Space Telescope', description: 'Explore the mission and latest images from the world’s premier space observatory.', site: 'NASA', url: 'https://www.nasa.gov/missions/webb/', labels: ['space', 'research'], icon: 'N', color: '#274f88', later: true, archived: false },
  { title: 'An old typography reference', description: 'A reference kept for history, but no longer needed in the everyday library.', site: 'Type Archive', url: 'https://example.com/old-type-reference', labels: ['typography'], icon: 'T', color: '#6d6256', later: false, archived: true }
];

const mode = new URLSearchParams(window.location.search).get('mode') || 'menu';
const deleteMode = new URLSearchParams(window.location.search).get('delete') || 'none';
const results = document.querySelector('#archive-results');
const empty = document.querySelector('#archive-empty');
const toast = document.querySelector('#archive-toast');
const searchInput = document.querySelector('#archive-search');
let currentView = 'all';
let pendingDelete = null;

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

function requestDelete(bookmark) {
  pendingDelete = bookmark;
  document.querySelector('#delete-title').textContent = bookmark.title;
  document.querySelector('#delete-dialog').showModal();
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
    if (deleteMode === 'archive') {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'archive-delete-button';
      remove.textContent = 'Delete permanently';
      remove.addEventListener('click', () => requestDelete(bookmark));
      slot.classList.add('archive-actions');
      slot.append(remove);
    }
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
    if (deleteMode === 'anywhere') {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger-menu-action';
      remove.textContent = 'Delete permanently';
      remove.addEventListener('click', () => requestDelete(bookmark));
      menu.append(remove);
    }
    menuButton.addEventListener('click', () => { menu.hidden = !menu.hidden; });
    slot.classList.add('menu-slot');
    slot.append(menuButton, menu);
  }
  return article;
}

function visibleBookmarks() {
  let inView;
  if (currentView === 'archive') inView = bookmarks.filter((bookmark) => bookmark.archived);
  else if (currentView === 'later') inView = bookmarks.filter((bookmark) => bookmark.later && !bookmark.archived);
  else inView = bookmarks.filter((bookmark) => !bookmark.archived);
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return inView;
  return inView.filter((bookmark) => [bookmark.title, bookmark.description, bookmark.site, bookmark.url, ...bookmark.labels].join(' ').toLowerCase().includes(query));
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
  const query = searchInput.value.trim();
  document.querySelector('#archive-empty-title').textContent = query ? `Nothing found in ${currentView === 'archive' ? 'Archive' : currentView === 'later' ? 'Read later' : 'All bookmarks'}` : currentView === 'archive' ? 'Nothing set aside' : 'Nothing here yet';
  document.querySelector('#archive-empty-copy').textContent = query && currentView !== 'archive' ? 'Archived bookmarks stay out of everyday results. Search from Archive when you want to find set-aside items.' : query ? 'Try another search within this part of your library.' : 'Bookmarks you archive will stay safe here until you restore them.';
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
  currentView = button.dataset.view;
  document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === button));
  render();
}));
searchInput.addEventListener('input', render);
document.querySelector('#confirm-delete').addEventListener('click', () => {
  if (!pendingDelete) return;
  const index = bookmarks.indexOf(pendingDelete);
  if (index !== -1) bookmarks.splice(index, 1);
  pendingDelete = null;
  window.setTimeout(() => {
    showToast('Bookmark deleted permanently.');
    render();
  }, 0);
});
render();
