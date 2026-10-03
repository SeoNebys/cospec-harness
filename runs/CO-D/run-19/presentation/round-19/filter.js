const bookmarks = [
  { title: 'Designing for Long-Form Content', description: 'Practical ways to create thoughtful reading experiences for longer articles on the web.', site: 'A List Apart', url: 'https://alistapart.com/article/designing-for-long-form-content/', labels: ['design', 'typography'], icon: 'A', color: '#1f4056' },
  { title: 'CSS grid layout', description: 'A two-dimensional layout system for arranging content in rows and columns.', site: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout', labels: ['web development', 'reference'], icon: 'M', color: '#4d3b75' },
  { title: 'James Webb Space Telescope', description: 'Explore the mission, discoveries, and latest images from the world’s premier space observatory.', site: 'NASA', url: 'https://www.nasa.gov/missions/webb/', labels: ['space', 'research'], icon: 'N', color: '#274f88' },
  { title: 'Inclusive Design Patterns', description: 'Practical interface patterns for making the web usable by more people.', site: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/inclusive-design-patterns/', labels: ['design', 'accessibility'], icon: 'S', color: '#8e3c32' },
  { title: 'The Food Lab’s guide to better roast potatoes', description: 'Crisp edges, fluffy centers, and the science behind a reliable method.', site: 'Serious Eats', url: 'https://www.seriouseats.com/the-best-roast-potatoes-ever-recipe', labels: ['cooking', 'recipes'], icon: 'S', color: '#796031' }
];

const mode = new URLSearchParams(window.location.search).get('mode') || 'card';
const input = document.querySelector('#search-input');
const results = document.querySelector('#filter-results');
const count = document.querySelector('#result-count');
const heading = document.querySelector('#results-heading');
const activeFilter = document.querySelector('#active-filter');
const activeLabelText = document.querySelector('#active-label');
const toolbar = document.querySelector('#label-toolbar');
let selectedLabel = '';

function chooseLabel(label) {
  selectedLabel = label;
  activeLabelText.textContent = label;
  activeFilter.hidden = false;
  render();
  document.querySelector('#results-heading').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function labelButton(label, location) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = location === 'toolbar' ? 'toolbar-label' : 'label-chip selectable-label';
  button.textContent = label;
  button.setAttribute('aria-label', `Show bookmarks labeled ${label}`);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    chooseLabel(label);
  });
  return button;
}

function cardFor(bookmark) {
  const article = document.createElement('article');
  article.className = 'bookmark-card';
  article.tabIndex = 0;
  article.setAttribute('role', 'link');
  article.innerHTML = `
    <div class="site-icon" style="background:${bookmark.color}" aria-hidden="true">${bookmark.icon}</div>
    <div class="bookmark-copy">
      <div class="bookmark-meta"><span class="site-name">${bookmark.site}</span><span>•</span><span>Saved recently</span></div>
      <h3>${bookmark.title}</h3><p class="description">${bookmark.description}</p>
      <a class="bookmark-url" href="${bookmark.url}" target="_blank" rel="noreferrer">${bookmark.url}</a>
      <div class="label-area"><div class="labels"></div></div>
    </div><div class="open-page" title="Open original page" aria-hidden="true">↗</div>`;
  const labelContainer = article.querySelector('.labels');
  bookmark.labels.forEach((label) => {
    if (mode === 'card') labelContainer.append(labelButton(label, 'card'));
    else {
      const chip = document.createElement('span');
      chip.className = 'label-chip';
      chip.textContent = label;
      labelContainer.append(chip);
    }
  });
  article.addEventListener('click', (event) => {
    if (event.target.closest('a, button')) return;
    window.open(bookmark.url, '_blank', 'noopener,noreferrer');
  });
  return article;
}

function render() {
  const query = input.value.trim().toLowerCase();
  const matches = bookmarks.filter((bookmark) => {
    const searchable = [bookmark.title, bookmark.description, bookmark.site, bookmark.url, ...bookmark.labels].join(' ').toLowerCase();
    return (!selectedLabel || bookmark.labels.includes(selectedLabel)) && (!query || searchable.includes(query));
  });
  results.replaceChildren(...matches.map(cardFor));
  heading.textContent = selectedLabel ? `${selectedLabel} bookmarks` : (query ? 'Search results' : 'Your saved links');
  count.textContent = `${matches.length} ${matches.length === 1 ? 'bookmark' : 'bookmarks'}`;
  if (mode === 'toolbar') {
    document.querySelectorAll('.toolbar-label').forEach((button) => button.classList.toggle('selected', button.textContent === selectedLabel));
  }
}

if (mode === 'toolbar') {
  toolbar.hidden = false;
  const uniqueLabels = [...new Set(bookmarks.flatMap((bookmark) => bookmark.labels))].sort();
  const toolbarLabels = document.querySelector('#toolbar-labels');
  uniqueLabels.forEach((label) => toolbarLabels.append(labelButton(label, 'toolbar')));
}

document.querySelector('#clear-filter').addEventListener('click', () => {
  selectedLabel = '';
  activeFilter.hidden = true;
  render();
});
input.addEventListener('input', render);
render();
