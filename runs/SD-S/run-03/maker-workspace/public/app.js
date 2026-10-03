// Frontend logic: list, add, edit, delete, tag filter, search.
const state = {
  q: '',
  activeTags: new Set(),
  hasFilter() {
    return this.q.trim() !== '' || this.activeTags.size > 0;
  },
};

const els = {
  app: document.getElementById('app'),
  addForm: document.getElementById('add-form'),
  addUrl: document.getElementById('add-url'),
  addTitle: document.getElementById('add-title'),
  addTags: document.getElementById('add-tags'),
  addError: document.getElementById('add-error'),
  search: document.getElementById('search'),
  tagFilters: document.getElementById('tag-filters'),
  list: document.getElementById('bookmark-list'),
  emptyState: document.getElementById('empty-state'),
  noResults: document.getElementById('no-results'),
};

// ---- API helpers ----------------------------------------------------------
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || 'Something went wrong.';
    throw new Error(message);
  }
  return data;
}

function parseTags(value) {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

// ---- Rendering ------------------------------------------------------------
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function bookmarkItem(b) {
  const li = document.createElement('li');
  li.className = 'bookmark';
  li.dataset.id = b.id;

  const tagsHtml = b.tags
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join('');

  li.innerHTML = `
    <div class="bookmark__main">
      <a class="bookmark__title" href="${escapeAttr(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.title)}</a>
      <a class="bookmark__url" href="${escapeAttr(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.url)}</a>
      <div class="bookmark__meta">
        <span class="bookmark__tags">${tagsHtml}</span>
        <span class="bookmark__date">Saved ${formatDate(b.createdAt)}</span>
      </div>
    </div>
    <div class="bookmark__actions">
      <button class="btn btn--ghost" data-action="edit">Edit</button>
      <button class="btn btn--ghost btn--danger" data-action="delete">Delete</button>
    </div>
  `;
  return li;
}

function editForm(b) {
  const li = document.createElement('li');
  li.className = 'bookmark bookmark--editing';
  li.dataset.id = b.id;
  li.innerHTML = `
    <form class="bookmark-form edit-form">
      <div class="field">
        <label>Web address</label>
        <input name="url" type="text" value="${escapeAttr(b.url)}" required />
      </div>
      <div class="field">
        <label>Title</label>
        <input name="title" type="text" value="${escapeAttr(b.title)}" />
      </div>
      <div class="field">
        <label>Tags <span class="muted">(comma-separated)</span></label>
        <input name="tags" type="text" value="${escapeAttr(b.tags.join(', '))}" />
      </div>
      <div class="form-row">
        <button type="submit" class="btn btn--primary">Save</button>
        <button type="button" class="btn btn--ghost" data-action="cancel">Cancel</button>
        <p class="form-error" role="alert" hidden></p>
      </div>
    </form>
  `;
  return li;
}

function renderList(bookmarks) {
  els.list.innerHTML = '';
  els.emptyState.hidden = true;
  els.noResults.hidden = true;

  if (bookmarks.length === 0) {
    if (state.hasFilter()) {
      els.noResults.hidden = false;
    } else {
      els.emptyState.hidden = false;
    }
    return;
  }
  for (const b of bookmarks) {
    els.list.appendChild(bookmarkItem(b));
  }
}

function renderTagFilters(tags) {
  els.tagFilters.innerHTML = '';
  for (const { name, count } of tags) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-filter' + (state.activeTags.has(name) ? ' tag-filter--active' : '');
    btn.textContent = `${name} (${count})`;
    btn.addEventListener('click', () => {
      if (state.activeTags.has(name)) state.activeTags.delete(name);
      else state.activeTags.add(name);
      refresh();
    });
    els.tagFilters.appendChild(btn);
  }
}

// ---- Data flow ------------------------------------------------------------
function buildQuery() {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set('q', state.q.trim());
  for (const t of state.activeTags) params.append('tag', t);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function refresh() {
  const [{ bookmarks }, { tags }] = await Promise.all([
    api(`/api/bookmarks${buildQuery()}`),
    api('/api/tags'),
  ]);
  renderTagFilters(tags);
  renderList(bookmarks);
}

// ---- Events ---------------------------------------------------------------
els.addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.addError.hidden = true;
  try {
    await api('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({
        url: els.addUrl.value,
        title: els.addTitle.value,
        tags: parseTags(els.addTags.value),
      }),
    });
    els.addForm.reset();
    await refresh();
  } catch (err) {
    els.addError.textContent = err.message;
    els.addError.hidden = false;
  }
});

let searchTimer;
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = els.search.value;
    refresh();
  }, 200);
});

els.list.addEventListener('click', async (e) => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const li = e.target.closest('.bookmark');
  const id = Number(li.dataset.id);
  const action = button.dataset.action;

  if (action === 'delete') {
    if (!confirm('Delete this bookmark? This cannot be undone.')) return;
    await api(`/api/bookmarks/${id}`, { method: 'DELETE' });
    await refresh();
  } else if (action === 'edit') {
    const { bookmark } = await api(`/api/bookmarks/${id}`);
    const form = editForm(bookmark);
    li.replaceWith(form);
    wireEditForm(form, bookmark);
  }
});

function wireEditForm(li, bookmark) {
  const form = li.querySelector('form');
  const errorEl = form.querySelector('.form-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    try {
      await api(`/api/bookmarks/${bookmark.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          url: form.url.value,
          title: form.title.value,
          tags: parseTags(form.tags.value),
        }),
      });
      await refresh();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });
  form.querySelector('[data-action="cancel"]').addEventListener('click', () => refresh());
}

// ---- Utilities ------------------------------------------------------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s);
}

// ---- Init -----------------------------------------------------------------
refresh()
  .catch((err) => {
    console.error(err);
  })
  .finally(() => {
    els.app.setAttribute('data-harness-ready', 'true');
  });
