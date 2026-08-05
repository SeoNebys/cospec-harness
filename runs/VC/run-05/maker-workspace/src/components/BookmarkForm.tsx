import { useEffect, useState } from "react";
import type { Bookmark, BookmarkDraft } from "../types.ts";
import { fetchTitle } from "../api.ts";

interface Props {
  initial?: Bookmark;
  onSubmit: (draft: BookmarkDraft) => Promise<void>;
  onCancel?: () => void;
}

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function BookmarkForm({ initial, onSubmit, onCancel }: Props) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setUrl(initial?.url ?? "");
    setTitle(initial?.title ?? "");
    setNotes(initial?.notes ?? "");
    setTagsText((initial?.tags ?? []).join(", "));
    setError("");
  }, [initial]);

  async function handleFetchTitle() {
    if (!url.trim()) return;
    setFetching(true);
    setError("");
    try {
      const fetched = await fetchTitle(url.trim());
      if (fetched) setTitle(fetched);
      else setError("Couldn't read a title from that page.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch title.");
    } finally {
      setFetching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        url: url.trim(),
        title: title.trim(),
        notes: notes.trim(),
        tags: parseTags(tagsText),
      });
      if (!initial) {
        setUrl("");
        setTitle("");
        setNotes("");
        setTagsText("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-row">
        <input
          className="input"
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button
          type="button"
          className="btn btn-ghost"
          onClick={handleFetchTitle}
          disabled={fetching || !url.trim()}
          title="Fetch the page title"
        >
          {fetching ? "…" : "Get title"}
        </button>
      </div>

      <input
        className="input"
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <input
        className="input"
        type="text"
        placeholder="Tags (comma separated)"
        value={tagsText}
        onChange={(e) => setTagsText(e.target.value)}
      />

      <textarea
        className="input textarea"
        placeholder="Notes"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {initial ? "Save changes" : "Add bookmark"}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
