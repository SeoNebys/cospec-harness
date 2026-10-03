// Render a single bookmark row. `handlers` provides callbacks.
export function bookmarkRow(bookmark, { selected, scope, onToggleSelect, onEdit, onToggleRead, onArchive, onRestore, onDelete }) {
  const li = document.createElement('li');
  li.className = 'bookmark' + (selected ? ' selected' : '');
  li.dataset.id = bookmark.id;

  const checkbox = el('input', { type: 'checkbox', class: 'select' });
  checkbox.checked = !!selected;
  checkbox.onchange = () => onToggleSelect(bookmark.id, checkbox.checked);

  const favicon = el('img', { class: 'favicon', alt: '', src: bookmark.faviconUrl || 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=' });
  favicon.onerror = () => { favicon.style.visibility = 'hidden'; };

  const body = el('div', { class: 'body' });
  const title = el('a', { class: 'title', href: bookmark.url, target: '_blank', rel: 'noopener' });
  title.textContent = bookmark.title;
  body.appendChild(title);
  if (bookmark.description) { const d = el('p', { class: 'desc' }); d.textContent = bookmark.description; body.appendChild(d); }

  const meta = el('div', { class: 'meta' });
  bookmark.tags.forEach((t) => { const s = el('span', { class: 'tag' }); s.textContent = `#${t}`; meta.appendChild(s); });
  if (!bookmark.isRead) meta.appendChild(badge('Unread'));
  if (bookmark.metadataUnavailable) meta.appendChild(badge('Metadata unavailable'));
  if (bookmark.preservedHtmlPath || bookmark.preservedPdfPath) {
    const a = el('a', { class: 'badge', href: `/api/bookmarks/${bookmark.id}/preserved`, target: '_blank' });
    a.textContent = 'Preserved'; meta.appendChild(a);
  }
  body.appendChild(meta);

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Edit', () => onEdit(bookmark.id)));
  actions.appendChild(button(bookmark.isRead ? 'Mark unread' : 'Mark read', () => onToggleRead(bookmark)));
  if (scope === 'archive') {
    actions.appendChild(button('Restore', () => onRestore(bookmark.id)));
    actions.appendChild(button('Delete', () => onDelete(bookmark.id), 'danger'));
  } else {
    actions.appendChild(button('Archive', () => onArchive(bookmark.id)));
    actions.appendChild(button('Delete', () => onDelete(bookmark.id), 'danger'));
  }

  li.append(checkbox, favicon, body, actions);
  return li;
}

function badge(text) { const s = el('span', { class: 'badge' }); s.textContent = text; return s; }
function button(label, onClick, extra = '') {
  const b = el('button', { type: 'button', class: extra }); b.textContent = label; b.onclick = onClick; return b;
}
function el(tag, attrs = {}) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== '') node.setAttribute(k, v);
  return node;
}
