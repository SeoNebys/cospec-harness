import { useState, type FormEvent } from 'react';
import { updateBookmark, ApiError, type Bookmark } from '../api';

// Inline edit form for a bookmark's title, address, and description (FR-011).
// Tags are edited directly on the list item, so they are not repeated here.
export function EditBookmarkForm({
  bookmark,
  onSaved,
  onCancel,
}: {
  bookmark: Bookmark;
  onSaved: (b: Bookmark) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState(bookmark.url);
  const [title, setTitle] = useState(bookmark.title);
  const [description, setDescription] = useState(bookmark.description);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const saved = await updateBookmark(bookmark.id, { url, title, description });
      onSaved(saved);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.body.message
          : 'Could not save changes. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="edit-form" onSubmit={submit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Edit title"
        placeholder="Title"
      />
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        aria-label="Edit address"
        placeholder="https://…"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label="Edit notes"
        placeholder="Notes (optional)"
        rows={2}
      />
      <div className="edit-actions">
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
