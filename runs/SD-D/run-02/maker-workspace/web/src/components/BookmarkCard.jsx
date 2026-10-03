import React from 'react';
import { renderMarkdown } from '../lib/markdown.js';

// One bookmark row: favicon, title (opens original), description, tags, note,
// and per-item actions. Tags are clickable to filter (FR-015).
export default function BookmarkCard({
  bookmark,
  selected,
  onToggleSelect,
  onTagClick,
  onEdit,
  onToggleRead,
  onToggleArchive,
  onDelete,
  onSnapshot,
  onArchiveOrg,
  busyAction,
}) {
  const b = bookmark;
  return (
    <div className={`card ${b.read_state === 'read' ? 'is-read' : 'is-unread'}`} data-testid="bookmark-card">
      <input
        type="checkbox"
        className="card-select"
        checked={selected}
        onChange={() => onToggleSelect(b.id)}
        aria-label={`Select ${b.title}`}
      />
      <img
        className="favicon"
        src={b.favicon || defaultFavicon}
        alt=""
        onError={(e) => {
          e.currentTarget.src = defaultFavicon;
        }}
      />
      <div className="card-body">
        <div className="card-head">
          <a className="card-title" href={b.url} target="_blank" rel="noopener noreferrer">
            {b.title || b.url}
          </a>
          {b.metadata_status === 'pending' && <span className="badge pending" title="Fetching details">fetching…</span>}
          {b.read_state === 'unread' && <span className="badge unread">unread</span>}
        </div>
        <div className="card-url">{b.url}</div>
        {b.description && <div className="card-desc">{b.description}</div>}
        {b.tags.length > 0 && (
          <div className="card-tags">
            {b.tags.map((t) => (
              <button key={t} type="button" className="tag-pill" onClick={() => onTagClick(t)}>
                #{t}
              </button>
            ))}
          </div>
        )}
        {b.note_md && (
          <div className="card-note" dangerouslySetInnerHTML={{ __html: renderMarkdown(b.note_md) }} />
        )}
        <div className="card-actions">
          <button type="button" onClick={() => onEdit(b)}>Edit</button>
          <button type="button" onClick={() => onToggleRead(b)}>
            Mark {b.read_state === 'read' ? 'unread' : 'read'}
          </button>
          <button type="button" onClick={() => onToggleArchive(b)}>
            {b.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button type="button" className="danger" onClick={() => onDelete(b)}>Delete</button>
          <button type="button" onClick={() => onSnapshot(b)} disabled={busyAction === 'snapshot'}>
            {busyAction === 'snapshot' ? 'Snapshotting…' : 'Snapshot'}
          </button>
          <button type="button" onClick={() => onArchiveOrg(b)} disabled={busyAction === 'archive-org'}>
            {busyAction === 'archive-org' ? 'Archiving…' : 'Save to Archive.org'}
          </button>
          {b.snapshot && (
            <a href={b.snapshot.url} target="_blank" rel="noopener noreferrer">
              Snapshot ({b.snapshot.kind})
            </a>
          )}
          {b.internet_archive_url && (
            <a href={b.internet_archive_url} target="_blank" rel="noopener noreferrer">Archive.org</a>
          )}
        </div>
      </div>
    </div>
  );
}

const defaultFavicon =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" rx="3" fill="%23cbd5e1"/></svg>'
  );
