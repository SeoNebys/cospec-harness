import { useDialogFocus } from './useDialogFocus';

export function PermanentDeleteDialog({
  count = 1,
  onCancel,
  onConfirm,
}: {
  count?: number;
  onCancel(): void;
  onConfirm(): void;
}) {
  const dialogRef = useDialogFocus<HTMLElement>(onCancel);
  return (
    <div className="confirm-overlay">
      <section
        ref={dialogRef}
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
      >
        <p className="eyebrow">Permanent action</p>
        <h2 id="delete-title">
          Delete {count} {count === 1 ? 'bookmark' : 'bookmarks'} forever?
        </h2>
        <p>This cannot be undone. Notes, organization, and saved metadata will be removed.</p>
        <div className="detail-actions">
          <button className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="button button--danger" onClick={onConfirm}>
            Delete permanently
          </button>
        </div>
      </section>
    </div>
  );
}
