// Bookmark Manager frontend. Single-user, no login.

const api = {
  async list({ search = '', tag = '' } = {}) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (tag) params.set('tag', tag);
    const qs = params.toString();
    const res = await fetch(`/api/bookmarks${qs ? `?${qs}` : ''}`);
    if (!res.ok) throw new Error('Could not load bookmarks.');
    return (await res.json()).bookmarks;
  },
  async tags() {
    const res = await fetch('/api/tags');
    if (!res.ok) return [];
    return (await res.json()).tags;
  },
  async create(payload) {
    return request('/api/bookmarks', 'POST', payload);
  },
  async update(id, payload) {
    return request(`/api/bookmarks/${id}`, 'PUT', payload);
  },
  async remove(id) {
    const res = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error('Could not delete bookmark.');
  },
};

async function request(url, method, payload) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// --- DOM references --------------------------------------------------------

const els = {
  addForm: document.getElementById('add-form'),
  addUrl: document.getElementById('add-url'),
  addTitle: document.getElementById('add-title'),
  addTags: document.getElementById('add-tags'),
  addNote: document.getElementById('add-note'),
  addMessage: document.getElementById('add-message'),
  search: document.getElementById('search'),
  tagFilter: document.getElementById('tag-filter'),
  list: document.getElementById('bookmark-list'),
  empty: document.getElementById('empty-state'),
  app: document.getElementById('app'),
  dialog: document.getElementById('edit-dialog'),
  editForm: document.getElementById('edit-form'),
  editId: document.getElementById('edit-id'),
  editUrl: document.getElementById('edit-url'),
  editTitle: document.getElementById('edit-title'),
  editTags: document.getElementById('edit-tags'),
  editNote: document.getElementById('edit-note'),
  editMessage: document.getElementById('edit-message'),
  editCancel: document.getElementById('edit-cancel'),
};

// --- Helpers ---------------------------------------------------------------

const parseTags = (str) =>
  str
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

function showMessage(el, text, kind) {
  el.textContent = text;
  el.className = `message ${kind}`;
  el.hidden = false;
}

function hideMessage(el) {
  el.hidden = true;
}

let searchTimer;

// --- Rendering -------------------------------------------------------------

function renderList(bookmarks) {
  els.list.innerHTML = '';
  if (bookmarks.length === 0) {
    const searching = els.search.value.trim() || els.tagFilter.value;
    els.empty.textContent = searching
      ? 'No bookmarks match your search.'
      : 'No bookmarks yet. Add your first one above.';
    els.empty.hidden = false;
    return;
  }
  els.empty.hidden = true;
  for (const b of bookmarks) {
    els.list.appendChild(renderBookmark(b));
  }
}

function renderBookmark(b) {
  const li = document.createElement('li');
  li.className = 'bookmark';
  li.dataset.id = b.id;

  const top = document.createElement('div');
  top.className = 'bookmark-top';

  const link = document.createElement('a');
  link.className = 'bookmark-title';
  link.href = b.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = b.title;
  link.title = b.title;

  const actions = document.createElement('div');
  actions.className = 'bookmark-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn link';
  editBtn.type = 'button';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => openEdit(b));

  const delBtn = document.createElement('button');
  delBtn.className = 'btn link danger';
  delBtn.type = 'button';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => deleteBookmark(b));

  actions.append(editBtn, delBtn);
  top.append(link, actions);

  const url = document.createElement('span');
  url.className = 'bookmark-url';
  url.textContent = b.url;

  li.append(top, url);

  if (b.note) {
    const note = document.createElement('p');
    note.className = 'bookmark-note clamped';
    note.textContent = b.note;
    li.append(note);
    // "Show more" for long notes (edge case: very long text).
    requestAnimationFrame(() => {
      if (note.scrollHeight > note.clientHeight + 2) {
        const toggle = document.createElement('button');
        toggle.className = 'btn link note-toggle';
        toggle.type = 'button';
        toggle.textContent = 'Show more';
        toggle.addEventListener('click', () => {
          const clamped = note.classList.toggle('clamped');
          toggle.textContent = clamped ? 'Show more' : 'Show less';
        });
        li.append(toggle);
      }
    });
  }

  if (b.tags.length) {
    const tags = document.createElement('div');
    tags.className = 'tags';
    for (const t of b.tags) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = t;
      tags.append(tag);
    }
    li.append(tags);
  }

  return li;
}

async function refreshTagFilter() {
  const current = els.tagFilter.value;
  const tags = await api.tags();
  els.tagFilter.innerHTML = '<option value="">All tags</option>';
  for (const t of tags) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    els.tagFilter.append(opt);
  }
  // Preserve selection if the tag still exists.
  els.tagFilter.value = tags.includes(current) ? current : '';
}

async function reload() {
  const bookmarks = await api.list({
    search: els.search.value.trim(),
    tag: els.tagFilter.value,
  });
  renderList(bookmarks);
}

// --- Actions ---------------------------------------------------------------

els.addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessage(els.addMessage);
  const payload = {
    url: els.addUrl.value,
    title: els.addTitle.value.trim(),
    tags: parseTags(els.addTags.value),
    note: els.addNote.value.trim(),
  };
  const { ok, status, data } = await api.create(payload);
  if (ok) {
    els.addForm.reset();
    await refreshTagFilter();
    await reload();
    showMessage(els.addMessage, 'Bookmark saved.', 'warn');
    setTimeout(() => hideMessage(els.addMessage), 2000);
  } else if (status === 409) {
    showMessage(els.addMessage, data.error || 'This address is already saved.', 'warn');
  } else {
    showMessage(els.addMessage, data.error || 'Could not save bookmark.', 'error');
  }
});

els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(reload, 200);
});

els.tagFilter.addEventListener('change', reload);

function openEdit(b) {
  els.editId.value = b.id;
  els.editUrl.value = b.url;
  els.editTitle.value = b.title;
  els.editTags.value = b.tags.join(', ');
  els.editNote.value = b.note;
  hideMessage(els.editMessage);
  els.dialog.showModal();
}

els.editCancel.addEventListener('click', () => els.dialog.close());

els.editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessage(els.editMessage);
  const id = els.editId.value;
  const payload = {
    url: els.editUrl.value,
    title: els.editTitle.value.trim(),
    tags: parseTags(els.editTags.value),
    note: els.editNote.value.trim(),
  };
  const { ok, status, data } = await api.update(id, payload);
  if (ok) {
    els.dialog.close();
    await refreshTagFilter();
    await reload();
  } else if (status === 409) {
    showMessage(els.editMessage, data.error || 'This address is already saved.', 'warn');
  } else {
    showMessage(els.editMessage, data.error || 'Could not save changes.', 'error');
  }
});

async function deleteBookmark(b) {
  if (!window.confirm(`Delete "${b.title}"? This cannot be undone.`)) return;
  await api.remove(b.id);
  await refreshTagFilter();
  await reload();
}

// --- Startup ---------------------------------------------------------------

(async function init() {
  try {
    await refreshTagFilter();
    await reload();
  } catch {
    els.empty.textContent = 'Could not load bookmarks. Please refresh.';
    els.empty.hidden = false;
  } finally {
    // Signal presentation readiness (initial UI + data loaded, or empty state).
    els.app.setAttribute('data-harness-ready', 'true');
  }
})();
