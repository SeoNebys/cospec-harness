import { useEffect, useRef } from 'react'
import type { BookmarkSummary } from '@shared/types'

// Renders the collection as a list of cards, each showing the favicon, title,
// description, address, and saved-copy status, with actions to open the page
// (US2) or view the saved copy (US3). A highlighted card (e.g. the existing
// bookmark surfaced after a duplicate save) scrolls into view.
export function BookmarkList({
  bookmarks,
  onOpen,
  onOpenCopy,
  onEdit,
  onRestore,
  onTagClick,
  onToggleRead,
  selectedIds,
  onToggleSelect,
  highlightId
}: {
  bookmarks: BookmarkSummary[]
  onOpen?: (id: string) => void
  onOpenCopy?: (id: string) => void
  onEdit?: (id: string) => void
  onRestore?: (id: string) => void
  onTagClick?: (tag: string) => void
  onToggleRead?: (id: string, current: boolean) => void
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  highlightId?: string | null
}): JSX.Element {
  const highlightRef = useRef<HTMLLIElement | null>(null)

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId])

  return (
    <ul className="bookmark-list">
      {bookmarks.map((b) => (
        <li
          className={`bookmark${b.id === highlightId ? ' highlight' : ''}${
            selectedIds?.has(b.id) ? ' selected' : ''
          }`}
          key={b.id}
          ref={b.id === highlightId ? highlightRef : null}
        >
          {onToggleSelect && (
            <input
              type="checkbox"
              className="select-box"
              checked={selectedIds?.has(b.id) ?? false}
              onChange={() => onToggleSelect(b.id)}
              aria-label="Select bookmark"
            />
          )}
          {b.faviconPath ? (
            <img className="favicon" src={`file://${b.faviconPath}`} alt="" />
          ) : (
            <span className="favicon" />
          )}
          <div className="body">
            <div className="title">{b.title}</div>
            {b.description && <div className="desc">{b.description}</div>}
            <div className="url">{b.url}</div>
            {b.tags.length > 0 && (
              <div className="card-tags">
                {b.tags.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className="tag-chip clickable"
                    onClick={() => onTagClick?.(t)}
                    disabled={!onTagClick}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            <div className="status">
              {!b.isRead && <span className="unread-dot">● Unread</span>}
              {b.savedCopyStatus === 'pending' && 'Saving copy…'}
              {b.savedCopyStatus === 'captured' && 'Saved copy available'}
              {b.savedCopyStatus === 'unavailable' && 'No saved copy'}
            </div>
          </div>
          <div className="actions">
            {onOpen && <button onClick={() => onOpen(b.id)}>Open</button>}
            {onOpenCopy && (
              <button
                className="secondary"
                disabled={b.savedCopyStatus !== 'captured'}
                onClick={() => onOpenCopy(b.id)}
              >
                Saved copy
              </button>
            )}
            {onToggleRead && (
              <button className="secondary" onClick={() => onToggleRead(b.id, b.isRead)}>
                {b.isRead ? 'Mark unread' : 'Mark read'}
              </button>
            )}
            {onEdit && (
              <button className="secondary" onClick={() => onEdit(b.id)}>
                Edit
              </button>
            )}
            {onRestore && (
              <button className="secondary" onClick={() => onRestore(b.id)}>
                Restore
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
