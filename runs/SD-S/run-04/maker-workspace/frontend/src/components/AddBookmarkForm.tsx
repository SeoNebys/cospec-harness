import { useState } from "react";
import { api, ApiError, type CreateBookmarkInput } from "../services/apiClient";

interface Props {
  onAdded: () => void;
}

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Form to add a bookmark. The user pastes a URL and may optionally set a title,
 * note, and tags; the title auto-fills from the fetched page metadata after
 * saving (FR-014) unless the user typed one (FR-015). Duplicates are warned
 * before saving (FR-012).
 */
export function AddBookmarkForm({ onAdded }: Props) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setUrl("");
    setTitle("");
    setNote("");
    setTags("");
    setError(null);
    setDuplicateWarning(null);
  };

  async function submit(allowDuplicate: boolean) {
    setSubmitting(true);
    setError(null);
    const input: CreateBookmarkInput = {
      url,
      title: title.trim() || undefined,
      note: note.trim() || undefined,
      tags: parseTags(tags),
      allowDuplicate,
    };
    try {
      await api.createBookmark(input);
      reset();
      onAdded();
    } catch (err) {
      if (err instanceof ApiError && err.code === "DUPLICATE_BOOKMARK") {
        setDuplicateWarning("This link is already saved. Save it again anyway?");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="add-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      <div className="row">
        <input
          type="url"
          placeholder="Paste a link (https://…)"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setDuplicateWarning(null);
          }}
          required
          data-testid="url-input"
          aria-label="Web address"
        />
        <button className="primary" type="submit" disabled={submitting || !url.trim()}>
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="field" style={{ marginTop: 10 }}>
        <label>Title (optional — auto-filled from the page if left blank)</label>
        <input
          type="text"
          placeholder="Leave blank to use the page's title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="title-input"
        />
      </div>
      <div className="field">
        <label>Note (optional)</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} data-testid="note-input" />
      </div>
      <div className="field">
        <label>Tags (optional, comma-separated)</label>
        <input type="text" placeholder="work, reading" value={tags} onChange={(e) => setTags(e.target.value)} data-testid="tags-input" />
      </div>

      {error && (
        <div className="banner" data-testid="add-error" style={{ background: "#ffe3e3", borderColor: "#ffa8a8" }}>
          {error}
        </div>
      )}
      {duplicateWarning && (
        <div className="banner" data-testid="duplicate-warning">
          {duplicateWarning}{" "}
          <button type="button" onClick={() => void submit(true)} disabled={submitting}>
            Save anyway
          </button>
        </div>
      )}
    </form>
  );
}
