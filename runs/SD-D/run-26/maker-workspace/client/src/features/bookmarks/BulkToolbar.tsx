import { useState } from 'react';
export function BulkToolbar({
  count,
  all,
  total,
  collection,
  onAction,
  onSelectAll,
  onClear
}: {
  count: number;
  all: boolean;
  total: number;
  collection: string;
  onAction: (action: any) => Promise<void>;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const [tags, setTags] = useState('');
  const parsed = tags
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return (
    <div className="bulk-toolbar" role="region" aria-label="Bulk actions">
      <strong>{all ? `${count} of ${total} matching selected` : `${count} selected`}</strong>
      {!all && count < total && <button onClick={onSelectAll}>Select all {total} matches</button>}
      <input
        aria-label="Tags for selected bookmarks"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="tag, another"
      />
      <button
        disabled={!parsed.length}
        onClick={() => void onAction({ type: 'addTags', tags: parsed })}
      >
        Add tags
      </button>
      <button
        disabled={!parsed.length}
        onClick={() => void onAction({ type: 'removeTags', tags: parsed })}
      >
        Remove tags
      </button>
      <button onClick={() => void onAction({ type: 'markRead', value: true })}>Mark read</button>
      <button onClick={() => void onAction({ type: 'markRead', value: false })}>Mark unread</button>
      {collection === 'archive' ? (
        <button onClick={() => void onAction({ type: 'restore' })}>Restore</button>
      ) : (
        <button onClick={() => void onAction({ type: 'archive' })}>Archive</button>
      )}
      <button
        className="danger-text"
        onClick={() => {
          if (confirm(`Permanently delete ${count} bookmarks? This cannot be undone.`))
            void onAction({ type: 'delete', confirm: 'permanent' });
        }}
      >
        Delete
      </button>
      <button aria-label="Clear selection" onClick={onClear}>
        ×
      </button>
    </div>
  );
}
