// Bookmark Manager UI logic. Talks to the JSON API in src/server.js.
// Covers US1 (save), US2 (browse/open), US3 (edit/delete), US4 (search/tags).

const listEl = document.getElementById('bookmark-list');
const emptyState = document.getElementById('empty-state');
const noResults = document.getElementById('no-results');
const listRegion = document.getElementById('list-region');
const searchInput = document.getElementById('search');
const tagFilter = document.getElementById('tag-filter');
const clearFiltersBtn = document.getElementById('clear-filters');

const formOverlay = document.getElementById('form-overlay');
const form = document.getElementById('bookmark-form');
const formTitle = document.getElementById('form-title');
const idField = document.getElementById('bookmark-id');
const urlField = document.getElementById('field-url');
const titleField = document.getElementById('field-title');
const notesField = document.getElementById('field-notes');
const tagsField = document.getElementById('field-tags');
const formError = document.getElementById('form-error');
const dupWarning = document.getElementById('dup-warning');
const dupMessage = document.getElementById('dup-message');
const formSubmit = document.getElementById('form-submit');

const confirmOverlay = document.getElementById('confirm-overlay');
const confirmMessage = document.getElementById('confirm-message');
let pendingDeleteId = null;
let pendingConfirmDuplicate = false;

// ---- API helpers -----------------------------------------------------------

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Request failed');
    err.code = data.error;
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Rendering -------------------------------------------------------------

function bookmarkNode(bm) {
  const li = document.createElement('li');
  li.className = 'bookmark';
  li.dataset.id = bm.id;

  const tagsHtml = bm.tags.length
    ? `<div class="tag-row">${bm.tags
        .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
        .join('')}</div>`
    : '';
  const notesHtml = bm.notes
    ? `<p class="bookmark-notes">${escapeHtml(bm.notes)}</p>`
    : '';

  li.innerHTML = `
    <div class="bookmark-main">
      <a class="bookmark-title" href="${escapeHtml(bm.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(bm.title)}">${escapeHtml(bm.title)}</a>
      <span class="bookmark-url" title="${escapeHtml(bm.url)}">${escapeHtml(bm.url)}</span>
      ${notesHtml}
      ${tagsHtml}
    </div>
    <div class="bookmark-actions">
      <button class="btn btn-small" type="button" data-action="edit">Edit</button>
      <button class="btn btn-small" type="button" data-action="delete">Delete</button>
    </div>
  `;
  return li;
}

let lastTotal = 0;

async function refresh() {
  const params = new URLSearchParams();
  const q = searchInput.value.trim();
  const tag = tagFilter.value;
  if (q) params.set('q', q);
  if (tag) params.set('tag', tag);

  const { bookmarks, total, matched } = await api(`/api/bookmarks?${params.toString()}`);
  lastTotal = total;

  listEl.innerHTML = '';
  for (const bm of bookmarks) listEl.appendChild(bookmarkNode(bm));

  const filtering = Boolean(q || tag);
  emptyState.hidden = total !== 0;
  noResults.hidden = !(total > 0 && matched === 0 && filtering);
  clearFiltersBtn.hidden = !filtering;

  markReady();
}

async function refreshTags() {
  const { tags } = await api('/api/tags');
  const current = tagFilter.value;
  tagFilter.innerHTML = '<option value="">All tags</option>';
  for (const t of tags) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    tagFilter.appendChild(opt);
  }
  if (tags.includes(current)) tagFilter.value = current;
}

let readyMarked = false;
function markReady() {
  if (readyMarked) return;
  readyMarked = true;
  listRegion.setAttribute('data-harness-ready', 'true');
}

// ---- Add / edit form -------------------------------------------------------

function openForm(bm = null) {
  form.reset();
  formError.hidden = true;
  dupWarning.hidden = true;
  pendingConfirmDuplicate = false;
  formSubmit.textContent = 'Save';

  if (bm) {
    formTitle.textContent = 'Edit bookmark';
    idField.value = bm.id;
    urlField.value = bm.url;
    titleField.value = bm.title;
    notesField.value = bm.notes;
    tagsField.value = bm.tags.join(', ');
  } else {
    formTitle.textContent = 'Add bookmark';
    idField.value = '';
  }
  formOverlay.hidden = false;
  urlField.focus();
}

function closeForm() {
  formOverlay.hidden = true;
}

function parseTags(value) {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.hidden = true;

  const id = idField.value;
  const payload = {
    url: urlField.value,
    title: titleField.value,
    notes: notesField.value,
    tags: parseTags(tagsField.value),
  };

  try {
    if (id) {
      await api(`/api/bookmarks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/bookmarks', {
        method: 'POST',
        body: JSON.stringify({ ...payload, confirmDuplicate: pendingConfirmDuplicate }),
      });
    }
    closeForm();
    await Promise.all([refresh(), refreshTags()]);
  } catch (err) {
    if (err.status === 409 && err.code === 'already_saved') {
      // Offer to save the duplicate anyway.
      pendingConfirmDuplicate = true;
      dupMessage.textContent = err.message;
      dupWarning.hidden = false;
      formSubmit.textContent = 'Save anyway';
      return;
    }
    formError.textContent = err.message;
    formError.hidden = false;
  }
});

// ---- Delete confirmation ---------------------------------------------------

function openConfirm(id, title) {
  pendingDeleteId = id;
  confirmMessage.textContent = `"${title}" will be permanently removed. This cannot be undone.`;
  confirmOverlay.hidden = false;
}

function closeConfirm() {
  pendingDeleteId = null;
  confirmOverlay.hidden = true;
}

document.getElementById('confirm-delete').addEventListener('click', async () => {
  if (pendingDeleteId == null) return;
  await api(`/api/bookmarks/${pendingDeleteId}`, { method: 'DELETE' });
  closeConfirm();
  await Promise.all([refresh(), refreshTags()]);
});

// ---- Event wiring ----------------------------------------------------------

document.getElementById('add-btn').addEventListener('click', () => openForm());
document.getElementById('form-cancel').addEventListener('click', closeForm);
document.getElementById('confirm-cancel').addEventListener('click', closeConfirm);

listEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const li = btn.closest('.bookmark');
  const id = Number(li.dataset.id);
  if (btn.dataset.action === 'edit') {
    const bm = await api(`/api/bookmarks/${id}`);
    openForm(bm);
  } else if (btn.dataset.action === 'delete') {
    const title = li.querySelector('.bookmark-title').textContent;
    openConfirm(id, title);
  }
});

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refresh, 180);
});
tagFilter.addEventListener('change', refresh);

function clearFilters() {
  searchInput.value = '';
  tagFilter.value = '';
  refresh();
}
clearFiltersBtn.addEventListener('click', clearFilters);

document.body.addEventListener('click', (e) => {
  if (e.target.matches('[data-open-add]')) openForm();
  if (e.target.matches('[data-clear-filters]')) clearFilters();
});

// Close overlays when clicking the backdrop.
for (const overlay of [formOverlay, confirmOverlay]) {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });
}

// ---- Boot ------------------------------------------------------------------

(async function init() {
  try {
    await Promise.all([refresh(), refreshTags()]);
  } catch (err) {
    console.error(err);
    // Still mark ready so the harness/user sees a usable (if empty) page.
    markReady();
  }
})();
