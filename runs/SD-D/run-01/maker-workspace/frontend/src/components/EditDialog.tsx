import { useState } from "react";
import { ApiError, Bookmark, deleteBookmark, updateBookmark } from "../services/api";
import { NoteEditor } from "./NoteEditor";
import { TagInput } from "./TagInput";

interface Props {
  bookmark: Bookmark;
  onSaved: (updated: Bookmark) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
}

export function EditDialog({ bookmark, onSaved, onDeleted, onClose }: Props) {
  const [title, setTitle] = useState(bookmark.title);
  const [url, setUrl] = useState(bookmark.url);
  const [noteHtml, setNoteHtml] = useState(bookmark.noteHtml ?? "");
  const [tags, setTags] = useState<string[]>(bookmark.tags);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSave() {
    setError(null);
    setBusy(true);
    try {
      const updated = await updateBookmark(bookmark.id, {
        title,
        url,
        noteHtml,
        tags,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteBookmark(bookmark.id);
      onDeleted(bookmark.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Edit bookmark</h2>

        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label>
          Address
          <input value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>

        <label>
          Note
          <NoteEditor valueHtml={noteHtml} onChange={setNoteHtml} />
        </label>

        <label>
          Tags
          <TagInput tags={tags} onChange={setTags} />
        </label>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="modal-actions">
          {confirmingDelete ? (
            <div className="confirm-delete">
              <span>Delete this bookmark?</span>
              <button type="button" className="danger" disabled={busy} onClick={handleDelete}>
                Yes, delete
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button type="button" className="danger-text" onClick={() => setConfirmingDelete(true)}>
                Delete
              </button>
              <span className="spacer" />
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="primary" disabled={busy} onClick={handleSave}>
                {busy ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
