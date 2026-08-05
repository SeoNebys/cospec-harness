import { useState } from "react";
import type { Bookmark } from "../types";
import { TagEditor } from "../components/TagEditor";
import { api } from "../services/apiClient";

interface Props {
  bookmark: Bookmark;
  onSaved: () => void;
  onCancel: () => void;
}

/** Edit a bookmark's title, note, and tags (FR-010, FR-015). */
export function BookmarkDetail({ bookmark, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(bookmark.title ?? "");
  const [note, setNote] = useState(bookmark.note ?? "");
  const [tags, setTags] = useState<string[]>(bookmark.tags);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.updateBookmark(bookmark.id, { title: title.trim(), note: note.trim(), tags });
      onSaved();
    } catch {
      setError("Could not save changes. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} data-testid="edit-modal">
        <h2 style={{ marginTop: 0, fontSize: "1.2rem" }}>Edit bookmark</h2>
        <div className="field">
          <label>Address</label>
          <div className="url">{bookmark.url}</div>
        </div>
        <div className="field">
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="edit-title"
          />
        </div>
        <div className="field">
          <label>Note</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} data-testid="edit-note" />
        </div>
        <div className="field">
          <label>Tags</label>
          <TagEditor tags={tags} onChange={setTags} />
        </div>
        {error && <div className="banner" style={{ background: "#ffe3e3", borderColor: "#ffa8a8" }}>{error}</div>}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className="primary" onClick={() => void save()} disabled={saving} data-testid="edit-save">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
