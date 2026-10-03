// Bookmark list rendering, save form, detail/edit modal, per-item actions.
import { api } from './api.js';
import { state, reload, getError } from './state.js';
import { createTagInput } from './tags.js';
import { openModal, closeModal, showMessage, el } from './ui.js';

const listEl = () => document.getElementById('list');

export function renderList() {
  const container = listEl();
  container.innerHTML = '';
  const err = getError();
  if (err) {
    container.append(el('div', { className: 'empty' }, err));
    return;
  }
  if (state.items.length === 0) {
    const msg = state.q || state.includeTags.length || state.excludeTags.length
      ? 'No bookmarks match your search.'
      : state.view === 'archive' ? 'No archived bookmarks.'
      : state.view === 'unread' ? 'Nothing marked to read later.'
      : 'No bookmarks yet. Paste a URL above to save your first one.';
    container.append(el('div', { className: 'empty' }, msg));
    return;
  }
  for (const bm of state.items) container.append(renderCard(bm));
}

function renderCard(bm) {
  const card = el('div', { className: 'card' + (state.selection.has(bm.id) ? ' selected' : '') });

  const sel = el('input', { type: 'checkbox', className: 'sel', checked: state.selection.has(bm.id) });
  sel.addEventListener('change', () => {
    if (sel.checked) state.selection.add(bm.id); else state.selection.delete(bm.id);
    card.classList.toggle('selected', sel.checked);
    document.dispatchEvent(new CustomEvent('selection-changed'));
  });

  const icon = bm.icon_url
    ? el('img', { className: 'icon', src: bm.icon_url, alt: '', onerror: function () { this.style.visibility = 'hidden'; } })
    : el('span', { className: 'icon' });

  const titleLink = el('a', { href: bm.url, target: '_blank', rel: 'noopener' }, bm.title || bm.url);
  const body = el('div', { className: 'body' }, [
    el('div', { className: 'title' }, titleLink),
    el('div', { className: 'url' }, bm.url),
    bm.description ? el('div', { className: 'desc' }, bm.description) : null,
    renderTags(bm),
    renderBadges(bm),
  ]);

  const actions = el('div', { className: 'actions' }, [
    el('button', { className: 'ghost', onclick: () => openDetail(bm.id) }, 'Open / Edit'),
    el('button', { className: 'ghost', onclick: () => toggleRead(bm) }, bm.is_read ? 'Mark unread' : 'Mark read'),
    el('button', { className: 'ghost', onclick: () => toggleArchive(bm) }, bm.is_archived ? 'Restore' : 'Archive'),
  ]);

  card.append(sel, icon, body, actions);
  return card;
}

function renderTags(bm) {
  const wrap = el('div', { className: 'tags' });
  (bm.tags || []).forEach((t) => {
    const chip = el('span', { className: 'chip' }, t);
    chip.style.cursor = 'pointer';
    chip.title = 'Filter by this tag';
    chip.onclick = () => document.dispatchEvent(new CustomEvent('add-include-tag', { detail: t }));
    wrap.append(chip);
  });
  return wrap;
}

function renderBadges(bm) {
  const wrap = el('div', { className: 'badges' });
  if (!bm.is_read) wrap.append(el('span', { className: 'badge unread' }, 'Unread'));
  if (bm.is_archived) wrap.append(el('span', { className: 'badge' }, 'Archived'));
  if (bm.page_copy_kind) wrap.append(el('span', { className: 'badge' }, 'Local copy'));
  if (bm.archive_org_url) wrap.append(el('span', { className: 'badge' }, 'Archived @ IA'));
  return wrap;
}

async function toggleRead(bm) {
  await api.post(`/api/bookmarks/${bm.id}/${bm.is_read ? 'unread' : 'read'}`);
  reload();
}
async function toggleArchive(bm) {
  await api.post(`/api/bookmarks/${bm.id}/${bm.is_archived ? 'restore' : 'archive'}`);
  reload();
}

// ---- Save form (preview metadata, then create) -------------------------
export async function openSaveForm(url) {
  let meta = { url, title: '', description: '', icon_url: '', preview_image_url: '' };
  try {
    meta = await api.post('/api/metadata', { url });
  } catch (e) {
    showMessage(e.message, true);
    return;
  }
  const titleInput = el('input', { type: 'text', value: meta.title || '' });
  const descInput = el('textarea', { rows: 3 });
  descInput.value = meta.description || '';
  const tagInput = createTagInput([]);

  const form = el('div', {}, [
    el('h2', {}, 'Save bookmark'),
    el('div', { className: 'field' }, [el('label', {}, 'URL'), el('div', { className: 'url' }, meta.url)]),
    el('div', { className: 'field' }, [el('label', {}, 'Title'), titleInput]),
    el('div', { className: 'field' }, [el('label', {}, 'Description'), descInput]),
    el('div', { className: 'field' }, [el('label', {}, 'Tags'), tagInput.element]),
    el('div', { className: 'modal-actions' }, [
      el('button', { className: 'ghost', onclick: closeModal }, 'Cancel'),
      el('button', { onclick: submit }, 'Save'),
    ]),
  ]);
  openModal(form);

  async function submit() {
    try {
      const data = await api.post('/api/bookmarks', {
        url: meta.url,
        title: titleInput.value,
        description: descInput.value,
        icon_url: meta.icon_url,
        preview_image_url: meta.preview_image_url,
        tags: tagInput.getTags(),
      });
      closeModal();
      if (data.duplicate) {
        showMessage('That URL is already saved — opening it for editing.');
        openDetail(data.bookmark.id);
      } else {
        showMessage('Bookmark saved.');
      }
      document.getElementById('new-url').value = '';
      reload();
    } catch (e) {
      showMessage(e.message, true);
    }
  }
}

// ---- Detail / edit modal ----------------------------------------------
export async function openDetail(id) {
  let bm;
  try {
    ({ bookmark: bm } = await api.get(`/api/bookmarks/${id}`));
  } catch (e) { showMessage(e.message, true); return; }

  const titleInput = el('input', { type: 'text', value: bm.title || '' });
  const urlInput = el('input', { type: 'text', value: bm.url });
  const descInput = el('textarea', { rows: 3 }); descInput.value = bm.description || '';
  const noteInput = el('textarea', { rows: 4 }); noteInput.value = bm.note || '';
  const notePreview = el('div', { className: 'note-html' });
  notePreview.innerHTML = bm.note_html || '<em>No note</em>';
  const tagInput = createTagInput(bm.tags || []);

  const form = el('div', {}, [
    el('h2', {}, 'Edit bookmark'),
    el('div', { className: 'field' }, [el('label', {}, 'Title'), titleInput]),
    el('div', { className: 'field' }, [el('label', {}, 'URL'), urlInput]),
    el('div', { className: 'field' }, [el('label', {}, 'Description'), descInput]),
    el('div', { className: 'field' }, [el('label', {}, 'Note (Markdown)'), noteInput]),
    el('div', { className: 'field' }, [el('label', {}, 'Note preview'), notePreview]),
    el('div', { className: 'field' }, [el('label', {}, 'Tags'), tagInput.element]),
    el('div', { className: 'row' }, [
      el('button', { className: 'ghost', onclick: () => window.open(bm.url, '_blank', 'noopener') }, 'Open original'),
      el('button', { className: 'ghost', onclick: savePageCopy }, 'Save local copy'),
      el('button', { className: 'ghost', onclick: saveToArchiveOrg }, 'Save to Internet Archive'),
    ]),
    pageCopyLinks(bm),
    el('div', { className: 'modal-actions' }, [
      el('button', { className: 'danger', onclick: doDelete }, 'Delete'),
      el('button', { className: 'ghost', onclick: closeModal }, 'Cancel'),
      el('button', { onclick: save }, 'Save changes'),
    ]),
  ]);
  openModal(form);

  noteInput.addEventListener('input', debounce(async () => {
    // Live-ish preview by asking the server to render on save; here just show raw safe text.
    notePreview.textContent = noteInput.value;
  }, 200));

  async function save() {
    try {
      await api.patch(`/api/bookmarks/${bm.id}`, {
        title: titleInput.value,
        url: urlInput.value,
        description: descInput.value,
        note: noteInput.value,
        tags: tagInput.getTags(),
      });
      closeModal();
      showMessage('Changes saved.');
      reload();
    } catch (e) { showMessage(e.message, true); }
  }
  async function doDelete() {
    if (!confirm('Permanently delete this bookmark? This also removes any saved local copy.')) return;
    await api.del(`/api/bookmarks/${bm.id}`);
    closeModal();
    showMessage('Bookmark deleted.');
    reload();
  }
  async function savePageCopy() {
    showMessage('Saving a local copy…');
    try {
      await api.post(`/api/bookmarks/${bm.id}/pagecopy`);
      showMessage('Local copy saved.');
      openDetail(bm.id);
    } catch (e) { showMessage(e.message, true); }
  }
  async function saveToArchiveOrg() {
    showMessage('Submitting to the Internet Archive…');
    try {
      await api.post(`/api/bookmarks/${bm.id}/archiveorg`);
      showMessage('Saved to the Internet Archive.');
      openDetail(bm.id);
    } catch (e) { showMessage(e.message, true); }
  }
}

function pageCopyLinks(bm) {
  const wrap = el('div', { className: 'row' });
  if (bm.page_copy_kind) {
    wrap.append(el('a', { className: 'button ghost', href: `/api/bookmarks/${bm.id}/pagecopy`, target: '_blank', rel: 'noopener' }, `Open local ${bm.page_copy_kind.toUpperCase()} copy`));
  }
  if (bm.archive_org_url) {
    wrap.append(el('a', { className: 'button ghost', href: bm.archive_org_url, target: '_blank', rel: 'noopener' }, 'Open Internet Archive snapshot'));
  }
  return wrap;
}

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
