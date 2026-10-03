import React, { useState } from 'react';

// Bulk action bar (US7). Acts on the current selection or all filtered results.
export default function BulkBar({ selectedCount, totalCount, allSelected, onSelectAll, onClear, onAction }) {
  const [tag, setTag] = useState('');
  if (selectedCount === 0) return null;

  return (
    <div className="bulk-bar">
      <span className="bulk-count">{selectedCount} selected</span>
      <button type="button" onClick={() => onSelectAll(!allSelected)}>
        {allSelected ? 'Clear selection' : `Select all ${totalCount} in results`}
      </button>
      <span className="bulk-sep" />
      <div className="bulk-tagadd">
        <input value={tag} placeholder="tag" onChange={(e) => setTag(e.target.value)} />
        <button type="button" disabled={!tag.trim()} onClick={() => { onAction({ type: 'addTags', tags: [tag.trim()] }); setTag(''); }}>
          Add tag
        </button>
        <button type="button" disabled={!tag.trim()} onClick={() => { onAction({ type: 'removeTags', tags: [tag.trim()] }); setTag(''); }}>
          Remove tag
        </button>
      </div>
      <button type="button" onClick={() => onAction({ type: 'markRead' })}>Mark read</button>
      <button type="button" onClick={() => onAction({ type: 'markUnread' })}>Mark unread</button>
      <button type="button" onClick={() => onAction({ type: 'archive' })}>Archive</button>
      <button type="button" onClick={() => onAction({ type: 'restore' })}>Restore</button>
      <button
        type="button"
        className="danger"
        onClick={() => {
          if (window.confirm(`Permanently delete ${selectedCount} bookmark(s)? This cannot be undone and is different from archiving.`)) {
            onAction({ type: 'delete' });
          }
        }}
      >
        Delete
      </button>
      <button type="button" className="secondary" onClick={onClear}>Clear</button>
    </div>
  );
}
