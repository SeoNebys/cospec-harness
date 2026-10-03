const state = {
  bookmarks: [],
  view: 'all',
  query: '',
  tag: '',
  deleteConfirmId: null,
  attentionId: null,
  editingId: null
};

const app = document.querySelector('#app');
const list = document.querySelector('#bookmark-list');
const loading = document.querySelector('#loading-state');
const saveForm = document.querySelector('#save-form');
const saveUrl = document.querySelector('#save-url');
const saveButton = document.querySelector('#save-button');
const saveMessage = document.querySelector('#save-message');
const search = document.querySelector('#search');
const resultCount = document.querySelector('#result-count');
const collectionTitle = document.querySelector('#collection-title');
const sectionKicker = document.querySelector('#section-kicker');
const clearTag = document.querySelector('#clear-tag');
const laterCount = document.querySelector('#later-count');
const editDialog = document.querySelector('#edit-dialog');
const editForm = document.querySelector('#edit-form');
const editUrl = document.querySelector('#edit-url');
const editTitle = document.querySelector('#edit-title');
const editDescription = document.querySelector('#edit-description');
const editTags = document.querySelector('#edit-tags');
const editMessage = document.querySelector('#edit-message');
const toast = document.querySelector('#toast');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Something went wrong.');
    error.status = response.status;
    error.code = data?.error?.code;
    error.details = data?.error;
    throw error;
  }
  return data;
}

function relativeTime(iso) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'Saved just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Saved ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Saved ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Saved yesterday';
  if (days < 7) return `Saved ${days} days ago`;
  return `Saved ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(iso))}`;
}

function visibleBookmarks() {
  const normalizedQuery = state.query.trim().toLocaleLowerCase();
  const normalizedTag = state.tag.toLocaleLowerCase();
  return state.bookmarks.filter((bookmark) => {
    if (state.view === 'later' && !bookmark.readLater) return false;
    if (normalizedTag && !bookmark.tags.some((tag) => tag.toLocaleLowerCase() === normalizedTag)) return false;
    if (normalizedQuery && ![bookmark.title, bookmark.description, bookmark.source]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))) return false;
    return true;
  });
}

function makeTagRow(bookmark) {
  if (!bookmark.tags.length) return null;
  const row = element('div', 'tag-row');
  bookmark.tags.slice(0, 4).forEach((tag) => {
    const button = element('button', 'tag-button', tag);
    button.type = 'button';
    button.dataset.action = 'filter-tag';
    button.dataset.tag = tag;
    row.append(button);
  });
  if (bookmark.tags.length > 4) row.append(element('span', 'more-tags', `+${bookmark.tags.length - 4} more tags`));
  return row;
}

function makeCard(bookmark) {
  const card = element('article', 'bookmark-card');
  card.dataset.id = bookmark.id;
  if (state.attentionId === bookmark.id) card.classList.add('attention');

  const content = element('div', 'card-content');
  content.append(element('p', 'card-source', bookmark.source));
  const heading = element('h3', 'card-title');
  const link = element('a', '', bookmark.title);
  link.href = bookmark.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  heading.append(link);
  content.append(heading);
  if (bookmark.description) content.append(element('p', 'card-description', bookmark.description));
  const tagRow = makeTagRow(bookmark);
  if (tagRow) content.append(tagRow);

  const side = element('div', 'card-side');
  side.append(element('span', 'saved-time', relativeTime(bookmark.createdAt)));
  const actions = element('div', 'card-actions');

  const later = element('button', `text-action later-action${bookmark.readLater ? ' active' : ''}`,
    state.view === 'later' ? 'Mark as read' : bookmark.readLater ? '✓ In read later' : '+ Read later');
  later.type = 'button';
  later.dataset.action = 'toggle-later';
  actions.append(later);

  const edit = element('button', 'text-action', 'Edit');
  edit.type = 'button';
  edit.dataset.action = 'edit';
  actions.append(edit);

  const remove = element('button', 'text-action delete-action', 'Delete');
  remove.type = 'button';
  remove.dataset.action = 'ask-delete';
  actions.append(remove);
  side.append(actions);
  card.append(content, side);

  if (state.deleteConfirmId === bookmark.id) {
    const confirmation = element('div', 'delete-confirm');
    confirmation.append(element('span', '', 'Delete this bookmark? This cannot be undone.'));
    const cancel = element('button', 'text-action', 'Cancel');
    cancel.type = 'button';
    cancel.dataset.action = 'cancel-delete';
    const confirm = element('button', 'danger-button', 'Delete bookmark');
    confirm.type = 'button';
    confirm.dataset.action = 'confirm-delete';
    confirmation.append(cancel, confirm);
    card.append(confirmation);
  }
  return card;
}

function emptyCopy() {
  if (state.query) return 'No saved pages match that search. Clear the search to see your full collection.';
  if (state.tag) return `No bookmarks are tagged ${state.tag}.`;
  if (state.view === 'later') return 'Nothing waiting to be read. Pages you set aside will appear here.';
  return 'Your collection is empty. Save a web address above whenever you’re ready.';
}

function render() {
  const visible = visibleBookmarks();
  const laterTotal = state.bookmarks.filter((bookmark) => bookmark.readLater).length;
  laterCount.textContent = laterTotal;
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view));

  sectionKicker.textContent = state.view === 'later' ? 'Reading queue' : 'Collection';
  collectionTitle.textContent = state.tag ? state.tag : state.view === 'later' ? 'Read later' : 'All bookmarks';
  clearTag.hidden = !state.tag;
  if (state.tag) clearTag.textContent = `${state.tag} ×`;
  resultCount.textContent = state.query || state.tag || state.view === 'later'
    ? `${visible.length} of ${state.bookmarks.length} bookmarks`
    : `${state.bookmarks.length} bookmark${state.bookmarks.length === 1 ? '' : 's'}`;

  list.replaceChildren();
  if (!visible.length) {
    list.append(element('div', 'empty-state', emptyCopy()));
  } else {
    visible.forEach((bookmark) => list.append(makeCard(bookmark)));
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => { toast.hidden = true; }, 3600);
}

function showSaveMessage(message, kind = '') {
  saveMessage.textContent = message;
  saveMessage.className = `form-message ${kind}`.trim();
}

function openEditor(bookmark) {
  state.editingId = bookmark.id;
  editUrl.value = bookmark.url;
  editTitle.value = bookmark.title;
  editDescription.value = bookmark.description;
  editTags.value = bookmark.tags.join(', ');
  editMessage.textContent = '';
  editMessage.className = 'dialog-message';
  editDialog.showModal();
}

saveForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showSaveMessage('');
  saveButton.disabled = true;
  saveButton.querySelector('.button-label').hidden = true;
  saveButton.querySelector('.button-progress').hidden = false;
  try {
    const data = await request('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ url: saveUrl.value })
    });
    state.bookmarks.unshift(data.bookmark);
    state.view = 'all';
    state.tag = '';
    state.attentionId = data.bookmark.id;
    saveUrl.value = '';
    render();
    showSaveMessage(data.metadataUnavailable
      ? 'Saved without page details — you can edit them anytime.'
      : 'Saved — title and description added automatically.', 'success');
    document.querySelector(`[data-id="${data.bookmark.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    if (error.code === 'duplicate' && error.details.bookmark) {
      const existing = error.details.bookmark;
      state.view = 'all';
      state.query = '';
      state.tag = '';
      search.value = '';
      state.attentionId = existing.id;
      render();
      showSaveMessage('Already saved — showing your existing bookmark.', 'success');
      const editExisting = element('button', 'text-action', 'Edit existing');
      editExisting.type = 'button';
      editExisting.addEventListener('click', () => openEditor(existing));
      saveMessage.append(' ', editExisting);
      document.querySelector(`[data-id="${existing.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      showSaveMessage(error.message, 'error');
      saveUrl.focus();
    }
  } finally {
    saveButton.disabled = false;
    saveButton.querySelector('.button-label').hidden = false;
    saveButton.querySelector('.button-progress').hidden = true;
  }
});

search.addEventListener('input', () => {
  state.query = search.value;
  state.deleteConfirmId = null;
  render();
});

document.querySelector('.views').addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  state.view = button.dataset.view;
  state.tag = '';
  state.deleteConfirmId = null;
  render();
});

clearTag.addEventListener('click', () => {
  state.tag = '';
  render();
});

list.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const card = action.closest('[data-id]');
  const id = Number(card?.dataset.id);
  const bookmark = state.bookmarks.find((item) => item.id === id);
  if (!bookmark) return;

  if (action.dataset.action === 'filter-tag') {
    state.tag = action.dataset.tag;
    state.deleteConfirmId = null;
    render();
    return;
  }
  if (action.dataset.action === 'edit') {
    openEditor(bookmark);
    return;
  }
  if (action.dataset.action === 'ask-delete') {
    state.deleteConfirmId = id;
    render();
    return;
  }
  if (action.dataset.action === 'cancel-delete') {
    state.deleteConfirmId = null;
    render();
    return;
  }
  if (action.dataset.action === 'confirm-delete') {
    try {
      await request(`/api/bookmarks/${id}`, { method: 'DELETE' });
      state.bookmarks = state.bookmarks.filter((item) => item.id !== id);
      state.deleteConfirmId = null;
      render();
      showToast('Bookmark deleted.');
      if (!state.bookmarks.length) saveUrl.focus();
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
  if (action.dataset.action === 'toggle-later') {
    try {
      const data = await request(`/api/bookmarks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ readLater: !bookmark.readLater })
      });
      state.bookmarks = state.bookmarks.map((item) => item.id === id ? data.bookmark : item);
      render();
      showToast(data.bookmark.readLater ? 'Added to read later.' : 'Marked as read.');
    } catch (error) {
      showToast(error.message);
    }
  }
});

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const saveEdit = document.querySelector('#save-edit');
  saveEdit.disabled = true;
  editMessage.textContent = '';
  try {
    const data = await request(`/api/bookmarks/${state.editingId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        url: editUrl.value,
        title: editTitle.value,
        description: editDescription.value,
        tags: editTags.value.split(',').map((tag) => tag.trim()).filter(Boolean)
      })
    });
    state.bookmarks = state.bookmarks.map((item) => item.id === data.bookmark.id ? data.bookmark : item);
    state.attentionId = data.bookmark.id;
    editDialog.close();
    render();
    showToast('Changes saved.');
  } catch (error) {
    editMessage.textContent = error.message;
    editMessage.className = 'dialog-message error';
    if (error.code === 'duplicate' || error.code === 'invalid_address') editUrl.focus();
  } finally {
    saveEdit.disabled = false;
  }
});

function closeEditor() {
  editDialog.close();
  state.editingId = null;
}
document.querySelector('#close-edit').addEventListener('click', closeEditor);
document.querySelector('#cancel-edit').addEventListener('click', closeEditor);

async function initialize() {
  try {
    const data = await request('/api/bookmarks');
    state.bookmarks = data.bookmarks;
    loading.hidden = true;
    render();
    app.dataset.harnessReady = 'true';
  } catch {
    loading.textContent = 'The collection could not be opened. Refresh the page to try again.';
  }
}

initialize();
