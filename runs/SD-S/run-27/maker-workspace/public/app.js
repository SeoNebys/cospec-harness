const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');
const tagFiltersEl = document.getElementById('tag-filters');
const dialog = document.getElementById('form-dialog');
const formTitle = document.getElementById('form-title');
const idField = document.getElementById('bookmark-id');
const addressField = document.getElementById('f-address');
const titleField = document.getElementById('f-title');
const noteField = document.getElementById('f-note');
const tagsField = document.getElementById('f-tags');
const errorEl = document.getElementById('form-error');
const warningEl = document.getElementById('form-warning');

let state = { q: '', tag: '' };
let forceSave = false; // set when the user confirms a duplicate save

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

async function refresh() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);
  const { bookmarks } = await api(`/api/bookmarks?${params.toString()}`);
  const { tags } = await api('/api/tags');
  renderTags(tags);
  renderList(bookmarks);
  document.body.setAttribute('data-harness-ready', 'true');
}

function renderTags(tags) {
  tagFiltersEl.innerHTML = '';
  if (!tags.length) return;
  const all = document.createElement('button');
  all.className = 'tag-chip' + (state.tag === '' ? ' active' : '');
  all.textContent = 'All';
  all.onclick = () => { state.tag = ''; refresh(); };
  tagFiltersEl.appendChild(all);

  for (const tag of tags) {
    const chip = document.createElement('button');
    chip.className = 'tag-chip' + (state.tag === tag ? ' active' : '');
    chip.textContent = tag;
    chip.onclick = () => { state.tag = state.tag === tag ? '' : tag; refresh(); };
    tagFiltersEl.appendChild(chip);
  }
}

function renderList(bookmarks) {
  listEl.innerHTML = '';
  if (!bookmarks.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = (state.q || state.tag)
      ? 'No bookmarks match your search.'
      : 'No bookmarks yet. Add your first one!';
    listEl.appendChild(empty);
    return;
  }

  for (const b of bookmarks) {
    const card = document.createElement('div');
    card.className = 'bookmark';
    const label = b.title || b.address;
    const tagsHtml = b.tags
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join('');
    card.innerHTML = `
      <a class="title" href="${escapeHtml(b.address)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>
      <span class="addr">${escapeHtml(b.address)}</span>
      ${b.note ? `<div class="note">${escapeHtml(b.note)}</div>` : ''}
      ${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ''}
      <div class="row-actions">
        <button class="btn link" data-edit="${b.id}">Edit</button>
        <button class="btn danger" data-delete="${b.id}">Delete</button>
      </div>`;
    listEl.appendChild(card);
  }
}

function openForm(bookmark) {
  errorEl.hidden = true;
  warningEl.hidden = true;
  forceSave = false;
  if (bookmark) {
    formTitle.textContent = 'Edit bookmark';
    idField.value = bookmark.id;
    addressField.value = bookmark.address;
    titleField.value = bookmark.title || '';
    noteField.value = bookmark.note || '';
    tagsField.value = bookmark.tags.join(', ');
  } else {
    formTitle.textContent = 'Add bookmark';
    idField.value = '';
    addressField.value = '';
    titleField.value = '';
    noteField.value = '';
    tagsField.value = '';
  }
  dialog.showModal();
  addressField.focus();
}

function parseTags(value) {
  return value.split(',').map((t) => t.trim()).filter(Boolean);
}

async function save() {
  errorEl.hidden = true;
  const payload = {
    address: addressField.value,
    title: titleField.value,
    note: noteField.value,
    tags: parseTags(tagsField.value),
  };
  const id = idField.value;

  try {
    if (id) {
      await api(`/api/bookmarks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      const { duplicateOf } = await api('/api/bookmarks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (duplicateOf && !forceSave) {
        // Non-blocking duplicate warning: the bookmark was already saved,
        // but let the user know a matching address already existed.
        warningEl.textContent =
          'Heads up: this address was already bookmarked. It has been saved again.';
        warningEl.hidden = false;
      }
    }
    dialog.close();
    await refresh();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

// Event wiring
document.getElementById('add-btn').onclick = () => openForm(null);
document.getElementById('cancel-btn').onclick = () => dialog.close();
document.getElementById('save-btn').onclick = save;

searchEl.addEventListener('input', (e) => {
  state.q = e.target.value;
  refresh();
});

listEl.addEventListener('click', async (e) => {
  const editId = e.target.getAttribute('data-edit');
  const delId = e.target.getAttribute('data-delete');
  if (editId) {
    const { bookmark } = await api(`/api/bookmarks/${editId}`);
    openForm(bookmark);
  } else if (delId) {
    if (confirm('Delete this bookmark? This cannot be undone.')) {
      await api(`/api/bookmarks/${delId}`, { method: 'DELETE' });
      await refresh();
    }
  }
});

refresh();
