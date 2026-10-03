import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
export function DeleteBookmarksDialog({
  ids,
  open,
  onClose,
  onConfirm,
}: {
  ids: string[];
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    setPending(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Deletion failed.');
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      open={open}
      title={`Permanently delete ${ids.length} bookmark${ids.length === 1 ? '' : 's'}?`}
      onClose={onClose}
    >
      <p>This cannot be undone. Notes, tags on these bookmarks, and saved preview details will be removed.</p>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" disabled={pending} onClick={() => void confirm()}>
          {pending ? 'Deleting…' : 'Delete permanently'}
        </Button>
      </div>
    </Dialog>
  );
}
