import type { BulkAction } from '../../../shared/contracts/bulk';
import { useDialogFocus } from '../../components/useDialogFocus';

export function BulkConfirmDialog({
  action,
  count,
  onCancel,
  onConfirm,
}: {
  action: BulkAction;
  count: number;
  onCancel(): void;
  onConfirm(): void;
}) {
  const dialogRef = useDialogFocus<HTMLElement>(onCancel);
  const isDelete = action.type === 'delete_permanently';
  const verb = isDelete ? 'Permanently delete' : action.type === 'restore' ? 'Restore' : 'Archive';
  return (
    <div className="confirm-overlay">
      <section
        ref={dialogRef}
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="bulk-confirm-title"
      >
        <p className="eyebrow">Confirm exact selection</p>
        <h2 id="bulk-confirm-title">
          {verb} {count} {count === 1 ? 'bookmark' : 'bookmarks'}?
        </h2>
        <p>
          {isDelete
            ? 'This cannot be undone. Notes, tags, and saved metadata will be removed.'
            : `This will ${action.type === 'restore' ? 'return every item to its active views' : 'move every item out of active views'}.`}
        </p>
        <div className="detail-actions">
          <button className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className={`button ${isDelete ? 'button--danger' : 'button--primary'}`} onClick={onConfirm}>
            {verb} {count}
          </button>
        </div>
      </section>
    </div>
  );
}
