const captureView = document.querySelector('#captureView');
const libraryView = document.querySelector('#libraryView');
const detailView = document.querySelector('#detailView');
const saveForm = document.querySelector('#saveForm');
const urlInput = document.querySelector('#urlInput');
const savedUrl = document.querySelector('#savedUrl');
const saveButton = document.querySelector('#saveButton');
const updateButton = document.querySelector('#updateButton');
const backButton = document.querySelector('#backButton');
const toast = document.querySelector('#toast');
const directEditButton = document.querySelector('#directEditButton');
const menuEditButton = document.querySelector('#menuEditButton');
const moreButton = document.querySelector('#moreButton');
const actionMenu = document.querySelector('#actionMenu');
const addButton = document.querySelector('#addButton');
const rowTitle = document.querySelector('#rowTitle');
const rowDescription = document.querySelector('#rowDescription');
const titleInput = document.querySelector('#titleInput');
const descriptionInput = document.querySelector('#descriptionInput');
const notesInput = document.querySelector('#notesInput');
const chipTagInput = document.querySelector('#chipTagInput');
const commaTagInput = document.querySelector('#commaTagInput');
const editorTags = document.querySelector('#editorTags');
const rowTags = document.querySelector('#rowTags');
const tagSuggestions = document.querySelector('#tagSuggestions');
const filterStatus = document.querySelector('#filterStatus');
const activeTag = document.querySelector('#activeTag');
const clearFilter = document.querySelector('#clearFilter');
const collectionCount = document.querySelector('.collection-count');
const searchForm = document.querySelector('#searchForm');
const searchInput = document.querySelector('#searchInput');
const searchButton = document.querySelector('#searchButton');
const advancedSearchHelp = document.querySelector('#advancedSearchHelp');
const syntaxExample = document.querySelector('#syntaxExample');
const searchInterpretation = document.querySelector('#searchInterpretation');
const noResults = document.querySelector('#noResults');
const noteTabs = document.querySelector('#noteTabs');
const writeNoteTab = document.querySelector('#writeNoteTab');
const readNoteTab = document.querySelector('#readNoteTab');
const noteWorkspace = document.querySelector('#noteWorkspace');
const noteWritingPane = document.querySelector('#noteWritingPane');
const noteReadingPane = document.querySelector('#noteReadingPane');
const notePreview = document.querySelector('#notePreview');
const formatToolbar = document.querySelector('#formatToolbar');
const shortcutHelp = document.querySelector('#shortcutHelp');

const params = new URLSearchParams(window.location.search);
const editVariant = params.get('edit') === 'direct' ? 'direct' : 'menu';
const tagVariant = params.get('tagstyle') === 'commas' ? 'commas' : 'chips';
const searchVariant = params.get('searchstyle') === 'submit' ? 'submit' : 'live';
const logicVariant = params.get('logic') === 'explicit' ? 'explicit' : 'simple';
const advancedSearch = params.get('mode') === 'advanced';
const noteViewVariant = params.get('noteview') === 'tabs' ? 'tabs' : 'split';
const formatInputVariant = params.get('formatinput') === 'shortcuts' ? 'shortcuts' : 'toolbar';
const defaultUrl = 'https://afar.com/magazine/a-perfect-day-in-rome';
let tags = [];
const knownTags = ['travel', 'article', 'book', 'Rome'];

function normaliseTags(values) {
  const unique = [];
  values.map(value => value.trim()).filter(Boolean).forEach(value => {
    if (!unique.some(tag => tag.toLowerCase() === value.toLowerCase())) unique.push(value);
  });
  return unique;
}

function renderEditorTags() {
  editorTags.replaceChildren();
  tags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'editor-tag';
    chip.append(document.createTextNode(tag));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-tag';
    remove.setAttribute('aria-label', `Remove ${tag} tag`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      tags = tags.filter(value => value !== tag);
      renderEditorTags();
    });
    chip.append(remove);
    editorTags.append(chip);
  });
}

function renderRowTags() {
  rowTags.replaceChildren();
  tags.forEach(tag => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tag filter-tag';
    chip.dataset.tag = tag;
    chip.textContent = tag;
    chip.addEventListener('click', () => filterByTag(tag));
    rowTags.append(chip);
  });
}

function setCollectionCount(count) {
  collectionCount.textContent = `${count} bookmark${count === 1 ? '' : 's'}`;
}

function filterByTag(tag) {
  let visible = 0;
  document.querySelectorAll('.bookmark-row').forEach(row => {
    const rowTagNames = row.dataset.tags.split(/\s+/).filter(Boolean);
    const matches = rowTagNames.some(value => value.toLowerCase() === tag.toLowerCase());
    row.hidden = !matches;
    if (matches) visible += 1;
  });
  activeTag.textContent = tag;
  filterStatus.hidden = false;
  setCollectionCount(visible);
}

function showAllBookmarks() {
  document.querySelectorAll('.bookmark-row').forEach(row => { row.hidden = false; });
  filterStatus.hidden = true;
  setCollectionCount(document.querySelectorAll('.bookmark-row').length);
}

function performSearch() {
  const query = searchInput.value.trim().toLowerCase();
  if (advancedSearch) {
    performAdvancedSearch(query);
    return;
  }
  let visible = 0;
  document.querySelectorAll('.bookmark-row').forEach(row => {
    const details = row.dataset.search.toLowerCase();
    const notes = row.dataset.notes.toLowerCase();
    const matchesDetails = !query || details.includes(query);
    const matchesNotes = query && notes.includes(query);
    const matches = matchesDetails || matchesNotes;
    row.hidden = !matches;
    const note = row.querySelector('.match-note');
    if (matchesNotes && !matchesDetails) {
      note.textContent = `Matched in your notes: ${row.dataset.notes}`;
      note.hidden = false;
    } else {
      note.hidden = true;
    }
    if (matches) visible += 1;
  });
  filterStatus.hidden = true;
  setCollectionCount(visible);
}

function parseAdvancedQuery(query) {
  const phrases = [...query.matchAll(/"([^"]+)"/g)].map(match => match[1].trim()).filter(Boolean);
  const tagNames = [...query.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map(match => match[1]);
  const unquoted = query.replace(/"[^"]*"/g, ' ');
  const terms = unquoted
    .replace(/#[\p{L}\p{N}_-]+/gu, ' ')
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(term => term && term !== 'or');
  return { phrases, tagNames, terms };
}

function tokenizeBooleanQuery(query) {
  const tokens = [];
  const matcher = /"([^"]*)"|#[\p{L}\p{N}_-]+|[()]|[^\s()]+/gu;
  for (const match of query.matchAll(matcher)) {
    const raw = match[0];
    if (raw.startsWith('"')) {
      tokens.push({ type: 'ATOM', kind: 'phrase', value: match[1].toLowerCase() });
    } else if (raw.startsWith('#')) {
      tokens.push({ type: 'ATOM', kind: 'tag', value: raw.slice(1).toLowerCase() });
    } else if (raw === '(') {
      tokens.push({ type: 'LPAREN' });
    } else if (raw === ')') {
      tokens.push({ type: 'RPAREN' });
    } else if (['AND', 'OR', 'NOT'].includes(raw.toUpperCase())) {
      tokens.push({ type: raw.toUpperCase() });
    } else {
      tokens.push({ type: 'ATOM', kind: 'word', value: raw.toLowerCase() });
    }
  }
  return tokens;
}

function parseBooleanQuery(query) {
  const tokens = tokenizeBooleanQuery(query);
  let position = 0;
  const peek = () => tokens[position];
  const take = type => peek()?.type === type ? tokens[position++] : null;
  const startsExpression = token => token && ['ATOM', 'LPAREN', 'NOT'].includes(token.type);

  function parsePrimary() {
    if (take('LPAREN')) {
      const node = parseOr();
      if (!take('RPAREN')) throw new Error('Missing closing parenthesis');
      return node;
    }
    const atom = take('ATOM');
    if (!atom) throw new Error('Expected a word, phrase, or tag');
    return atom;
  }

  function parseUnary() {
    if (take('NOT')) return { type: 'NOT', child: parseUnary() };
    return parsePrimary();
  }

  function parseAnd() {
    let node = parseUnary();
    while (true) {
      if (take('AND')) {
        node = { type: 'AND', left: node, right: parseUnary() };
      } else if (startsExpression(peek())) {
        node = { type: 'AND', left: node, right: parseUnary() };
      } else {
        break;
      }
    }
    return node;
  }

  function parseOr() {
    let node = parseAnd();
    while (take('OR')) node = { type: 'OR', left: node, right: parseAnd() };
    return node;
  }

  if (tokens.length === 0) return null;
  const tree = parseOr();
  if (position !== tokens.length) throw new Error('Unexpected search text');
  return tree;
}

function evaluateBooleanQuery(node, row, includeNotes = true) {
  if (!node) return true;
  if (node.type === 'AND') return evaluateBooleanQuery(node.left, row, includeNotes) && evaluateBooleanQuery(node.right, row, includeNotes);
  if (node.type === 'OR') return evaluateBooleanQuery(node.left, row, includeNotes) || evaluateBooleanQuery(node.right, row, includeNotes);
  if (node.type === 'NOT') return !evaluateBooleanQuery(node.child, row, includeNotes);
  if (node.kind === 'tag') return row.dataset.tags.toLowerCase().split(/\s+/).includes(node.value);
  const haystack = includeNotes ? `${row.dataset.search} ${row.dataset.notes}`.toLowerCase() : row.dataset.search.toLowerCase();
  return haystack.includes(node.value);
}

function performBooleanSearch(query) {
  let tree;
  try {
    tree = parseBooleanQuery(query);
  } catch (error) {
    document.querySelectorAll('.bookmark-row').forEach(row => { row.hidden = true; });
    searchInterpretation.textContent = 'Finish the combination to see results';
    searchInterpretation.hidden = false;
    noResults.hidden = true;
    setCollectionCount(0);
    return;
  }

  let visible = 0;
  document.querySelectorAll('.bookmark-row').forEach(row => {
    const matches = evaluateBooleanQuery(tree, row, true);
    row.hidden = !matches;
    const note = row.querySelector('.match-note');
    const reliesOnNotes = matches && !evaluateBooleanQuery(tree, row, false);
    if (reliesOnNotes) {
      note.textContent = `Matched in your notes: ${row.dataset.notes}`;
      note.hidden = false;
    } else {
      note.hidden = true;
    }
    if (matches) visible += 1;
  });
  searchInterpretation.textContent = query ? `Using: ${query}` : '';
  searchInterpretation.hidden = !query;
  filterStatus.hidden = true;
  noResults.hidden = visible !== 0 || !query;
  setCollectionCount(visible);
}

function performAdvancedSearch(query) {
  if (logicVariant === 'explicit') {
    performBooleanSearch(query);
    return;
  }
  const parsed = parseAdvancedQuery(query);
  let visible = 0;

  const textMatches = haystack =>
    parsed.terms.every(term => haystack.includes(term)) &&
    parsed.phrases.every(phrase => haystack.includes(phrase));

  document.querySelectorAll('.bookmark-row').forEach(row => {
    const details = row.dataset.search.toLowerCase();
    const notes = row.dataset.notes.toLowerCase();
    const rowTagNames = row.dataset.tags.toLowerCase().split(/\s+/).filter(Boolean);
    const tagsMatch = parsed.tagNames.length === 0 || parsed.tagNames.some(tag => rowTagNames.includes(tag));
    const combinedTextMatches = textMatches(`${details} ${notes}`);
    const matches = tagsMatch && combinedTextMatches;
    row.hidden = !matches;

    const note = row.querySelector('.match-note');
    const reliesOnNotes = matches && !textMatches(details);
    if (reliesOnNotes) {
      note.textContent = `Matched in your notes: ${row.dataset.notes}`;
      note.hidden = false;
    } else {
      note.hidden = true;
    }
    if (matches) visible += 1;
  });

  const parts = [];
  if (parsed.terms.length) parts.push(`Words: ${parsed.terms.join(' + ')}`);
  if (parsed.phrases.length) parts.push(`Exact: “${parsed.phrases.join('” + “')}”`);
  if (parsed.tagNames.length) parts.push(`Tags: ${parsed.tagNames.join(' or ')}`);
  searchInterpretation.textContent = parts.join('  ·  ');
  searchInterpretation.hidden = parts.length === 0;
  filterStatus.hidden = true;
  noResults.hidden = visible !== 0 || !query;
  setCollectionCount(visible);
}

function addTag(value) {
  tags = normaliseTags([...tags, value]);
  chipTagInput.value = '';
  renderEditorTags();
  renderSuggestions();
}

function matchingSuggestions() {
  const query = chipTagInput.value.trim().toLowerCase();
  if (!query) return [];
  return knownTags.filter(tag =>
    tag.toLowerCase().includes(query) &&
    !tags.some(selected => selected.toLowerCase() === tag.toLowerCase())
  );
}

function renderSuggestions() {
  const matches = matchingSuggestions();
  tagSuggestions.replaceChildren();
  matches.forEach(tag => {
    const suggestion = document.createElement('button');
    suggestion.type = 'button';
    suggestion.className = 'tag-suggestion';
    suggestion.setAttribute('role', 'option');
    const name = document.createElement('span');
    name.textContent = tag;
    const note = document.createElement('span');
    note.textContent = 'Used before';
    suggestion.append(name, note);
    suggestion.addEventListener('click', () => addTag(tag));
    tagSuggestions.append(suggestion);
  });
  tagSuggestions.hidden = matches.length === 0;
  chipTagInput.setAttribute('aria-expanded', String(matches.length > 0));
}

function showView(view) {
  captureView.hidden = view !== captureView;
  libraryView.hidden = view !== libraryView;
  detailView.hidden = view !== detailView;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function appendFormattedInline(container, text) {
  const pieces = text.split(/(\*\*[^*]+\*\*)/g);
  pieces.forEach(piece => {
    if (piece.startsWith('**') && piece.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = piece.slice(2, -2);
      container.append(strong);
    } else {
      container.append(document.createTextNode(piece));
    }
  });
}

function renderNotePreview() {
  notePreview.replaceChildren();
  const lines = notesInput.value.split(/\r?\n/);
  let list = null;
  lines.forEach(line => {
    if (line.startsWith('## ')) {
      list = null;
      const heading = document.createElement('h3');
      appendFormattedInline(heading, line.slice(3));
      notePreview.append(heading);
    } else if (line.startsWith('- ')) {
      if (!list) {
        list = document.createElement('ul');
        notePreview.append(list);
      }
      const item = document.createElement('li');
      appendFormattedInline(item, line.slice(2));
      list.append(item);
    } else if (line.trim()) {
      list = null;
      const paragraph = document.createElement('p');
      appendFormattedInline(paragraph, line);
      notePreview.append(paragraph);
    } else {
      list = null;
    }
  });
}

function showNotePane(pane) {
  renderNotePreview();
  const reading = pane === 'read';
  noteWritingPane.hidden = reading;
  noteReadingPane.hidden = !reading;
  writeNoteTab.classList.toggle('active', !reading);
  readNoteTab.classList.toggle('active', reading);
}

function applyNoteFormat(kind) {
  const start = notesInput.selectionStart;
  const end = notesInput.selectionEnd;
  const value = notesInput.value;
  const selected = value.slice(start, end);
  let replacement;

  if (kind === 'bold') {
    replacement = `**${selected || 'bold text'}**`;
  } else {
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndAt = value.indexOf('\n', end);
    const lineEnd = lineEndAt === -1 ? value.length : lineEndAt;
    const lines = value.slice(lineStart, lineEnd).split('\n');
    const prefix = kind === 'heading' ? '## ' : '- ';
    replacement = lines.map(line => line.startsWith(prefix) ? line : `${prefix}${line}`).join('\n');
    notesInput.setSelectionRange(lineStart, lineEnd);
    return replaceNoteSelection(lineStart, lineEnd, replacement);
  }
  replaceNoteSelection(start, end, replacement);
}

function replaceNoteSelection(start, end, replacement) {
  notesInput.setRangeText(replacement, start, end, 'end');
  notesInput.focus();
  renderNotePreview();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 1800);
}

function openEditor() {
  savedUrl.value = savedUrl.value || defaultUrl;
  titleInput.value = rowTitle.textContent;
  descriptionInput.value = rowDescription.textContent;
  notesInput.value = rowTags.closest('.bookmark-row').dataset.notes;
  renderEditorTags();
  commaTagInput.value = tags.join(', ');
  document.querySelector('.saved-banner').hidden = true;
  showView(detailView);
  titleInput.focus();
}

if (editVariant === 'menu') {
  document.querySelector('.direct-action').hidden = true;
  document.querySelector('.menu-action').hidden = false;
}

if (tagVariant === 'commas') {
  document.querySelector('.chips-tag-editor').hidden = true;
  document.querySelector('.comma-tag-editor').hidden = false;
}

if (searchVariant === 'submit') searchButton.hidden = false;

if (params.get('mode') === 'filter') {
  tags = ['travel', 'article'];
  renderRowTags();
  document.querySelector('.bookmark-row').dataset.tags = tags.join(' ');
  document.querySelectorAll('.sample-row').forEach(row => { row.hidden = false; });
  setCollectionCount(document.querySelectorAll('.bookmark-row').length);
  savedUrl.value = defaultUrl;
  showView(libraryView);
} else if (params.get('mode') === 'search') {
  tags = ['travel', 'article'];
  renderRowTags();
  document.querySelector('.bookmark-row').dataset.tags = tags.join(' ');
  document.querySelectorAll('.sample-row').forEach(row => { row.hidden = false; });
  setCollectionCount(document.querySelectorAll('.bookmark-row').length);
  savedUrl.value = defaultUrl;
  showView(libraryView);
  searchInput.focus();
} else if (params.get('mode') === 'advanced') {
  tags = ['travel', 'article'];
  renderRowTags();
  document.querySelector('.bookmark-row').dataset.tags = tags.join(' ');
  document.querySelectorAll('.sample-row').forEach(row => { row.hidden = false; });
  setCollectionCount(document.querySelectorAll('.bookmark-row').length);
  savedUrl.value = defaultUrl;
  showView(libraryView);
  advancedSearchHelp.hidden = false;
  searchInput.placeholder = 'Search words, #tags, or “exact phrases”';
  syntaxExample.textContent = logicVariant === 'simple'
    ? 'Try: Rome #article #book'
    : 'Try: Rome AND (#article OR #book)';
  searchInput.focus();
} else if (params.get('mode') === 'notes') {
  tags = ['travel', 'article'];
  renderRowTags();
  document.querySelector('.bookmark-row').dataset.tags = tags.join(' ');
  document.querySelectorAll('.sample-row').forEach(row => { row.hidden = false; });
  setCollectionCount(document.querySelectorAll('.bookmark-row').length);
  savedUrl.value = defaultUrl;
  showView(libraryView);
} else if (params.get('mode') === 'formatted-note') {
  tags = ['travel', 'article'];
  renderRowTags();
  const primaryRow = document.querySelector('.bookmark-row');
  primaryRow.dataset.tags = tags.join(' ');
  primaryRow.dataset.notes = '## Before we go\nA few things I don’t want to forget:\n\n- Reserve the **rooftop tour**\n- Check the sunset time\n- Bring comfortable shoes\n\n**Best tip:** book the Colosseum for late afternoon.';
  savedUrl.value = defaultUrl;
  openEditor();
  if (noteViewVariant === 'split') {
    noteWorkspace.classList.add('split');
    document.querySelectorAll('.pane-label').forEach(label => { label.hidden = false; });
    noteWritingPane.hidden = false;
    noteReadingPane.hidden = false;
    renderNotePreview();
  } else {
    noteTabs.hidden = false;
    showNotePane('write');
  }
  if (formatInputVariant === 'toolbar') {
    formatToolbar.hidden = false;
  } else {
    shortcutHelp.hidden = false;
  }
} else if (params.get('mode') === 'library') {
  savedUrl.value = defaultUrl;
  showView(libraryView);
}

saveForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!saveForm.reportValidity()) return;

  saveButton.disabled = true;
  saveButton.textContent = 'Finding details…';

  window.setTimeout(() => {
    savedUrl.value = urlInput.value;
    document.querySelector('.saved-banner').hidden = false;
    showView(detailView);
    saveButton.disabled = false;
    saveButton.textContent = 'Save bookmark';
    titleInput.focus();
  }, 650);
});

updateButton.addEventListener('click', () => {
  if (!savedUrl.reportValidity()) return;
  if (tagVariant === 'commas') {
    tags = normaliseTags(commaTagInput.value.split(','));
  }
  rowTitle.textContent = titleInput.value;
  rowDescription.textContent = descriptionInput.value;
  document.querySelector('#bookmarkLink').href = savedUrl.value;
  const editedRow = rowTags.closest('.bookmark-row');
  editedRow.dataset.notes = notesInput.value;
  editedRow.dataset.search = `${titleInput.value} ${descriptionInput.value} ${savedUrl.value}`;
  try {
    document.querySelector('.row-url').textContent = new URL(savedUrl.value).hostname.replace(/^www\./, '');
  } catch {
    document.querySelector('.row-url').textContent = savedUrl.value;
  }
  renderRowTags();
  rowTags.closest('.bookmark-row').dataset.tags = tags.join(' ');
  showToast('Changes saved');
});

chipTagInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const matches = matchingSuggestions();
  addTag(matches[0] || chipTagInput.value);
});

chipTagInput.addEventListener('input', renderSuggestions);

backButton.addEventListener('click', () => showView(libraryView));

addButton.addEventListener('click', () => {
  showView(captureView);
  urlInput.focus();
});

directEditButton.addEventListener('click', openEditor);
menuEditButton.addEventListener('click', openEditor);
moreButton.addEventListener('click', () => {
  const willOpen = actionMenu.hidden;
  actionMenu.hidden = !willOpen;
  moreButton.setAttribute('aria-expanded', String(willOpen));
});

document.querySelectorAll('.sample-row .filter-tag').forEach(button => {
  button.addEventListener('click', () => filterByTag(button.dataset.tag));
});

clearFilter.addEventListener('click', showAllBookmarks);

writeNoteTab.addEventListener('click', () => showNotePane('write'));
readNoteTab.addEventListener('click', () => showNotePane('read'));
notesInput.addEventListener('input', () => {
  if (noteViewVariant === 'split') renderNotePreview();
});

formatToolbar.querySelectorAll('button').forEach(button => {
  button.addEventListener('click', () => applyNoteFormat(button.dataset.format));
});

searchForm.addEventListener('submit', event => {
  event.preventDefault();
  performSearch();
});

if (searchVariant === 'live') searchInput.addEventListener('input', performSearch);
