const state = {
  filter: 'all', // 'all' | 'favorites'
  tag: '',
  search: '',
};

const els = {
  search: document.getElementById('search'),
  addBtn: document.getElementById('add-btn'),
  bookmarks: document.getElementById('bookmarks'),
  empty: document.getElementById('empty'),
  listTitle: document.getElementById('list-title'),
  count: document.getElementById('count'),
  tagList: document.getElementById('tag-list'),
  filters: document.querySelectorAll('.filter'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  form: document.getElementById('bookmark-form'),
  fId: document.getElementById('bookmark-id'),
  fUrl: document.getElementById('f-url'),
  fTitle: document.getElementById('f-title'),
  fDesc: document.getElementById('f-description'),
  fTags: document.getElementById('f-tags'),
  fFav: document.getElementById('f-favorite'),
  formError: document.getElementById('form-error'),
  cancelBtn: document.getElementById('cancel-btn'),
  toast: document.getElementById('toast'),
};

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function faviconUrl(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return '';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.add('hidden'), 2200);
}

function renderBookmarks(items) {
  els.bookmarks.innerHTML = '';
  els.empty.classList.toggle('hidden', items.length > 0);
  els.count.textContent = items.length
    ? `${items.length} bookmark${items.length === 1 ? '' : 's'}`
    : '';

  for (const b of items) {
    const card = document.createElement('article');
    card.className = 'card';
    const fav = faviconUrl(b.url);
    card.innerHTML = `
      <div class="card-head">
        ${fav ? `<img class="favicon" src="${fav}" alt="" onerror="this.style.visibility='hidden'" />` : '<span class="favicon"></span>'}
        <h3 class="card-title"><a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.title)}</a></h3>
        <button class="star ${b.favorite ? 'on' : ''}" title="Toggle favorite" data-star="${b.id}">${b.favorite ? '★' : '☆'}</button>
      </div>
      <a class="card-url" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.url)}</a>
      ${b.description ? `<p class="card-desc">${escapeHtml(b.description)}</p>` : ''}
      ${b.tags.length ? `<div class="card-tags">${b.tags.map((t) => `<span class="chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="card-actions">
        <button data-edit="${b.id}">✏️ Edit</button>
        <button class="del" data-del="${b.id}">🗑️ Delete</button>
      </div>
    `;
    els.bookmarks.appendChild(card);
  }
}

async function loadBookmarks() {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.tag) params.set('tag', state.tag);
  if (state.filter === 'favorites') params.set('favorite', 'true');
  const items = await api(`/api/bookmarks?${params.toString()}`);
  renderBookmarks(items);
  updateTitle();
  markReady();
}

function updateTitle() {
  if (state.tag) els.listTitle.textContent = `#${state.tag}`;
  else if (state.filter === 'favorites') els.listTitle.textContent = '★ Favorites';
  else els.listTitle.textContent = 'All bookmarks';
}

async function loadTags() {
  const tags = await api('/api/tags');
  els.tagList.innerHTML = '';
  for (const t of tags) {
    const li = document.createElement('li');
    li.dataset.tag = t.name;
    if (state.tag === t.name) li.classList.add('active');
    li.innerHTML = `<span>#${escapeHtml(t.name)}</span><span class="tag-count">${t.count}</span>`;
    els.tagList.appendChild(li);
  }
}

function openModal(bookmark) {
  els.formError.classList.add('hidden');
  els.form.reset();
  if (bookmark) {
    els.modalTitle.textContent = 'Edit bookmark';
    els.fId.value = bookmark.id;
    els.fUrl.value = bookmark.url;
    els.fTitle.value = bookmark.title;
    els.fDesc.value = bookmark.description;
    els.fTags.value = bookmark.tags.join(', ');
    els.fFav.checked = bookmark.favorite;
  } else {
    els.modalTitle.textContent = 'Add bookmark';
    els.fId.value = '';
  }
  els.modal.classList.remove('hidden');
  els.fUrl.focus();
}

function closeModal() {
  els.modal.classList.add('hidden');
}

async function submitForm(e) {
  e.preventDefault();
  const id = els.fId.value;
  const payload = {
    url: els.fUrl.value,
    title: els.fTitle.value,
    description: els.fDesc.value,
    tags: els.fTags.value,
    favorite: els.fFav.checked,
  };
  try {
    if (id) {
      await api(`/api/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Bookmark updated');
    } else {
      await api('/api/bookmarks', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Bookmark added');
    }
    closeModal();
    await refresh();
  } catch (err) {
    els.formError.textContent = err.message;
    els.formError.classList.remove('hidden');
  }
}

async function refresh() {
  await Promise.all([loadBookmarks(), loadTags()]);
}

let readyMarked = false;
function markReady() {
  if (readyMarked) return;
  readyMarked = true;
  document.body.setAttribute('data-harness-ready', 'true');
}

// Event wiring
els.addBtn.addEventListener('click', () => openModal(null));
els.cancelBtn.addEventListener('click', closeModal);
els.form.addEventListener('submit', submitForm);
els.modal.addEventListener('click', (e) => {
  if (e.target === els.modal) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !els.modal.classList.contains('hidden')) closeModal();
});

let searchTimer;
els.search.addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value.trim();
    loadBookmarks();
  }, 200);
});

els.filters.forEach((btn) => {
  btn.addEventListener('click', () => {
    els.filters.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    state.tag = '';
    refresh();
  });
});

els.tagList.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-tag]');
  if (!li) return;
  const tag = li.dataset.tag;
  state.tag = state.tag === tag ? '' : tag;
  refresh();
});

els.bookmarks.addEventListener('click', async (e) => {
  const starBtn = e.target.closest('[data-star]');
  const editBtn = e.target.closest('[data-edit]');
  const delBtn = e.target.closest('[data-del]');
  const chip = e.target.closest('.chip[data-tag]');

  if (starBtn) {
    await api(`/api/bookmarks/${starBtn.dataset.star}/favorite`, { method: 'PATCH' });
    await refresh();
  } else if (editBtn) {
    const bookmark = await api(`/api/bookmarks/${editBtn.dataset.edit}`);
    openModal(bookmark);
  } else if (delBtn) {
    if (confirm('Delete this bookmark?')) {
      await api(`/api/bookmarks/${delBtn.dataset.del}`, { method: 'DELETE' });
      showToast('Bookmark deleted');
      await refresh();
    }
  } else if (chip) {
    state.tag = chip.dataset.tag;
    els.filters.forEach((b) => b.classList.toggle('active', b.dataset.filter === 'all'));
    state.filter = 'all';
    refresh();
  }
});

refresh();
