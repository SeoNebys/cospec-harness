import { useState } from 'react';
import type { Bookmark } from '../types';
import { deleteBookmark, updateBookmark } from '../api/client';
import { TagInput } from './TagInput';
import { CopyLinks } from './CopyLinks';
import { renderMarkdown } from '../lib/markdown';

interface Props {
  bookmark: Bookmark;
  onClose: () => void;
  onSaved: () => void;
}

// Edit all fields (FR-023), delete with confirm (FR-024), Markdown note (US7).
export function EditDialog({ bookmark, onClose, onSaved }: Props) {
  const [url, setUrl] = useState(bookmark.url);
  const [title, setTitle] = useState(bookmark.title);
  const [description, setDescription] = useState(bookmark.description);
  const [note, setNote] = useState(bookmark.note_markdown);
  const [tags, setTags] = useState<string[]>(bookmark.tags);
  const [readLater, setReadLater] = useState(!bookmark.read);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await updateBookmark(bookmark.id, {
        url,
        title,
        description,
        note_markdown: note,
        tags,
        read: !readLater,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  async function del() {
    if (!confirm('Delete this bookmark permanently? This cannot be undone.')) return;
    await deleteBookmark(bookmark.id);
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit bookmark</h2>
        <label>Address</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} />
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        <label>Description</label>
        <textarea value={description} rows={2} onChange={(e) => setDescription(e.target.value)} />
        <label>
          Note (Markdown){' '}
          <button type="button" className="linklike" onClick={() => setPreview((p) => !p)}>
            {preview ? 'Edit' : 'Preview'}
          </button>
        </label>
        {preview ? (
          <div className="note-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(note) }} />
        ) : (
          <textarea value={note} rows={5} onChange={(e) => setNote(e.target.value)} />
        )}
        <label>Tags</label>
        <TagInput tags={tags} onChange={setTags} />
        <label className="checkbox">
          <input type="checkbox" checked={readLater} onChange={(e) => setReadLater(e.target.checked)} />
          Mark as “read later”
        </label>
        <CopyLinks bookmark={bookmark} />
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="danger" onClick={del}>
            Delete
          </button>
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
