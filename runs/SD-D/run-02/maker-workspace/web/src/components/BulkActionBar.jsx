import React, { useState } from 'react';

// Bulk actions on the selected bookmarks, or on the entire current result set
// ("apply to all matching") which sends the full active view descriptor (FR-027).
export default function BulkActionBar({ selectedCount, total, onApply }) {
  const [tagValue, setTagValue] = useState('');
  const [scope, setScope] = useState('selected'); // 'selected' | 'matching'

  function apply(action) {
    if ((action === 'tag' || action === 'untag') && !tagValue.trim()) return;
    onApply({ action, value: tagValue.trim(), scope });
    if (action === 'tag' || action === 'untag') setTagValue('');
  }

  const disabled = scope === 'selected' && selectedCount === 0;

  return (
    <div className="bulk-bar">
      <div className="bulk-scope">
        <label>
          <input type="radio" checked={scope === 'selected'} onChange={() => setScope('selected')} />
          Selected ({selectedCount})
        </label>
        <label>
          <input type="radio" checked={scope === 'matching'} onChange={() => setScope('matching')} />
          All matching this view ({total})
        </label>
      </div>
      <div className="bulk-actions">
        <input
          className="bulk-tag"
          value={tagValue}
          placeholder="tag name"
          onChange={(e) => setTagValue(e.target.value)}
        />
        <button disabled={disabled} onClick={() => apply('tag')}>Add tag</button>
        <button disabled={disabled} onClick={() => apply('untag')}>Remove tag</button>
        <button disabled={disabled} onClick={() => apply('read')}>Mark read</button>
        <button disabled={disabled} onClick={() => apply('unread')}>Mark unread</button>
        <button disabled={disabled} onClick={() => apply('archive')}>Archive</button>
        <button disabled={disabled} onClick={() => apply('unarchive')}>Unarchive</button>
        <button disabled={disabled} className="danger" onClick={() => apply('delete')}>Delete</button>
      </div>
    </div>
  );
}
