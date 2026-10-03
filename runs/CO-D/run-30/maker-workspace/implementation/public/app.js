const state = {
  view: 'active',
  search: '',
  label: '',
  items: [],
  labels: [],
  totalActive: 0,
  totalAll: 0,
  selectionMode: false,
  selected: new Set(),
  editing: null,
  draft: null,
  draftLabels: [],
  loadSequence: 0,
  prepareController: null,
  prepareTimer: null,
  bulkLabel: '',
  emptyAction: null
};

const $ = selector => document.querySelector(selector);
const shell = $('#app-shell');
const grid = $('#bookmark-grid');
const controls = $('#library-controls');
const loading = $('#loading-state');
const empty = $('#empty-state');
const count = $('#result-count');
const searchInput = $('#search-input');
const searchClear = $('#search-clear');
const selectToggle = $('#select-toggle');
const bulkBar = $('#bulk-bar');
const bookmarkDialog = $('#bookmark-dialog');
const bookmarkForm = $('#bookmark-form');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'Something went wrong. Please try again.');
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2800);
}

function faviconNode(bookmark) {
  const avatar = element('span', 'site-avatar', bookmark.siteName.slice(0, 1).toUpperCase());
  if (bookmark.faviconUrl) {
    const image = document.createElement('img');
    image.src = bookmark.faviconUrl;
    image.alt = '';
    image.addEventListener('load', () => { avatar.textContent = ''; avatar.append(image); });
  }
  return avatar;
}

function displayAddress(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

function renderCard(bookmark) {
  const card = element('article', `bookmark-card${state.selected.has(bookmark.id) ? ' selected' : ''}`);
  card.dataset.id = bookmark.id;

  const top = element('div', 'card-top');
  top.append(faviconNode(bookmark), element('span', '', bookmark.siteName));
  card.append(top);

  const edit = element('button', 'edit-button', 'Edit');
  edit.type = 'button';
  edit.addEventListener('click', () => openEdit(bookmark));
  card.append(edit);

  if (state.selectionMode && state.view !== 'archived') {
    const selection = element('label', 'select-control');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = state.selected.has(bookmark.id);
    box.addEventListener('change', () => {
      if (box.checked) state.selected.add(bookmark.id);
      else state.selected.delete(bookmark.id);
      card.classList.toggle('selected', box.checked);
      renderBulkBar();
    });
    selection.append(box, document.createTextNode('Select'));
    card.append(selection);
  }

  const title = element('h2', 'card-title');
  const link = element('a', '', bookmark.title);
  link.href = bookmark.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  title.append(link);
  card.append(title);
  card.append(element('p', 'card-description', bookmark.description || 'No description saved.'));

  if (bookmark.labels.length) {
    const labels = element('div', 'card-labels');
    bookmark.labels.slice(0, 3).forEach(name => labels.append(element('span', 'card-label', name)));
    if (bookmark.labels.length > 3) labels.append(element('span', 'card-label', `+${bookmark.labels.length - 3}`));
    card.append(labels);
  }

  const footer = element('div', 'card-footer');
  const address = element('span', 'card-url', displayAddress(bookmark.url));
  address.title = bookmark.url;
  footer.append(address);

  if (state.view === 'archived') {
    const restore = element('button', 'restore-card', 'Restore');
    restore.type = 'button';
    restore.addEventListener('click', () => updateBookmark(bookmark.id, { archived: false }, 'Bookmark restored.'));
    footer.append(restore);
  } else {
    const later = element('label', 'later-control');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = bookmark.readLater;
    box.addEventListener('change', async () => {
      box.disabled = true;
      try {
        await api(`/api/bookmarks/${bookmark.id}`, { method: 'PATCH', body: JSON.stringify({ readLater: box.checked }) });
        await loadLibrary();
      } catch (error) {
        box.checked = !box.checked;
        showToast(error.message);
      }
    });
    later.append(box, document.createTextNode('Read later'));
    footer.append(later);
  }
  card.append(footer);
  return card;
}

function renderLabelChips() {
  const container = $('#label-chips');
  container.replaceChildren();
  if (!state.labels.length) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  const names = ['', ...state.labels.map(label => label.name)];
  for (const name of names) {
    const button = element('button', `label-chip${state.label === name ? ' active' : ''}`, name || 'All labels');
    button.type = 'button';
    button.addEventListener('click', () => {
      state.label = name;
      state.selected.clear();
      loadLibrary();
    });
    container.append(button);
  }
}

function configureEmptyState() {
  let title;
  let copy;
  let action;
  let actionLabel;

  if (state.totalAll === 0) {
    title = 'No bookmarks yet';
    copy = 'Save your first link and it’ll appear here with its title, description, and site details.';
    actionLabel = '＋ Add your first bookmark';
    action = openAdd;
  } else if (state.search) {
    title = 'No bookmarks found';
    copy = 'Nothing matches those words in this view.';
    actionLabel = 'Clear search';
    action = () => { searchInput.value = ''; state.search = ''; loadLibrary(); searchInput.focus(); };
  } else if (state.label) {
    title = 'No bookmarks with this label';
    copy = `There’s nothing filed under “${state.label}” in this view.`;
    actionLabel = 'Show all labels';
    action = () => { state.label = ''; loadLibrary(); };
  } else if (state.view === 'later') {
    title = 'Nothing to read later';
    copy = 'Bookmarks you mark “Read later” will wait for you here.';
    actionLabel = 'View all bookmarks';
    action = () => setView('active');
  } else if (state.view === 'archived') {
    title = 'Nothing archived';
    copy = 'Bookmarks you tuck away will stay safely here until you restore them.';
    actionLabel = 'View collection';
    action = () => setView('active');
  } else {
    title = 'Your collection is clear';
    copy = 'Your saved bookmarks are currently tucked away in the archive.';
    actionLabel = 'View archived bookmarks';
    action = () => setView('archived');
  }

  $('#empty-title').textContent = title;
  $('#empty-copy').textContent = copy;
  $('#empty-action').textContent = actionLabel;
  state.emptyAction = action;
}

function renderLibrary() {
  loading.hidden = true;
  const brandNew = state.totalAll === 0;
  controls.hidden = brandNew;
  searchClear.hidden = !state.search;
  selectToggle.hidden = state.view === 'archived';
  selectToggle.textContent = state.selectionMode ? 'Done selecting' : 'Select items';

  document.querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === state.view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  renderLabelChips();

  const filtered = Boolean(state.search || state.label || state.view !== 'active');
  count.textContent = brandNew ? '0 saved' : filtered
    ? `${state.items.length} ${state.items.length === 1 ? 'result' : 'results'}`
    : `${state.items.length} saved`;

  grid.replaceChildren(...state.items.map(renderCard));
  grid.hidden = state.items.length === 0;
  empty.hidden = state.items.length > 0;
  if (!state.items.length) configureEmptyState();
  renderBulkBar();
}

async function loadLibrary({ firstLoad = false } = {}) {
  const sequence = ++state.loadSequence;
  const query = new URLSearchParams({ view: state.view });
  if (state.search) query.set('search', state.search);
  if (state.label) query.set('label', state.label);
  try {
    const [collection, labels] = await Promise.all([
      api(`/api/bookmarks?${query}`),
      api('/api/labels')
    ]);
    if (sequence !== state.loadSequence) return;
    state.items = collection.items;
    state.totalActive = collection.totalActive;
    state.totalAll = collection.totalAll;
    state.labels = labels.labels;
    if (state.label && !state.labels.some(label => label.name.toLowerCase() === state.label.toLowerCase())) {
      state.label = '';
      await loadLibrary({ firstLoad });
      return;
    }
    renderLibrary();
    if (firstLoad) {
      shell.removeAttribute('aria-busy');
      shell.dataset.harnessReady = 'true';
    }
  } catch (error) {
    if (sequence !== state.loadSequence) return;
    loading.hidden = true;
    grid.hidden = true;
    empty.hidden = false;
    $('#empty-title').textContent = 'Couldn’t open your collection';
    $('#empty-copy').textContent = error.message;
    $('#empty-action').textContent = 'Try again';
    state.emptyAction = () => loadLibrary({ firstLoad });
  }
}

function setView(view) {
  state.view = view;
  if (view === 'archived') {
    state.selectionMode = false;
    state.selected.clear();
  }
  loadLibrary();
}

function renderBulkBar() {
  const amount = state.selected.size;
  bulkBar.hidden = !state.selectionMode || amount === 0;
  $('#selected-count').textContent = `${amount} selected`;
}

function resetBookmarkDialog() {
  clearTimeout(state.prepareTimer);
  state.prepareController?.abort();
  state.prepareController = null;
  state.editing = null;
  state.draft = null;
  state.draftLabels = [];
  bookmarkForm.reset();
  $('#bookmark-url').disabled = false;
  $('#url-entry').hidden = false;
  $('#source-summary').hidden = true;
  $('#fetching').hidden = true;
  $('#bookmark-fields').hidden = true;
  $('#fallback-notice').hidden = true;
  $('#archived-notice').hidden = true;
  $('#operation-error').hidden = true;
  $('#url-error').hidden = true;
  $('#label-notice').textContent = '';
  $('#delete-bookmark').hidden = true;
  $('#archive-bookmark').hidden = true;
  $('#restore-bookmark').hidden = true;
  $('#save-bookmark').disabled = true;
  $('#save-bookmark').textContent = 'Save bookmark';
}

function openAdd() {
  resetBookmarkDialog();
  $('#dialog-eyebrow').textContent = 'New bookmark';
  $('#dialog-title').textContent = 'Add a bookmark';
  $('#dialog-subtitle').textContent = 'Paste a link and its details will appear automatically.';
  $('#bookmark-url').disabled = false;
  bookmarkDialog.showModal();
  requestAnimationFrame(() => $('#bookmark-url').focus());
}

function showSource(bookmark) {
  const avatar = $('#source-avatar');
  avatar.replaceChildren();
  avatar.textContent = bookmark.siteName.slice(0, 1).toUpperCase();
  if (bookmark.faviconUrl) {
    const image = document.createElement('img');
    image.src = bookmark.faviconUrl;
    image.alt = '';
    image.addEventListener('load', () => { avatar.textContent = ''; avatar.append(image); });
  }
  $('#source-site').textContent = bookmark.siteName;
  $('#source-url').textContent = displayAddress(bookmark.url);
  $('#source-url').title = bookmark.url;
  $('#source-summary').hidden = false;
}

function openEdit(bookmark, { duplicate = false } = {}) {
  resetBookmarkDialog();
  state.editing = bookmark;
  state.draftLabels = [...bookmark.labels];
  $('#dialog-eyebrow').textContent = duplicate ? 'Already saved' : 'Saved bookmark';
  $('#dialog-title').textContent = 'Edit bookmark';
  $('#dialog-subtitle').textContent = duplicate
    ? 'You already saved this page. Update the existing bookmark instead.'
    : 'Adjust how this page appears in your collection.';
  $('#url-entry').hidden = true;
  $('#bookmark-url').disabled = true;
  showSource(bookmark);
  $('#bookmark-fields').hidden = false;
  $('#bookmark-title-input').value = bookmark.title;
  $('#bookmark-description').value = bookmark.description;
  $('#bookmark-later').checked = bookmark.readLater;
  $('#delete-bookmark').hidden = false;
  $('#archive-bookmark').hidden = bookmark.archived;
  $('#restore-bookmark').hidden = !bookmark.archived;
  $('#archived-notice').hidden = !bookmark.archived;
  $('#save-bookmark').disabled = false;
  $('#save-bookmark').textContent = 'Save changes';
  renderDialogLabels();
  if (!bookmarkDialog.open) bookmarkDialog.showModal();
  requestAnimationFrame(() => $('#bookmark-title-input').focus());
}

function renderDialogLabels() {
  const options = $('#label-options');
  options.replaceChildren();
  const names = [];
  for (const item of [...state.labels.map(label => label.name), ...state.draftLabels]) {
    if (!names.some(name => name.toLowerCase() === item.toLowerCase())) names.push(item);
  }
  names.sort((a, b) => a.localeCompare(b));
  if (!names.length) options.append(element('span', 'field-help', 'No labels yet. Create one below.'));
  names.forEach((name, index) => {
    const label = element('label', 'label-option');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = name;
    input.checked = state.draftLabels.some(item => item.toLowerCase() === name.toLowerCase());
    input.id = `dialog-label-${index}`;
    input.addEventListener('change', () => {
      if (input.checked && !state.draftLabels.some(item => item.toLowerCase() === name.toLowerCase())) state.draftLabels.push(name);
      if (!input.checked) state.draftLabels = state.draftLabels.filter(item => item.toLowerCase() !== name.toLowerCase());
    });
    label.append(input, element('span', '', name));
    options.append(label);
  });
}

function addDraftLabel() {
  const input = $('#new-label');
  const value = input.value.trim();
  if (!value) return;
  const existing = [...state.labels.map(label => label.name), ...state.draftLabels]
    .find(name => name.toLowerCase() === value.toLowerCase());
  const canonical = existing || value;
  if (!state.draftLabels.some(name => name.toLowerCase() === canonical.toLowerCase())) state.draftLabels.push(canonical);
  $('#label-notice').textContent = existing
    ? `Used your existing “${existing}” label.`
    : `Created “${value}” and added it.`;
  input.value = '';
  renderDialogLabels();
  input.focus();
}

function showPreparedDraft(draft) {
  state.draft = draft;
  state.draftLabels = [];
  $('#fetching').hidden = true;
  $('#url-entry').hidden = true;
  showSource(draft);
  $('#bookmark-fields').hidden = false;
  $('#fallback-notice').hidden = !draft.fallback;
  $('#bookmark-title-input').value = draft.title;
  $('#bookmark-description').value = draft.description;
  $('#bookmark-later').checked = false;
  $('#save-bookmark').disabled = false;
  renderDialogLabels();
  requestAnimationFrame(() => $('#bookmark-title-input').focus());
}

async function prepareUrl(value) {
  state.prepareController?.abort();
  state.prepareController = new AbortController();
  $('#url-error').hidden = true;
  $('#fetching').hidden = false;
  $('#save-bookmark').disabled = true;
  try {
    const result = await api('/api/bookmarks/prepare', {
      method: 'POST',
      signal: state.prepareController.signal,
      body: JSON.stringify({ url: value })
    });
    if (result.status === 'existing') openEdit(result.bookmark, { duplicate: true });
    else showPreparedDraft(result.draft);
  } catch (error) {
    if (error.name === 'AbortError') return;
    $('#fetching').hidden = true;
    $('#url-error').textContent = error.message;
    $('#url-error').hidden = false;
  }
}

function schedulePrepare() {
  clearTimeout(state.prepareTimer);
  state.prepareController?.abort();
  state.draft = null;
  $('#bookmark-fields').hidden = true;
  $('#source-summary').hidden = true;
  $('#fetching').hidden = true;
  $('#save-bookmark').disabled = true;
  $('#url-error').hidden = true;
  const value = $('#bookmark-url').value.trim();
  if (!value) return;
  if (!/^https?:\/\//i.test(value)) {
    state.prepareTimer = setTimeout(() => {
      $('#url-error').textContent = 'Enter a full web address beginning with http:// or https://.';
      $('#url-error').hidden = false;
    }, 420);
    return;
  }
  try { new URL(value); } catch {
    state.prepareTimer = setTimeout(() => {
      $('#url-error').textContent = 'Enter a complete, valid web address.';
      $('#url-error').hidden = false;
    }, 420);
    return;
  }
  state.prepareTimer = setTimeout(() => prepareUrl(value), 420);
}

async function updateBookmark(id, changes, message) {
  try {
    await api(`/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
    await loadLibrary();
    if (message) showToast(message);
  } catch (error) {
    showToast(error.message);
  }
}

function showOperationError(error, title = 'Couldn’t save this bookmark') {
  const box = $('#operation-error');
  box.querySelector('strong').textContent = title;
  box.querySelector('span').textContent = `${error.message} Your details are still here.`;
  box.hidden = false;
}

async function saveBookmark(event) {
  event.preventDefault();
  $('#operation-error').hidden = true;
  if (!state.editing && !state.draft) {
    const value = $('#bookmark-url').value.trim();
    if (!/^https?:\/\//i.test(value)) {
      $('#url-error').textContent = 'Enter a full web address beginning with http:// or https://.';
      $('#url-error').hidden = false;
      $('#bookmark-url').focus();
      return;
    }
    await prepareUrl(value);
    return;
  }
  if (!bookmarkForm.reportValidity()) return;
  const button = $('#save-bookmark');
  button.disabled = true;
  button.textContent = state.editing ? 'Saving changes…' : 'Saving…';
  try {
    if (state.editing) {
      await api(`/api/bookmarks/${state.editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: $('#bookmark-title-input').value,
          description: $('#bookmark-description').value,
          labels: state.draftLabels,
          readLater: $('#bookmark-later').checked
        })
      });
    } else {
      await api('/api/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
          ...state.draft,
          title: $('#bookmark-title-input').value,
          description: $('#bookmark-description').value,
          labels: state.draftLabels,
          readLater: $('#bookmark-later').checked
        })
      });
    }
    bookmarkDialog.close();
    await loadLibrary();
    showToast(state.editing ? 'Bookmark updated.' : 'Bookmark saved.');
  } catch (error) {
    if (error.status === 409 && error.body?.bookmark) {
      openEdit(error.body.bookmark, { duplicate: true });
      return;
    }
    showOperationError(error);
    button.disabled = false;
    button.textContent = 'Try again';
  }
}

async function archiveEditing(archived) {
  if (!state.editing) return;
  try {
    await api(`/api/bookmarks/${state.editing.id}`, { method: 'PATCH', body: JSON.stringify({ archived }) });
    bookmarkDialog.close();
    await loadLibrary();
    showToast(archived ? 'Bookmark archived.' : 'Bookmark restored.');
  } catch (error) {
    showOperationError(error, archived ? 'Couldn’t archive this bookmark' : 'Couldn’t restore this bookmark');
  }
}

function renderBulkLabelDialog() {
  const container = $('#bulk-label-options');
  container.replaceChildren();
  state.bulkLabel = '';
  $('#bulk-new-label').value = '';
  $('#bulk-label-notice').textContent = '';
  state.labels.forEach(label => {
    const button = element('button', 'bulk-label-choice', label.name);
    button.type = 'button';
    button.addEventListener('click', () => {
      state.bulkLabel = label.name;
      $('#bulk-new-label').value = '';
      container.querySelectorAll('button').forEach(item => item.classList.toggle('selected', item === button));
    });
    container.append(button);
  });
}

async function runBulk(action, extra = {}) {
  try {
    await api('/api/bookmarks/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids: [...state.selected], action, ...extra })
    });
    await loadLibrary();
    if (action === 'addLabel') showToast(`Label added to ${state.selected.size} bookmarks.`);
    if (action === 'readLater') showToast(`${state.selected.size} bookmarks marked Read later.`);
  } catch (error) {
    showToast(error.message);
  }
}

document.querySelectorAll('#add-bookmark').forEach(button => button.addEventListener('click', openAdd));
$('#empty-action').addEventListener('click', () => state.emptyAction?.());
searchInput.addEventListener('input', () => {
  clearTimeout(searchInput.timer);
  state.search = searchInput.value.trim();
  searchClear.hidden = !state.search;
  searchInput.timer = setTimeout(() => { state.selected.clear(); loadLibrary(); }, 180);
});
searchClear.addEventListener('click', () => { searchInput.value = ''; state.search = ''; loadLibrary(); searchInput.focus(); });
$('#view-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (button) setView(button.dataset.view);
});
selectToggle.addEventListener('click', () => {
  state.selectionMode = !state.selectionMode;
  state.selected.clear();
  renderLibrary();
});

$('.dialog-close').addEventListener('click', () => bookmarkDialog.close());
$('.dialog-cancel').addEventListener('click', () => bookmarkDialog.close());
$('#bookmark-url').addEventListener('input', schedulePrepare);
bookmarkForm.addEventListener('submit', saveBookmark);
$('#create-label').addEventListener('click', addDraftLabel);
$('#new-label').addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); addDraftLabel(); }
});
$('#archive-bookmark').addEventListener('click', () => archiveEditing(true));
$('#restore-bookmark').addEventListener('click', () => archiveEditing(false));
$('#delete-bookmark').addEventListener('click', () => {
  if (!state.editing) return;
  $('#delete-confirm-copy').textContent = `“${state.editing.title}” will be removed from your collection.`;
  $('#delete-confirm').showModal();
});
$('#confirm-delete').addEventListener('click', async () => {
  if (!state.editing) return;
  const button = $('#confirm-delete');
  button.disabled = true;
  try {
    await api(`/api/bookmarks/${state.editing.id}`, { method: 'DELETE' });
    $('#delete-confirm').close();
    bookmarkDialog.close();
    await loadLibrary();
    showToast('Bookmark permanently deleted.');
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
});

$('#bulk-label').addEventListener('click', () => {
  renderBulkLabelDialog();
  $('#bulk-label-dialog').showModal();
});
$('#bulk-new-label').addEventListener('input', () => {
  const value = $('#bulk-new-label').value.trim();
  const existing = state.labels.find(label => label.name.toLowerCase() === value.toLowerCase());
  state.bulkLabel = existing?.name || value;
  $('#bulk-label-notice').textContent = existing ? `Your existing “${existing.name}” label will be used.` : '';
  $('#bulk-label-options').querySelectorAll('button').forEach(button => button.classList.remove('selected'));
});
$('#apply-bulk-label').addEventListener('click', async () => {
  if (!state.bulkLabel) { $('#bulk-label-notice').textContent = 'Choose or create a label first.'; return; }
  $('#bulk-label-dialog').close();
  await runBulk('addLabel', { label: state.bulkLabel });
});
$('#bulk-later').addEventListener('click', () => runBulk('readLater'));
$('#bulk-delete').addEventListener('click', () => {
  const amount = state.selected.size;
  $('#bulk-delete-copy').textContent = `${amount} ${amount === 1 ? 'bookmark' : 'bookmarks'} will be removed from your collection.`;
  $('#bulk-delete-confirm').showModal();
});
$('#confirm-bulk-delete').addEventListener('click', async () => {
  const amount = state.selected.size;
  try {
    await api('/api/bookmarks/bulk', { method: 'POST', body: JSON.stringify({ ids: [...state.selected], action: 'delete' }) });
    state.selected.clear();
    $('#bulk-delete-confirm').close();
    await loadLibrary();
    showToast(`${amount} ${amount === 1 ? 'bookmark' : 'bookmarks'} permanently deleted.`);
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelectorAll('[data-close-dialog]').forEach(button => {
  button.addEventListener('click', () => button.closest('dialog').close());
});

loadLibrary({ firstLoad: true });
