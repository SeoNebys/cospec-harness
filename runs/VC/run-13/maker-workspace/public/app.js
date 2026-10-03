const state = {
  search: '',
  filter: 'all', // 'all' | 'favorites'
  tag: '',
};

const el = (id) => document.getElementById(id);
const listEl = el('list');
const emptyEl = el('empty');

function api(path, options) {
  return fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function faviconFor(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
  } catch {
    return '';
  }
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

async function loadBookmarks() {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.tag) params.set('tag', state.tag);
  if (state.filter === 'favorites') params.set('favorite', '1');
  const res = await api('/api/bookmarks?' + params.toString());
  const items = await res.json();
  renderList(items);
  renderActiveFilter();
}

async function loadTags() {
  const res = await api('/api/tags');
  const tags = await res.json();
  const ul = el('tag-list');
  ul.innerHTML = '';
  if (!tags.length) {
    ul.innerHTML = '<li class="empty-tags" style="color:var(--border);font-size:13px;padding:0 12px">No tags yet</li>';
    return;
  }
  for (const t of tags) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'tag-btn' + (state.tag === t.name ? ' active' : '');
    btn.innerHTML = `<span>#${escapeHtml(t.name)}</span><span class="tag-count">${t.count}</span>`;
    btn.onclick = () => {
      state.tag = state.tag === t.name ? '' : t.name;
      refresh();
    };
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

function renderActiveFilter() {
  const bar = el('active-filter');
  const parts = [];
  if (state.tag) parts.push(`tag <strong>#${escapeHtml(state.tag)}</strong>`);
  if (state.filter === 'favorites') parts.push('<strong>favorites</strong>');
  if (state.search) parts.push(`search “${escapeHtml(state.search)}”`);
  if (parts.length) {
    bar.hidden = false;
    bar.innerHTML = `Filtering by ${parts.join(', ')} <a class="clear" href="#">Clear all</a>`;
    bar.querySelector('.clear').onclick = (e) => {
      e.preventDefault();
      state.search = '';
      state.tag = '';
      state.filter = 'all';
      el('search').value = '';
      document.querySelectorAll('.filter').forEach((f) => f.classList.toggle('active', f.dataset.filter === 'all'));
      refresh();
    };
  } else {
    bar.hidden = true;
  }
}

function renderList(items) {
  listEl.innerHTML = '';
  if (!items.length) {
    emptyEl.hidden = false;
    const filtering = state.search || state.tag || state.filter !== 'all';
    emptyEl.innerHTML = filtering
      ? '<h3>No matches</h3><p>Try a different search or clear your filters.</p>'
      : '<h3>No bookmarks yet</h3><p>Click “+ New bookmark” to save your first link.</p>';
    return;
  }
  emptyEl.hidden = true;
  for (const bm of items) {
    listEl.appendChild(renderCard(bm));
  }
}

function renderCard(bm) {
  const card = document.createElement('div');
  card.className = 'card';
  const favicon = faviconFor(bm.url);
  card.innerHTML = `
    <div class="card-head">
      <div class="card-title">
        ${favicon ? `<img src="${favicon}" alt="" onerror="this.style.display='none'"/>` : ''}
        <a href="${escapeHtml(bm.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(bm.title)}</a>
      </div>
      <button class="star-btn ${bm.favorite ? 'on' : ''}" title="Toggle favorite">★</button>
    </div>
    <div class="card-url"><a href="${escapeHtml(bm.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(hostOf(bm.url))}</a></div>
    ${bm.description ? `<div class="card-desc">${escapeHtml(bm.description)}</div>` : ''}
    ${bm.tags.length ? `<div class="card-tags">${bm.tags.map((t) => `<button class="chip" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join('')}</div>` : ''}
    <div class="card-actions">
      <button class="edit">Edit</button>
      <button class="del">Delete</button>
    </div>
  `;
  card.querySelector('.star-btn').onclick = async () => {
    await api(`/api/bookmarks/${bm.id}/favorite`, { method: 'PATCH' });
    refresh();
  };
  card.querySelector('.edit').onclick = () => openModal(bm);
  card.querySelector('.del').onclick = async () => {
    if (confirm(`Delete “${bm.title}”?`)) {
      await api(`/api/bookmarks/${bm.id}`, { method: 'DELETE' });
      refresh();
    }
  };
  card.querySelectorAll('.chip').forEach((chip) => {
    chip.onclick = () => {
      state.tag = chip.dataset.tag;
      refresh();
    };
  });
  return card;
}

// Modal handling
function openModal(bm) {
  el('modal-title').textContent = bm ? 'Edit bookmark' : 'New bookmark';
  el('bm-id').value = bm ? bm.id : '';
  el('bm-title').value = bm ? bm.title : '';
  el('bm-url').value = bm ? bm.url : '';
  el('bm-description').value = bm ? bm.description : '';
  el('bm-tags').value = bm ? bm.tags.join(', ') : '';
  el('bm-favorite').checked = bm ? bm.favorite : false;
  el('form-errors').hidden = true;
  el('modal-backdrop').hidden = false;
  el('bm-title').focus();
}

function closeModal() {
  el('modal-backdrop').hidden = true;
}

async function submitForm(e) {
  e.preventDefault();
  const id = el('bm-id').value;
  const payload = {
    title: el('bm-title').value,
    url: el('bm-url').value,
    description: el('bm-description').value,
    tags: el('bm-tags').value,
    favorite: el('bm-favorite').checked,
  };
  const res = await api(id ? `/api/bookmarks/${id}` : '/api/bookmarks', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const errBox = el('form-errors');
    errBox.hidden = false;
    errBox.innerHTML = '<ul>' + (data.errors || ['Something went wrong.']).map((e) => `<li>${escapeHtml(e)}</li>`).join('') + '</ul>';
    return;
  }
  closeModal();
  refresh();
}

function refresh() {
  loadBookmarks();
  loadTags();
}

// Event wiring
el('new-btn').onclick = () => openModal(null);
el('cancel-btn').onclick = closeModal;
el('bookmark-form').onsubmit = submitForm;
el('modal-backdrop').onclick = (e) => { if (e.target === el('modal-backdrop')) closeModal(); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

let searchTimer;
el('search').oninput = (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value.trim();
    loadBookmarks();
  }, 200);
};

document.querySelectorAll('.filter').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('.filter').forEach((f) => f.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    refresh();
  };
});

// Initial load
(async function init() {
  await refresh();
  document.body.setAttribute('data-harness-ready', 'true');
})();
