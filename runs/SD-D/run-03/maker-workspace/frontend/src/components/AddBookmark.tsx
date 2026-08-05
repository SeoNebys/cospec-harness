// Add-bookmark form with inline validation messaging (US1).

import { useState } from "react";
import { ApiError, saveBookmark, type Bookmark } from "../api/client";

interface Props {
  onSaved: (bookmark: Bookmark, existing: boolean) => void;
}

export function AddBookmark({ onSaved }: Props) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { bookmark, existing } = await saveBookmark(url);
      setUrl("");
      onSaved(bookmark, existing);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="add-bookmark" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="https://example.com/page-to-keep"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        aria-label="Web address"
        data-testid="url-input"
      />
      <button type="submit" disabled={busy || url.trim() === ""} data-testid="save-button">
        {busy ? "Saving…" : "Save"}
      </button>
      {error && (
        <p className="error" role="alert" data-testid="save-error">
          {error}
        </p>
      )}
    </form>
  );
}
