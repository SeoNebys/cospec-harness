const $ = (sel) => document.querySelector(sel);

const state = { search: '', tag: '' };

const els = {
  form: $('#form'),
  formTitle: $('#formTitle'),
  editId: $('#editId'),
  url: $('#url'),
  title: $('#title'),
  description: $('#description'),
  tags: $('#tags'),
  submitBtn: $('#submitBtn'),
  cancelBtn: $('#cancelBtn'),
  formError: $('#formError'),
  search: $('#search'),
  list: $('#list'),
  empty: $('#empty'),
  count: $('#count'),
  activeFilter: $('#activeFilter'),
  tagcloud: $('#tagcloud'),
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error((data.errors || ['Request failed']).join(', '));
  return data;
}

async function refresh() {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.tag) params.set('tag', state.tag);
  const [bookmarks, tags] = await Promise.all([
    api(`/api/bookmarks?${params}`),
    api('/api/tags'),
  ]);
  renderList(bookmarks);
  renderTags(tags);
  renderFilter();
}

function renderList(bookmarks) {
  els.count.textContent = `${bookmarks.length} bookmark${bookmarks.length === 1 ? '' : 's'}`;
  els.empty.hidden = bookmarks.length > 0;
  els.list.innerHTML = bookmarks
    .map(
      (b) => `
    <li class="card" data-id="${b.id}">
      <a class="title" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${esc(b.title)}</a>
      <p class="url">${esc(b.url)}</p>
      ${b.description ? `<p class="desc">${esc(b.description)}</p>` : ''}
      <div class="meta">
        <div class="tags">
          ${b.tags.map((t) => `<span class="chip" data-tag="${esc(t)}">${esc(t)}</span>`).join('')}
        </div>
        <div class="actions">
          <button class="edit" data-id="${b.id}">Edit</button>
          <button class="del" data-id="${b.id}">Delete</button>
        </div>
      </div>
    </li>`
    )
    .join('');
}

function renderTags(tags) {
  els.tagcloud.innerHTML = tags
    .map(
      (t) =>
        `<span class="chip ${t.name === state.tag ? 'active' : ''}" data-tag="${esc(t.name)}">${esc(t.name)}<span class="c">${t.count}</span></span>`
    )
    .join('');
}

function renderFilter() {
  els.activeFilter.textContent = state.tag ? `Filtered by "${state.tag}" ✕` : '';
}

function startEdit(bookmark) {
  els.editId.value = bookmark.id;
  els.url.value = bookmark.url;
  els.title.value = bookmark.title;
  els.description.value = bookmark.description;
  els.tags.value = bookmark.tags.join(', ');
  els.formTitle.textContent = 'Edit bookmark';
  els.submitBtn.textContent = 'Update';
  els.cancelBtn.hidden = false;
  els.url.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  els.form.reset();
  els.editId.value = '';
  els.formTitle.textContent = 'Add a bookmark';
  els.submitBtn.textContent = 'Save';
  els.cancelBtn.hidden = true;
  els.formError.textContent = '';
}

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.formError.textContent = '';
  const payload = {
    url: els.url.value,
    title: els.title.value,
    description: els.description.value,
    tags: els.tags.value,
  };
  const id = els.editId.value;
  try {
    if (id) {
      await api(`/api/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/bookmarks', { method: 'POST', body: JSON.stringify(payload) });
    }
    resetForm();
    await refresh();
  } catch (err) {
    els.formError.textContent = err.message;
  }
});

els.cancelBtn.addEventListener('click', resetForm);

let searchTimer;
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = els.search.value.trim();
    refresh();
  }, 200);
});

els.activeFilter.addEventListener('click', () => {
  state.tag = '';
  refresh();
});

// Event delegation for dynamic elements
document.addEventListener('click', async (e) => {
  const tagEl = e.target.closest('[data-tag]');
  if (tagEl && (tagEl.closest('.tagcloud') || tagEl.closest('.card .tags'))) {
    const tag = tagEl.dataset.tag;
    state.tag = state.tag === tag ? '' : tag;
    return refresh();
  }
  const editBtn = e.target.closest('button.edit');
  if (editBtn) {
    const bookmark = await api(`/api/bookmarks/${editBtn.dataset.id}`);
    if (bookmark) startEdit(bookmark);
    return;
  }
  const delBtn = e.target.closest('button.del');
  if (delBtn) {
    if (!confirm('Delete this bookmark?')) return;
    await api(`/api/bookmarks/${delBtn.dataset.id}`, { method: 'DELETE' });
    return refresh();
  }
});

refresh()
  .catch((err) => {
    els.formError.textContent = 'Failed to load: ' + err.message;
  })
  .finally(() => {
    document.body.setAttribute('data-harness-ready', 'true');
  });
