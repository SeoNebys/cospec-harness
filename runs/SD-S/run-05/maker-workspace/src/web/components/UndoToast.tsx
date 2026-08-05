// Transient toast shown after a deletion, offering an immediate undo (FR-013).
export function UndoToast({
  title,
  onUndo,
  onDismiss,
}: {
  title: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="undo-toast" role="status">
      <span>Deleted “{title}”.</span>
      <button type="button" onClick={onUndo}>
        Undo
      </button>
      <button type="button" className="dismiss" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
