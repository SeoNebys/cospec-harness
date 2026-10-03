const state = {
  view: 'all',
  query: '',
  bookmarks: [],
  loading: true,
  openMenu: null
};

const elements = {
  app: document.querySelector('#app'),
  collection: document.querySelector('#collection'),
  viewTitle: document.querySelector('#view-title'),
  viewCount: document.querySelector('#view-count'),
  search: document.querySelector('#search'),
  clearSearch: document.querySelector('#clear-search'),
  notice: document.querySelector('#page-notice'),
  addDialog: document.querySelector('#add-dialog'),
  addForm: document.querySelector('#add-form'),
  url: document.querySelector('#bookmark-url'),
  urlError: document.querySelector('#url-error'),
  saveButton: document.querySelector('#save-bookmark'),
  saveWorking: document.querySelector('#save-working'),
  editDialog: document.querySelector('#edit-dialog'),
  editForm: document.querySelector('#edit-form'),
  editId: document.querySelector('#edit-id'),
  editTitle: document.querySelector('#edit-title'),
  editDescription: document.querySelector('#edit-description'),
  editError: document.querySelector('#edit-error'),
  toast: document.querySelector('#toast')
};

const viewContent = {
  all: { title: 'All bookmarks', emptyTitle: 'Your collection is ready', emptyCopy: 'Save your first link and its page details will appear here automatically.' },
  later: { title: 'Read later', emptyTitle: 'Your reading pile is clear', emptyCopy: 'Bookmarks you mark for later will wait for you here.' },
  archive: { title: 'Archive', emptyTitle: 'Nothing archived yet', emptyCopy: 'Finished bookmarks you tidy away will remain safely available here.' }
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || 'Something went wrong'), { status: response.status, payload });
  return payload;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { elements.toast.hidden = true; }, 3200);
}

function showNotice(message = '') {
  elements.notice.textContent = message;
  elements.notice.hidden = !message;
}

function iconForEmpty() {
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 27c4-10 9-15 15-15s11 5 15 15c-4 7-9 10-15 10S13 34 9 27Z"/><path d="M15 27c5 4 13 4 18 0M24 12V6"/></svg>`;
}

function emptyMarkup() {
  if (state.query) {
    return `<div class="empty-state"><div><div class="empty-icon">${iconForEmpty()}</div><h2>No bookmarks found</h2><p>Nothing matches “${escapeHtml(state.query)}”. Try a different word or clear the search.</p><button class="secondary-button" data-action="clear-search">Clear search</button></div></div>`;
  }
  const content = viewContent[state.view];
  const action = state.view === 'all' ? '<button class="primary-button" data-action="open-add">Save your first link</button>' : '';
  return `<div class="empty-state"><div><div class="empty-icon">${iconForEmpty()}</div><h2>${content.emptyTitle}</h2><p>${content.emptyCopy}</p>${action}</div></div>`;
}

function tagMarkup(label) {
  return `<span class="tag">${escapeHtml(label)}</span>`;
}

function cardMarkup(bookmark) {
  const tags = bookmark.labels.map(tagMarkup).join('');
  const siteLetter = (bookmark.site || '?').replace(/^www\./, '').charAt(0).toUpperCase();
  const menuOpen = state.openMenu === bookmark.id;
  const actions = bookmark.archived
    ? `<span class="archived-badge">Archived</span><div class="menu-wrap"><button class="menu-button" data-action="menu" data-id="${bookmark.id}" aria-label="More actions" aria-expanded="${menuOpen}">•••</button>${menuOpen ? `<div class="action-menu"><button data-action="restore" data-id="${bookmark.id}">Restore</button></div>` : ''}</div>`
    : `<button class="later-button ${bookmark.readLater ? 'active' : ''}" data-action="later" data-id="${bookmark.id}">${bookmark.readLater ? '✓ In read later' : '＋ Read later'}</button><div class="menu-wrap"><button class="menu-button" data-action="menu" data-id="${bookmark.id}" aria-label="More actions" aria-expanded="${menuOpen}">•••</button>${menuOpen ? `<div class="action-menu"><button data-action="edit" data-id="${bookmark.id}">Edit details</button><button data-action="archive" data-id="${bookmark.id}">Archive</button></div>` : ''}</div>`;
  const status = bookmark.detailsStatus === 'needs_details'
    ? `<div class="status-row"><span class="needs-details">Needs details</span><button class="retry-button" data-action="retry" data-id="${bookmark.id}">Try getting details again</button></div>` : '';
  return `<article class="bookmark-card" data-bookmark-id="${bookmark.id}">
    <div class="site-mark" aria-hidden="true">${escapeHtml(siteLetter)}</div>
    <div class="bookmark-body">
      <a class="bookmark-title" href="${escapeHtml(bookmark.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(bookmark.title)}</a>
      ${bookmark.description ? `<p class="bookmark-description">${escapeHtml(bookmark.description)}</p>` : ''}
      <div class="bookmark-site">${escapeHtml(bookmark.site)}</div>
      <div class="tag-list">${tags}${bookmark.archived ? '' : `<button class="add-label-button" data-action="add-label" data-id="${bookmark.id}">＋ Add label</button>`}</div>
      <span class="inline-error" data-label-error="${bookmark.id}" hidden></span>
      ${status}
    </div>
    <div class="card-actions">${actions}</div>
  </article>`;
}

function render() {
  const content = viewContent[state.view];
  elements.viewTitle.textContent = content.title;
  const count = state.bookmarks.length;
  elements.viewCount.textContent = state.query ? `${count} ${count === 1 ? 'result' : 'results'} for “${state.query}”` : `${count} ${count === 1 ? 'bookmark' : 'bookmarks'}`;
  elements.clearSearch.hidden = !state.query;
  document.querySelectorAll('.nav-button').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
  elements.collection.innerHTML = count ? state.bookmarks.map(cardMarkup).join('') : emptyMarkup();
}

async function loadBookmarks({ quiet = false } = {}) {
  if (!quiet) {
    state.loading = true;
    elements.collection.innerHTML = '<div class="loading-state"><span class="spinner"></span><p>Gathering your bookmarks…</p></div>';
  }
  try {
    const params = new URLSearchParams({ view: state.view });
    if (state.query) params.set('q', state.query);
    const payload = await api(`/api/bookmarks?${params}`);
    state.bookmarks = payload.bookmarks;
    state.loading = false;
    showNotice();
    render();
    elements.app.dataset.harnessReady = 'true';
  } catch (error) {
    state.loading = false;
    elements.collection.innerHTML = `<div class="empty-state"><div><h2>We couldn’t load your bookmarks</h2><p>${escapeHtml(error.message)}</p><button class="secondary-button" data-action="reload">Try again</button></div></div>`;
  }
}

function closeDialog(id) {
  const dialog = document.querySelector(`#${id}`);
  if (dialog?.open) dialog.close();
}

function openAdd() {
  elements.addForm.reset();
  elements.urlError.hidden = true;
  elements.url.classList.remove('invalid');
  elements.addDialog.showModal();
  setTimeout(() => elements.url.focus(), 30);
}

async function patchBookmark(id, changes, message) {
  await api(`/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
  state.openMenu = null;
  await loadBookmarks({ quiet: true });
  if (message) showToast(message);
}

function openEdit(id) {
  const bookmark = state.bookmarks.find(item => item.id === id);
  if (!bookmark) return;
  elements.editId.value = String(id);
  elements.editTitle.value = bookmark.title;
  elements.editDescription.value = bookmark.description;
  elements.editError.hidden = true;
  state.openMenu = null;
  render();
  elements.editDialog.showModal();
  setTimeout(() => elements.editTitle.focus(), 30);
}

function openLabelInput(id) {
  const card = document.querySelector(`[data-bookmark-id="${id}"]`);
  const trigger = card?.querySelector('[data-action="add-label"]');
  if (!trigger) return;
  trigger.outerHTML = `<form class="label-form" data-label-form="${id}"><input aria-label="New label" maxlength="40" placeholder="Type a label"><span class="label-hint">Enter</span></form>`;
  card.querySelector('[aria-label="New label"]').focus();
}

async function submitLabel(form) {
  const id = Number(form.dataset.labelForm);
  const input = form.querySelector('input');
  const name = input.value.trim();
  if (!name) return;
  const errorElement = document.querySelector(`[data-label-error="${id}"]`);
  try {
    await api(`/api/bookmarks/${id}/labels`, { method: 'POST', body: JSON.stringify({ name }) });
    await loadBookmarks({ quiet: true });
  } catch (error) {
    errorElement.textContent = error.message;
    errorElement.hidden = false;
    input.focus();
  }
}

document.querySelector('#open-add').addEventListener('click', openAdd);
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(button.dataset.close)));
document.querySelectorAll('.nav-button').forEach(button => button.addEventListener('click', async () => {
  state.view = button.dataset.view;
  state.openMenu = null;
  await loadBookmarks();
}));

let searchTimer;
elements.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    state.query = elements.search.value.trim();
    await loadBookmarks({ quiet: true });
  }, 180);
});

async function clearSearch() {
  elements.search.value = '';
  state.query = '';
  await loadBookmarks({ quiet: true });
  elements.search.focus();
}
elements.clearSearch.addEventListener('click', clearSearch);

elements.addForm.addEventListener('submit', async event => {
  event.preventDefault();
  const address = elements.url.value.trim();
  elements.urlError.hidden = true;
  elements.url.classList.remove('invalid');
  elements.saveButton.disabled = true;
  elements.saveWorking.hidden = false;
  try {
    const payload = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url: address }) });
    closeDialog('add-dialog');
    state.view = 'all';
    state.query = '';
    elements.search.value = '';
    await loadBookmarks({ quiet: true });
    showToast(payload.bookmark.detailsStatus === 'needs_details' ? 'Link saved. Its page details can be retried later.' : 'Bookmark saved with its page details.');
  } catch (error) {
    elements.urlError.textContent = error.message;
    elements.urlError.hidden = false;
    elements.url.classList.add('invalid');
    elements.url.focus();
  } finally {
    elements.saveButton.disabled = false;
    elements.saveWorking.hidden = true;
  }
});

elements.url.addEventListener('input', () => {
  elements.urlError.hidden = true;
  elements.url.classList.remove('invalid');
});

elements.editForm.addEventListener('submit', async event => {
  event.preventDefault();
  const id = Number(elements.editId.value);
  const title = elements.editTitle.value.trim();
  if (!title) {
    elements.editError.textContent = 'Title cannot be empty';
    elements.editError.hidden = false;
    elements.editTitle.focus();
    return;
  }
  try {
    await patchBookmark(id, { title, description: elements.editDescription.value }, 'Bookmark details updated.');
    closeDialog('edit-dialog');
  } catch (error) {
    elements.editError.textContent = error.message;
    elements.editError.hidden = false;
  }
});

elements.collection.addEventListener('submit', event => {
  if (event.target.matches('[data-label-form]')) {
    event.preventDefault();
    submitLabel(event.target);
  }
});

elements.collection.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const id = Number(button.dataset.id);
  try {
    if (action === 'open-add') return openAdd();
    if (action === 'clear-search') return clearSearch();
    if (action === 'reload') return loadBookmarks();
    if (action === 'menu') {
      state.openMenu = state.openMenu === id ? null : id;
      return render();
    }
    if (action === 'add-label') return openLabelInput(id);
    if (action === 'edit') return openEdit(id);
    if (action === 'later') {
      const bookmark = state.bookmarks.find(item => item.id === id);
      return patchBookmark(id, { readLater: !bookmark.readLater }, bookmark.readLater ? 'Removed from Read later.' : 'Added to Read later.');
    }
    if (action === 'archive') return patchBookmark(id, { archived: true }, 'Bookmark moved to Archive.');
    if (action === 'restore') return patchBookmark(id, { archived: false }, 'Bookmark restored to All bookmarks.');
    if (action === 'retry') {
      button.disabled = true;
      try {
        await api(`/api/bookmarks/${id}/retry-details`, { method: 'POST', body: '{}' });
        await loadBookmarks({ quiet: true });
        showToast('Page details updated.');
      } catch (error) {
        showNotice(error.message);
        button.disabled = false;
      }
    }
  } catch (error) {
    showNotice(error.message);
  }
});

document.addEventListener('click', event => {
  if (state.openMenu && !event.target.closest('.menu-wrap')) {
    state.openMenu = null;
    render();
  }
});

loadBookmarks();
