// Front-end logic for the Bookmark Manager.
// Talks to the JSON API in src/routes/bookmarks.js.

const state = { q: '', tag: null };

const els = {
  addForm: document.getElementById('add-form'),
  addMessage: document.getElementById('add-message'),
  url: document.getElementById('url'),
  title: document.getElementById('title'),
  tags: document.getElementById('tags'),
  note: document.getElementById('note'),
  search: document.getElementById('search'),
  list: document.getElementById('list'),
  tagCloud: document.getElementById('tag-cloud'),
  activeFilter: document.getElementById('active-filter'),
  activeFilterName: document.getElementById('active-filter-name'),
  clearFilter: document.getElementById('clear-filter'),
  dialog: document.getElementById('edit-dialog'),
  editId: document.getElementById('edit-id'),
  editUrl: document.getElementById('edit-url'),
  editTitle: document.getElementById('edit-title'),
  editTags: document.getElementById('edit-tags'),
  editNote: document.getElementById('edit-note'),
  editMessage: document.getElementById('edit-message'),
  editSave: document.getElementById('edit-save'),
  editCancel: document.getElementById('edit-cancel'),
};

function parseTags(value) {
  return (value || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let body = null;
  if (res.status !== 204) {
    body = await res.json().catch(() => null);
  }
  if (!res.ok) {
    const message = body?.error?.message || 'Something went wrong.';
    const err = new Error(message);
    err.code = body?.error?.code;
    throw err;
  }
  return body;
}

function setMessage(el, text, kind) {
  el.textContent = text || '';
  el.className = 'message' + (kind ? ` message--${kind}` : '');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBookmarks(bookmarks) {
  els.list.innerHTML = '';
  if (bookmarks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent =
      state.q || state.tag
        ? 'No bookmarks match your search.'
        : 'No bookmarks yet. Add your first one above.';
    els.list.appendChild(empty);
    return;
  }

  for (const b of bookmarks) {
    const item = document.createElement('article');
    item.className = 'bookmark';
    item.dataset.id = b.id;

    const tagsHtml = (b.tags || [])
      .map(
        (t) =>
          `<button class="tag-chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`
      )
      .join('');

    item.innerHTML = `
      <div class="bookmark__top">
        <div>
          <div class="bookmark__title">
            <a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.title)}</a>
          </div>
          <div class="bookmark__url">
            <a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.url)}</a>
          </div>
        </div>
        <div class="bookmark__actions">
          <button class="btn" data-action="edit">Edit</button>
          <button class="btn btn--danger" data-action="delete">Delete</button>
        </div>
      </div>
      ${b.note ? `<p class="bookmark__note">${escapeHtml(b.note)}</p>` : ''}
      ${tagsHtml ? `<div class="bookmark__tags">${tagsHtml}</div>` : ''}
    `;
    els.list.appendChild(item);
  }
}

function renderTagCloud(tags) {
  els.tagCloud.innerHTML = '';
  for (const t of tags) {
    const chip = document.createElement('button');
    chip.className = 'tag-chip' + (state.tag === t ? ' tag-chip--active' : '');
    chip.textContent = t;
    chip.dataset.tag = t;
    els.tagCloud.appendChild(chip);
  }
}

async function refresh() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);
  const qs = params.toString();

  const [{ bookmarks }, { tags }] = await Promise.all([
    api(`/api/bookmarks${qs ? `?${qs}` : ''}`),
    api('/api/tags'),
  ]);

  renderBookmarks(bookmarks);
  renderTagCloud(tags);

  if (state.tag) {
    els.activeFilter.hidden = false;
    els.activeFilterName.textContent = state.tag;
  } else {
    els.activeFilter.hidden = true;
  }
}

// --- Event wiring ---

els.addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = els.url.value.trim();
  if (!url) {
    setMessage(els.addMessage, 'Enter a valid web address.', 'error');
    return;
  }
  try {
    const result = await api('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({
        url,
        title: els.title.value,
        note: els.note.value,
        tags: parseTags(els.tags.value),
      }),
    });
    els.addForm.reset();
    if (result.warnings?.includes('duplicate_url')) {
      setMessage(els.addMessage, 'Saved. Note: this address was already in your bookmarks.', 'warn');
    } else {
      setMessage(els.addMessage, 'Bookmark saved.', 'ok');
    }
    await refresh();
  } catch (err) {
    setMessage(els.addMessage, err.message, 'error');
  }
});

let searchTimer;
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = els.search.value.trim();
    refresh();
  }, 200);
});

els.clearFilter.addEventListener('click', () => {
  state.tag = null;
  refresh();
});

// Delegated clicks: tag filters (cloud + per-bookmark), edit, delete.
document.addEventListener('click', async (e) => {
  const tagBtn = e.target.closest('[data-tag]');
  if (tagBtn) {
    state.tag = tagBtn.dataset.tag;
    refresh();
    return;
  }

  const actionBtn = e.target.closest('[data-action]');
  if (!actionBtn) return;
  const item = actionBtn.closest('.bookmark');
  const id = Number(item.dataset.id);

  if (actionBtn.dataset.action === 'delete') {
    const title = item.querySelector('.bookmark__title')?.textContent?.trim() || 'this bookmark';
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api(`/api/bookmarks/${id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      window.alert(err.message);
    }
    return;
  }

  if (actionBtn.dataset.action === 'edit') {
    openEdit(id);
  }
});

async function openEdit(id) {
  try {
    const { bookmark } = await api(`/api/bookmarks/${id}`);
    els.editId.value = bookmark.id;
    els.editUrl.textContent = bookmark.url;
    els.editTitle.value = bookmark.title;
    els.editTags.value = (bookmark.tags || []).join(', ');
    els.editNote.value = bookmark.note || '';
    setMessage(els.editMessage, '', null);
    els.dialog.showModal();
  } catch (err) {
    window.alert(err.message);
  }
}

els.editCancel.addEventListener('click', () => els.dialog.close());

els.editSave.addEventListener('click', async () => {
  const id = Number(els.editId.value);
  const title = els.editTitle.value.trim();
  if (!title) {
    setMessage(els.editMessage, 'Title cannot be empty.', 'error');
    return;
  }
  try {
    await api(`/api/bookmarks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title,
        note: els.editNote.value,
        tags: parseTags(els.editTags.value),
      }),
    });
    els.dialog.close();
    await refresh();
  } catch (err) {
    setMessage(els.editMessage, err.message, 'error');
  }
});

// Initial load — mark ready once the list (or empty state) has rendered.
refresh()
  .catch(() => {
    els.list.innerHTML = '<div class="empty">Could not load bookmarks.</div>';
  })
  .finally(() => {
    document.getElementById('app').setAttribute('data-harness-ready', 'true');
  });
