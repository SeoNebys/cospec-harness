import { FormEvent, useState } from "react";
import { ApiError, Bookmark, createBookmark } from "../services/api";

interface Props {
  onSaved: (bookmark: Bookmark, duplicate: boolean) => void;
}

export function AddBookmark({ onSaved }: Props) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) return;

    setBusy(true);
    try {
      const { bookmark, duplicate } = await createBookmark(trimmed);
      onSaved(bookmark, duplicate);
      setUrl("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save that bookmark.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="add-bookmark" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Paste a link to save (https://…)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        aria-label="Bookmark address"
        disabled={busy}
      />
      <button type="submit" disabled={busy || !url.trim()}>
        {busy ? "Saving…" : "Save"}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
