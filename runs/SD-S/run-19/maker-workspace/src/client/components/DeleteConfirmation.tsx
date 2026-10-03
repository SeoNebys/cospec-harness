import { useEffect, useRef, useState } from 'react';

interface DeleteConfirmationProps {
  bookmarkTitle: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function DeleteConfirmation({ bookmarkTitle, onConfirm, onCancel }: DeleteConfirmationProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => cancelRef.current?.focus(), []);

  return (
    <div className="dialog-backdrop">
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-heading" aria-describedby="delete-description">
        <div className="dialog-icon" aria-hidden="true">×</div>
        <h4 id="delete-heading">Delete this bookmark?</h4>
        <p id="delete-description"><strong>{bookmarkTitle}</strong> will be removed permanently. This cannot be undone.</p>
        <div className="dialog-actions">
          <button ref={cancelRef} className="secondary-button" type="button" onClick={onCancel} disabled={deleting}>Keep bookmark</button>
          <button className="danger-button" type="button" disabled={deleting} onClick={async () => { setDeleting(true); await onConfirm(); }}>{deleting ? 'Deleting…' : 'Delete permanently'}</button>
        </div>
      </div>
    </div>
  );
}
