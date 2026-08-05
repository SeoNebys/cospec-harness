// Generic confirmation dialog — used before permanent deletes (US3, FR-008/SC-005).

interface Props {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, confirmLabel = "Delete", onConfirm, onCancel }: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="confirm-dialog">
      <div className="modal modal--small">
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-danger"
            data-testid="confirm-delete"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
