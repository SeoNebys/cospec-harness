import React, { useState } from 'react';
import TagInput from './TagInput.jsx';
import { api } from '../api/client.js';

// Create or edit a bookmark. `existing` present => edit mode; otherwise save mode.
// Editable at both save and edit time: url, title, description, tags, note (FR-004).
export default function SaveDialog({ existing, onClose, onSaved, onDuplicate }) {
  const editing = !!existing;
  const [url, setUrl] = useState(existing ? existing.url : '');
  const [title, setTitle] = useState(existing ? existing.title || '' : '');
  const [description, setDescription] = useState(existing ? existing.description || '' : '');
  const [tags, setTags] = useState(existing ? existing.tags : []);
  const [note, setNote] = useState(existing ? existing.note_md || '' : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (editing) {
        const body = { url, title, description, tags, note_md: note };
        const r = await api.updateBookmark(existing.id, body);
        onSaved(r.bookmark);
      } else {
        const body = { url };
        if (title.trim()) body.title = title;
        if (description.trim()) body.description = description;
        if (tags.length) body.tags = tags;
        if (note.trim()) body.note_md = note;
        const r = await api.createBookmark(body);
        if (r.duplicate) {
          onDuplicate(r.bookmark);
        } else {
          onSaved(r.bookmark, true);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{editing ? 'Edit bookmark' : 'Save a bookmark'}</h2>
        <form onSubmit={submit}>
          <label>
            Web address
            <input data-testid="field-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" autoFocus={!editing} />
          </label>
          <label>
            Title {editing ? '' : '(optional — auto-filled if left blank)'}
            <input data-testid="field-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Description {editing ? '' : '(optional — auto-filled if left blank)'}
            <textarea data-testid="field-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </label>
          <label>
            Tags
            <TagInput tags={tags} onChange={setTags} />
          </label>
          <label>
            Note (Markdown)
            <textarea data-testid="field-note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Supports **Markdown**" />
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" data-testid="dialog-submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Save bookmark'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
