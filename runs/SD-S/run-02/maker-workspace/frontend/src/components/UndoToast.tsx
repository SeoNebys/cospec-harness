interface Props {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}

/** Transient toast offering to undo a recent deletion. */
export function UndoToast({ message, onUndo, onDismiss }: Props) {
  return (
    <div className="undo-toast" role="status">
      <span>{message}</span>
      <button onClick={onUndo}>Undo</button>
      <button className="undo-toast__dismiss" onClick={onDismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
