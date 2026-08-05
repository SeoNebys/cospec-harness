// Bookmark list: icon, title, description, address, tags (US2 + US3).
// Per-item actions: open, toggle read, archive/restore, edit, delete (US5).

import type { Bookmark } from "../api/client";

interface Props {
  bookmarks: Bookmark[];
  archiveView?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
  onToggleRead: (bookmark: Bookmark) => void;
  onArchiveToggle: (bookmark: Bookmark) => void;
}

export function BookmarkList({
  bookmarks,
  archiveView = false,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
  onToggleRead,
  onArchiveToggle,
}: Props) {
  const selectable = Boolean(onToggleSelect);
  return (
    <ul className="bookmark-list" data-testid="bookmark-list">
      {bookmarks.map((b) => (
        <li
          key={b.id}
          className={`bookmark-item${!b.is_read ? " bookmark-item--unread" : ""}`}
          data-testid="bookmark-item"
        >
          {selectable && (
            <input
              type="checkbox"
              className="bookmark-select"
              checked={selectedIds?.has(b.id) ?? false}
              onChange={() => onToggleSelect?.(b.id)}
              aria-label={`Select ${b.title}`}
              data-testid="bookmark-select"
            />
          )}
          {b.icon ? (
            <img className="favicon" src={b.icon} alt="" width={16} height={16} />
          ) : (
            <span className="favicon favicon--placeholder" aria-hidden="true" />
          )}
          <div className="bookmark-body">
            <a
              className="bookmark-title"
              href={b.url}
              target="_blank"
              rel="noreferrer noopener"
              data-testid="bookmark-link"
            >
              {b.title}
            </a>
            {!b.is_read && <span className="unread-dot" title="Unread" data-testid="unread-badge" />}
            {b.description && <p className="bookmark-desc">{b.description}</p>}
            <span className="bookmark-url">{b.url}</span>
            {b.tags.length > 0 && (
              <div className="bookmark-tags" data-testid="bookmark-tags">
                {b.tags.map((t) => (
                  <span key={t} className="tag-chip tag-chip--static">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="bookmark-actions">
            {!archiveView && (
              <button
                type="button"
                onClick={() => onToggleRead(b)}
                data-testid="toggle-read"
              >
                {b.is_read ? "Mark unread" : "Mark read"}
              </button>
            )}
            <button type="button" onClick={() => onArchiveToggle(b)} data-testid="archive-toggle">
              {b.is_archived ? "Restore" : "Archive"}
            </button>
            {!archiveView && (
              <button type="button" onClick={() => onEdit(b)} data-testid="edit-button">
                Edit
              </button>
            )}
            <button
              type="button"
              className="link-danger"
              onClick={() => onDelete(b)}
              data-testid="delete-button"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
