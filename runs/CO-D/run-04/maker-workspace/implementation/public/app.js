const state = {
  view: 'all',
  query: '',
  limit: 20,
  total: 0,
  items: [],
  overview: { all: 0, readLater: 0, archive: 0, labels: [] },
  metadataDraft: null,
  editBookmark: null,
  chosenLabels: [],
  focusId: null,
  searchTimer: null,
  toastTimer: null
};

const elements = {
  app: document.querySelector('#app'),
  collection: document.querySelector('.collection'),
  list: document.querySelector('#bookmarkList'),
  loadMore: document.querySelector('#loadMoreWrap'),
  title: document.querySelector('#viewTitle'),
  eyebrow: document.querySelector('#viewEyebrow'),
  summary: document.querySelector('#viewSummary'),
  collectionLabel: document.querySelector('#collectionLabel'),
  shownCount: document.querySelector('#shownCount'),
  search: document.querySelector('#search'),
  clearSearch: document.querySelector('#clearSearch'),
  searchMessage: document.querySelector('#searchMessage'),
  labelLinks: document.querySelector('#labelLinks'),
  allCount: document.querySelector('#allCount'),
  laterCount: document.querySelector('#laterCount'),
  archiveCount: document.querySelector('#archiveCount'),
  saveDialog: document.querySelector('#saveDialog'),
  editDialog: document.querySelector('#editDialog'),
  deleteDialog: document.querySelector('#deleteDialog'),
  toast: document.querySelector('#toast')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function titleCaseLabel(value) {
  const trimmed = String(value || '').trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1) : '';
}

function colorFor(value) {
  const colors = ['#286b67', '#8d5d45', '#516d8b', '#687741', '#795d88', '#9b4e43', '#3e727b'];
  let sum = 0;
  for (const character of String(value || 'T')) sum += character.codePointAt(0);
  return colors[sum % colors.length];
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({ error: 'The app returned an unreadable response.' }));
  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong.');
    error.code = data.code;
    error.existing = data.existing;
    error.status = response.status;
    throw error;
  }
  return data;
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  state.toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 3000);
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

function renderOverview() {
  elements.allCount.textContent = state.overview.all;
  elements.laterCount.textContent = state.overview.readLater;
  elements.archiveCount.textContent = state.overview.archive;

  elements.labelLinks.innerHTML = state.overview.labels.map(({ name, count }) => `
    <button class="nav-link" type="button" data-label="${escapeHtml(name)}">
      <span class="label-dot" aria-hidden="true"></span>
      <span>${escapeHtml(name)}</span>
      <span class="nav-count">${count}</span>
    </button>
  `).join('');
}

function viewCopy() {
  if (state.view === 'read-later') return { eyebrow: 'Your queue', title: 'Read later' };
  if (state.view === 'archive') return { eyebrow: 'Out of the way, still safe', title: 'Archive' };
  return { eyebrow: 'Your library', title: 'All bookmarks' };
}

function emptyMarkup() {
  if (state.query) {
    return `<div class="empty-state"><div><div class="empty-state-icon">⌕</div><h2>No bookmarks found</h2><p>Try different words or clear the search to see this full view.</p></div></div>`;
  }
  if (state.view === 'read-later') {
    return `<div class="empty-state"><div><div class="empty-state-icon">✓</div><h2>You're all caught up</h2><p>Use the bookmark control on any saved item when you want to come back to it later.</p></div></div>`;
  }
  if (state.view === 'archive') {
    return `<div class="empty-state"><div><div class="empty-state-icon">□</div><h2>Archive is empty</h2><p>Bookmarks you tuck away will stay safely available here.</p></div></div>`;
  }
  return `<div class="empty-state"><div><div class="empty-state-icon">＋</div><h2>Save your first find</h2><p>Start with a web address and Trove will turn it into something you can recognize later.</p><button class="primary-button" type="button" data-empty-save>Save a link</button></div></div>`;
}

function bookmarkMarkup(bookmark) {
  const initial = (bookmark.siteName || bookmark.title || 'T').charAt(0).toLocaleUpperCase();
  const avatar = bookmark.faviconUrl
    ? `<span class="bookmark-avatar" style="background:${colorFor(bookmark.siteName)}"><img src="${escapeHtml(bookmark.faviconUrl)}" alt="" referrerpolicy="no-referrer"></span>`
    : `<span class="bookmark-avatar" style="background:${colorFor(bookmark.siteName)}">${escapeHtml(initial)}</span>`;
  const labels = bookmark.labels.map(label => `<span class="label-chip">${escapeHtml(label)}</span>`).join('');
  const laterLabel = state.view === 'read-later'
    ? `Mark ${bookmark.title} as read`
    : `${bookmark.readLater ? 'Remove' : 'Add'} ${bookmark.title} ${bookmark.readLater ? 'from' : 'to'} Read later`;
  const laterIcon = state.view === 'read-later' ? '✓' : (bookmark.readLater ? '◆' : '◇');
  const archiveLabel = state.view === 'archive' ? `Restore ${bookmark.title}` : `Archive ${bookmark.title}`;
  const archiveContent = state.view === 'archive' ? '↩ Restore' : '□';

  return `<article class="bookmark-row ${state.focusId === bookmark.id ? 'focused' : ''}" data-bookmark-id="${bookmark.id}">
    <span class="existing-flag">Already saved — here it is</span>
    <a class="bookmark-open" href="${escapeHtml(bookmark.url)}" target="_blank" rel="noopener">
      ${avatar}
      <span class="bookmark-copy">
        <span class="bookmark-title">${escapeHtml(bookmark.title)}</span>
        <span class="bookmark-description">${escapeHtml(bookmark.description)}</span>
        <span class="bookmark-meta"><span>${escapeHtml(bookmark.siteName)}</span>${labels}</span>
      </span>
      <span class="external-mark" aria-label="Opens website">↗</span>
    </a>
    <span class="row-actions">
      <button class="row-button ${bookmark.readLater && state.view !== 'read-later' ? 'selected' : ''}" type="button" data-action="later" aria-label="${escapeHtml(laterLabel)}" title="${escapeHtml(laterLabel)}">${laterIcon}</button>
      <button class="row-button" type="button" data-action="archive" aria-label="${escapeHtml(archiveLabel)}" title="${escapeHtml(archiveLabel)}">${archiveContent}</button>
      <button class="row-button edit-button" type="button" data-action="edit" aria-label="Edit ${escapeHtml(bookmark.title)}">Edit</button>
    </span>
  </article>`;
}

function renderCollection() {
  const copy = viewCopy();
  elements.eyebrow.textContent = copy.eyebrow;
  elements.title.textContent = copy.title;
  elements.summary.textContent = state.query
    ? `${state.total} ${state.total === 1 ? 'bookmark' : 'bookmarks'} found in ${copy.title}`
    : `${state.total} ${state.total === 1 ? 'bookmark' : 'bookmarks'} in this view`;
  elements.collectionLabel.textContent = state.query ? 'Search results' : (state.view === 'all' ? 'Your collection' : copy.title);
  elements.shownCount.textContent = state.total > state.items.length ? `Showing ${state.items.length} of ${state.total}` : `${state.items.length} shown`;
  elements.list.innerHTML = state.items.length ? state.items.map(bookmarkMarkup).join('') : emptyMarkup();
  elements.loadMore.innerHTML = state.items.length < state.total
    ? '<button class="quiet-button" type="button" id="loadMore">Show 20 more</button>'
    : '';

  document.querySelectorAll('[data-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.view === state.view && !state.query.startsWith('label:'));
  });
  elements.collection.setAttribute('aria-busy', 'false');

  if (state.focusId) {
    requestAnimationFrame(() => {
      const row = document.querySelector(`[data-bookmark-id="${state.focusId}"]`);
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}

async function fetchCollection({ preserveOnSearchError = false } = {}) {
  elements.collection.setAttribute('aria-busy', 'true');
  const params = new URLSearchParams({
    view: state.view,
    q: state.query,
    offset: '0',
    limit: String(state.limit)
  });
  try {
    const data = await api(`/api/bookmarks?${params}`);
    state.items = data.items;
    state.total = data.total;
    state.overview = data.overview;
    elements.searchMessage.textContent = '';
    renderOverview();
    renderCollection();
    if (!elements.app.hasAttribute('data-harness-ready')) elements.app.setAttribute('data-harness-ready', 'true');
  } catch (error) {
    elements.collection.setAttribute('aria-busy', 'false');
    if (error.code === 'search_syntax') {
      elements.searchMessage.textContent = error.message;
      if (!preserveOnSearchError) renderCollection();
      return;
    }
    elements.list.innerHTML = `<div class="empty-state"><div><div class="empty-state-icon">!</div><h2>Could not load your collection</h2><p>${escapeHtml(error.message)}</p></div></div>`;
  }
}

async function setView(view) {
  state.view = view;
  state.limit = 20;
  state.focusId = null;
  elements.searchMessage.textContent = '';
  await fetchCollection();
}

async function focusExisting(bookmark, trackingIgnored = false) {
  state.view = bookmark.archived ? 'archive' : 'all';
  state.query = '';
  state.limit = 500;
  state.focusId = bookmark.id;
  elements.search.value = '';
  elements.clearSearch.style.display = 'none';
  closeDialog(elements.saveDialog);
  closeDialog(elements.editDialog);
  await fetchCollection();
  showToast(trackingIgnored
    ? 'Same page already saved — tracking text was ignored'
    : 'Already saved — here it is in your collection');
  setTimeout(() => {
    state.focusId = null;
    document.querySelector('.bookmark-row.focused')?.classList.remove('focused');
  }, 4500);
}

function resetSaveDialog() {
  state.metadataDraft = null;
  document.querySelector('#saveAddressStep').hidden = false;
  document.querySelector('#saveReviewStep').hidden = true;
  document.querySelector('#saveUrl').value = '';
  document.querySelector('#saveTitle').value = '';
  document.querySelector('#saveDescription').value = '';
  document.querySelector('#saveUrlError').textContent = '';
  document.querySelector('#saveTitleError').textContent = '';
  document.querySelector('#fetchDetails').disabled = false;
  document.querySelector('#fetchDetails').textContent = 'Get page details';
}

function showMetadataReview(details) {
  state.metadataDraft = details;
  document.querySelector('#saveAddressStep').hidden = true;
  document.querySelector('#saveReviewStep').hidden = false;
  const unavailable = details.status === 'unavailable';
  const status = document.querySelector('#metadataStatus');
  status.classList.toggle('warning', unavailable);
  status.textContent = unavailable ? 'Page details unavailable' : 'Page details found';
  document.querySelector('#metadataHelp').textContent = unavailable
    ? 'The page did not provide readable details. Add your own title and optional description.'
    : 'Fix anything that will not help you recognize this page later.';
  document.querySelector('#saveTitle').value = details.title || '';
  document.querySelector('#saveDescription').value = details.description || '';
  document.querySelector('#saveSite').textContent = details.siteName;
  document.querySelector('#saveAvatar').textContent = (details.siteName || 'T').charAt(0).toLocaleUpperCase();
  document.querySelector('#saveAvatar').style.background = unavailable ? '#707a78' : colorFor(details.siteName);
  document.querySelector('#saveTitle').focus();
}

async function retrieveMetadata(event) {
  event.preventDefault();
  const url = document.querySelector('#saveUrl').value;
  const errorElement = document.querySelector('#saveUrlError');
  const button = document.querySelector('#fetchDetails');
  errorElement.textContent = '';
  button.disabled = true;
  button.textContent = 'Reading page…';
  try {
    const details = await api('/api/metadata', { method: 'POST', body: JSON.stringify({ url }) });
    if (details.duplicate) {
      await focusExisting(details.duplicate, details.trackingIgnored);
      return;
    }
    showMetadataReview(details);
  } catch (error) {
    errorElement.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Get page details';
  }
}

async function createBookmark() {
  const title = document.querySelector('#saveTitle').value.trim();
  const titleError = document.querySelector('#saveTitleError');
  titleError.textContent = '';
  if (!title) {
    titleError.textContent = 'Add a title so you can recognize this bookmark later.';
    document.querySelector('#saveTitle').focus();
    return;
  }
  const button = document.querySelector('#createBookmark');
  button.disabled = true;
  try {
    const data = await api('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({
        url: state.metadataDraft.url,
        title,
        description: document.querySelector('#saveDescription').value,
        faviconUrl: state.metadataDraft.faviconUrl,
        siteName: state.metadataDraft.siteName
      })
    });
    closeDialog(elements.saveDialog);
    state.view = 'all';
    state.query = '';
    state.limit = 20;
    state.focusId = data.bookmark.id;
    elements.search.value = '';
    await fetchCollection();
    showToast('Bookmark saved with page details');
  } catch (error) {
    if (error.code === 'duplicate' && error.existing) await focusExisting(error.existing);
    else titleError.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function renderSelectedLabels() {
  const container = document.querySelector('#selectedLabels');
  container.innerHTML = state.chosenLabels.map(label => `
    <span class="selected-chip">${escapeHtml(label)}<button class="remove-chip" type="button" data-remove-label="${escapeHtml(label)}" aria-label="Remove ${escapeHtml(label)}">×</button></span>
  `).join('');
}

function addLabel(label) {
  const canonical = titleCaseLabel(label);
  if (!canonical) return;
  const existing = state.overview.labels.find(item => item.name.toLocaleLowerCase() === canonical.toLocaleLowerCase());
  const finalName = existing ? existing.name : canonical;
  if (!state.chosenLabels.some(item => item.toLocaleLowerCase() === finalName.toLocaleLowerCase())) state.chosenLabels.push(finalName);
  document.querySelector('#labelInput').value = '';
  document.querySelector('#labelSuggestions').classList.remove('open');
  renderSelectedLabels();
  document.querySelector('#labelInput').focus();
}

function updateSuggestions() {
  const input = document.querySelector('#labelInput');
  const suggestions = document.querySelector('#labelSuggestions');
  const query = input.value.trim().toLocaleLowerCase();
  const matches = state.overview.labels.filter(({ name }) =>
    query && name.toLocaleLowerCase().includes(query) && !state.chosenLabels.some(label => label.toLocaleLowerCase() === name.toLocaleLowerCase())
  );
  suggestions.innerHTML = matches.map(({ name }) => `<button class="suggestion" type="button" data-suggestion="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join('');
  suggestions.classList.toggle('open', matches.length > 0);
}

async function openEdit(bookmark) {
  state.editBookmark = bookmark;
  state.chosenLabels = [...bookmark.labels];
  document.querySelector('#editId').value = bookmark.id;
  document.querySelector('#editUrl').value = bookmark.url;
  document.querySelector('#editTitle').value = bookmark.title;
  document.querySelector('#editDescription').value = bookmark.description;
  document.querySelector('#editUrlError').textContent = '';
  document.querySelector('#editTitleError').textContent = '';
  document.querySelector('#labelInput').value = '';
  document.querySelector('#labelSuggestions').classList.remove('open');
  renderSelectedLabels();
  openDialog(elements.editDialog);
  document.querySelector('#editTitle').focus();
}

async function saveEdit(event) {
  event.preventDefault();
  const title = document.querySelector('#editTitle').value.trim();
  const titleError = document.querySelector('#editTitleError');
  const urlError = document.querySelector('#editUrlError');
  titleError.textContent = '';
  urlError.textContent = '';
  if (!title) {
    titleError.textContent = 'Add a title so you can recognize this bookmark later.';
    document.querySelector('#editTitle').focus();
    return;
  }
  try {
    await api(`/api/bookmarks/${state.editBookmark.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        url: document.querySelector('#editUrl').value,
        title,
        description: document.querySelector('#editDescription').value,
        labels: state.chosenLabels
      })
    });
    closeDialog(elements.editDialog);
    await fetchCollection();
    showToast('Bookmark details updated');
  } catch (error) {
    if (error.code === 'invalid_address') urlError.textContent = error.message;
    else if (error.code === 'duplicate' && error.existing) await focusExisting(error.existing);
    else titleError.textContent = error.message;
  }
}

async function patchBookmark(bookmark, changes, message) {
  await api(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
  await fetchCollection();
  showToast(message);
}

async function handleRowAction(button) {
  const row = button.closest('[data-bookmark-id]');
  const bookmark = state.items.find(item => item.id === Number(row.dataset.bookmarkId));
  if (!bookmark) return;
  const action = button.dataset.action;
  if (action === 'edit') await openEdit(bookmark);
  if (action === 'later') {
    const readLater = state.view === 'read-later' ? false : !bookmark.readLater;
    await patchBookmark(bookmark, { readLater }, readLater ? 'Added to Read later' : (state.view === 'read-later' ? 'Marked as read' : 'Removed from Read later'));
  }
  if (action === 'archive') {
    const archived = state.view !== 'archive';
    await patchBookmark(bookmark, { archived }, archived ? 'Moved to Archive' : 'Restored to All bookmarks');
  }
}

async function deleteBookmark() {
  await api(`/api/bookmarks/${state.editBookmark.id}`, { method: 'DELETE' });
  closeDialog(elements.deleteDialog);
  await fetchCollection();
  showToast('Bookmark permanently deleted');
}

document.querySelector('#openSave').addEventListener('click', () => {
  resetSaveDialog();
  openDialog(elements.saveDialog);
  document.querySelector('#saveUrl').focus();
});
document.querySelector('#saveForm').addEventListener('submit', retrieveMetadata);
document.querySelector('#createBookmark').addEventListener('click', createBookmark);
document.querySelector('#backToAddress').addEventListener('click', () => {
  document.querySelector('#saveReviewStep').hidden = true;
  document.querySelector('#saveAddressStep').hidden = false;
  document.querySelector('#saveUrl').focus();
});
document.querySelector('#saveTitle').addEventListener('input', () => document.querySelector('#saveTitleError').textContent = '');

document.querySelector('#editForm').addEventListener('submit', saveEdit);
document.querySelector('#editTitle').addEventListener('input', () => document.querySelector('#editTitleError').textContent = '');
document.querySelector('#editUrl').addEventListener('input', () => document.querySelector('#editUrlError').textContent = '');
document.querySelector('#openDelete').addEventListener('click', () => {
  closeDialog(elements.editDialog);
  openDialog(elements.deleteDialog);
});
document.querySelector('#confirmDelete').addEventListener('click', deleteBookmark);

document.querySelector('#labelInput').addEventListener('input', updateSuggestions);
document.querySelector('#labelInput').addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const first = document.querySelector('[data-suggestion]');
  addLabel(first ? first.dataset.suggestion : event.currentTarget.value);
});
document.querySelector('#labelSuggestions').addEventListener('click', event => {
  const button = event.target.closest('[data-suggestion]');
  if (button) addLabel(button.dataset.suggestion);
});
document.querySelector('#selectedLabels').addEventListener('click', event => {
  const button = event.target.closest('[data-remove-label]');
  if (!button) return;
  state.chosenLabels = state.chosenLabels.filter(label => label !== button.dataset.removeLabel);
  renderSelectedLabels();
});

document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(document.querySelector(`#${button.dataset.close}`))));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));

elements.labelLinks.addEventListener('click', event => {
  const button = event.target.closest('[data-label]');
  if (!button) return;
  const name = button.dataset.label;
  state.view = 'all';
  state.query = name.includes(' ') ? `label:"${name}"` : `label:${name.toLocaleLowerCase()}`;
  state.limit = 20;
  state.focusId = null;
  elements.search.value = state.query;
  elements.clearSearch.style.display = 'block';
  fetchCollection();
});

elements.search.addEventListener('input', () => {
  clearTimeout(state.searchTimer);
  const nextQuery = elements.search.value.trim();
  elements.clearSearch.style.display = nextQuery ? 'block' : 'none';
  state.searchTimer = setTimeout(async () => {
    state.query = nextQuery;
    state.limit = 20;
    state.focusId = null;
    await fetchCollection({ preserveOnSearchError: true });
  }, 180);
});
elements.clearSearch.addEventListener('click', async () => {
  elements.search.value = '';
  elements.clearSearch.style.display = 'none';
  state.query = '';
  state.limit = 20;
  elements.search.focus();
  await fetchCollection();
});

elements.list.addEventListener('click', event => {
  const saveButton = event.target.closest('[data-empty-save]');
  if (saveButton) {
    document.querySelector('#openSave').click();
    return;
  }
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) handleRowAction(actionButton).catch(error => showToast(error.message));
});

elements.loadMore.addEventListener('click', event => {
  if (!event.target.closest('#loadMore')) return;
  state.limit += 20;
  fetchCollection();
});

fetchCollection();
