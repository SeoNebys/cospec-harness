import {
  addBookmark,
  assignToCollection,
  createCollectionAndAssign,
  deleteBookmarks,
  findBookmarks
} from './domain.js';
import { loadState, saveState } from './storage.js';

let state = loadState();
const view = {
  search: '',
  collectionId: 'all',
  selected: new Set(),
  pendingDelete: []
};
let toastTimer;

const elements = {
  shell: document.querySelector('#app-shell'),
  addTop: document.querySelector('#add-bookmark-top'),
  totalNumber: document.querySelector('#total-number'),
  totalLabel: document.querySelector('#total-label'),
  finder: document.querySelector('#finder'),
  search: document.querySelector('#bookmark-search'),
  filters: document.querySelector('#collection-filters'),
  selectionBar: document.querySelector('#selection-bar'),
  selectionCount: document.querySelector('#selection-count'),
  clearSelection: document.querySelector('#clear-selection'),
  organizeSelected: document.querySelector('#organize-selected'),
  deleteSelected: document.querySelector('#delete-selected'),
  collectionView: document.querySelector('#collection-view'),
  bookmarkDialog: document.querySelector('#bookmark-dialog'),
  bookmarkForm: document.querySelector('#bookmark-form'),
  bookmarkName: document.querySelector('#bookmark-name'),
  bookmarkUrl: document.querySelector('#bookmark-url'),
  bookmarkNameError: document.querySelector('#bookmark-name-error'),
  bookmarkUrlError: document.querySelector('#bookmark-url-error'),
  duplicateBookmarkError: document.querySelector('#duplicate-bookmark-error'),
  organizeDialog: document.querySelector('#organize-dialog'),
  organizeForm: document.querySelector('#organize-form'),
  organizeCopy: document.querySelector('#organize-dialog-copy'),
  destinationList: document.querySelector('#destination-list'),
  newCollectionField: document.querySelector('#new-collection-field'),
  collectionName: document.querySelector('#collection-name'),
  collectionNameError: document.querySelector('#collection-name-error'),
  duplicateCollectionError: document.querySelector('#duplicate-collection-error'),
  organizeSubmit: document.querySelector('#organize-submit'),
  deleteDialog: document.querySelector('#delete-dialog'),
  deleteTitle: document.querySelector('#delete-dialog-title'),
  deleteCopy: document.querySelector('#delete-dialog-copy'),
  cancelDelete: document.querySelector('#cancel-delete'),
  confirmDelete: document.querySelector('#confirm-delete'),
  toast: document.querySelector('#toast'),
  toastMessage: document.querySelector('#toast-message')
};

function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function escapeText(value) {
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML;
}

function collectionFor(bookmark) {
  return state.collections.find((collection) => collection.id === bookmark.collectionId) ?? null;
}

function persist() {
  saveState(state);
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toastMessage.textContent = message;
  elements.toast.classList.add('visible');
  toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 3200);
}

function setFieldError(input, target, message) {
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  target.textContent = message || '';
  target.classList.toggle('visible', Boolean(message));
}

function setAlert(target, message) {
  target.textContent = message || '';
  target.classList.toggle('visible', Boolean(message));
}

function clearBookmarkErrors() {
  setFieldError(elements.bookmarkName, elements.bookmarkNameError, '');
  setFieldError(elements.bookmarkUrl, elements.bookmarkUrlError, '');
  setAlert(elements.duplicateBookmarkError, '');
}

function clearCollectionErrors() {
  setFieldError(elements.collectionName, elements.collectionNameError, '');
  setAlert(elements.duplicateCollectionError, '');
}

function openBookmarkForm() {
  elements.bookmarkForm.reset();
  clearBookmarkErrors();
  elements.bookmarkDialog.showModal();
  elements.bookmarkName.focus();
}

function renderFilters() {
  elements.filters.replaceChildren();
  const choices = [{ id: 'all', name: 'All', count: state.bookmarks.length }, ...state.collections.map((collection) => ({
    ...collection,
    count: state.bookmarks.filter((bookmark) => bookmark.collectionId === collection.id).length
  }))];

  choices.forEach((choice) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-button';
    button.dataset.collectionId = choice.id;
    button.setAttribute('aria-pressed', String(view.collectionId === choice.id));
    button.innerHTML = `${escapeText(choice.name)} <span class="filter-count">${choice.count}</span>`;
    button.addEventListener('click', () => {
      view.collectionId = choice.id;
      render();
    });
    elements.filters.appendChild(button);
  });
}

function createCard(bookmark) {
  const collection = collectionFor(bookmark);
  const card = document.createElement('article');
  card.className = `bookmark-card${view.selected.has(bookmark.id) ? ' selected' : ''}`;
  card.dataset.bookmarkId = bookmark.id;
  card.dataset.bookmarkName = bookmark.name;
  card.tabIndex = 0;
  card.setAttribute('role', 'link');
  card.setAttribute('aria-label', `Open ${bookmark.name} in a new tab`);
  card.innerHTML = `
    <input class="card-checkbox" type="checkbox" ${view.selected.has(bookmark.id) ? 'checked' : ''} aria-label="Select ${escapeText(bookmark.name)}">
    <div class="site-letter" aria-hidden="true">${escapeText(bookmark.name.slice(0, 1) || '↗')}</div>
    <div class="card-copy">
      <p class="bookmark-name" title="${escapeText(bookmark.name)}">${escapeText(bookmark.name)}</p>
      <p class="bookmark-url" title="${escapeText(bookmark.url)}">${escapeText(bookmark.url)}</p>
      <span class="collection-tag ${collection ? '' : 'unfiled-tag'}" title="${escapeText(collection?.name || 'Unfiled')}">${escapeText(collection?.name || 'Unfiled')}</span>
    </div>
    <button class="delete-card" type="button" aria-label="Delete ${escapeText(bookmark.name)}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5"></path></svg>
    </button>`;

  const checkbox = card.querySelector('.card-checkbox');
  checkbox.addEventListener('click', (event) => event.stopPropagation());
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) view.selected.add(bookmark.id);
    else view.selected.delete(bookmark.id);
    render();
  });

  const deleteButton = card.querySelector('.delete-card');
  deleteButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openDeleteConfirmation([bookmark.id]);
  });

  const open = () => window.open(bookmark.url, '_blank', 'noopener,noreferrer');
  card.addEventListener('click', (event) => {
    if (!event.target.closest('button, input')) open();
  });
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target === card) {
      event.preventDefault();
      open();
    }
  });
  return card;
}

function createSection(title, bookmarks, named = false) {
  const section = document.createElement('section');
  section.className = `collection-section${named ? ' named' : ''}`;
  const heading = document.createElement('div');
  heading.className = 'section-heading';
  heading.innerHTML = `<h3>${escapeText(title)}</h3><span>${plural(bookmarks.length, 'bookmark')}</span>`;
  const grid = document.createElement('div');
  grid.className = 'card-grid';
  bookmarks.forEach((bookmark) => grid.appendChild(createCard(bookmark)));
  section.append(heading, grid);
  return section;
}

function renderEmptyState() {
  elements.collectionView.innerHTML = `
    <section class="empty-state">
      <div>
        <div class="empty-illustration" aria-hidden="true"></div>
        <h2>Your collection is empty</h2>
        <p>Save a useful page whenever you find one. It’ll be waiting here when you need it again.</p>
        <button class="button button-primary" id="add-first-bookmark" type="button">Add your first bookmark</button>
      </div>
    </section>`;
  document.querySelector('#add-first-bookmark').addEventListener('click', openBookmarkForm);
}

function renderNoResults() {
  const filter = state.collections.find((collection) => collection.id === view.collectionId);
  const context = filter
    ? `No saved link in ${filter.name} contains that text. Clear the search to return to the collection.`
    : 'Try a different word or clear the search to see your bookmarks again.';
  elements.collectionView.innerHTML = `
    <section class="no-results">
      <div>
        <div class="search-zero" aria-hidden="true">⌕</div>
        <h2>No bookmarks match that search</h2>
        <p>${escapeText(context)}</p>
        <button class="button button-secondary" id="clear-empty-search" type="button">Clear search</button>
      </div>
    </section>`;
  document.querySelector('#clear-empty-search').addEventListener('click', () => {
    view.search = '';
    elements.search.value = '';
    render();
  });
}

function renderBookmarkList(matches) {
  const filter = state.collections.find((collection) => collection.id === view.collectionId);
  let title = 'All bookmarks';
  if (filter && view.search) title = `${filter.name} matching “${view.search}”`;
  else if (filter) title = filter.name;
  else if (view.search) title = `Results for “${view.search}”`;

  const heading = document.createElement('div');
  heading.className = 'view-heading';
  heading.innerHTML = `<h2>${escapeText(title)}</h2><span>${plural(matches.length, view.search || filter ? 'result' : 'bookmark')}</span>`;
  elements.collectionView.replaceChildren(heading);

  if (view.collectionId === 'all' && !view.search) {
    state.collections.forEach((collection) => {
      const grouped = matches.filter((bookmark) => bookmark.collectionId === collection.id);
      if (grouped.length) elements.collectionView.appendChild(createSection(collection.name, grouped, true));
    });
    const unfiled = matches.filter((bookmark) => !bookmark.collectionId);
    if (unfiled.length) elements.collectionView.appendChild(createSection('Unfiled', unfiled));
  } else {
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    matches.forEach((bookmark) => grid.appendChild(createCard(bookmark)));
    elements.collectionView.appendChild(grid);
  }
}

function renderSelectionBar() {
  const count = view.selected.size;
  elements.selectionBar.hidden = count === 0;
  elements.selectionCount.textContent = plural(count, 'selected bookmark', 'selected bookmarks');
}

function render() {
  const existingIds = new Set(state.bookmarks.map((bookmark) => bookmark.id));
  view.selected = new Set([...view.selected].filter((id) => existingIds.has(id)));
  if (view.collectionId !== 'all' && !state.collections.some((collection) => collection.id === view.collectionId)) {
    view.collectionId = 'all';
  }

  elements.totalNumber.textContent = state.bookmarks.length;
  elements.totalLabel.textContent = state.bookmarks.length === 1 ? 'bookmark' : 'bookmarks';
  elements.finder.hidden = state.bookmarks.length === 0;
  renderSelectionBar();
  renderFilters();

  if (state.bookmarks.length === 0) {
    renderEmptyState();
  } else {
    const matches = findBookmarks(state, { search: view.search, collectionId: view.collectionId });
    if (matches.length === 0 && view.search) renderNoResults();
    else renderBookmarkList(matches);
  }
  elements.shell.setAttribute('data-harness-ready', 'true');
}

function renderDestinationChoices() {
  elements.destinationList.replaceChildren();
  state.collections.forEach((collection, index) => {
    const count = state.bookmarks.filter((bookmark) => bookmark.collectionId === collection.id).length;
    const label = document.createElement('label');
    label.className = 'destination-option';
    label.innerHTML = `
      <input type="radio" name="destination" value="${escapeText(collection.id)}" ${index === 0 ? 'checked' : ''}>
      <span class="destination-name" title="${escapeText(collection.name)}">${escapeText(collection.name)}</span>
      <span class="destination-count">${plural(count, 'bookmark')}</span>`;
    elements.destinationList.appendChild(label);
  });

  const newLabel = document.createElement('label');
  newLabel.className = 'destination-option';
  newLabel.innerHTML = `
    <input type="radio" name="destination" value="new" ${state.collections.length === 0 ? 'checked' : ''}>
    <span class="destination-name">Create a new collection</span>
    <span class="destination-count">New</span>`;
  elements.destinationList.appendChild(newLabel);

  elements.destinationList.querySelectorAll('input').forEach((input) => input.addEventListener('change', updateDestinationState));
  updateDestinationState();
}

function updateDestinationState() {
  const selected = elements.organizeForm.elements.destination?.value;
  const isNew = selected === 'new';
  elements.collectionName.disabled = !isNew;
  elements.newCollectionField.classList.toggle('inactive', !isNew);
  elements.organizeSubmit.textContent = isNew ? 'Create collection' : 'Add to collection';
  clearCollectionErrors();
}

function openOrganizeDialog() {
  if (!view.selected.size) return;
  elements.organizeForm.reset();
  clearCollectionErrors();
  elements.organizeCopy.textContent = `${plural(view.selected.size, 'selected bookmark')} will be kept together.`;
  renderDestinationChoices();
  elements.organizeDialog.showModal();
  if (!state.collections.length) elements.collectionName.focus();
}

function openDeleteConfirmation(ids) {
  view.pendingDelete = ids.filter((id) => state.bookmarks.some((bookmark) => bookmark.id === id));
  if (!view.pendingDelete.length) return;
  const selectedBookmarks = state.bookmarks.filter((bookmark) => view.pendingDelete.includes(bookmark.id));
  if (selectedBookmarks.length === 1) {
    elements.deleteTitle.textContent = 'Delete this bookmark?';
    elements.deleteCopy.textContent = `“${selectedBookmarks[0].name}” will be permanently removed from your collection.`;
    elements.confirmDelete.textContent = 'Delete bookmark';
  } else {
    elements.deleteTitle.textContent = `Delete ${selectedBookmarks.length} bookmarks?`;
    elements.deleteCopy.textContent = 'The selected bookmarks will be permanently removed from your collection.';
    elements.confirmDelete.textContent = `Delete ${selectedBookmarks.length} bookmarks`;
  }
  elements.deleteDialog.showModal();
  elements.cancelDelete.focus();
}

elements.addTop.addEventListener('click', openBookmarkForm);
document.querySelectorAll('.close-dialog').forEach((button) => button.addEventListener('click', () => elements.bookmarkDialog.close()));
document.querySelectorAll('.close-organize').forEach((button) => button.addEventListener('click', () => elements.organizeDialog.close()));

elements.bookmarkForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearBookmarkErrors();
  const result = addBookmark(state, { name: elements.bookmarkName.value, url: elements.bookmarkUrl.value });
  if (Object.keys(result.errors).length) {
    setFieldError(elements.bookmarkName, elements.bookmarkNameError, result.errors.name);
    setFieldError(elements.bookmarkUrl, elements.bookmarkUrlError, result.errors.url);
    setAlert(elements.duplicateBookmarkError, result.errors.duplicate);
    (result.errors.name ? elements.bookmarkName : elements.bookmarkUrl).focus();
    return;
  }
  state = result.state;
  persist();
  elements.bookmarkDialog.close();
  render();
  showToast('Bookmark saved to your collection');
});

elements.search.addEventListener('input', (event) => {
  view.search = event.target.value.trim();
  render();
});

elements.clearSelection.addEventListener('click', () => {
  view.selected.clear();
  render();
});
elements.organizeSelected.addEventListener('click', openOrganizeDialog);
elements.deleteSelected.addEventListener('click', () => openDeleteConfirmation([...view.selected]));

elements.organizeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearCollectionErrors();
  const destination = elements.organizeForm.elements.destination.value;
  const selectedIds = [...view.selected];
  let collectionName;
  if (destination === 'new') {
    const result = createCollectionAndAssign(state, elements.collectionName.value, selectedIds);
    if (Object.keys(result.errors).length) {
      setFieldError(elements.collectionName, elements.collectionNameError, result.errors.name);
      setAlert(elements.duplicateCollectionError, result.errors.duplicate);
      elements.collectionName.focus();
      return;
    }
    state = result.state;
    collectionName = result.collection.name;
  } else {
    const collection = state.collections.find((item) => item.id === destination);
    if (!collection) return;
    state = assignToCollection(state, destination, selectedIds);
    collectionName = collection.name;
  }
  persist();
  view.selected.clear();
  elements.organizeDialog.close();
  render();
  showToast(`Added to ${collectionName}`);
});

elements.cancelDelete.addEventListener('click', () => {
  view.pendingDelete = [];
  elements.deleteDialog.close();
});

elements.confirmDelete.addEventListener('click', () => {
  const amount = view.pendingDelete.length;
  state = deleteBookmarks(state, view.pendingDelete);
  view.pendingDelete.forEach((id) => view.selected.delete(id));
  view.pendingDelete = [];
  persist();
  elements.deleteDialog.close();
  render();
  showToast(amount === 1 ? 'Bookmark deleted' : `${amount} bookmarks deleted`);
});

render();
