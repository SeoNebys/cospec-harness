import { useState, type FormEvent } from 'react';
import type { Bookmark } from '../../shared/types.js';
import { ApiClientError, updateBookmark, type BookmarkDraft } from '../api/client.js';

interface BookmarkEditorProps {
  bookmark: Bookmark;
  onSaved: (bookmark: Bookmark) => void | Promise<void>;
  onCancel: () => void;
}

export function BookmarkEditor({ bookmark, onSaved, onCancel }: BookmarkEditorProps) {
  const [url, setUrl] = useState(bookmark.url);
  const [title, setTitle] = useState(bookmark.title);
  const [description, setDescription] = useState(bookmark.description ?? '');
  const [tagsText, setTagsText] = useState(bookmark.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicateDraft, setDuplicateDraft] = useState<BookmarkDraft | null>(null);

  function draft(allowDuplicate = false): BookmarkDraft {
    return {
      url,
      title,
      description: description.trim() || null,
      tags: tagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
      allowDuplicate,
    };
  }

  async function save(values: BookmarkDraft) {
    setSaving(true);
    setError('');
    try {
      const updated = await updateBookmark(bookmark.id, values);
      setDuplicateDraft(null);
      await onSaved(updated);
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'DUPLICATE_URL') {
        setDuplicateDraft(values);
      } else {
        setError(caught instanceof Error ? caught.message : 'The changes could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void save(draft());
  }

  return (
    <form className="edit-form" onSubmit={submit} aria-label={`Edit ${bookmark.title}`}>
      <div className="field">
        <label htmlFor={`edit-url-${bookmark.id}`}>Web address</label>
        <input id={`edit-url-${bookmark.id}`} type="url" value={url} onChange={(event) => setUrl(event.target.value)} maxLength={2048} required />
      </div>
      <div className="field">
        <label htmlFor={`edit-title-${bookmark.id}`}>Title</label>
        <input id={`edit-title-${bookmark.id}`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} required />
      </div>
      <div className="field">
        <label htmlFor={`edit-description-${bookmark.id}`}>Description <span>optional</span></label>
        <textarea id={`edit-description-${bookmark.id}`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} />
      </div>
      <div className="field">
        <label htmlFor={`edit-tags-${bookmark.id}`}>Tags <span>optional, separated by commas</span></label>
        <input id={`edit-tags-${bookmark.id}`} value={tagsText} onChange={(event) => setTagsText(event.target.value)} />
      </div>
      {error ? <p className="message error-message" role="alert">{error}</p> : null}
      <div className="form-actions">
        <button className="primary-button" type="submit" disabled={saving || !url.trim() || !title.trim()}>{saving ? 'Saving…' : 'Save changes'}</button>
        <button className="secondary-button" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
      {duplicateDraft ? (
        <div className="duplicate-callout" role="alert">
          <strong>Another bookmark uses this address.</strong>
          <span>Cancel the change or update this bookmark to use the same address.</span>
          <div className="callout-actions">
            <button className="secondary-button" type="button" onClick={() => setDuplicateDraft(null)}>Cancel duplicate</button>
            <button className="primary-button" type="button" onClick={() => void save({ ...duplicateDraft, allowDuplicate: true })}>Update anyway</button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
