// Bookmark Manager UI logic.
const state = { view: 'all', q: '', tag: '', sort: 'created', order: 'desc', current: null };

const el = (id) => document.getElementById(id);
const listEl = el('list');
const emptyEl = el('empty');
const overlay = el('overlay');

async function api(path, options = {}) {
  const res = await fetch(path, options);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

const EMPTY_MESSAGES = {
  all: 'No bookmarks yet. Paste a link above to save your first one.',
  unread: 'Nothing to read later. Mark bookmarks as unread to build your queue.',
  archive: 'Your archive is empty. Archived bookmarks appear here.',
  search: 'No bookmarks match your search or filter.',
};

function bookmarkCard(b) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.id = b.id;

  const thumb = b.previewImageUrl
    ? `<img class="card-thumb" src="${escapeHtml(b.previewImageUrl)}" alt="" onerror="this.classList.add('placeholder');this.removeAttribute('src');this.textContent='🔖'" />`
    : `<div class="card-thumb placeholder">🔖</div>`;

  const favicon = b.faviconUrl
    ? `<img class="card-favicon" src="${escapeHtml(b.faviconUrl)}" alt="" onerror="this.style.display='none'" />`
    : '';

  const tags = (b.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const unread = b.status === 'unread' ? '<span class="badge-unread">Unread</span>' : '';

  card.innerHTML = `
    ${thumb}
    <div class="card-body">
      <div class="card-head">${favicon}<h3 class="card-title">${escapeHtml(b.title)}</h3></div>
      <div class="card-url">${escapeHtml(b.address)}</div>
      ${b.description ? `<p class="card-desc">${escapeHtml(b.description)}</p>` : ''}
      <div class="card-meta">${unread}${tags}</div>
    </div>`;

  card.addEventListener('click', () => openPanel(b.id));
  return card;
}

async function refresh() {
  const params = new URLSearchParams({
    view: state.view,
    sort: state.sort,
    order: state.order,
  });
  if (state.q) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);

  const data = await api(`/api/bookmarks?${params.toString()}`);
  listEl.innerHTML = '';
  if (data.bookmarks.length === 0) {
    const key = state.q || state.tag ? 'search' : state.view;
    emptyEl.textContent = EMPTY_MESSAGES[key];
    emptyEl.hidden = false;
  } else {
    emptyEl.hidden = true;
    for (const b of data.bookmarks) listEl.appendChild(bookmarkCard(b));
  }
  await refreshTags();
}

async function refreshTags() {
  const { tags } = await api('/api/bookmarks/meta/tags');
  const sel = el('tag-filter');
  const current = state.tag;
  sel.innerHTML = '<option value="">All tags</option>';
  for (const t of tags) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    if (t.toLowerCase() === current.toLowerCase()) opt.selected = true;
    sel.appendChild(opt);
  }
}

// ---- Add form (US1 / US7) ----
el('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = el('add-input');
  const address = input.value.trim();
  const errBox = el('add-error');
  errBox.hidden = true;
  if (!address) return;
  const btn = el('add-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const result = await api('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    input.value = '';
    if (result.duplicate) {
      await refresh();
      openPanel(result.bookmark.id, 'This address is already saved — opened for editing.');
    } else {
      await refresh();
    }
  } catch (err) {
    errBox.textContent = err.message;
    errBox.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
});

// ---- Detail / edit panel ----
async function openPanel(id, notice) {
  const b = await api(`/api/bookmarks/${id}`);
  state.current = b;

  const noticeEl = el('panel-notice');
  if (notice) { noticeEl.textContent = notice; noticeEl.hidden = false; } else noticeEl.hidden = true;

  const preview = el('panel-preview');
  if (b.previewImageUrl) { preview.src = b.previewImageUrl; preview.hidden = false; }
  else preview.hidden = true;

  el('panel-title').textContent = b.title;
  const link = el('panel-link');
  link.href = b.address; link.textContent = b.address;

  el('edit-title').value = b.title;
  el('edit-description').value = b.description || '';
  el('edit-notes').value = b.notes || '';
  el('edit-tags').value = (b.tags || []).join(', ');

  const snap = el('snapshot-row');
  if (b.snapshotAvailable) {
    const label = b.snapshotType === 'pdf' ? 'Open saved PDF' : 'Open saved snapshot';
    snap.innerHTML = `📄 <a href="${b.snapshotUrl}" target="_blank" rel="noopener">${label}</a>`;
  } else {
    snap.innerHTML = '<span class="snapshot-none">No snapshot available for this bookmark.</span>';
  }

  el('toggle-read').textContent = b.status === 'unread' ? 'Mark as read' : 'Mark as unread';
  el('toggle-archive').textContent = b.archived ? 'Restore' : 'Archive';

  overlay.hidden = false;
}

function closePanel() { overlay.hidden = true; state.current = null; }
el('panel-close').addEventListener('click', closePanel);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });

el('save-edit').addEventListener('click', async () => {
  const id = state.current.id;
  const tags = el('edit-tags').value.split(',').map((t) => t.trim()).filter(Boolean);
  await api(`/api/bookmarks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: el('edit-title').value,
      description: el('edit-description').value,
      notes: el('edit-notes').value,
      tags,
    }),
  });
  closePanel();
  await refresh();
});

el('toggle-read').addEventListener('click', async () => {
  const b = state.current;
  const status = b.status === 'unread' ? 'read' : 'unread';
  await api(`/api/bookmarks/${b.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  closePanel();
  await refresh();
});

el('toggle-archive').addEventListener('click', async () => {
  const b = state.current;
  const action = b.archived ? 'restore' : 'archive';
  await api(`/api/bookmarks/${b.id}/${action}`, { method: 'POST' });
  closePanel();
  await refresh();
});

el('delete-btn').addEventListener('click', async () => {
  const b = state.current;
  if (!confirm('Permanently delete this bookmark? This cannot be undone.')) return;
  await api(`/api/bookmarks/${b.id}`, { method: 'DELETE' });
  closePanel();
  await refresh();
});

// ---- Views / toolbar ----
document.querySelectorAll('.view-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.view-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    state.view = tab.dataset.view;
    refresh();
  });
});

let searchTimer;
el('search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = e.target.value.trim(); refresh(); }, 200);
});
el('tag-filter').addEventListener('change', (e) => { state.tag = e.target.value; refresh(); });
el('sort').addEventListener('change', (e) => {
  const [sort, order] = e.target.value.split(':');
  state.sort = sort; state.order = order; refresh();
});

// ---- Import (US8) ----
el('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const result = await api('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/html' },
      body: text,
    });
    alert(
      `Import complete.\nImported: ${result.imported}\nSkipped duplicates: ${result.skippedDuplicates}\nInvalid: ${result.invalid}`
    );
    await refresh();
  } catch (err) {
    alert(`Import failed: ${err.message}`);
  } finally {
    e.target.value = '';
  }
});

// ---- Initial load ----
(async function init() {
  try {
    await refresh();
  } catch (err) {
    emptyEl.textContent = 'Could not load bookmarks.';
    emptyEl.hidden = false;
  }
  // Ready only after the initial view + data have loaded (harness marker).
  el('app').setAttribute('data-harness-ready', 'true');
})();
