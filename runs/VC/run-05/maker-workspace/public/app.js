const state = { q: '', tag: '' };

const $ = (sel) => document.querySelector(sel);
const listEl = $('#bookmark-list');
const emptyEl = $('#empty');
const tagListEl = $('#tag-list');
const modal = $('#modal');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Request failed');
  }
  return res.status === 204 ? null : res.json();
}

async function loadBookmarks() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);
  const items = await api('/api/bookmarks?' + params.toString());
  render(items);
}

async function loadTags() {
  const tags = await api('/api/tags');
  const items = [`<li><button class="tag-filter ${state.tag === '' ? 'active' : ''}" data-tag="">All</button></li>`];
  for (const t of tags) {
    items.push(
      `<li><button class="tag-filter ${state.tag === t.name ? 'active' : ''}" data-tag="${esc(t.name)}">` +
        `<span>${esc(t.name)}</span><span class="count">${t.count}</span></button></li>`
    );
  }
  tagListEl.innerHTML = items.join('');
}

function render(items) {
  emptyEl.classList.toggle('hidden', items.length > 0);
  emptyEl.textContent = state.q || state.tag ? 'No bookmarks match your filters.' : 'No bookmarks yet. Add your first one!';
  listEl.innerHTML = items
    .map(
      (b) => `
    <li class="card" data-id="${b.id}">
      <div class="card-head">
        <div>
          <a class="title" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${esc(b.title)}</a>
          <p class="url">${esc(b.url)}</p>
        </div>
        <div class="card-actions">
          <button class="icon-btn edit" data-id="${b.id}">Edit</button>
          <button class="icon-btn del" data-id="${b.id}">Delete</button>
        </div>
      </div>
      ${b.description ? `<p class="desc">${esc(b.description)}</p>` : ''}
      ${b.tags.length ? `<div class="tags">${b.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
    </li>`
    )
    .join('');
}

let cache = [];
async function refresh() {
  await Promise.all([loadTags(), loadBookmarks()]);
}

function openModal(bookmark) {
  $('#modal-title').textContent = bookmark ? 'Edit bookmark' : 'New bookmark';
  $('#edit-id').value = bookmark ? bookmark.id : '';
  $('#f-url').value = bookmark ? bookmark.url : '';
  $('#f-title').value = bookmark ? bookmark.title : '';
  $('#f-description').value = bookmark ? bookmark.description : '';
  $('#f-tags').value = bookmark ? bookmark.tags.join(', ') : '';
  modal.classList.remove('hidden');
  $('#f-url').focus();
}
function closeModal() { modal.classList.add('hidden'); }

$('#new-btn').addEventListener('click', () => openModal(null));
$('#cancel-btn').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#edit-id').value;
  const payload = {
    url: $('#f-url').value,
    title: $('#f-title').value,
    description: $('#f-description').value,
    tags: $('#f-tags').value,
  };
  try {
    await api(id ? `/api/bookmarks/${id}` : '/api/bookmarks', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    closeModal();
    await refresh();
  } catch (err) {
    alert(err.message);
  }
});

listEl.addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  if (!id) return;
  if (e.target.classList.contains('del')) {
    if (confirm('Delete this bookmark?')) {
      await api(`/api/bookmarks/${id}`, { method: 'DELETE' });
      await refresh();
    }
  } else if (e.target.classList.contains('edit')) {
    const items = await api('/api/bookmarks');
    const b = items.find((x) => String(x.id) === String(id));
    if (b) openModal(b);
  }
});

tagListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.tag-filter');
  if (!btn) return;
  state.tag = btn.dataset.tag;
  refresh();
});

let searchTimer;
$('#search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = e.target.value.trim();
    loadBookmarks();
  }, 200);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

refresh().then(() => {
  document.body.setAttribute('data-harness-ready', 'true');
});
