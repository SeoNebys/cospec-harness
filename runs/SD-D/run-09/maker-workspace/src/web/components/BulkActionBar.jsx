import React, { useState } from 'react';

// Bulk-action bar for a selection or "all matching" the current view (FR-024/025).
export function BulkActionBar({ selectedCount, totalCount, allMatchingSelected, onSelectAllMatching, onClear, onApply }) {
  const [tag, setTag] = useState('');
  const count = allMatchingSelected ? totalCount : selectedCount;
  if (selectedCount === 0 && !allMatchingSelected) return null;

  return (
    <div className="bulkbar">
      <strong>{count} selected</strong>
      {!allMatchingSelected && totalCount > selectedCount && (
        <button onClick={onSelectAllMatching}>Select all {totalCount} matching</button>
      )}
      <button onClick={() => onApply('markRead')}>Mark read</button>
      <button onClick={() => onApply('markUnread')}>Mark unread</button>
      <button onClick={() => onApply('archive')}>Archive</button>
      <button onClick={() => onApply('unarchive')}>Un-archive</button>
      <span style={{ display: 'inline-flex', gap: 4 }}>
        <input
          type="text"
          placeholder="tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          style={{ width: 90 }}
        />
        <button onClick={() => tag && onApply('addTag', tag)}>Add tag</button>
        <button onClick={() => tag && onApply('removeTag', tag)}>Remove tag</button>
      </span>
      <button
        className="danger"
        onClick={() => {
          if (window.confirm(`Permanently delete ${count} bookmark(s)? This cannot be undone.`)) {
            onApply('delete');
          }
        }}
      >
        Delete
      </button>
      <button onClick={onClear}>Clear</button>
    </div>
  );
}
