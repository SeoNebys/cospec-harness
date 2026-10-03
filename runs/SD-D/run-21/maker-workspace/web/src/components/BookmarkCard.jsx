import React from 'react';

// A bookmark row/card. Shows title, description, tags, and site icon (FR-027).
// `density` controls how much is shown.
export default function BookmarkCard({
  bookmark,
  density,
  selected,
  onSelect,
  onEdit,
  onToggleRead,
  onToggleArchive,
  onDelete,
}) {
  const b = bookmark;
  return (
    <li className={`card ${density} ${b.isRead ? 'read' : 'unread'}`}>
      <input
        type="checkbox"
        className="select"
        checked={selected}
        onChange={(e) => onSelect(b.id, e.target.checked)}
        aria-label={`Select ${b.title}`}
      />
      {b.iconUrl ? (
        <img className="favicon" src={b.iconUrl} alt="" onError={(e) => (e.target.style.visibility = 'hidden')} />
      ) : (
        <span className="favicon placeholder" aria-hidden="true">🔖</span>
      )}
      <div className="card-body">
        <div className="card-title">
          <a href={b.url} target="_blank" rel="noreferrer">
            {b.title}
          </a>
          {!b.isRead && <span className="badge unread-badge">Unread</span>}
          {b.isArchived && <span className="badge archived-badge">Archived</span>}
        </div>
        {density !== 'compact' && b.description && <p className="card-desc">{b.description}</p>}
        {b.tags.length > 0 && (
          <div className="card-tags">
            {b.tags.map((t) => (
              <span key={t} className="chip small">
                {t}
              </span>
            ))}
          </div>
        )}
        {density !== 'compact' && b.noteHtml && (
          <div className="card-note" dangerouslySetInnerHTML={{ __html: b.noteHtml }} />
        )}
      </div>
      <div className="card-actions">
        <button type="button" onClick={() => onToggleRead(b)}>
          {b.isRead ? 'Mark unread' : 'Mark read'}
        </button>
        <button type="button" onClick={() => onToggleArchive(b)}>
          {b.isArchived ? 'Restore' : 'Archive'}
        </button>
        <button type="button" onClick={() => onEdit(b)}>
          Edit
        </button>
        <button type="button" className="danger" onClick={() => onDelete(b)}>
          Delete
        </button>
      </div>
    </li>
  );
}
