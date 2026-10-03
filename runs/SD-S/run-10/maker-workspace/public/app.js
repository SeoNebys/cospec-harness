// Frontend logic: talk to the REST API, render the list, handle form/filters.

const form = document.getElementById('bookmark-form');
const idField = document.getElementById('bookmark-id');
const urlField = document.getElementById('url');
const titleField = document.getElementById('title');
const notesField = document.getElementById('notes');
const tagsField = document.getElementById('tags');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit');
const formMessage = document.getElementById('form-message');

const searchInput = document.getElementById('search');
const tagFilter = document.getElementById('tag-filter');
const listStatus = document.getElementById('list-status');
const list = document.getElementById('bookmark-list');
const app = document.getElementById('app');

function setMessage(text, kind) {
  formMessage.textContent = text || '';
  formMessage.className = 'form__message' + (kind ? ` form__message--${kind}` : '');
}

function parseTags(value) {
  return value.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
}

async function api(path, options) {
  const res = await fetch(path, options);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

// --- Rendering --------------------------------------------------------------

function bookmarkNode(b) {
  const li = document.createElement('li');
  li.className = 'bookmark';
  li.dataset.id = b.id;

  const displayTitle = b.title && b.title.trim() ? b.title : b.url;

  const titleEl = document.createElement('div');
  titleEl.className = 'bookmark__title';
  const link = document.createElement('a');
  link.href = b.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = displayTitle;
  titleEl.appendChild(link);

  const urlEl = document.createElement('div');
  urlEl.className = 'bookmark__url';
  urlEl.textContent = b.url;

  li.append(titleEl, urlEl);

  if (b.notes && b.notes.trim()) {
    const notesEl = document.createElement('div');
    notesEl.className = 'bookmark__notes';
    notesEl.textContent = b.notes;
    li.appendChild(notesEl);
  }

  if (b.tags && b.tags.length) {
    const tagsEl = document.createElement('div');
    tagsEl.className = 'bookmark__tags';
    for (const name of b.tags) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = name;
      tagsEl.appendChild(tag);
    }
    li.appendChild(tagsEl);
  }

  const actions = document.createElement('div');
  actions.className = 'bookmark__actions';
  const editBtn = document.createElement('button');
  editBtn.className = 'btn--link';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => startEdit(b));
  const delBtn = document.createElement('button');
  delBtn.className = 'btn--link btn--danger';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => deleteBookmark(b));
  actions.append(editBtn, delBtn);
  li.appendChild(actions);

  return li;
}

function render(bookmarks) {
  list.innerHTML = '';
  const searching = searchInput.value.trim() !== '' || tagFilter.value !== '';

  if (bookmarks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = searching
      ? 'No bookmarks match your search. Try a different keyword or tag.'
      : 'No bookmarks yet. Add your first one using the form above.';
    list.appendChild(empty);
    listStatus.textContent = '';
    return;
  }

  listStatus.textContent = `${bookmarks.length} bookmark${bookmarks.length === 1 ? '' : 's'}`;
  for (const b of bookmarks) list.appendChild(bookmarkNode(b));
}

// --- Data loading -----------------------------------------------------------

async function loadBookmarks() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
  if (tagFilter.value) params.set('tag', tagFilter.value);
  const query = params.toString();
  const data = await api(`/api/bookmarks${query ? `?${query}` : ''}`);
  render(data.bookmarks);
}

async function loadTags() {
  const data = await api('/api/tags');
  const current = tagFilter.value;
  tagFilter.innerHTML = '<option value="">All tags</option>';
  for (const name of data.tags) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    tagFilter.appendChild(opt);
  }
  if (data.tags.includes(current)) tagFilter.value = current;
}

async function refresh() {
  await Promise.all([loadBookmarks(), loadTags()]);
}

// --- Form: create / edit ----------------------------------------------------

function startEdit(b) {
  idField.value = b.id;
  urlField.value = b.url;
  titleField.value = b.title || '';
  notesField.value = b.notes || '';
  tagsField.value = (b.tags || []).join(', ');
  submitBtn.textContent = 'Update bookmark';
  cancelEditBtn.classList.remove('hidden');
  setMessage('Editing an existing bookmark.', null);
  urlField.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  form.reset();
  idField.value = '';
  submitBtn.textContent = 'Save bookmark';
  cancelEditBtn.classList.add('hidden');
}

cancelEditBtn.addEventListener('click', () => {
  resetForm();
  setMessage('', null);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMessage('', null);
  const payload = {
    url: urlField.value,
    title: titleField.value,
    notes: notesField.value,
    tags: parseTags(tagsField.value),
  };
  const editingId = idField.value;

  try {
    if (editingId) {
      await api(`/api/bookmarks/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      resetForm();
      setMessage('Bookmark updated.', 'success');
    } else {
      const data = await api('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      resetForm();
      if (data.duplicate) {
        setMessage('Saved. Note: another bookmark already uses this address.', 'warn');
      } else {
        setMessage('Bookmark saved.', 'success');
      }
    }
    await refresh();
  } catch (err) {
    setMessage(err.message, 'error');
  }
});

async function deleteBookmark(b) {
  const label = b.title && b.title.trim() ? b.title : b.url;
  if (!window.confirm(`Delete this bookmark?\n\n${label}`)) return;
  try {
    await api(`/api/bookmarks/${b.id}`, { method: 'DELETE' });
    if (idField.value === String(b.id)) resetForm();
    setMessage('Bookmark deleted.', 'success');
    await refresh();
  } catch (err) {
    setMessage(err.message, 'error');
  }
}

// --- Filters ----------------------------------------------------------------

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadBookmarks().catch((e) => setMessage(e.message, 'error')), 150);
});
tagFilter.addEventListener('change', () => loadBookmarks().catch((e) => setMessage(e.message, 'error')));

// --- Startup ----------------------------------------------------------------

refresh()
  .catch((err) => setMessage(err.message, 'error'))
  .finally(() => app.setAttribute('data-harness-ready', 'true'));
