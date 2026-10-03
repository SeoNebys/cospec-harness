// Bulk selection action bar (FR-017).
import { api } from './api.js';
import { state, reload, selectAllPayload } from './state.js';
import { showMessage, el } from './ui.js';

export function renderBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const count = state.selection.size;
  if (count === 0 && !bar.dataset.selectAll) { bar.hidden = true; bar.innerHTML = ''; return; }
  bar.hidden = false;
  bar.innerHTML = '';

  const label = el('span', {}, `${count} selected`);

  const selectAllBtn = el('button', { className: 'ghost', onclick: () => {
    state.items.forEach((b) => state.selection.add(b.id));
    document.dispatchEvent(new CustomEvent('selection-changed'));
  } }, `Select all ${state.total} in results`);

  const clearBtn = el('button', { className: 'ghost', onclick: () => {
    state.selection.clear();
    document.dispatchEvent(new CustomEvent('selection-changed'));
  } }, 'Clear');

  const tagField = el('input', { type: 'text', placeholder: 'tag name' });
  const addTagBtn = el('button', { className: 'ghost', onclick: () => bulk('add_tags', { tags: splitTags(tagField.value) }) }, 'Add tag');
  const removeTagBtn = el('button', { className: 'ghost', onclick: () => bulk('remove_tags', { tags: splitTags(tagField.value) }) }, 'Remove tag');

  const readBtn = el('button', { className: 'ghost', onclick: () => bulk('mark_read') }, 'Mark read');
  const unreadBtn = el('button', { className: 'ghost', onclick: () => bulk('mark_unread') }, 'Mark unread');
  const archiveBtn = el('button', { className: 'ghost', onclick: () => bulk('archive') }, 'Archive');
  const restoreBtn = el('button', { className: 'ghost', onclick: () => bulk('restore') }, 'Restore');
  const deleteBtn = el('button', { className: 'danger', onclick: () => {
    if (confirm(`Permanently delete ${state.selection.size} bookmark(s)? This also removes their local copies.`)) bulk('delete');
  } }, 'Delete');

  bar.append(label, selectAllBtn, clearBtn, tagField, addTagBtn, removeTagBtn,
    readBtn, unreadBtn, archiveBtn, restoreBtn, deleteBtn);
}

function splitTags(v) { return (v || '').split(',').map((t) => t.trim()).filter(Boolean); }

async function bulk(action, payload) {
  const ids = [...state.selection];
  if (ids.length === 0) { showMessage('Nothing selected.', true); return; }
  try {
    const { affected } = await api.post('/api/bookmarks/bulk', { ids, action, payload });
    showMessage(`Updated ${affected} bookmark(s).`);
    state.selection.clear();
    reload();
  } catch (e) { showMessage(e.message, true); }
}

// Exported for a possible "apply to every match" flow using selectAll.
export async function bulkSelectAll(action, payload) {
  try {
    const { affected } = await api.post('/api/bookmarks/bulk', { selectAll: selectAllPayload(), action, payload });
    showMessage(`Updated ${affected} bookmark(s).`);
    state.selection.clear();
    reload();
  } catch (e) { showMessage(e.message, true); }
}
