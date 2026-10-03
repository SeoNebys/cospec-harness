import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { Bookmark } from '../../../shared/api-types';

export function DeleteBookmarkDialog({ bookmark, busy, onCancel, onConfirm }: { bookmark: Bookmark; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelButton.current?.focus();
    return () => previous?.focus();
  }, []);

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); return; }
    if (event.key !== 'Tab' || !dialog.current) return;
    const controls = [...dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled)')];
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); }
  }

  return (
    <div className="dialog-backdrop" onKeyDown={onKeyDown}>
      <section ref={dialog} className="confirm-dialog destructive-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
        <p className="eyebrow">Permanent action</p><h2 id="delete-title">Delete “{bookmark.title}”?</h2><p id="delete-description">This bookmark will be removed permanently. This action cannot be undone.</p>
        <div className="form-actions"><button ref={cancelButton} className="button secondary" type="button" onClick={onCancel}>Cancel</button><button className="button danger" type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Deleting…' : 'Delete permanently'}</button></div>
      </section>
    </div>
  );
}
