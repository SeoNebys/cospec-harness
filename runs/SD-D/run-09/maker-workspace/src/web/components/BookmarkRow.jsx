import React from 'react';

// A single bookmark list row: favicon, title, description, tags, meta + actions.
export function BookmarkRow({ bookmark, selected, onToggleSelect, onEdit, onToggleRead, onToggleArchive }) {
  const b = bookmark;
  const date = new Date(b.dateAdded).toLocaleDateString();
  return (
    <div className="card">
      <input
        type="checkbox"
        checked={!!selected}
        onChange={() => onToggleSelect(b.id)}
        aria-label={`select ${b.title}`}
      />
      {b.faviconPath ? (
        <img className="favicon" src={b.faviconPath} alt="" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
      ) : (
        <span className="favicon" />
      )}
      <div className="body">
        <p className="title">
          <a href={b.url} target="_blank" rel="noreferrer noopener">
            {b.title || b.url}
          </a>
          {!b.read && <span className="status-pill pending" style={{ marginLeft: 8 }}>unread</span>}
        </p>
        {b.description && <div className="desc">{b.description}</div>}
        <div className="meta">
          <span>{date}</span>
          {b.tags.map((t) => (
            <span key={t} className="tag">#{t}</span>
          ))}
          <SnapshotPill status={b.snapshotStatus} />
        </div>
        <div className="row-actions" style={{ marginTop: 8 }}>
          <button onClick={() => onEdit(b.id)}>Edit</button>
          <button onClick={() => onToggleRead(b)}>{b.read ? 'Mark unread' : 'Mark read'}</button>
          <button onClick={() => onToggleArchive(b)}>{b.archived ? 'Un-archive' : 'Archive'}</button>
        </div>
      </div>
    </div>
  );
}

function SnapshotPill({ status }) {
  const label = { available: 'snapshot ✓', pending: 'snapshot…', unavailable: 'no snapshot' }[status] || '';
  if (!label) return null;
  return <span className={`status-pill ${status}`}>{label}</span>;
}
