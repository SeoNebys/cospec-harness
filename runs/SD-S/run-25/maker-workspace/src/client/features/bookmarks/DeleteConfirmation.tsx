import { useEffect, useRef } from 'react';

export interface DeleteConfirmationProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmation({
  title,
  onCancel,
  onConfirm,
}: DeleteConfirmationProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);

  return (
    <div role="group" aria-label={`Delete ${title}`}>
      <p>This permanently removes the bookmark.</p>
      <button ref={cancelRef} type="button" onClick={onCancel}>
        Cancel
      </button>
      <button type="button" onClick={onConfirm}>
        Delete
      </button>
    </div>
  );
}
