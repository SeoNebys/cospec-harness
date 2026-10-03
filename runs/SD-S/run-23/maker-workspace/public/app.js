const $ = (sel) => document.querySelector(sel);

const state = { search: '', tag: '' };

const els = {
  addForm: $('#add-form'),
  addUrl: $('#add-url'),
  addTags: $('#add-tags'),
  addError: $('#add-error'),
  search: $('#search'),
  tagFilter: $('#tag-filter'),
  list: $('#bookmark-list'),
  emptyState: $('#empty-state'),
  noResults: $('#no-results'),
  suggestions: $('#tag-suggestions'),
  dialog: $('#edit-dialog'),
  editForm: $('#edit-form'),
  editUrl: $('#edit-url'),
  editTitle: $('#edit-title'),
  editDescription: $('#edit-description'),
  editTags: $('#edit-tags'),
  editError: $('#edit-error'),
  editCancel: $('#edit-cancel'),
};

let editingId = null;

// --- Helpers ---

function parseTags(str) {
  return String(str || '')
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
  return { status: res.status, body };
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of [].concat(children)) {
    if (c) node.append(c);
  }
  return node;
}

// --- Rendering ---

function renderBookmark(b) {
  const li = el('li', { className: 'bookmark' });
  li.dataset.id = b.id;

  if (b.faviconUrl) {
    const img = el('img', { className: 'favicon', src: b.faviconUrl, alt: '', loading: 'lazy' });
    img.addEventListener('error', () => {
      const ph = el('span', { className: 'favicon-placeholder' });
      img.replaceWith(ph);
    });
    li.append(img);
  } else {
    li.append(el('span', { className: 'favicon-placeholder' }));
  }

  const body = el('div', { className: 'body' });
  const title = el('a', {
    className: 'title',
    href: b.url,
    target: '_blank',
    rel: 'noopener noreferrer',
    textContent: b.title || b.url,
    title: b.title || b.url,
  });
  const url = el('div', { className: 'url', textContent: b.url, title: b.url });
  body.append(title, url);

  if (b.description) {
    body.append(el('p', { className: 'desc', textContent: b.description }));
  }
  if (b.tags && b.tags.length) {
    const tags = el('div', { className: 'tags' });
    for (const t of b.tags) {
      const chip = el('button', { className: 'tag-chip', type: 'button', textContent: t });
      chip.addEventListener('click', () => {
        els.tagFilter.value = t;
        state.tag = t;
        load();
      });
      tags.append(chip);
    }
    body.append(tags);
  }
  li.append(body);

  const actions = el('div', { className: 'actions' });
  const editBtn = el('button', { className: 'link-plain', type: 'button', textContent: 'Edit' });
  editBtn.addEventListener('click', () => openEdit(b));
  const delBtn = el('button', { className: 'link-danger', type: 'button', textContent: 'Delete' });
  delBtn.addEventListener('click', () => remove(b));
  actions.append(editBtn, delBtn);
  li.append(actions);

  return li;
}

function render(bookmarks) {
  els.list.replaceChildren(...bookmarks.map(renderBookmark));
  const hasFilter = Boolean(state.search || state.tag);
  els.emptyState.hidden = bookmarks.length > 0 || hasFilter;
  els.noResults.hidden = bookmarks.length > 0 || !hasFilter;
}

// --- Data loading ---

async function loadTags() {
  const { body } = await api('/api/tags');
  const tags = (body && body.tags) || [];
  els.suggestions.replaceChildren(...tags.map((t) => el('option', { value: t })));
  const current = els.tagFilter.value;
  els.tagFilter.replaceChildren(
    el('option', { value: '', textContent: 'All tags' }),
    ...tags.map((t) => el('option', { value: t, textContent: t }))
  );
  els.tagFilter.value = current;
}

async function load() {
  const params = new URLSearchParams();
  if (state.search) params.set('q', state.search);
  if (state.tag) params.set('tag', state.tag);
  const qs = params.toString();
  const { body } = await api('/api/bookmarks' + (qs ? `?${qs}` : ''));
  render((body && body.bookmarks) || []);
  markReady();
}

let ready = false;
function markReady() {
  if (ready) return;
  ready = true;
  document.body.setAttribute('data-harness-ready', 'true');
}

function flash(id) {
  const node = els.list.querySelector(`li[data-id="${id}"]`);
  if (node) {
    node.classList.remove('flash');
    void node.offsetWidth; // restart animation
    node.classList.add('flash');
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// --- Actions ---

let addBusy = false;
async function addBookmark(e) {
  e.preventDefault();
  if (addBusy) return;
  addBusy = true;
  els.addError.hidden = true;
  const addBtn = document.getElementById('add-btn');
  addBtn.disabled = true;
  try {
    const url = els.addUrl.value.trim();
    const tags = parseTags(els.addTags.value);
    const { status, body } = await api('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ url, tags }),
    });
    if (status === 400) {
      els.addError.textContent = (body && body.error) || 'Could not save that address';
      els.addError.hidden = false;
      return;
    }
    els.addUrl.value = '';
    els.addTags.value = '';
    await loadTags();
    await load();
    if (body && body.bookmark) {
      flash(body.bookmark.id); // navigates to existing on duplicate (FR-019)
    }
  } finally {
    addBtn.disabled = false;
    addBusy = false;
  }
}

function openEdit(b) {
  editingId = b.id;
  els.editUrl.value = b.url;
  els.editTitle.value = b.title || '';
  els.editDescription.value = b.description || '';
  els.editTags.value = (b.tags || []).join(', ');
  els.editError.hidden = true;
  els.dialog.showModal();
}

async function saveEdit(e) {
  e.preventDefault();
  els.editError.hidden = true;
  const payload = {
    url: els.editUrl.value.trim(),
    title: els.editTitle.value,
    description: els.editDescription.value,
    tags: parseTags(els.editTags.value),
  };
  const { status, body } = await api(`/api/bookmarks/${editingId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (status === 200) {
    els.dialog.close();
    await loadTags();
    await load();
    if (body && body.bookmark) flash(body.bookmark.id);
    return;
  }
  els.editError.textContent =
    (body && body.error) ||
    (status === 409 ? 'A bookmark with that address already exists' : 'Could not save changes');
  els.editError.hidden = false;
}

async function remove(b) {
  const label = b.title || b.url;
  if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
  await api(`/api/bookmarks/${b.id}`, { method: 'DELETE' });
  await loadTags();
  await load();
}

// --- Wiring ---

els.addForm.addEventListener('submit', addBookmark);
els.editForm.addEventListener('submit', saveEdit);
els.editCancel.addEventListener('click', () => els.dialog.close());

let searchTimer;
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = els.search.value.trim();
    load();
  }, 200);
});
els.tagFilter.addEventListener('change', () => {
  state.tag = els.tagFilter.value;
  load();
});

(async function init() {
  await loadTags();
  await load();
})();
