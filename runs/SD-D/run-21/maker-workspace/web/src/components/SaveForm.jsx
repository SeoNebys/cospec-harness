import React, { useState } from 'react';
import { api } from '../api.js';
import TagInput from './TagInput.jsx';
import NoteEditor from './NoteEditor.jsx';
import CaptureControls from './CaptureControls.jsx';

// Save form (US1) and edit form (US4). `existing` toggles edit mode; editing
// allows changing the address itself (FR-003).
export default function SaveForm({ existing, onSaved, onCancel }) {
  const [url, setUrl] = useState(existing?.url || '');
  const [title, setTitle] = useState(existing?.title || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [previewImageUrl, setPreviewImageUrl] = useState(existing?.previewImageUrl || '');
  const [iconUrl, setIconUrl] = useState(existing?.iconUrl || '');
  const [tags, setTags] = useState(existing?.tags || []);
  const [noteHtml, setNoteHtml] = useState(existing?.noteHtml || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isEdit = !!existing;

  const doFetch = async () => {
    setError('');
    try {
      const meta = await api.fetchMetadata(url);
      if (meta.title) setTitle(meta.title);
      if (meta.description) setDescription(meta.description);
      if (meta.previewImageUrl) setPreviewImageUrl(meta.previewImageUrl);
      if (meta.iconUrl) setIconUrl(meta.iconUrl);
    } catch (e) {
      setError(e.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = { url, title, description, previewImageUrl, iconUrl, tags, noteHtml };
      if (isEdit) {
        const updated = await api.updateBookmark(existing.id, payload);
        onSaved(updated, { edited: true });
      } else {
        const result = await api.createBookmark(payload);
        if (result && result.existing) {
          // Duplicate address opens the existing bookmark for editing (FR-015).
          onSaved(result.bookmark, { openedExisting: true });
        } else {
          onSaved(result, { created: true });
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="save-form" onSubmit={submit}>
      <h2>{isEdit ? 'Edit bookmark' : 'Save a bookmark'}</h2>
      {error && <p className="error" role="alert">{error}</p>}

      <label>
        Address
        <div className="row">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            autoFocus={!isEdit}
          />
          <button type="button" onClick={doFetch} disabled={!url.trim()}>
            Fetch details
          </button>
        </div>
      </label>

      {previewImageUrl && (
        <img className="preview" src={previewImageUrl} alt="Page preview" />
      )}

      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      </label>

      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </label>

      <label>
        Tags
        <TagInput tags={tags} onChange={setTags} />
      </label>

      <label>
        Note
        <NoteEditor value={noteHtml} onChange={setNoteHtml} />
      </label>

      {isEdit && <CaptureControls bookmark={existing} />}

      <div className="row actions">
        <button type="submit" disabled={busy || !url.trim()}>
          {isEdit ? 'Save changes' : 'Save bookmark'}
        </button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
