import { useEffect, useRef, useState } from "react";
import { Button, Dialog, Status } from "../../components";
import { ApiError, api, type Bookmark, type BookmarkApiClient } from "../../lib/api";

export interface DeleteBookmarkDialogProps {
  open: boolean;
  bookmark: Pick<Bookmark, "id" | "title">;
  client?: BookmarkApiClient | undefined;
  onClose: () => void;
  onDeleted: (bookmarkId: number, announcement: string) => void;
}

export function DeleteBookmarkDialog({
  open,
  bookmark,
  client = api,
  onClose,
  onDeleted,
}: DeleteBookmarkDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDeleting(false);
      setError("");
    }
  }, [open]);

  async function confirmDeletion() {
    setDeleting(true);
    setError("");
    const controller = new AbortController();
    try {
      await client.deleteBookmark(bookmark.id, { signal: controller.signal });
      onDeleted(bookmark.id, `Bookmark “${bookmark.title}” permanently deleted.`);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.problem.message
          : "The bookmark could not be deleted. Please try again.",
      );
      setDeleting(false);
    }
  }

  function close() {
    if (!deleting) onClose();
  }

  return (
    <Dialog
      open={open}
      title={`Permanently delete ${bookmark.title}?`}
      description="This removes the bookmark from every view and cannot be undone."
      onClose={close}
      closeLabel="Cancel permanent deletion"
      initialFocusRef={cancelRef}
      destructive
      footer={
        <>
          <Button ref={cancelRef} variant="quiet" disabled={deleting} onClick={close}>
            Cancel
          </Button>
          <Button
            variant="danger"
            busy={deleting}
            busyLabel="Deleting bookmark…"
            onClick={confirmDeletion}
          >
            Delete bookmark
          </Button>
        </>
      }
    >
      {error ? (
        <Status tone="error" live="assertive">
          {error}
        </Status>
      ) : (
        <p>Only “{bookmark.title}” will be deleted.</p>
      )}
    </Dialog>
  );
}
