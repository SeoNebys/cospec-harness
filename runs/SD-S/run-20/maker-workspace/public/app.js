// Bookmark Manager frontend. All user-supplied content is inserted via
// textContent / DOM node creation and safe attribute assignment — never via
// innerHTML — so stored text can never alter the page (FR-014).

const els = {
  root: document.getElementById('app'),
  saveForm: document.getElementById('save-form'),
  url: document.getElementById('url-input'),
  title: document.getElementById('title-input'),
  tags: document.getElementById('tags-input'),
  formMessage: document.getElementById('form-message'),
  search: document.getElementById('search-input'),
  tagFilter: document.getElementById('tag-filter'),
  clearFilters: document.getElementById('clear-filters'),
  list: document.getElementById('bookmark-list'),
  emptyState: document.getElementById('empty-state'),
  noResults: document.getElementById('no-results'),
  editDialog: document.getElementById('edit-dialog'),
  editForm: document.getElementById('edit-form'),
  editId: document.getElementById('edit-id'),
  editUrl: document.getElementById('edit-url'),
  editTitle: document.getElementById('edit-title'),
  editTags: document.getElementById('edit-tags'),
  editMessage: document.getElementById('edit-message'),
  editCancel: document.getElementById('edit-cancel'),
};

// Tracks whether any bookmarks exist at all, so we can distinguish the
// "no bookmarks yet" empty state from the "no matching bookmarks" state.
let totalBookmarks = 0;

function showMessage(el, text, kind) {
  el.textContent = text;
  el.className = `form-message ${kind}`;
  el.hidden = false;
}

function hideMessage(el) {
  el.hidden = true;
  el.textContent = '';
}

function currentFilters() {
  return {
    q: els.search.value.trim(),
    tag: els.tagFilter.value,
  };
}

function filtersActive() {
  const { q, tag } = currentFilters();
  return Boolean(q || tag);
}

async function fetchBookmarks() {
  const { q, tag } = currentFilters();
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (tag) params.set('tag', tag);
  const qs = params.toString();
  const res = await fetch(`/api/bookmarks${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to load bookmarks');
  return res.json();
}

async function fetchTags() {
  const res = await fetch('/api/tags');
  if (!res.ok) throw new Error('Failed to load tags');
  return res.json();
}

async function fetchTotal() {
  // Unfiltered count, to decide which empty message to show.
  const res = await fetch('/api/bookmarks');
  if (!res.ok) throw new Error('Failed to load bookmarks');
  const data = await res.json();
  return data.total;
}

function makeBookmarkNode(bookmark) {
  const li = document.createElement('li');
  li.className = 'bookmark-item';
  li.dataset.id = String(bookmark.id);

  const link = document.createElement('a');
  link.className = 'bookmark-title';
  link.href = bookmark.url; // validated http/https url from the server
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = bookmark.title;
  li.appendChild(link);

  const urlLine = document.createElement('span');
  urlLine.className = 'bookmark-url';
  urlLine.textContent = bookmark.url;
  urlLine.title = bookmark.url;
  li.appendChild(urlLine);

  if (bookmark.tags.length > 0) {
    const tagWrap = document.createElement('div');
    tagWrap.className = 'bookmark-tags';
    for (const tag of bookmark.tags) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.textContent = tag;
      tagWrap.appendChild(chip);
    }
    li.appendChild(tagWrap);
  }

  const actions = document.createElement('div');
  actions.className = 'bookmark-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn link';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => openEdit(bookmark));
  actions.appendChild(editBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn link danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => confirmDelete(bookmark));
  actions.appendChild(deleteBtn);

  li.appendChild(actions);
  return li;
}

function renderList(bookmarks) {
  els.list.replaceChildren();
  for (const bookmark of bookmarks) {
    els.list.appendChild(makeBookmarkNode(bookmark));
  }

  const hasResults = bookmarks.length > 0;
  els.list.hidden = !hasResults;

  if (hasResults) {
    els.emptyState.hidden = true;
    els.noResults.hidden = true;
  } else if (totalBookmarks === 0) {
    els.emptyState.hidden = false;
    els.noResults.hidden = true;
  } else {
    els.emptyState.hidden = true;
    els.noResults.hidden = false;
  }
}

function renderTagOptions(tags) {
  const selected = els.tagFilter.value;
  els.tagFilter.replaceChildren();

  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'All tags';
  els.tagFilter.appendChild(allOption);

  for (const tag of tags) {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = tag;
    els.tagFilter.appendChild(opt);
  }
  // Preserve the current selection if it still exists.
  els.tagFilter.value = tags.includes(selected) ? selected : '';
}

async function refresh() {
  const [{ bookmarks }, { tags }, total] = await Promise.all([
    fetchBookmarks(),
    fetchTags(),
    fetchTotal(),
  ]);
  totalBookmarks = total;
  renderTagOptions(tags);
  renderList(bookmarks);
  els.clearFilters.hidden = !filtersActive();
}

// --- Save (Story 1) ---
els.saveForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage(els.formMessage);

  const url = els.url.value.trim();
  if (!url) {
    showMessage(els.formMessage, 'Enter a valid web address.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        title: els.title.value,
        tags: els.tags.value,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      showMessage(
        els.formMessage,
        data.message || 'Could not save the bookmark.',
        'error'
      );
      return;
    }

    els.saveForm.reset();
    if (data.warning === 'duplicate_url') {
      showMessage(
        els.formMessage,
        'Heads up: this address was already saved. Saved it again anyway.',
        'warning'
      );
    }
    await refresh();
  } catch {
    showMessage(els.formMessage, 'Could not reach the server.', 'error');
  }
});

// --- Edit (Story 3) ---
function openEdit(bookmark) {
  hideMessage(els.editMessage);
  els.editId.value = String(bookmark.id);
  els.editUrl.value = bookmark.url;
  els.editTitle.value = bookmark.title;
  els.editTags.value = bookmark.tags.join(', ');
  els.editDialog.showModal();
}

els.editCancel.addEventListener('click', () => {
  els.editDialog.close();
});

els.editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage(els.editMessage);

  const id = Number(els.editId.value);
  try {
    const res = await fetch(`/api/bookmarks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: els.editUrl.value.trim(),
        title: els.editTitle.value,
        tags: els.editTags.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(
        els.editMessage,
        data.message || 'Could not update the bookmark.',
        'error'
      );
      return;
    }
    els.editDialog.close();
    await refresh();
  } catch {
    showMessage(els.editMessage, 'Could not reach the server.', 'error');
  }
});

// --- Delete (Story 3) ---
async function confirmDelete(bookmark) {
  const ok = window.confirm(`Delete "${bookmark.title}"? This cannot be undone.`);
  if (!ok) return;
  try {
    const res = await fetch(`/api/bookmarks/${bookmark.id}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 204) {
      throw new Error('delete failed');
    }
    await refresh();
  } catch {
    showMessage(els.formMessage, 'Could not delete the bookmark.', 'error');
  }
}

// --- Search & tag filter (Story 4) ---
let searchDebounce;
els.search.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    refresh().catch(() => {});
  }, 150);
});

els.tagFilter.addEventListener('change', () => {
  refresh().catch(() => {});
});

els.clearFilters.addEventListener('click', () => {
  els.search.value = '';
  els.tagFilter.value = '';
  refresh().catch(() => {});
});

// --- Initial load ---
async function init() {
  try {
    await refresh();
  } catch {
    showMessage(els.formMessage, 'Could not load bookmarks.', 'error');
  } finally {
    // Mark ready once the initial UI + data (including empty state) are shown.
    els.root.setAttribute('data-harness-ready', 'true');
  }
}

init();
