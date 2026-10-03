import { useRef } from 'react';
export function DeleteBookmarkDialog({
  title,
  onCancel,
  onConfirm,
  busy
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <dialog
      ref={(el) => {
        ref.current = el;
        if (el && !el.open) el.showModal();
      }}
      onCancel={onCancel}
    >
      <div className="dialog-body">
        <p className="eyebrow danger-text">Permanent deletion</p>
        <h2>Delete “{title}”?</h2>
        <p>
          This removes the bookmark, its note, and its tag connections forever. Archiving is the
          reversible option.
        </p>
        <div className="form-actions">
          <button onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button className="danger" disabled={busy} onClick={onConfirm}>
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
