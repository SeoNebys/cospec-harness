import { useState } from 'react';
import type { Bookmark } from '../types';
import { createBookmark, getMetadata } from '../api/client';
import { TagInput } from './TagInput';

interface Props {
  onClose: () => void;
  onSaved: () => void;
  onDuplicate: (bookmark: Bookmark) => void;
}

// Save flow (US1): fetch editable metadata, then create. Duplicate opens the
// existing bookmark for editing (US2).
export function SaveDialog({ onClose, onSaved, onDuplicate }: Props) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchMeta() {
    setLoading(true);
    setError('');
    try {
      const meta = await getMetadata(url);
      setTitle(meta.title || url);
      setDescription(meta.description || '');
      setPreview(meta.previewImageUrl);
      setFetched(true);
    } catch (e) {
      // Metadata failure must not block saving.
      setTitle((t) => t || url);
      setFetched(true);
      setError('Could not fetch page details — you can still save.');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setLoading(true);
    setError('');
    try {
      const { bookmark, duplicate } = await createBookmark({ url, title, description, tags });
      if (duplicate) {
        onDuplicate(bookmark);
        return;
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Save a bookmark</h2>
        <label>Address</label>
        <div className="row">
          <input
            autoFocus
            value={url}
            placeholder="https://…"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !fetched && url && fetchMeta()}
          />
          {!fetched && (
            <button type="button" onClick={fetchMeta} disabled={!url || loading}>
              {loading ? 'Fetching…' : 'Fetch'}
            </button>
          )}
        </div>

        {fetched && (
          <>
            {preview && <img className="preview" src={preview} alt="" />}
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
            <label>Description</label>
            <textarea value={description} rows={2} onChange={(e) => setDescription(e.target.value)} />
            <label>Tags</label>
            <TagInput tags={tags} onChange={setTags} />
          </>
        )}

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={save} disabled={!url || loading}>
            {loading ? 'Saving…' : 'Save bookmark'}
          </button>
        </div>
      </div>
    </div>
  );
}
