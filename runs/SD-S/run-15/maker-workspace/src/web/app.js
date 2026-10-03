const state = {
  view: 'active', // 'active' | 'unread' | 'archive'
  q: '',
  tag: '',
};

const els = {
  app: document.getElementById('app'),
  list: document.getElementById('bookmark-list'),
  empty: document.getElementById('empty-state'),
  listHeading: document.getElementById('list-heading'),
  views: document.getElementById('views'),
  search: document.getElementById('search'),
  tagFilter: document.getElementById('tag-filter'),
  form: document.getElementById('add-form'),
  formHeading: document.getElementById('form-heading'),
  editId: document.getElementById('edit-id'),
  address: document.getElementById('f-address'),
  title: document.getElementById('f-title'),
  description: document.getElementById('f-description'),
  tags: document.getElementById('f-tags'),
  saveBtn: document.getElementById('save-btn'),
  cancelBtn: document.getElementById('cancel-btn'),
  formError: document.getElementById('form-error'),
};

const VIEW_LABEL = {
  active: 'All bookmarks',
  unread: 'Read later',
  archive: 'Archive',
};
const EMPTY_MESSAGE = {
  active: 'No bookmarks yet. Add your first one on the left.',
  unread: 'Nothing to read later. Bookmarks you mark unread appear here.',
  archive: 'The archive is empty. Archived bookmarks appear here.',
};

async function api(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || 'Request failed'), { body, status: res.status });
  return body;
}

function parseTags(value) {
  return value
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

// ---- rendering -------------------------------------------------------------

function bookmarkNode(bm) {
  const li = document.createElement('li');
  li.className = 'bookmark' + (!bm.isRead && !bm.isArchived ? ' unread' : '');
  li.dataset.id = bm.id;

  const main = document.createElement('div');
  main.className = 'bm-main';

  const h3 = document.createElement('h3');
  h3.className = 'bm-title';
  const link = document.createElement('a');
  link.href = bm.address;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = bm.title;
  h3.appendChild(link);
  if (!bm.isRead && !bm.isArchived) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'unread';
    h3.appendChild(badge);
  }
  main.appendChild(h3);

  const addr = document.createElement('p');
  addr.className = 'bm-address';
  addr.textContent = bm.address;
  main.appendChild(addr);

  if (bm.description) {
    const desc = document.createElement('p');
    desc.className = 'bm-desc';
    desc.textContent = bm.description;
    main.appendChild(desc);
  }

  if (bm.tags.length) {
    const tagWrap = document.createElement('div');
    tagWrap.className = 'bm-tags';
    for (const t of bm.tags) {
      const tag = document.createElement('button');
      tag.type = 'button';
      tag.className = 'tag';
      tag.textContent = `#${t}`;
      tag.addEventListener('click', () => {
        els.tagFilter.value = t;
        state.tag = t;
        refresh();
      });
      tagWrap.appendChild(tag);
    }
    main.appendChild(tagWrap);
  }

  li.appendChild(main);
  li.appendChild(actionsNode(bm));
  return li;
}

function actionsNode(bm) {
  const wrap = document.createElement('div');
  wrap.className = 'bm-actions';
  const add = (label, handler, cls = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', handler);
    wrap.appendChild(b);
  };

  if (bm.isArchived) {
    add('Restore', () => patch(bm.id, { isArchived: false }));
    add('Delete', () => remove(bm.id), 'danger');
  } else {
    add('Edit', () => startEdit(bm));
    add(bm.isRead ? 'Mark unread' : 'Mark read', () =>
      patch(bm.id, { isRead: !bm.isRead })
    );
    add('Archive', () => patch(bm.id, { isArchived: true }));
    add('Delete', () => remove(bm.id), 'danger');
  }
  return wrap;
}

function render(items) {
  els.list.innerHTML = '';
  els.listHeading.textContent = VIEW_LABEL[state.view];
  if (!items.length) {
    els.empty.hidden = false;
    els.empty.textContent =
      state.q || state.tag ? 'No bookmarks match your search.' : EMPTY_MESSAGE[state.view];
    return;
  }
  els.empty.hidden = true;
  for (const bm of items) els.list.appendChild(bookmarkNode(bm));
}

// ---- data flow -------------------------------------------------------------

async function refresh() {
  const params = new URLSearchParams({ view: state.view });
  if (state.q) params.set('q', state.q);
  if (state.tag) params.set('tag', state.tag);
  const items = await api(`/bookmarks?${params.toString()}`);
  render(items);
  await refreshTags();
}

async function refreshTags() {
  const tags = await api('/tags');
  const current = els.tagFilter.value;
  els.tagFilter.innerHTML = '<option value="">All tags</option>';
  for (const t of tags) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = `#${t}`;
    els.tagFilter.appendChild(opt);
  }
  els.tagFilter.value = tags.includes(current) ? current : '';
  if (!tags.includes(current)) state.tag = '';
}

async function patch(id, fields) {
  await api(`/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });
  await refresh();
}

async function remove(id) {
  if (!window.confirm('Delete this bookmark permanently?')) return;
  await api(`/bookmarks/${id}`, { method: 'DELETE' });
  if (els.editId.value === String(id)) resetForm();
  await refresh();
}

// ---- add / edit form -------------------------------------------------------

function resetForm() {
  els.editId.value = '';
  els.form.reset();
  els.formHeading.textContent = 'Add bookmark';
  els.saveBtn.textContent = 'Save';
  els.cancelBtn.hidden = true;
  els.formError.textContent = '';
}

async function startEdit(bm) {
  els.editId.value = bm.id;
  els.address.value = bm.address;
  els.title.value = bm.title;
  els.description.value = bm.description;
  els.tags.value = bm.tags.join(', ');
  els.formHeading.textContent = 'Edit bookmark';
  els.saveBtn.textContent = 'Update';
  els.cancelBtn.hidden = false;
  els.formError.textContent = '';
  els.address.focus();
}

async function loadForEdit(id) {
  const bm = await api(`/bookmarks/${id}`);
  await startEdit(bm);
}

async function onSubmit(event) {
  event.preventDefault();
  els.formError.textContent = '';
  const address = els.address.value.trim();
  if (!address) {
    els.formError.textContent = 'A web address is required.';
    return;
  }
  const payload = {
    address,
    title: els.title.value.trim(),
    description: els.description.value.trim(),
    tags: parseTags(els.tags.value),
  };
  const editing = els.editId.value;

  try {
    if (editing) {
      await api(`/bookmarks/${editing}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      await api('/bookmarks', { method: 'POST', body: JSON.stringify(payload) });
    }
    resetForm();
    await refresh();
  } catch (err) {
    if (err.status === 409 && err.body?.existingId) {
      const where = err.body.existingArchived
        ? ' It is in your archive — opening it to edit (restore it from there if needed).'
        : ' Opening the existing bookmark to edit.';
      if (err.body.existingArchived) {
        state.view = 'archive';
        syncViewTabs();
      }
      await refresh();
      await loadForEdit(err.body.existingId);
      // Set the notice after loadForEdit, which otherwise clears the error line.
      els.formError.textContent = 'A bookmark with this address already exists.' + where;
    } else {
      els.formError.textContent = err.body?.error || err.message;
    }
  }
}

// ---- view / filter wiring --------------------------------------------------

function syncViewTabs() {
  for (const tab of els.views.querySelectorAll('.view-tab')) {
    tab.classList.toggle('active', tab.dataset.view === state.view);
  }
}

els.views.addEventListener('click', (e) => {
  const tab = e.target.closest('.view-tab');
  if (!tab) return;
  state.view = tab.dataset.view;
  syncViewTabs();
  refresh();
});

let searchTimer;
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = els.search.value.trim();
    refresh();
  }, 150);
});

els.tagFilter.addEventListener('change', () => {
  state.tag = els.tagFilter.value;
  refresh();
});

els.form.addEventListener('submit', onSubmit);
els.cancelBtn.addEventListener('click', resetForm);

// ---- boot ------------------------------------------------------------------

(async function init() {
  try {
    await refresh();
  } finally {
    els.app.dataset.harnessReady = 'true';
  }
})();
