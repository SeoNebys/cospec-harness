const state = {
  bookmarks: [], view: 'all', search: '', tag: null,
  deleteTargetId: null, lastArchivedId: null, toastTimer: null
};

const ui = {
  app: document.querySelector('#app'), saveForm: document.querySelector('#save-form'),
  urlInput: document.querySelector('#url-input'), saveButton: document.querySelector('#save-button'),
  saveMessage: document.querySelector('#save-message'), searchInput: document.querySelector('#search-input'),
  clearSearch: document.querySelector('#clear-search'), tagBar: document.querySelector('#tag-bar'),
  tagBarItems: document.querySelector('#tag-bar-items'), list: document.querySelector('#bookmark-list'),
  empty: document.querySelector('#empty-state'), emptyTitle: document.querySelector('#empty-title'),
  emptyCopy: document.querySelector('#empty-copy'), listTitle: document.querySelector('#library-title'),
  listContext: document.querySelector('#list-context'), resultCount: document.querySelector('#result-count'),
  allCount: document.querySelector('#all-count'), unreadCount: document.querySelector('#unread-count'),
  archivedCount: document.querySelector('#archived-count'), deleteDialog: document.querySelector('#delete-dialog'),
  deleteTitle: document.querySelector('#delete-bookmark-title'), deleteForm: document.querySelector('#delete-form'),
  archiveToast: document.querySelector('#archive-toast'), undoArchive: document.querySelector('#undo-archive')
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* response has no JSON */ }
  if (!response.ok) {
    const error = new Error(payload.message || 'Something went wrong.');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text, action) {
  const node = element('button', className, text);
  node.type = 'button';
  if (action) node.addEventListener('click', action);
  return node;
}

function setSaveMessage(message = '', type = '') {
  ui.saveMessage.textContent = message;
  ui.saveMessage.className = `form-message${message ? ` visible ${type}` : ''}`;
}

function replaceBookmark(updated) {
  const index = state.bookmarks.findIndex((item) => item.id === updated.id);
  if (index !== -1) state.bookmarks[index] = updated;
}

async function patchBookmark(id, changes) {
  const { bookmark } = await request(`/api/bookmarks/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(changes)
  });
  replaceBookmark(bookmark);
  render();
  return bookmark;
}

function activeBookmarks() { return state.bookmarks.filter((bookmark) => !bookmark.archived); }

function filteredBookmarks() {
  let items;
  if (state.view === 'archived') items = state.bookmarks.filter((bookmark) => bookmark.archived);
  else if (state.view === 'unread') items = state.bookmarks.filter((bookmark) => !bookmark.archived && bookmark.unread);
  else items = activeBookmarks();

  if (state.view !== 'archived' && state.tag) {
    items = items.filter((bookmark) => bookmark.tags.includes(state.tag));
  }
  const query = state.search.trim().toLowerCase();
  if (query) {
    items = items.filter((bookmark) => [
      bookmark.title, bookmark.note, bookmark.summary, bookmark.siteName,
      bookmark.url, ...bookmark.tags
    ].join(' ').toLowerCase().includes(query));
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function renderHeader() {
  const active = activeBookmarks();
  const unread = active.filter((bookmark) => bookmark.unread);
  const archived = state.bookmarks.filter((bookmark) => bookmark.archived);
  ui.allCount.textContent = active.length;
  ui.unreadCount.textContent = unread.length;
  ui.archivedCount.textContent = archived.length;
  document.querySelectorAll('.view-button').forEach((node) => node.classList.toggle('active', node.dataset.view === state.view));
  ui.clearSearch.classList.toggle('visible', Boolean(state.search));

  const tags = [...new Set(active.flatMap((bookmark) => bookmark.tags))].sort();
  ui.tagBar.hidden = state.view === 'archived' || tags.length === 0;
  ui.tagBarItems.replaceChildren();
  for (const tag of tags) {
    const item = button(`tag-filter${state.tag === tag ? ' active' : ''}`, tag, () => {
      state.tag = state.tag === tag ? null : tag;
      render();
    });
    ui.tagBarItems.append(item);
  }
  if (state.tag && !tags.includes(state.tag)) state.tag = null;
}

function renderListHeading(items) {
  const labels = { all: 'All bookmarks', unread: 'Unread bookmarks', archived: 'Archived bookmarks' };
  ui.listTitle.textContent = labels[state.view];
  if (state.search) ui.listTitle.textContent = `Results for “${state.search.trim()}”`;
  else if (state.tag) ui.listTitle.textContent = `Tagged “${state.tag}”`;
  ui.listContext.textContent = state.search ? 'Search' : state.tag ? 'Tag filter' : 'Library';
  ui.resultCount.textContent = `${items.length} ${items.length === 1 ? 'bookmark' : 'bookmarks'}`;
}

function tagControls(bookmark) {
  const wrapper = element('div', 'bookmark-tags');
  for (const tag of bookmark.tags) {
    const tagButton = button('tag-chip', '', async () => {
      const { bookmark: updated } = await request(`/api/bookmarks/${encodeURIComponent(bookmark.id)}/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' });
      replaceBookmark(updated); render();
    });
    tagButton.setAttribute('aria-label', `Remove ${tag} tag`);
    tagButton.append(element('span', '', tag), element('span', 'remove-x', '×'));
    wrapper.append(tagButton);
  }
  wrapper.append(button('add-tags-button', '+ Add tags', () => togglePanel(`tags-${bookmark.id}`)));
  return wrapper;
}

function togglePanel(id) {
  const panel = document.getElementById(id);
  if (!panel) return;
  const opening = panel.hidden;
  panel.hidden = !opening;
  if (opening) panel.querySelector('input, textarea')?.focus();
}

function editPanel(bookmark) {
  const panel = element('div', 'inline-panel');
  panel.id = `edit-${bookmark.id}`;
  panel.hidden = true;
  const form = element('form', 'inline-form');
  const fields = [
    ['Title', 'title', 'input', bookmark.title],
    ['Summary', 'summary', 'textarea', bookmark.summary],
    ['Your note', 'note', 'textarea', bookmark.note]
  ];
  const inputs = {};
  for (const [labelText, name, kind, value] of fields) {
    const field = element('div', 'field');
    const label = element('label', '', labelText);
    const input = document.createElement(kind);
    input.name = name; input.value = value || ''; input.id = `${name}-${bookmark.id}`;
    label.htmlFor = input.id;
    field.append(label, input);
    if (name === 'title') {
      const error = element('p', 'field-error', 'Add a title so you can recognize this bookmark later.');
      error.setAttribute('role', 'alert'); field.append(error);
    }
    form.append(field); inputs[name] = input;
  }
  const actions = element('div', 'inline-actions');
  actions.append(button('button button-secondary', 'Cancel', () => { panel.hidden = true; }), (() => {
    const save = element('button', 'button button-primary', 'Save changes'); save.type = 'submit'; return save;
  })());
  form.append(actions);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = inputs.title.value.trim();
    const titleError = inputs.title.parentElement.querySelector('.field-error');
    if (!title) {
      inputs.title.classList.add('invalid'); titleError.classList.add('visible'); inputs.title.focus(); return;
    }
    inputs.title.classList.remove('invalid'); titleError.classList.remove('visible');
    await patchBookmark(bookmark.id, { title, summary: inputs.summary.value, note: inputs.note.value });
  });
  panel.append(form);
  return panel;
}

function tagsPanel(bookmark) {
  const panel = element('div', 'inline-panel');
  panel.id = `tags-${bookmark.id}`; panel.hidden = true;
  const form = element('form', 'tag-entry');
  const input = document.createElement('input');
  input.placeholder = 'Add tags separated by commas'; input.setAttribute('aria-label', 'Tags');
  const cancel = button('button button-secondary', 'Cancel', () => { panel.hidden = true; });
  const submit = element('button', 'button button-primary', 'Add tags'); submit.type = 'submit';
  form.append(input, cancel, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { bookmark: updated } = await request(`/api/bookmarks/${encodeURIComponent(bookmark.id)}/tags`, {
      method: 'POST', body: JSON.stringify({ tags: input.value })
    });
    replaceBookmark(updated); render();
  });
  panel.append(form);
  return panel;
}

function bookmarkCard(bookmark) {
  const card = element('article', 'bookmark-card');
  card.id = `bookmark-${bookmark.id}`;
  const tile = element('div', 'site-tile', (bookmark.siteName || bookmark.title || '?').charAt(0));
  tile.setAttribute('aria-hidden', 'true');
  const main = element('div', 'bookmark-main');
  main.append(element('div', 'site-name', bookmark.siteName));
  const title = element('h3', 'bookmark-title');
  const link = element('a', '', bookmark.title);
  link.href = bookmark.url; link.target = '_blank'; link.rel = 'noreferrer';
  title.append(link); main.append(title);
  if (bookmark.summary) main.append(element('p', 'bookmark-summary', bookmark.summary));
  if (bookmark.note) {
    const note = element('div', 'note-block');
    note.append(element('span', 'note-label', 'Your note'), element('p', '', bookmark.note));
    main.append(note);
  }
  main.append(tagControls(bookmark));

  const actions = element('div', 'card-actions');
  const status = button(`card-button status-button${bookmark.unread ? ' unread' : ''}`, bookmark.unread ? 'Unread — mark read' : 'Mark unread', () => patchBookmark(bookmark.id, { unread: !bookmark.unread }));
  const edit = button('card-button', 'Edit details', () => togglePanel(`edit-${bookmark.id}`));
  const archive = bookmark.archived
    ? button('card-button archive-button', 'Restore', () => patchBookmark(bookmark.id, { archived: false }))
    : button('card-button archive-button', 'Archive', async () => {
        await patchBookmark(bookmark.id, { archived: true });
        state.lastArchivedId = bookmark.id; showArchiveToast();
      });
  const moreWrap = element('div', 'more-wrap');
  const more = button('card-button more-button', '•••', () => {
    document.querySelectorAll('.more-menu.open').forEach((menu) => { if (menu !== more.nextElementSibling) menu.classList.remove('open'); });
    more.nextElementSibling.classList.toggle('open');
  });
  more.setAttribute('aria-label', 'More actions');
  const menu = element('div', 'more-menu');
  menu.append(button('delete-menu-button', 'Delete permanently', () => openDeleteDialog(bookmark)));
  moreWrap.append(more, menu);
  actions.append(status, edit, archive, moreWrap);

  card.append(tile, main, actions, editPanel(bookmark), tagsPanel(bookmark));
  return card;
}

function renderEmpty(items) {
  ui.empty.hidden = items.length > 0;
  if (items.length) return;
  if (state.search) {
    ui.emptyTitle.textContent = 'No bookmarks match that search.';
    ui.emptyCopy.textContent = 'Clear the search or try a different word.';
  } else if (state.tag) {
    ui.emptyTitle.textContent = 'No bookmarks use this tag.';
    ui.emptyCopy.textContent = 'Clear the tag filter to return to the full library.';
  } else if (state.view === 'unread') {
    ui.emptyTitle.textContent = 'Nothing waiting to be read.';
    ui.emptyCopy.textContent = 'New bookmarks will appear here automatically.';
  } else if (state.view === 'archived') {
    ui.emptyTitle.textContent = 'Nothing in the archive.';
    ui.emptyCopy.textContent = 'Archived bookmarks will be kept here until you restore or delete them.';
  } else {
    ui.emptyTitle.textContent = 'Nothing here yet.';
    ui.emptyCopy.textContent = 'Save a web address above to begin your library.';
  }
}

function render() {
  renderHeader();
  const items = filteredBookmarks();
  renderListHeading(items);
  ui.list.replaceChildren(...items.map(bookmarkCard));
  renderEmpty(items);
}

function openDeleteDialog(bookmark) {
  state.deleteTargetId = bookmark.id;
  ui.deleteTitle.textContent = bookmark.title;
  ui.deleteDialog.showModal();
}

function showArchiveToast() {
  clearTimeout(state.toastTimer);
  ui.archiveToast.classList.add('visible');
  state.toastTimer = setTimeout(() => ui.archiveToast.classList.remove('visible'), 6000);
}

ui.saveForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = ui.urlInput.value.trim();
  ui.urlInput.classList.remove('invalid'); setSaveMessage();
  ui.saveButton.disabled = true; ui.saveButton.textContent = 'Getting page details…';
  try {
    const { bookmark, warning } = await request('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url }) });
    state.bookmarks.push(bookmark); state.view = 'all'; state.tag = null; state.search = ''; ui.searchInput.value = '';
    ui.urlInput.value = ''; render();
    setSaveMessage(warning || 'Bookmark saved and added to your unread pile.', warning ? 'warning' : 'success');
  } catch (error) {
    if (error.payload?.code === 'INVALID_URL') ui.urlInput.classList.add('invalid');
    if (error.payload?.code === 'DUPLICATE_URL') {
      state.view = 'all'; state.tag = null; state.search = ''; ui.searchInput.value = ''; render();
      setSaveMessage(error.message, 'warning');
      requestAnimationFrame(() => {
        const existing = document.getElementById(`bookmark-${error.payload.bookmark.id}`);
        if (existing) { existing.classList.add('highlight'); existing.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      });
    } else setSaveMessage(error.message, 'error');
  } finally {
    ui.saveButton.disabled = false; ui.saveButton.textContent = 'Save bookmark';
  }
});

ui.searchInput.addEventListener('input', () => { state.search = ui.searchInput.value; render(); });
ui.clearSearch.addEventListener('click', () => { ui.searchInput.value = ''; state.search = ''; render(); ui.searchInput.focus(); });
document.querySelectorAll('.view-button').forEach((node) => node.addEventListener('click', () => {
  state.view = node.dataset.view; state.tag = null; render();
}));

ui.deleteForm.addEventListener('submit', async (event) => {
  if (event.submitter?.value !== 'confirm') { state.deleteTargetId = null; return; }
  event.preventDefault();
  const id = state.deleteTargetId;
  await request(`/api/bookmarks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  state.bookmarks = state.bookmarks.filter((bookmark) => bookmark.id !== id);
  state.deleteTargetId = null; ui.deleteDialog.close(); render();
});

ui.undoArchive.addEventListener('click', async () => {
  if (!state.lastArchivedId) return;
  await patchBookmark(state.lastArchivedId, { archived: false });
  state.lastArchivedId = null; ui.archiveToast.classList.remove('visible');
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.more-wrap')) document.querySelectorAll('.more-menu.open').forEach((menu) => menu.classList.remove('open'));
});

(async function start() {
  try {
    const { bookmarks } = await request('/api/bookmarks');
    state.bookmarks = bookmarks; render();
    ui.app.dataset.harnessReady = 'true';
  } catch {
    setSaveMessage('The bookmark library could not be loaded. Please refresh and try again.', 'error');
  }
})();
