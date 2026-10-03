const bookmarks = [
  { title: 'Designing for Long-Form Content', description: 'Practical ways to create thoughtful reading experiences for longer articles on the web.', site: 'A List Apart', url: 'https://alistapart.com/article/designing-for-long-form-content/', labels: ['design', 'typography'], icon: 'A', color: '#1f4056' },
  { title: 'CSS grid layout', description: 'A two-dimensional layout system for arranging content in rows and columns.', site: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout', labels: ['design', 'web development', 'reference'], icon: 'M', color: '#4d3b75' },
  { title: 'James Webb Space Telescope', description: 'Explore the mission, discoveries, and latest images from the world’s premier space observatory.', site: 'NASA', url: 'https://www.nasa.gov/missions/webb/', labels: ['space', 'research'], icon: 'N', color: '#274f88' },
  { title: 'Inclusive Design Patterns', description: 'Practical interface patterns for making the web usable by more people.', site: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/inclusive-design-patterns/', labels: ['design', 'accessibility'], icon: 'S', color: '#8e3c32' },
  { title: 'Design systems that scale', description: 'How shared components and careful documentation help product teams work together.', site: 'UX Collective', url: 'https://uxdesign.cc/design-systems-that-scale', labels: ['design', 'teams'], icon: 'U', color: '#765135' },
  { title: 'The Food Lab’s guide to better roast potatoes', description: 'Crisp edges, fluffy centers, and the science behind a reliable method.', site: 'Serious Eats', url: 'https://www.seriouseats.com/the-best-roast-potatoes-ever-recipe', labels: ['cooking', 'recipes'], icon: 'S', color: '#796031' }
];

const mode = new URLSearchParams(window.location.search).get('mode') || 'query';
const input = document.querySelector('#advanced-input');
const results = document.querySelector('#advanced-results');
const count = document.querySelector('#advanced-count');
const meaning = document.querySelector('#search-meaning');
const empty = document.querySelector('#advanced-empty');
const visualControls = document.querySelector('#visual-controls');
const queryHelp = document.querySelector('#query-help');
let visualMatch = 'all';
const visualLabels = new Map();

function searchable(bookmark) {
  return [bookmark.title, bookmark.description, bookmark.site, bookmark.url, ...bookmark.labels].join(' ').toLowerCase();
}

function cardFor(bookmark) {
  const article = document.createElement('article');
  article.className = 'bookmark-card';
  article.tabIndex = 0;
  article.setAttribute('role', 'link');
  article.innerHTML = `<div class="site-icon" style="background:${bookmark.color}" aria-hidden="true">${bookmark.icon}</div><div class="bookmark-copy"><div class="bookmark-meta"><span class="site-name">${bookmark.site}</span><span>•</span><span>Saved recently</span></div><h3>${bookmark.title}</h3><p class="description">${bookmark.description}</p><a class="bookmark-url" href="${bookmark.url}" target="_blank" rel="noreferrer">${bookmark.url}</a><div class="label-area"><div class="labels">${bookmark.labels.map((label) => `<span class="label-chip">${label}</span>`).join('')}</div></div></div><div class="open-page" aria-hidden="true">↗</div>`;
  article.addEventListener('click', (event) => {
    if (event.target.closest('a')) return;
    window.open(bookmark.url, '_blank', 'noopener,noreferrer');
  });
  return article;
}

function splitOrGroups(query) {
  const parts = query.match(/"[^"]+"|\S+/g) || [];
  const groups = [[]];
  parts.forEach((part) => {
    if (part.toUpperCase() === 'OR') groups.push([]);
    else groups.at(-1).push(part);
  });
  return groups.filter((group) => group.length);
}

function tokenMatches(bookmark, rawToken) {
  let token = rawToken;
  let excluded = false;
  if (token.startsWith('-')) {
    excluded = true;
    token = token.slice(1);
  }
  let matches;
  if (token.toLowerCase().startsWith('label:')) {
    const wanted = token.slice(6).replace(/^"|"$/g, '').toLowerCase();
    matches = bookmark.labels.some((label) => label.toLowerCase() === wanted);
  } else {
    const wanted = token.replace(/^"|"$/g, '').toLowerCase();
    matches = searchable(bookmark).includes(wanted);
  }
  return excluded ? !matches : matches;
}

function queryMatches(bookmark, query) {
  if (!query.trim()) return true;
  const groups = splitOrGroups(query);
  return groups.some((group) => group.every((token) => tokenMatches(bookmark, token)));
}

function visualMatches(bookmark, query) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const text = searchable(bookmark);
  const textMatch = visualMatch === 'phrase' ? text.includes(words.join(' ')) : visualMatch === 'any' ? (!words.length || words.some((word) => text.includes(word))) : words.every((word) => text.includes(word));
  const labelMatch = [...visualLabels].every(([label, state]) => state === 'include' ? bookmark.labels.includes(label) : !bookmark.labels.includes(label));
  return textMatch && labelMatch;
}

function selectedLabelsMatch(bookmark) {
  return [...visualLabels].every(([label, state]) => state === 'include' ? bookmark.labels.includes(label) : !bookmark.labels.includes(label));
}

function combinedMatches(bookmark, query) {
  if (!selectedLabelsMatch(bookmark)) return false;
  if (visualMatch === 'all') return queryMatches(bookmark, query);
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const text = searchable(bookmark);
  return visualMatch === 'phrase' ? text.includes(words.join(' ')) : (!words.length || words.some((word) => text.includes(word)));
}

function describeQuery(query) {
  if (!query.trim()) return '';
  if (/^"[^"]+"$/.test(query.trim())) return `Exact wording: ${query.trim().slice(1, -1)}`;
  return 'Showing bookmarks that meet your search conditions';
}

function render() {
  const query = input.value;
  const matches = bookmarks.filter((bookmark) => mode === 'query' ? queryMatches(bookmark, query) : mode === 'visual' ? visualMatches(bookmark, query) : combinedMatches(bookmark, query));
  results.replaceChildren(...matches.map(cardFor));
  results.hidden = matches.length === 0;
  empty.hidden = matches.length !== 0;
  count.textContent = `${matches.length} ${matches.length === 1 ? 'bookmark' : 'bookmarks'}`;
  const description = mode === 'query' ? describeQuery(query) : (query || visualLabels.size ? 'Showing bookmarks that meet all selected conditions' : '');
  meaning.textContent = description;
  meaning.hidden = !description;
}

if (mode !== 'query') {
  queryHelp.hidden = mode === 'visual';
  visualControls.hidden = false;
  document.querySelector('[data-match="all"]').classList.add('selected');
  document.querySelectorAll('[data-match]').forEach((button) => button.addEventListener('click', () => {
    visualMatch = button.dataset.match;
    document.querySelectorAll('[data-match]').forEach((item) => item.classList.toggle('selected', item === button));
    render();
  }));
  const labels = [...new Set(bookmarks.flatMap((bookmark) => bookmark.labels))].sort();
  const container = document.querySelector('#advanced-labels');
  labels.forEach((label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toolbar-label';
    button.textContent = label;
    button.addEventListener('click', () => {
      const current = visualLabels.get(label);
      if (!current) visualLabels.set(label, 'include');
      else if (current === 'include') visualLabels.set(label, 'exclude');
      else visualLabels.delete(label);
      button.classList.toggle('selected', visualLabels.get(label) === 'include');
      button.classList.toggle('excluded', visualLabels.get(label) === 'exclude');
      button.textContent = visualLabels.get(label) === 'exclude' ? `Not ${label}` : label;
      render();
    });
    container.append(button);
  });
}

input.addEventListener('input', render);
render();
