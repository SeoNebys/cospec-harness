'use strict';

const state = {
  q: '',
  tag: '',
  bookmarks: [],
  pendingPolls: new Map(), // id -> timeoutId
};

const els = {
  list: document.getElementById('list'),
  emptyState: document.getElementById('empty-state'),
  noResults: document.getElementById('no-results'),
  search: document.getElementById('search'),
  clearSearch: document.getElementById('clear-search'),
  activeFilter: document.getElementById('active-filter'),
  activeTag: document.getElementById('active-tag'),
  clearFilter: document.getElementById('clear-filter'),
  // add form
  addForm: document.getElementById('add-form'),
  addUrl: document.getElementById('add-url'),
  addTitle: document.getElementById('add-title'),
  addTags: document.getElementById('add-tags'),
  addNote: document.getElementById('add-note'),
  addError: document.getElementById('add-error'),
  tagSuggestions: document.getElementById('tag-suggestions'),
  // edit dialog
  editDialog: document.getElementById('edit-dialog'),
  editUrl: document.getElementById('edit-url'),
  editTitle: document.getElementById('edit-title'),
  editDescription: document.getElementById('edit-description'),
  editTags: document.getElementById('edit-tags'),
  editNote: document.getElementById('edit-note'),
  editError: document.getElementById('edit-error'),
  editSave: document.getElementById('edit-save'),
  editCancel: document.getElementById('edit-cancel'),
  editRefresh: document.getElementById('edit-refresh'),
  // delete dialog
  deleteDialog: document.getElementById('delete-dialog'),
  deleteConfirm: document.getElementById('delete-confirm'),
  deleteCancel: document.getElementById('delete-cancel'),
};

let editingId = null;
let deletingId = null;

// ---------- API ----------

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let body = null;
  if (res.status !== 204) {
    try { body = await res.json(); } catch { body = null; }
  }
  return { status: res.status, body };
}

function parseTags(value) {
  return (value || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

// ---------- Rendering ----------

function render() {
  const { bookmarks } = state;
  els.list.innerHTML = '';

  const searching = state.q.trim() !== '' || state.tag.trim() !== '';
  els.emptyState.hidden = bookmarks.length > 0 || searching;
  els.noResults.hidden = bookmarks.length > 0 || !searching;

  for (const b of bookmarks) {
    els.list.appendChild(renderBookmark(b));
  }
}

function renderBookmark(b) {
  const card = document.createElement('article');
  card.className = 'bookmark';
  card.dataset.id = b.id;

  // Preview
  if (b.previewUrl) {
    const img = document.createElement('img');
    img.className = 'preview';
    img.src = b.previewUrl;
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', () => replaceWithPlaceholder(img));
    card.appendChild(img);
  } else {
    card.appendChild(placeholderPreview());
  }

  const body = document.createElement('div');
  body.className = 'body';

  const titleRow = document.createElement('div');
  titleRow.className = 'title-row';
  if (b.faviconUrl) {
    const fav = document.createElement('img');
    fav.className = 'favicon';
    fav.src = b.faviconUrl;
    fav.alt = '';
    fav.addEventListener('error', () => fav.remove());
    titleRow.appendChild(fav);
  }
  const title = document.createElement('a');
  title.className = 'title';
  title.href = b.url;
  title.target = '_blank';
  title.rel = 'noopener noreferrer';
  title.textContent = b.title || b.url;
  titleRow.appendChild(title);
  body.appendChild(titleRow);

  const url = document.createElement('div');
  url.className = 'url';
  url.textContent = b.url;
  body.appendChild(url);

  if (b.description) {
    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = b.description;
    body.appendChild(desc);
  }

  if (b.note) {
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = b.note;
    body.appendChild(note);
  }

  if (b.tags && b.tags.length) {
    const tags = document.createElement('div');
    tags.className = 'tags';
    for (const name of b.tags) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tag';
      chip.textContent = name;
      chip.addEventListener('click', () => filterByTag(name));
      tags.appendChild(chip);
    }
    body.appendChild(tags);
  }

  if (b.enrichmentStatus && b.enrichmentStatus !== 'done') {
    const pill = document.createElement('div');
    pill.className = 'status-pill' + (b.enrichmentStatus === 'failed' ? ' failed' : '');
    pill.textContent =
      b.enrichmentStatus === 'pending'
        ? 'Fetching page details…'
        : 'Page details unavailable';
    body.appendChild(pill);
  }

  card.appendChild(body);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'actions';
  const editBtn = document.createElement('button');
  editBtn.className = 'ghost';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => openEdit(b.id));
  const delBtn = document.createElement('button');
  delBtn.className = 'ghost';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => openDelete(b.id));
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  card.appendChild(actions);

  return card;
}

function placeholderPreview() {
  const div = document.createElement('div');
  div.className = 'preview placeholder';
  div.textContent = '🔗';
  return div;
}

function replaceWithPlaceholder(img) {
  img.replaceWith(placeholderPreview());
}

// ---------- Data loading ----------

async function loadBookmarks() {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set('q', state.q.trim());
  if (state.tag.trim()) params.set('tag', state.tag.trim());
  const { body } = await api(`/api/bookmarks?${params.toString()}`);
  state.bookmarks = (body && body.bookmarks) || [];
  render();
  schedulePollsForPending();
}

async function loadTagSuggestions() {
  const { body } = await api('/api/tags');
  const names = (body && body.tags) || [];
  els.tagSuggestions.innerHTML = '';
  for (const name of names) {
    const opt = document.createElement('option');
    opt.value = name;
    els.tagSuggestions.appendChild(opt);
  }
}

// Poll bookmarks whose enrichment is still pending so details appear once ready.
function schedulePollsForPending() {
  const pending = state.bookmarks.filter((b) => b.enrichmentStatus === 'pending');
  for (const b of pending) {
    if (state.pendingPolls.has(b.id)) continue;
    const timer = setTimeout(() => pollOne(b.id), 1200);
    state.pendingPolls.set(b.id, timer);
  }
}

async function pollOne(id) {
  state.pendingPolls.delete(id);
  const { status, body } = await api(`/api/bookmarks/${id}`);
  if (status !== 200 || !body) return;
  const idx = state.bookmarks.findIndex((b) => b.id === id);
  if (idx === -1) return;
  state.bookmarks[idx] = body;
  render();
  if (body.enrichmentStatus === 'pending') {
    const timer = setTimeout(() => pollOne(id), 1500);
    state.pendingPolls.set(id, timer);
  } else if (body.enrichmentStatus === 'done') {
    loadTagSuggestions();
  }
}

// ---------- Add ----------

els.addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.addError.hidden = true;
  const payload = {
    url: els.addUrl.value,
    title: els.addTitle.value,
    note: els.addNote.value,
    tags: parseTags(els.addTags.value),
  };
  const { status, body } = await api('/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (status === 201) {
    els.addForm.reset();
    await loadBookmarks();
    await loadTagSuggestions();
  } else if (status === 409 && body && body.existing) {
    // Duplicate → guide the user to edit the existing bookmark (FR-009).
    els.addForm.reset();
    await loadBookmarks();
    openEditWith(body.existing, 'This address is already saved — edit it here.');
  } else if (body && body.error) {
    showError(els.addError, body.error.message);
  } else {
    showError(els.addError, 'Could not save the bookmark.');
  }
});

// ---------- Search & filter ----------

let searchTimer = null;
els.search.addEventListener('input', () => {
  els.clearSearch.hidden = els.search.value === '';
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = els.search.value;
    loadBookmarks();
  }, 250);
});

els.clearSearch.addEventListener('click', () => {
  els.search.value = '';
  els.clearSearch.hidden = true;
  state.q = '';
  loadBookmarks();
});

function filterByTag(name) {
  state.tag = name;
  els.activeTag.textContent = name;
  els.activeFilter.hidden = false;
  loadBookmarks();
}

els.clearFilter.addEventListener('click', () => {
  state.tag = '';
  els.activeFilter.hidden = true;
  loadBookmarks();
});

// ---------- Edit ----------

async function openEdit(id) {
  const { status, body } = await api(`/api/bookmarks/${id}`);
  if (status !== 200 || !body) return;
  openEditWith(body);
}

function openEditWith(b, message) {
  editingId = b.id;
  els.editUrl.value = b.url;
  els.editTitle.value = b.title || '';
  els.editDescription.value = b.description || '';
  els.editTags.value = (b.tags || []).join(', ');
  els.editNote.value = b.note || '';
  els.editError.hidden = !message;
  if (message) els.editError.textContent = message;
  loadTagSuggestions();
  els.editDialog.showModal();
}

els.editCancel.addEventListener('click', () => els.editDialog.close());

els.editSave.addEventListener('click', async () => {
  els.editError.hidden = true;
  const payload = {
    url: els.editUrl.value,
    title: els.editTitle.value,
    description: els.editDescription.value,
    note: els.editNote.value,
    tags: parseTags(els.editTags.value),
  };
  const { status, body } = await api(`/api/bookmarks/${editingId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (status === 200) {
    els.editDialog.close();
    await loadBookmarks();
    await loadTagSuggestions();
  } else if (status === 409 && body && body.existing) {
    showError(els.editError, 'Another bookmark already uses this address.');
  } else if (body && body.error) {
    showError(els.editError, body.error.message);
  } else {
    showError(els.editError, 'Could not save changes.');
  }
});

els.editRefresh.addEventListener('click', async () => {
  els.editError.hidden = true;
  const { status } = await api(`/api/bookmarks/${editingId}/refresh`, { method: 'POST' });
  if (status === 202) {
    els.editDialog.close();
    await loadBookmarks();
  }
});

// ---------- Delete ----------

function openDelete(id) {
  deletingId = id;
  els.deleteDialog.showModal();
}

els.deleteCancel.addEventListener('click', () => els.deleteDialog.close());

els.deleteConfirm.addEventListener('click', async () => {
  const { status } = await api(`/api/bookmarks/${deletingId}`, { method: 'DELETE' });
  els.deleteDialog.close();
  if (status === 204) {
    await loadBookmarks();
    await loadTagSuggestions();
  }
});

// ---------- Helpers ----------

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

// ---------- Init ----------

(async function init() {
  await loadBookmarks();
  await loadTagSuggestions();
  document.body.setAttribute('data-harness-ready', 'true');
})();
