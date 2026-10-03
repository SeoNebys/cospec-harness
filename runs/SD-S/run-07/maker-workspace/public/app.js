'use strict';

const state = {
  q: '',
  tag: '',
  bookmarks: [],
  tags: [],
  editingId: null,
};

const els = {
  app: document.getElementById('app'),
  saveForm: document.getElementById('save-form'),
  url: document.getElementById('url-input'),
  title: document.getElementById('title-input'),
  tags: document.getElementById('tags-input'),
  saveBtn: document.getElementById('save-btn'),
  formMessage: document.getElementById('form-message'),
  search: document.getElementById('search-input'),
  tagFilters: document.getElementById('tag-filters'),
  list: document.getElementById('bookmark-list'),
  emptyState: document.getElementById('empty-state'),
  noResults: document.getElementById('no-results'),
  clearFilters: document.getElementById('clear-filters'),
};

// ---- API helpers ----

async function api(path, options) {
  const res = await fetch(path, options);
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await res.json() : null;
  if (!res.ok) {
    const message = (body && body.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function parseTags(value) {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '');
}

// ---- Messaging ----

function showMessage(text, kind) {
  els.formMessage.textContent = text;
  els.formMessage.className = `form-message ${kind}`;
  els.formMessage.hidden = false;
}

function clearMessage() {
  els.formMessage.hidden = true;
  els.formMessage.textContent = '';
}

// ---- Rendering ----

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function renderTagFilters() {
  els.tagFilters.innerHTML = '';
  for (const tag of state.tags) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `#${tag}`;
    btn.setAttribute('aria-pressed', String(state.tag === tag));
    btn.addEventListener('click', () => {
      state.tag = state.tag === tag ? '' : tag;
      loadBookmarks();
    });
    els.tagFilters.appendChild(btn);
  }
}

function renderBookmark(bm) {
  const li = document.createElement('li');
  li.className = 'bookmark';
  li.dataset.id = String(bm.id);

  const link = document.createElement('a');
  link.className = 'bookmark-title';
  link.href = bm.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = bm.title;
  li.appendChild(link);

  const url = document.createElement('p');
  url.className = 'bookmark-url';
  url.textContent = bm.url;
  li.appendChild(url);

  if (bm.tags.length) {
    const tagWrap = document.createElement('div');
    tagWrap.className = 'bookmark-tags';
    for (const t of bm.tags) {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = `#${t}`;
      tagWrap.appendChild(span);
    }
    li.appendChild(tagWrap);
  }

  const meta = document.createElement('div');
  meta.className = 'bookmark-meta';
  meta.textContent = `Saved ${formatDate(bm.createdAt)}`;
  li.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'bookmark-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'secondary';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => startEdit(li, bm));
  actions.appendChild(editBtn);

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'link-danger';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => deleteBookmark(bm));
  actions.appendChild(delBtn);

  li.appendChild(actions);
  return li;
}

function startEdit(li, bm) {
  // Prevent multiple edit forms on one item.
  if (li.querySelector('.edit-form')) return;

  const form = document.createElement('form');
  form.className = 'edit-form';

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.value = bm.title;
  titleInput.setAttribute('aria-label', 'Edit title');
  form.appendChild(titleInput);

  const tagsInput = document.createElement('input');
  tagsInput.type = 'text';
  tagsInput.value = bm.tags.join(', ');
  tagsInput.placeholder = 'tags, comma separated';
  tagsInput.setAttribute('aria-label', 'Edit tags');
  form.appendChild(tagsInput);

  const row = document.createElement('div');
  row.className = 'bookmark-actions';

  const save = document.createElement('button');
  save.type = 'submit';
  save.textContent = 'Save';
  row.appendChild(save);

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'secondary';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => form.remove());
  row.appendChild(cancel);

  form.appendChild(row);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`/api/bookmarks/${bm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleInput.value,
          tags: parseTags(tagsInput.value),
        }),
      });
      await loadBookmarks();
      await loadTags();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  });

  li.appendChild(form);
  titleInput.focus();
}

async function deleteBookmark(bm) {
  const ok = window.confirm(`Delete "${bm.title}"? This cannot be undone.`);
  if (!ok) return;
  try {
    await api(`/api/bookmarks/${bm.id}`, { method: 'DELETE' });
    await loadBookmarks();
    await loadTags();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

function renderList() {
  els.list.innerHTML = '';
  const hasAny = state.bookmarks.length > 0;
  const filtering = state.q !== '' || state.tag !== '';

  els.emptyState.hidden = true;
  els.noResults.hidden = true;

  if (!hasAny && !filtering) {
    els.emptyState.hidden = false;
    return;
  }
  if (!hasAny && filtering) {
    els.noResults.hidden = false;
    return;
  }
  for (const bm of state.bookmarks) {
    els.list.appendChild(renderBookmark(bm));
  }
}

// ---- Data loading ----

async function loadBookmarks() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);
  const query = params.toString();
  const data = await api(`/api/bookmarks${query ? `?${query}` : ''}`);
  state.bookmarks = data.bookmarks;
  renderList();
  renderTagFilters();
}

async function loadTags() {
  const data = await api('/api/tags');
  state.tags = data.tags;
  // If the active tag filter no longer exists, clear it.
  if (state.tag && !state.tags.includes(state.tag)) {
    state.tag = '';
  }
  renderTagFilters();
}

// ---- Events ----

els.saveForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage();
  const url = els.url.value.trim();
  if (url === '') {
    showMessage('A valid web address is required.', 'error');
    return;
  }
  els.saveBtn.disabled = true;
  try {
    const bm = await api('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        title: els.title.value,
        tags: parseTags(els.tags.value),
      }),
    });
    els.saveForm.reset();
    showMessage(`Saved "${bm.title}".`, 'success');
    // Reset filters so the new bookmark is visible at the top.
    state.q = '';
    state.tag = '';
    els.search.value = '';
    await loadBookmarks();
    await loadTags();
  } catch (err) {
    if (err.status === 409) {
      showMessage('This address is already bookmarked.', 'warn');
    } else {
      showMessage(err.message, 'error');
    }
  } finally {
    els.saveBtn.disabled = false;
  }
});

let searchTimer;
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = els.search.value.trim();
    loadBookmarks();
  }, 200);
});

els.clearFilters.addEventListener('click', () => {
  state.q = '';
  state.tag = '';
  els.search.value = '';
  loadBookmarks();
});

// ---- Init ----

async function init() {
  try {
    await loadBookmarks();
    await loadTags();
  } catch (err) {
    showMessage(`Could not load bookmarks: ${err.message}`, 'error');
  } finally {
    // Mark presentation-ready once the initial list (or empty state) has loaded.
    els.app.setAttribute('data-harness-ready', 'true');
  }
}

init();
