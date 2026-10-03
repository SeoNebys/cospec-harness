const bookmarks = [
  { title: 'Designing for Long-Form Content', description: 'Practical ways to create thoughtful reading experiences for longer articles on the web.', site: 'A List Apart', url: 'https://alistapart.com/article/designing-for-long-form-content/', labels: ['design', 'typography'], icon: 'A', color: '#1f4056' },
  { title: 'CSS grid layout', description: 'A two-dimensional layout system for arranging content in rows and columns.', site: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout', labels: ['web development', 'reference'], icon: 'M', color: '#4d3b75' },
  { title: 'James Webb Space Telescope', description: 'Explore the mission, discoveries, and latest images from the world’s premier space observatory.', site: 'NASA', url: 'https://www.nasa.gov/missions/webb/', labels: ['space', 'research'], icon: 'N', color: '#274f88' },
  { title: 'Inclusive Design Patterns', description: 'Practical interface patterns for making the web usable by more people.', site: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/inclusive-design-patterns/', labels: ['design', 'accessibility'], icon: 'S', color: '#8e3c32' },
  { title: 'The Food Lab’s guide to better roast potatoes', description: 'Crisp edges, fluffy centers, and the science behind a reliable method.', site: 'Serious Eats', url: 'https://www.seriouseats.com/the-best-roast-potatoes-ever-recipe', labels: ['cooking', 'recipes'], icon: 'S', color: '#796031' }
];

const input = document.querySelector('#search-input');
const results = document.querySelector('#search-results');
const count = document.querySelector('#result-count');
const heading = document.querySelector('#results-heading');
const noResults = document.querySelector('#no-results');

function cardFor(bookmark) {
  const article = document.createElement('article');
  article.className = 'bookmark-card';
  article.tabIndex = 0;
  article.setAttribute('role', 'link');
  article.innerHTML = `
    <div class="site-icon" style="background:${bookmark.color}" aria-hidden="true">${bookmark.icon}</div>
    <div class="bookmark-copy">
      <div class="bookmark-meta"><span class="site-name">${bookmark.site}</span><span>•</span><span>Saved recently</span></div>
      <h3>${bookmark.title}</h3>
      <p class="description">${bookmark.description}</p>
      <a class="bookmark-url" href="${bookmark.url}" target="_blank" rel="noreferrer">${bookmark.url}</a>
      <div class="label-area"><div class="labels">${bookmark.labels.map((label) => `<span class="label-chip">${label}</span>`).join('')}</div></div>
    </div>
    <div class="open-page" title="Open original page" aria-hidden="true">↗</div>`;
  article.addEventListener('click', (event) => {
    if (event.target.closest('a')) return;
    window.open(bookmark.url, '_blank', 'noopener,noreferrer');
  });
  return article;
}

function render() {
  const query = input.value.trim().toLowerCase();
  const words = query.split(/\s+/).filter(Boolean);
  const matches = bookmarks.filter((bookmark) => {
    const searchable = [bookmark.title, bookmark.description, bookmark.site, bookmark.url, ...bookmark.labels].join(' ').toLowerCase();
    return words.every((word) => searchable.includes(word));
  });

  results.replaceChildren(...matches.map(cardFor));
  results.hidden = matches.length === 0;
  noResults.hidden = matches.length !== 0;
  heading.textContent = query ? 'Search results' : 'Your saved links';
  count.textContent = query ? `${matches.length} ${matches.length === 1 ? 'result' : 'results'}` : `${bookmarks.length} bookmarks`;
}

input.addEventListener('input', render);
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && document.activeElement !== input) {
    event.preventDefault();
    input.focus();
  }
});
render();
