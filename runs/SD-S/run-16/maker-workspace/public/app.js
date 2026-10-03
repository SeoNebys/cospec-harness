// Bookmark Manager frontend (US1 add + background fill, US2 browse/search/filter,
// US3 edit/delete + duplicate-to-edit).

const api = {
  async list({ q = '', tag = '' } = {}) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (tag) params.set('tag', tag);
    const res = await fetch(`/api/bookmarks?${params.toString()}`);
    return (await res.json()).bookmarks;
  },
  async get(id) {
    const res = await fetch(`/api/bookmarks/${id}`);
    return res.ok ? res.json() : null;
  },
  async create(body) {
    const res = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  },
  async update(id, body) {
    const res = await fetch(`/api/bookmarks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  },
  async remove(id) {
    const res = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
    return res.status === 204;
  },
  async tags() {
    const res = await fetch('/api/tags');
    return (await res.json()).tags;
  },
};

const el = (id) => document.getElementById(id);
const parseTags = (str) =>
  (str || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

const state = { q: '', tag: '', pollers: new Map() };

// --- Rendering -----------------------------------------------------------

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function cardHtml(b) {
  const enriching = b.enrichmentStatus === 'pending';
  const preview = b.previewImageUrl
    ? `<img class="preview" src="${escapeHtml(b.previewImageUrl)}" alt="" loading="lazy" onerror="this.remove()" />`
    : '<div class="preview placeholder"></div>';
  const favicon = b.faviconUrl
    ? `<img class="favicon" src="${escapeHtml(b.faviconUrl)}" alt="" onerror="this.remove()" />`
    : '';
  const tags = (b.tags || [])
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join('');
  const statusBadge = enriching
    ? '<span class="badge fetching">fetching details…</span>'
    : b.enrichmentStatus === 'failed'
    ? '<span class="badge failed">preview unavailable</span>'
    : '';

  return `
    <article class="card" data-id="${b.id}" data-status="${b.enrichmentStatus}">
      ${preview}
      <div class="card-body">
        <h3 class="card-title">
          ${favicon}
          <a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.title)}</a>
        </h3>
        <p class="card-url">${escapeHtml(b.url)}</p>
        ${b.description ? `<p class="card-desc">${escapeHtml(b.description)}</p>` : ''}
        ${b.notes ? `<p class="card-notes">📝 ${escapeHtml(b.notes)}</p>` : ''}
        <div class="card-meta">${tags} ${statusBadge}</div>
      </div>
      <div class="card-actions">
        <button class="edit-btn" data-id="${b.id}" aria-label="Edit">✏️</button>
      </div>
    </article>`;
}

function renderList(bookmarks) {
  const list = el('list');
  const empty = el('empty-state');
  if (bookmarks.length === 0) {
    list.innerHTML = '';
    empty.hidden = false;
    empty.innerHTML =
      state.q || state.tag
        ? '<p>No bookmarks match your search.</p>'
        : '<p>No bookmarks yet. Save your first link above ☝️</p>';
    return;
  }
  empty.hidden = true;
  list.innerHTML = bookmarks.map(cardHtml).join('');
  // Start polling any pending items so details fill in without a manual reload.
  for (const b of bookmarks) {
    if (b.enrichmentStatus === 'pending') startPolling(b.id);
  }
}

async function refresh() {
  const bookmarks = await api.list({ q: state.q, tag: state.tag });
  renderList(bookmarks);
  await refreshTagFilter();
}

async function refreshTagFilter() {
  const tags = await api.tags();
  const sel = el('tag-filter');
  const current = sel.value;
  sel.innerHTML =
    '<option value="">All tags</option>' +
    tags.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  sel.value = tags.includes(current) ? current : '';
}

// --- Background fill polling --------------------------------------------

function startPolling(id) {
  if (state.pollers.has(id)) return;
  const timer = setInterval(async () => {
    const b = await api.get(id);
    if (!b) {
      stopPolling(id);
      return;
    }
    if (b.enrichmentStatus !== 'pending') {
      stopPolling(id);
      const card = document.querySelector(`.card[data-id="${id}"]`);
      if (card) card.outerHTML = cardHtml(b);
    }
  }, 1000);
  state.pollers.set(id, timer);
}

function stopPolling(id) {
  const t = state.pollers.get(id);
  if (t) clearInterval(t);
  state.pollers.delete(id);
}

// --- Add flow (US1) ------------------------------------------------------

async function onAdd(e) {
  e.preventDefault();
  const errBox = el('add-error');
  errBox.hidden = true;
  const url = el('add-url').value.trim();
  if (!url) return;

  const { status, data } = await api.create({
    url,
    notes: el('add-notes').value.trim() || null,
    tags: parseTags(el('add-tags').value),
  });

  if (status === 201) {
    el('add-form').reset();
    // Optimistically show it immediately (already pending), then refresh list.
    await refresh();
  } else if (status === 409 && data.existing) {
    // Duplicate -> open the existing bookmark to edit (FR-011).
    openEdit(data.existing);
  } else if (status === 400) {
    errBox.textContent = data.message || 'Enter a valid web address.';
    errBox.hidden = false;
  } else {
    errBox.textContent = 'Could not save the bookmark. Please try again.';
    errBox.hidden = false;
  }
}

// --- Edit / delete flow (US3) -------------------------------------------

let editingId = null;

function openEdit(b) {
  editingId = b.id;
  el('edit-url').value = b.url;
  el('edit-title').value = b.title ?? '';
  el('edit-description').value = b.description ?? '';
  el('edit-notes').value = b.notes ?? '';
  el('edit-tags').value = (b.tags || []).join(', ');
  el('edit-error').hidden = true;
  el('edit-dialog').showModal();
}

async function onEditSave() {
  const errBox = el('edit-error');
  errBox.hidden = true;
  const { status, data } = await api.update(editingId, {
    url: el('edit-url').value.trim(),
    title: el('edit-title').value.trim(),
    description: el('edit-description').value.trim(),
    notes: el('edit-notes').value.trim(),
    tags: parseTags(el('edit-tags').value),
  });
  if (status === 200) {
    el('edit-dialog').close();
    await refresh();
  } else if (status === 409) {
    errBox.textContent = 'Another bookmark already uses that address.';
    errBox.hidden = false;
  } else if (status === 400) {
    errBox.textContent = data.message || 'Enter a valid web address.';
    errBox.hidden = false;
  } else {
    errBox.textContent = 'Could not save changes.';
    errBox.hidden = false;
  }
}

async function onEditDelete() {
  if (!confirm('Delete this bookmark? This cannot be undone.')) return;
  const ok = await api.remove(editingId);
  if (ok) {
    el('edit-dialog').close();
    await refresh();
  }
}

// --- Wiring --------------------------------------------------------------

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function init() {
  el('add-form').addEventListener('submit', onAdd);

  el('search').addEventListener(
    'input',
    debounce((e) => {
      state.q = e.target.value.trim();
      refresh();
    }, 200)
  );

  el('tag-filter').addEventListener('change', (e) => {
    state.tag = e.target.value;
    refresh();
  });

  // Edit button (event delegation on the list).
  el('list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.edit-btn');
    if (!btn) return;
    const b = await api.get(Number(btn.dataset.id));
    if (b) openEdit(b);
  });

  el('edit-save').addEventListener('click', onEditSave);
  el('edit-delete').addEventListener('click', onEditDelete);
  el('edit-cancel').addEventListener('click', () => el('edit-dialog').close());

  // Initial load, then mark the app presentation-ready.
  refresh().finally(() => {
    el('app').setAttribute('data-harness-ready', 'true');
  });
}

init();
