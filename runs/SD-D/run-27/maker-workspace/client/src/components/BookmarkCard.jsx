import React from 'react';

// A list item showing title, description, tags, and site icon (FR-023).
export default function BookmarkCard({ bm, selected, onSelect, onOpenDetail, onToggleReadLater, onToggleRead, onArchive, onUnarchive, onDelete }) {
  return (
    <div className="card">
      <div className="bm">
        <input
          type="checkbox"
          className="checkbox"
          checked={selected}
          onChange={e => onSelect(bm.id, e.target.checked)}
          aria-label="Select bookmark"
        />
        {bm.icon_url
          ? <img className="icon" src={bm.icon_url} alt="" onError={e => { e.target.style.visibility = 'hidden'; }} />
          : <span className="icon" />}
        <div className="body">
          <div className="title">
            {/* Open destination in a new tab (FR-036) */}
            <a href={bm.url} target="_blank" rel="noopener noreferrer">{bm.title || bm.url}</a>
          </div>
          <div className="url">{bm.url}</div>
          {bm.description && <div className="desc">{bm.description}</div>}
          {bm.metadata_status === 'failed' && (
            <div className="status-failed">Metadata could not be fetched.</div>
          )}
          {bm.tags && bm.tags.length > 0 && (
            <div className="tags">{bm.tags.map(t => <span key={t} className="tag">{t}</span>)}</div>
          )}
          <div className="row wrap" style={{ marginTop: 8 }}>
            <button onClick={() => onOpenDetail(bm.id)}>Edit</button>
            <button onClick={() => onToggleReadLater(bm)}>
              {bm.read_later ? 'Remove read-later' : 'Read later'}
            </button>
            <button onClick={() => onToggleRead(bm)}>
              {bm.is_read ? 'Mark unread' : 'Mark read'}
            </button>
            {bm.is_archived
              ? <button onClick={() => onUnarchive(bm)}>Restore</button>
              : <button onClick={() => onArchive(bm)}>Archive</button>}
            <button className="danger" onClick={() => onDelete(bm)}>Delete</button>
            {bm.is_read && <span className="pill">read</span>}
            {bm.read_later && <span className="pill">read later</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
