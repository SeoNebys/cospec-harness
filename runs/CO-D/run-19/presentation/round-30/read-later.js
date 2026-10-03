const bookmarks = [
  { title: 'Designing for Long-Form Content', description: 'Practical ways to create thoughtful reading experiences for longer articles on the web.', site: 'A List Apart', url: 'https://alistapart.com/article/designing-for-long-form-content/', labels: ['design', 'typography'], icon: 'A', color: '#1f4056', later: false },
  { title: 'CSS grid layout', description: 'A two-dimensional layout system for arranging content in rows and columns.', site: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout', labels: ['web development', 'reference'], icon: 'M', color: '#4d3b75', later: false },
  { title: 'James Webb Space Telescope', description: 'Explore the mission, discoveries, and latest images from the world’s premier space observatory.', site: 'NASA', url: 'https://www.nasa.gov/missions/webb/', labels: ['space', 'research'], icon: 'N', color: '#274f88', later: true },
  { title: 'Inclusive Design Patterns', description: 'Practical interface patterns for making the web usable by more people.', site: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/inclusive-design-patterns/', labels: ['design', 'accessibility'], icon: 'S', color: '#8e3c32', later: false }
];

const mode = new URLSearchParams(window.location.search).get('mode') || 'button';
const results = document.querySelector('#read-later-results');
const toast = document.querySelector('#toast');
let currentView = 'all';

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function toggleLater(bookmark) {
  bookmark.later = !bookmark.later;
  showToast(bookmark.later ? 'Added to Read later.' : 'Removed from Read later.');
  render();
}

function cardFor(bookmark) {
  const article = document.createElement('article');
  article.className = 'bookmark-card';
  article.tabIndex = 0;
  article.setAttribute('role', 'link');
  article.innerHTML = `<div class="site-icon" style="background:${bookmark.color}" aria-hidden="true">${bookmark.icon}</div><div class="bookmark-copy"><div class="bookmark-meta"><span class="site-name">${bookmark.site}</span><span>•</span><span>Saved recently</span></div><h3>${bookmark.title}</h3><p class="description">${bookmark.description}</p><a class="bookmark-url" href="${bookmark.url}" target="_blank" rel="noreferrer">${bookmark.url}</a><div class="bookmark-footer"><div class="labels">${bookmark.labels.map((label) => `<span class="label-chip">${label}</span>`).join('')}</div></div></div><div class="later-action-slot"></div>`;
  const slot = article.querySelector('.later-action-slot');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = mode === 'icon' ? 'later-icon-button' : 'later-text-button';
  button.classList.toggle('selected', bookmark.later);
  button.setAttribute('aria-label', bookmark.later ? 'Remove from Read later' : 'Add to Read later');
  button.innerHTML = mode === 'icon' ? `<span aria-hidden="true">◷</span>` : (bookmark.later ? '<span>✓</span> In Read later' : '<span>＋</span> Read later');
  button.addEventListener('click', (event) => { event.stopPropagation(); toggleLater(bookmark); });
  slot.append(button);
  article.addEventListener('click', (event) => {
    if (event.target.closest('a, button')) return;
    window.open(bookmark.url, '_blank', 'noopener,noreferrer');
  });
  return article;
}

function render() {
  const visible = currentView === 'later' ? bookmarks.filter((bookmark) => bookmark.later) : bookmarks;
  results.replaceChildren(...visible.map(cardFor));
  const laterTotal = bookmarks.filter((bookmark) => bookmark.later).length;
  document.querySelector('#later-count').textContent = laterTotal;
  document.querySelector('#view-count').textContent = `${visible.length} ${visible.length === 1 ? 'bookmark' : 'bookmarks'}`;
  document.querySelector('#view-eyebrow').textContent = currentView === 'later' ? 'READ LATER' : 'ALL BOOKMARKS';
  document.querySelector('#read-later-heading').textContent = currentView === 'later' ? 'Your reading queue' : 'Your saved links';
}

document.querySelector('#all-tab').addEventListener('click', () => {
  currentView = 'all';
  document.querySelector('#all-tab').classList.add('active');
  document.querySelector('#later-tab').classList.remove('active');
  render();
});
document.querySelector('#later-tab').addEventListener('click', () => {
  currentView = 'later';
  document.querySelector('#later-tab').classList.add('active');
  document.querySelector('#all-tab').classList.remove('active');
  render();
});
render();
