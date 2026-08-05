// Edit a bookmark: title, description, tags, and Markdown notes with a live
// rendered preview (US3, FR-004/004b/007). Shown as a modal panel.

import { useState } from "react";
import { marked } from "marked";
import { updateBookmark, type Bookmark } from "../api/client";
import { TagInput } from "./TagInput";

interface Props {
  bookmark: Bookmark;
  /** Highlights the edit intent when opened via a re-save (FR-011). */
  reason?: "resave" | null;
  onSaved: (updated: Bookmark) => void;
  onCancel: () => void;
}

export function EditBookmark({ bookmark, reason, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(bookmark.title);
  const [description, setDescription] = useState(bookmark.description ?? "");
  const [notes, setNotes] = useState(bookmark.notes ?? "");
  const [tags, setTags] = useState<string[]>(bookmark.tags);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      const updated = await updateBookmark(bookmark.id, {
        title,
        description,
        notes,
        tags,
      });
      onSaved(updated);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="edit-panel">
      <div className="modal">
        <h2>Edit bookmark</h2>
        {reason === "resave" && (
          <p className="notice" data-testid="resave-notice">
            You already saved this link — here it is, ready to tweak.
          </p>
        )}
        <span className="edit-url">{bookmark.url}</span>

        <label>
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="edit-title"
          />
        </label>

        <label>
          Description
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="edit-description"
          />
        </label>

        <label>
          Tags
          <TagInput tags={tags} onChange={setTags} />
        </label>

        <label>
          Notes (Markdown — **bold**, lists, [links](url))
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            data-testid="edit-notes"
          />
        </label>
        {notes.trim() && (
          <div className="notes-preview" data-testid="notes-preview">
            <span className="notes-preview-label">Preview</span>
            <div dangerouslySetInnerHTML={{ __html: marked.parse(notes) as string }} />
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="btn-primary"
            data-testid="edit-save"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
