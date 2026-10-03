import { useState } from 'react';

interface Props {
  selectedCount: number;
  totalMatching: number;
  selectAllMatching: boolean;
  onSelectAllMatching: (on: boolean) => void;
  onClear: () => void;
  onAddTags: (tags: string[]) => void;
  onRemoveTags: (tags: string[]) => void;
  onSetUnread: (unread: boolean) => void;
  onArchive: (archived: boolean) => void;
  onDelete: () => void;
  scope: string;
}

/** Bulk action bar. "Select all matching" targets the complete current view
 *  server-side (FR-019), not just the visible page. */
export function BulkBar(p: Props) {
  const [tagText, setTagText] = useState('');
  if (p.selectedCount === 0 && !p.selectAllMatching) return null;
  const effective = p.selectAllMatching ? p.totalMatching : p.selectedCount;
  const tags = () =>
    tagText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

  return (
    <div className="bulk-bar">
      <div className="row-flex wrap">
        <strong>{effective} selected</strong>
        {!p.selectAllMatching && p.totalMatching > p.selectedCount && (
          <button onClick={() => p.onSelectAllMatching(true)}>
            Select all {p.totalMatching} matching this view
          </button>
        )}
        {p.selectAllMatching && <span className="muted">(all matching the current view)</span>}
        <button onClick={p.onClear}>Clear</button>
      </div>
      <div className="row-flex wrap" style={{ marginTop: 8 }}>
        <input
          type="text"
          style={{ maxWidth: 220 }}
          placeholder="tag1, tag2"
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
        />
        <button onClick={() => tags().length && p.onAddTags(tags())}>Add tags</button>
        <button onClick={() => tags().length && p.onRemoveTags(tags())}>Remove tags</button>
        <button onClick={() => p.onSetUnread(true)}>Mark unread</button>
        <button onClick={() => p.onSetUnread(false)}>Mark read</button>
        {p.scope === 'archived' ? (
          <button onClick={() => p.onArchive(false)}>Restore</button>
        ) : (
          <button onClick={() => p.onArchive(true)}>Archive</button>
        )}
        <button className="danger" onClick={p.onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
