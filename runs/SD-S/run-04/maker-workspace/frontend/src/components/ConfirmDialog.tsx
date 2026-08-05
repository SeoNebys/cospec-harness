interface Props {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Explicit confirmation before a destructive action (FR-011). */
export function ConfirmDialog({ message, confirmLabel = "Delete", onConfirm, onCancel }: Props) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} data-testid="confirm-dialog">
        <p>{message}</p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button onClick={onCancel}>Cancel</button>
          <button className="danger" onClick={onConfirm} data-testid="confirm-delete">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
