// Bulk action bar shown when bookmarks are selected (US6, FR-018).
// Delete routes through the parent's confirm dialog.

import { useState } from "react";

interface Props {
  count: number;
  /** true when the target is "everything matching the current filter" */
  selectAllMatching: boolean;
  totalMatching: number;
  onSelectAllMatching: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onArchive: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionBar(props: Props) {
  const [tag, setTag] = useState("");

  return (
    <div className="bulk-bar" data-testid="bulk-bar">
      <span className="bulk-count" data-testid="bulk-count">
        {props.selectAllMatching
          ? `All ${props.totalMatching} matching selected`
          : `${props.count} selected`}
      </span>

      {!props.selectAllMatching && props.totalMatching > props.count && (
        <button
          type="button"
          className="link-button"
          onClick={props.onSelectAllMatching}
          data-testid="select-all-matching"
        >
          Select all {props.totalMatching} matching
        </button>
      )}

      <span className="bulk-actions">
        <input
          type="text"
          placeholder="tag…"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="bulk-tag-input"
          data-testid="bulk-tag-input"
        />
        <button
          type="button"
          disabled={tag.trim() === ""}
          onClick={() => {
            props.onAddTag(tag.trim());
            setTag("");
          }}
          data-testid="bulk-add-tag"
        >
          Add tag
        </button>
        <button
          type="button"
          disabled={tag.trim() === ""}
          onClick={() => {
            props.onRemoveTag(tag.trim());
            setTag("");
          }}
          data-testid="bulk-remove-tag"
        >
          Remove tag
        </button>
        <button type="button" onClick={props.onArchive} data-testid="bulk-archive">
          Archive
        </button>
        <button type="button" onClick={props.onMarkRead} data-testid="bulk-mark-read">
          Mark read
        </button>
        <button type="button" onClick={props.onMarkUnread} data-testid="bulk-mark-unread">
          Mark unread
        </button>
        <button
          type="button"
          className="link-danger"
          onClick={props.onDelete}
          data-testid="bulk-delete"
        >
          Delete
        </button>
        <button type="button" className="link-button" onClick={props.onClear}>
          Clear
        </button>
      </span>
    </div>
  );
}
