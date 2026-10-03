const state = { q: '', tag: '' };

const els = {
  list: document.getElementById('list'),
  empty: document.getElementById('empty'),
  tagList: document.getElementById('tagList'),
  search: document.getElementById('search'),
  activeFilter: document.getElementById('activeFilter'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modalTitle'),
  form: document.getElementById('form'),
  addBtn: document.getElementById('addBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  f: {
    id: document.getElementById('bmId'),
    url: document.getElementById('url'),
    title: document.getElementById('title'),
    description: document.getElementById('description'),
    tags: document.getElementById('tags'),
  },
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Request failed');
  }
  return res.status === 204 ? null : res.json();
}

async function load() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);
  const [items, tags] = await Promise.all([
    api('/api/bookmarks?' + params.toString()),
    api('/api/tags'),
  ]);
  renderTags(tags);
  renderList(items);
  renderActiveFilter();
}

function renderActiveFilter() {
  if (state.tag) {
    els.activeFilter.hidden = false;
    els.activeFilter.innerHTML = `Filtering by tag <strong>#${esc(state.tag)}</strong><button id="clearTag">Clear</button>`;
    document.getElementById('clearTag').onclick = () => { state.tag = ''; load(); };
  } else {
    els.activeFilter.hidden = true;
  }
}

function renderTags(tags) {
  els.tagList.innerHTML = '';
  const allLi = document.createElement('li');
  allLi.textContent = 'All';
  allLi.className = state.tag ? '' : 'active';
  allLi.onclick = () => { state.tag = ''; load(); };
  els.tagList.appendChild(allLi);

  for (const t of tags) {
    const li = document.createElement('li');
    if (t.name === state.tag) li.className = 'active';
    li.innerHTML = `<span>#${esc(t.name)}</span><span class="count">${t.count}</span>`;
    li.onclick = () => { state.tag = t.name; load(); };
    els.tagList.appendChild(li);
  }
}

function renderList(items) {
  els.list.innerHTML = '';
  els.empty.hidden = items.length !== 0;
  if (items.length === 0 && (state.q || state.tag)) {
    els.empty.hidden = false;
    els.empty.textContent = 'No bookmarks match your filter.';
  } else if (items.length === 0) {
    els.empty.textContent = 'No bookmarks yet. Add your first one!';
  }

  for (const b of items) {
    const card = document.createElement('div');
    card.className = 'card';
    const tagsHtml = b.tags.map((t) => `<span class="tag" data-tag="${esc(t)}">#${esc(t)}</span>`).join('');
    card.innerHTML = `
      <a class="title" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title)}</a>
      <div class="url">${esc(b.url)}</div>
      ${b.description ? `<div class="desc">${esc(b.description)}</div>` : ''}
      <div class="tags">${tagsHtml}</div>
      <div class="actions">
        <button class="edit">Edit</button>
        <button class="del">Delete</button>
      </div>`;
    card.querySelectorAll('.tag').forEach((el) => {
      el.onclick = () => { state.tag = el.dataset.tag; load(); };
    });
    card.querySelector('.edit').onclick = () => openModal(b);
    card.querySelector('.del').onclick = () => removeBookmark(b);
    els.list.appendChild(card);
  }
}

function openModal(b) {
  els.form.reset();
  if (b) {
    els.modalTitle.textContent = 'Edit bookmark';
    els.f.id.value = b.id;
    els.f.url.value = b.url;
    els.f.title.value = b.title;
    els.f.description.value = b.description || '';
    els.f.tags.value = b.tags.join(', ');
  } else {
    els.modalTitle.textContent = 'Add bookmark';
    els.f.id.value = '';
  }
  els.modal.hidden = false;
  els.f.url.focus();
}

function closeModal() { els.modal.hidden = true; }

async function removeBookmark(b) {
  if (!confirm(`Delete "${b.title}"?`)) return;
  await api('/api/bookmarks/' + b.id, { method: 'DELETE' });
  load();
}

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    url: els.f.url.value,
    title: els.f.title.value,
    description: els.f.description.value,
    tags: els.f.tags.value,
  };
  const id = els.f.id.value;
  try {
    if (id) {
      await api('/api/bookmarks/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    closeModal();
    load();
  } catch (err) {
    alert(err.message);
  }
});

els.addBtn.onclick = () => openModal(null);
els.cancelBtn.onclick = closeModal;
els.modal.addEventListener('click', (e) => { if (e.target === els.modal) closeModal(); });

let searchTimer;
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = els.search.value.trim(); load(); }, 200);
});

load().then(() => {
  document.body.setAttribute('data-harness-ready', 'true');
});
