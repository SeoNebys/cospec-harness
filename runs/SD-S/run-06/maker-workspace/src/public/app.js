const api = {
  async list({ search = '', tag = '' } = {}) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (tag) params.set('tag', tag);
    const res = await fetch(`/api/bookmarks?${params}`);
    return (await res.json()).bookmarks;
  },
  async create(payload) {
    const res = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: res.status, body: await res.json() };
  },
  async update(id, payload) {
    const res = await fetch(`/api/bookmarks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: res.status, body: res.status === 204 ? {} : await res.json() };
  },
  async remove(id) {
    await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
  },
  async tags() {
    const res = await fetch('/api/tags');
    return (await res.json()).tags;
  },
};

const state = { search: '', tag: '' };

const el = (id) => document.getElementById(id);
const form = el('bookmark-form');
const editIdInput = el('edit-id');
const addressInput = el('address');
const titleInput = el('title');
const descInput = el('description');
const tagsInput = el('tags');
const formError = el('form-error');
const submitBtn = el('submit-btn');
const cancelEditBtn = el('cancel-edit');
const searchInput = el('search');
const listEl = el('bookmark-list');
const emptyEl = el('empty-state');
const tagFilterEl = el('tag-filter');
const tagSuggestions = el('tag-suggestions');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function parseTags(value) {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function isEditing() {
  return editIdInput.value !== '';
}

function setEditMode(on) {
  form.classList.toggle('editing', on);
  document.querySelectorAll('.edit-only').forEach((n) => (n.hidden = !on));
  submitBtn.textContent = on ? 'Save changes' : 'Save bookmark';
  cancelEditBtn.hidden = !on;
}

function resetForm() {
  form.reset();
  editIdInput.value = '';
  formError.textContent = '';
  setEditMode(false);
}

function beginEdit(bookmark) {
  editIdInput.value = bookmark.id;
  addressInput.value = bookmark.address;
  titleInput.value = bookmark.title;
  descInput.value = bookmark.description;
  tagsInput.value = bookmark.tags.join(', ');
  formError.textContent = '';
  setEditMode(true);
  addressInput.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderList(bookmarks) {
  listEl.innerHTML = '';
  if (bookmarks.length === 0) {
    emptyEl.hidden = false;
    emptyEl.textContent =
      state.search || state.tag
        ? 'No bookmarks match your search.'
        : 'No bookmarks yet. Add your first one above.';
    return;
  }
  emptyEl.hidden = true;

  for (const b of bookmarks) {
    const li = document.createElement('li');
    li.className = 'bookmark';
    li.dataset.id = b.id;
    const icon = b.iconUrl
      ? `<img class="favicon" src="${escapeHtml(b.iconUrl)}" alt="" onerror="this.style.visibility='hidden'" />`
      : `<span class="favicon"></span>`;
    const tags = b.tags
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join('');
    li.innerHTML = `
      ${icon}
      <div class="body">
        <p class="title"><a href="${escapeHtml(b.address)}" target="_blank" rel="noopener">${escapeHtml(b.title || b.address)}</a></p>
        <p class="addr">${escapeHtml(b.address)}</p>
        ${b.description ? `<p class="desc">${escapeHtml(b.description)}</p>` : ''}
        <div class="tags">${tags}</div>
      </div>
      <div class="actions">
        <button class="link" data-action="edit">Edit</button>
        <button class="link danger" data-action="delete">Delete</button>
      </div>`;
    listEl.appendChild(li);
  }
}

async function refresh() {
  const bookmarks = await api.list(state);
  renderList(bookmarks);
  await refreshTags();
}

async function refreshTags() {
  const tags = await api.tags();
  tagSuggestions.innerHTML = tags.map((t) => `<option value="${escapeHtml(t)}"></option>`).join('');
  tagFilterEl.innerHTML = '';
  for (const t of tags) {
    const chip = document.createElement('button');
    chip.className = 'tag-chip' + (state.tag === t ? ' active' : '');
    chip.textContent = t;
    chip.addEventListener('click', () => {
      state.tag = state.tag === t ? '' : t;
      refresh();
    });
    tagFilterEl.appendChild(chip);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';
  const payload = {
    address: addressInput.value.trim(),
    tags: parseTags(tagsInput.value),
  };

  if (isEditing()) {
    payload.title = titleInput.value.trim();
    payload.description = descInput.value.trim();
    const { status, body } = await api.update(editIdInput.value, payload);
    if (status === 400 || status === 409) {
      formError.textContent = body.error;
      return;
    }
    resetForm();
    await refresh();
    return;
  }

  const { status, body } = await api.create(payload);
  if (status === 400) {
    formError.textContent = body.error;
    return;
  }
  if (status === 200 && body.existing) {
    // Address already saved — open the existing bookmark for update (FR-014).
    beginEdit(body.bookmark);
    formError.textContent = 'This address is already bookmarked — opening it for editing.';
    return;
  }
  resetForm();
  await refresh();
});

cancelEditBtn.addEventListener('click', resetForm);

listEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.closest('.bookmark').dataset.id;
  if (btn.dataset.action === 'edit') {
    const res = await fetch(`/api/bookmarks/${id}`);
    const { bookmark } = await res.json();
    beginEdit(bookmark);
  } else if (btn.dataset.action === 'delete') {
    if (confirm('Delete this bookmark?')) {
      await api.remove(id);
      if (editIdInput.value === id) resetForm();
      await refresh();
    }
  }
});

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = searchInput.value.trim();
    refresh();
  }, 150);
});

// Initial load: mark ready once the list (or empty state) has rendered.
(async () => {
  await refresh();
  document.getElementById('app').setAttribute('data-harness-ready', 'true');
})();
