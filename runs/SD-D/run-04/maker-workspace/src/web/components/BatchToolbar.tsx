import { useState } from 'react';

// Appears when one or more bookmarks are selected. Acts on the current selection
// only — "Select all showing" selects exactly what the active view/filter shows,
// never hidden or archived items (FR-019/FR-020). Delete confirms once for the batch.

export function BatchToolbar({
  selectedCount,
  showingCount,
  inArchivedView,
  onSelectAllShowing,
  onClear,
  onAddTag,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  selectedCount: number;
  showingCount: number;
  inArchivedView: boolean;
  onSelectAllShowing: () => void;
  onClear: () => void;
  onAddTag: (tag: string) => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const [tag, setTag] = useState('');

  return (
    <div className="batch-toolbar">
      <span className="batch-count">{selectedCount} selected</span>
      <button type="button" className="link-button" onClick={onSelectAllShowing}>
        Select all showing ({showingCount})
      </button>
      <button type="button" className="link-button" onClick={onClear}>
        Clear
      </button>
      <span className="batch-sep" />
      <form
        className="batch-tag"
        onSubmit={(e) => {
          e.preventDefault();
          if (tag.trim()) {
            onAddTag(tag.trim());
            setTag('');
          }
        }}
      >
        <input
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="tag…"
          aria-label="Tag to add to selection"
        />
        <button type="submit" disabled={!tag.trim()}>
          Add tag
        </button>
      </form>
      {inArchivedView ? (
        <button type="button" onClick={onUnarchive}>
          Restore
        </button>
      ) : (
        <button type="button" onClick={onArchive}>
          Archive
        </button>
      )}
      <button type="button" className="danger-btn" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}
