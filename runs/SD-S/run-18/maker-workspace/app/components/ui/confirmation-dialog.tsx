import { useEffect, useRef } from "react";

export function ConfirmationDialog({ open, title, message, pending, onCancel, onConfirm }: {
  open: boolean;
  title: string;
  message: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prior = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => prior?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onCancel(); }}>
      <div ref={dialogRef} className="dialog-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) onCancel();
        if (event.key === "Tab") {
          const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
          if (!controls.length) return;
          const current = controls.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.shiftKey ? (current <= 0 ? controls.length - 1 : current - 1) : (current >= controls.length - 1 ? 0 : current + 1);
          event.preventDefault();
          controls[next]?.focus();
        }
      }}>
        <p className="eyebrow">Permanent action</p>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <div className="dialog-actions">
          <button ref={cancelRef} className="button button-secondary" type="button" disabled={pending} onClick={onCancel}>Keep bookmark</button>
          <button className="button button-danger" type="button" disabled={pending} onClick={onConfirm}>{pending ? "Deleting…" : "Delete permanently"}</button>
        </div>
      </div>
    </div>
  );
}
