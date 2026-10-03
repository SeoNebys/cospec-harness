import { useEffect, useRef } from 'react';
import type { Bookmark } from '../../../shared/contracts/bookmarks';

export function DeleteBookmarkDialog({
  bookmark,
  busy,
  onCancel,
  onConfirm,
}: {
  bookmark: Bookmark;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        className="dialog delete-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-copy"
      >
        <p className="dialog-icon danger">!</p>
        <p className="eyebrow">Permanent action</p>
        <h2 id="delete-title">Delete “{bookmark.title}”?</h2>
        <p id="delete-copy" className="muted">
          This bookmark and its notes will be permanently removed. This can’t be undone.
        </p>
        <div className="dialog-actions">
          <button ref={cancel} className="button ghost" onClick={onCancel}>
            Keep bookmark
          </button>
          <button className="button danger" disabled={busy} onClick={onConfirm}>
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
