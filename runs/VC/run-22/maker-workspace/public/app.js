const state = {
  search: '',
  tag: '',
  favorite: false,
};

const els = {
  list: document.getElementById('list'),
  empty: document.getElementById('empty'),
  search: document.getElementById('search'),
  tagList: document.getElementById('tag-list'),
  filters: document.querySelectorAll('.filter'),
  activeTagBar: document.getElementById('active-tag-bar'),
  activeTagName: document.getElementById('active-tag-name'),
  clearTag: document.getElementById('clear-tag'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  form: document.getElementById('bookmark-form'),
  fId: document.getElementById('bm-id'),
  fUrl: document.getElementById('bm-url'),
  fTitle: document.getElementById('bm-title'),
  fDesc: document.getElementById('bm-description'),
  fTags: document.getElementById('bm-tags'),
  fFav: document.getElementById('bm-favorite'),
  formError: document.getElementById('form-error'),
  newBtn: document.getElementById('new-btn'),
  cancelBtn: document.getElementById('cancel-btn'),
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function hostname(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function faviconUrl(url) {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
  } catch { return ''; }
}

function bookmarkCard(b) {
  const tags = b.tags.map((t) =>
    `<span class="tag-pill" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`
  ).join('');
  return `
    <article class="card" data-id="${b.id}">
      <div class="card-head">
        <img class="favicon" src="${faviconUrl(b.url)}" alt="" onerror="this.style.visibility='hidden'" />
        <div class="card-title">
          <a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.title)}</a>
          <div class="card-url">${escapeHtml(hostname(b.url))}</div>
        </div>
        <button class="star-btn ${b.favorite ? 'on' : ''}" data-action="fav" title="Toggle favorite">★</button>
      </div>
      ${b.description ? `<p class="card-desc">${escapeHtml(b.description)}</p>` : ''}
      ${tags ? `<div class="card-tags">${tags}</div>` : ''}
      <div class="card-actions">
        <button data-action="edit">Edit</button>
        <button class="del" data-action="delete">Delete</button>
      </div>
    </article>
  `;
}

async function refresh() {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.tag) params.set('tag', state.tag);
  if (state.favorite) params.set('favorite', '1');
  const bookmarks = await api(`/api/bookmarks?${params.toString()}`);

  els.list.innerHTML = bookmarks.map(bookmarkCard).join('');
  els.empty.hidden = bookmarks.length > 0;

  els.activeTagBar.hidden = !state.tag;
  els.activeTagName.textContent = state.tag;

  await refreshTags();
}

async function refreshTags() {
  const tags = await api('/api/tags');
  els.tagList.innerHTML = tags.map((t) =>
    `<li data-tag="${escapeHtml(t.name)}" class="${state.tag === t.name ? 'active' : ''}">
       <span>${escapeHtml(t.name)}</span><span class="tag-count">${t.count}</span>
     </li>`
  ).join('') || '<li style="cursor:default;color:var(--muted)">No tags yet</li>';
}

// ---- Modal handling ----
function openModal(bookmark = null) {
  els.formError.hidden = true;
  if (bookmark) {
    els.modalTitle.textContent = 'Edit bookmark';
    els.fId.value = bookmark.id;
    els.fUrl.value = bookmark.url;
    els.fTitle.value = bookmark.title;
    els.fDesc.value = bookmark.description;
    els.fTags.value = bookmark.tags.join(', ');
    els.fFav.checked = bookmark.favorite;
  } else {
    els.modalTitle.textContent = 'New bookmark';
    els.form.reset();
    els.fId.value = '';
  }
  els.modal.hidden = false;
  els.fUrl.focus();
}

function closeModal() {
  els.modal.hidden = true;
}

els.form.addEventListener('submit', async (e) => {
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
    } else {
      await api('/api/bookmarks', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeModal();
    await refresh();
  } catch (err) {
    els.formError.textContent = err.message;
    els.formError.hidden = false;
  }
});

// ---- Event wiring ----
els.newBtn.addEventListener('click', () => openModal());
els.cancelBtn.addEventListener('click', closeModal);
els.modal.addEventListener('click', (e) => { if (e.target === els.modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !els.modal.hidden) closeModal(); });

let searchTimer;
els.search.addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value.trim();
    refresh();
  }, 200);
});

els.filters.forEach((btn) => {
  btn.addEventListener('click', () => {
    els.filters.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.favorite = btn.dataset.filter === 'favorites';
    refresh();
  });
});

els.clearTag.addEventListener('click', () => {
  state.tag = '';
  refresh();
});

els.tagList.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-tag]');
  if (!li) return;
  const tag = li.dataset.tag;
  state.tag = state.tag === tag ? '' : tag;
  refresh();
});

els.list.addEventListener('click', async (e) => {
  const tagPill = e.target.closest('.tag-pill');
  if (tagPill) {
    state.tag = tagPill.dataset.tag;
    refresh();
    return;
  }
  const card = e.target.closest('.card');
  if (!card) return;
  const id = Number(card.dataset.id);
  const action = e.target.dataset.action;
  if (action === 'delete') {
    if (confirm('Delete this bookmark?')) {
      await api(`/api/bookmarks/${id}`, { method: 'DELETE' });
      await refresh();
    }
  } else if (action === 'edit') {
    const bookmark = await api(`/api/bookmarks/${id}`);
    openModal(bookmark);
  } else if (action === 'fav') {
    const on = e.target.classList.contains('on');
    await api(`/api/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify({ favorite: !on }) });
    await refresh();
  }
});

// ---- Init ----
(async function init() {
  try {
    await refresh();
  } catch (err) {
    console.error(err);
  } finally {
    document.body.setAttribute('data-harness-ready', 'true');
  }
})();
