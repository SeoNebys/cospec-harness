import { useEffect, useRef, useState } from 'react';
import type { Bookmark } from './types';

interface Props {
  bookmark: Bookmark | null;
  returnFocus?: HTMLButtonElement | null;
  onCancel: () => void;
  onConfirm: (bookmark: Bookmark) => Promise<void>;
}
export function DeleteBookmarkDialog({ bookmark, returnFocus, onCancel, onConfirm }: Props) {
  const dialog = useRef<HTMLDialogElement>(null),
    cancel = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (bookmark) {
      dialog.current?.showModal();
      cancel.current?.focus();
    } else dialog.current?.close();
  }, [bookmark]);
  function close() {
    onCancel();
    window.setTimeout(() => returnFocus?.focus(), 0);
  }
  async function confirm() {
    if (!bookmark) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm(bookmark);
      onCancel();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The bookmark could not be deleted.');
      setPending(false);
    }
  }
  return (
    <dialog
      className="confirm-dialog"
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) close();
      }}
      onClose={() => returnFocus?.focus()}
    >
      <div className="danger-glyph" aria-hidden="true">
        !
      </div>
      <h2>Delete this bookmark?</h2>
      <p>
        <strong>{bookmark?.title}</strong> will be permanently removed. This can’t be undone.
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button ref={cancel} className="button ghost" disabled={pending} onClick={close}>
          Keep bookmark
        </button>
        <button className="button danger" disabled={pending} onClick={() => void confirm()}>
          {pending ? 'Deleting…' : 'Delete permanently'}
        </button>
      </div>
    </dialog>
  );
}
