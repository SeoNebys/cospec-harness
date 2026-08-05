import { useState, type FormEvent } from 'react';
import { createBookmark, ApiError, type Bookmark } from '../api';

// Add-bookmark form with inline validation-error display (FR-002, FR-015) and a
// duplicate prompt offering to open the existing bookmark instead (FR-014).
export function AddBookmarkForm({ onAdded }: { onAdded: (b: Bookmark) => void }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Bookmark | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDuplicate(null);
    setBusy(true);
    try {
      const bookmark = await createBookmark({
        url,
        title: title || undefined,
      });
      onAdded(bookmark);
      setUrl('');
      setTitle('');
    } catch (err) {
      if (err instanceof ApiError && err.body.error === 'duplicate' && err.body.existing) {
        setDuplicate(err.body.existing);
      } else if (err instanceof ApiError) {
        setError(err.body.message);
      } else {
        setError('Could not save the bookmark. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="add-form">
      <input
        type="text"
        placeholder="Paste a web address (https://…)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        aria-label="Web address"
        required
      />
      <input
        type="text"
        placeholder="Title (optional — we'll fetch one)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Title"
      />
      <button type="submit" disabled={busy || !url.trim()}>
        {busy ? 'Saving…' : 'Save bookmark'}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {duplicate && (
        <p className="duplicate" role="alert">
          You already saved this address as{' '}
          <a href={duplicate.url} target="_blank" rel="noreferrer">
            “{duplicate.title}”
          </a>
          . <button type="button" onClick={() => setDuplicate(null)}>Dismiss</button>
        </p>
      )}
    </form>
  );
}
