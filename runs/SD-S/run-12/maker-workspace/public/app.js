// Browser client: fetches the API, renders the list, and wires the add/edit/
// delete/search/filter interactions. (User stories US1–US4)

const listEl = document.getElementById('bookmark-list');
const emptyEl = document.getElementById('empty-state');
const noResultsEl = document.getElementById('no-results');
const searchEl = document.getElementById('search');
const tagFilterEl = document.getElementById('tag-filter');

const addForm = document.getElementById('add-form');
const addError = document.getElementById('add-error');
const addWarning = document.getElementById('add-warning');

const editDialog = document.getElementById('edit-dialog');
const editForm = document.getElementById('edit-form');
const editError = document.getElementById('edit-error');

// --- API helpers -------------------------------------------------------------

async function api(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res;
}

function parseTags(value) {
  return String(value || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

// --- rendering ---------------------------------------------------------------

function renderList(bookmarks, { filtered }) {
  listEl.innerHTML = '';
  emptyEl.hidden = true;
  noResultsEl.hidden = true;

  if (bookmarks.length === 0) {
    // Distinguish "nothing saved yet" (FR-012 empty) from "search matched
    // nothing" (FR-012 no-results).
    if (filtered) noResultsEl.hidden = false;
    else emptyEl.hidden = false;
    return;
  }

  for (const b of bookmarks) {
    listEl.appendChild(renderItem(b));
  }
}

function renderItem(b) {
  const li = document.createElement('li');
  li.className = 'bookmark-item';
  li.dataset.id = b.id;

  const main = document.createElement('div');
  main.className = 'bookmark-main';

  const link = document.createElement('a');
  link.className = 'bookmark-title';
  link.href = b.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = b.displayLabel;
  link.title = b.title || b.url;
  main.appendChild(link);

  const url = document.createElement('div');
  url.className = 'bookmark-url';
  url.textContent = b.url;
  url.title = b.url;
  main.appendChild(url);

  if (b.notes) {
    const notes = document.createElement('p');
    notes.className = 'bookmark-notes';
    notes.textContent = b.notes;
    notes.title = b.notes;
    main.appendChild(notes);
  }

  if (b.tags.length) {
    const tagRow = document.createElement('div');
    tagRow.className = 'tag-row';
    for (const t of b.tags) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = t;
      tagRow.appendChild(tag);
    }
    main.appendChild(tagRow);
  }

  const actions = document.createElement('div');
  actions.className = 'bookmark-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'link-plain';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => openEdit(b));

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'link-danger';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => deleteBookmark(b));

  actions.append(editBtn, delBtn);
  li.append(main, actions);
  return li;
}

// --- data loading ------------------------------------------------------------

async function refresh() {
  const params = new URLSearchParams();
  const q = searchEl.value.trim();
  const tag = tagFilterEl.value;
  if (q) params.set('q', q);
  if (tag) params.set('tag', tag);

  const res = await api(`/bookmarks?${params.toString()}`);
  const { bookmarks } = await res.json();
  renderList(bookmarks, { filtered: Boolean(q || tag) });
}

async function refreshTags() {
  const res = await api('/tags');
  const { tags } = await res.json();
  const current = tagFilterEl.value;
  tagFilterEl.innerHTML = '<option value="">All tags</option>';
  for (const t of tags) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    tagFilterEl.appendChild(opt);
  }
  // Keep the current filter selected if it still exists.
  if (tags.includes(current)) tagFilterEl.value = current;
}

// --- create (US1) ------------------------------------------------------------

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  addError.hidden = true;
  addWarning.hidden = true;

  const payload = {
    url: document.getElementById('add-url').value,
    title: document.getElementById('add-title').value,
    notes: document.getElementById('add-notes').value,
    tags: parseTags(document.getElementById('add-tags').value),
  };

  const res = await api('/bookmarks', { method: 'POST', body: JSON.stringify(payload) });
  if (res.status === 400) {
    const { error } = await res.json();
    addError.textContent = error || 'Invalid URL';
    addError.hidden = false;
    return;
  }

  const { warning } = await res.json();
  if (warning === 'duplicate_url') {
    addWarning.textContent = 'You already have a bookmark for this address — saved anyway.';
    addWarning.hidden = false;
  }

  addForm.reset();
  document.getElementById('add-url').focus();
  await Promise.all([refresh(), refreshTags()]);
});

// --- edit (US3) --------------------------------------------------------------

function openEdit(b) {
  editError.hidden = true;
  document.getElementById('edit-id').value = b.id;
  document.getElementById('edit-url').value = b.url;
  document.getElementById('edit-title').value = b.title;
  document.getElementById('edit-tags').value = b.tags.join(', ');
  document.getElementById('edit-notes').value = b.notes;
  editDialog.showModal();
}

document.getElementById('edit-cancel').addEventListener('click', () => editDialog.close());

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  editError.hidden = true;
  const id = document.getElementById('edit-id').value;
  const payload = {
    url: document.getElementById('edit-url').value,
    title: document.getElementById('edit-title').value,
    notes: document.getElementById('edit-notes').value,
    tags: parseTags(document.getElementById('edit-tags').value),
  };

  const res = await api(`/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  if (res.status === 400) {
    const { error } = await res.json();
    editError.textContent = error || 'Invalid URL';
    editError.hidden = false;
    return;
  }
  editDialog.close();
  await Promise.all([refresh(), refreshTags()]);
});

// --- delete (US3) ------------------------------------------------------------

async function deleteBookmark(b) {
  const label = b.displayLabel || b.url;
  if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
  await api(`/bookmarks/${b.id}`, { method: 'DELETE' });
  await Promise.all([refresh(), refreshTags()]);
}

// --- search / filter (US4) ---------------------------------------------------

let searchTimer;
searchEl.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refresh, 150);
});
tagFilterEl.addEventListener('change', refresh);

// --- init --------------------------------------------------------------------

(async function init() {
  await Promise.all([refresh(), refreshTags()]);
  // Mark presentation-ready only after the initial list/empty state has loaded.
  document.getElementById('app').setAttribute('data-harness-ready', 'true');
})();
