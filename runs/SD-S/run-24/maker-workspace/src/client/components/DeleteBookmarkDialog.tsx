import { useId, useLayoutEffect, useRef } from 'react';

interface DeleteBookmarkDialogProps {
  title: string;
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteBookmarkDialog({
  title,
  open,
  pending,
  onCancel,
  onConfirm,
}: DeleteBookmarkDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
      else dialog.setAttribute('open', '');
      cancelRef.current?.focus();
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <dialog
        ref={dialogRef}
        className="delete-dialog"
        aria-labelledby={headingId}
        onCancel={(event) => {
          event.preventDefault();
          if (!pending) onCancel();
        }}
      >
        <p className="eyebrow">Permanent action</p>
        <h2 id={headingId}>Delete “{title}”?</h2>
        <p>This bookmark will be permanently removed. This cannot be undone.</p>
        <div className="dialog-actions">
          <button
            ref={cancelRef}
            className="button secondary"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
          <button className="button danger" onClick={onConfirm} disabled={pending}>
            {pending ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
