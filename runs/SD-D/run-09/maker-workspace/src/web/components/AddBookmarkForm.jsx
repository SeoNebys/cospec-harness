import React, { useState } from 'react';
import { api } from '../api/client.js';
import { navigate } from '../main.jsx';
import { TagInput } from './TagInput.jsx';

// Save flow: enter URL → preview collects details for review → edit → commit.
// Re-saving an existing address opens it for editing (FR-006). Fallback details
// are shown when the page can't be read promptly (FR-007).
export function AddBookmarkForm() {
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState('url'); // 'url' | 'review'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fallback, setFallback] = useState(false);
  const [details, setDetails] = useState({
    title: '',
    description: '',
    note: '',
    tags: [],
    faviconPath: null,
    previewImagePath: null,
  });

  async function fetchDetails(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.preview(url);
      if (res.existing) {
        navigate(`/edit/${res.existing.id}`);
        return;
      }
      setDetails({
        title: res.title || '',
        description: res.description || '',
        note: '',
        tags: [],
        faviconPath: res.faviconPath || null,
        previewImagePath: res.previewImagePath || null,
      });
      setFallback(res.metadataStatus === 'fallback');
      setStage('review');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    setError('');
    setLoading(true);
    try {
      const res = await api.createBookmark({ url, ...details });
      navigate(`/edit/${res.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const set = (k) => (e) => setDetails({ ...details, [k]: e.target.value });

  return (
    <div className="form">
      <h2>Add a bookmark</h2>
      {error && <p className="error">{error}</p>}

      {stage === 'url' && (
        <form onSubmit={fetchDetails}>
          <label>Web address</label>
          <input
            type="text"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
          <p className="hint">We’ll collect the title, description, favicon and preview for you to review before saving.</p>
          <div style={{ marginTop: 12 }}>
            <button className="primary" type="submit" disabled={loading || !url.trim()}>
              {loading ? 'Fetching…' : 'Fetch details'}
            </button>
          </div>
        </form>
      )}

      {stage === 'review' && (
        <div>
          {fallback && (
            <p className="fallback">
              We couldn’t read that page promptly, so we filled in fallback details. You can edit them and save now.
            </p>
          )}
          {details.previewImagePath && (
            <img
              src={details.previewImagePath}
              alt="preview"
              style={{ maxWidth: '100%', borderRadius: 8, margin: '8px 0' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <label>Title</label>
          <input type="text" aria-label="Title" value={details.title} onChange={set('title')} />
          <label>Description</label>
          <textarea aria-label="Description" value={details.description} onChange={set('description')} />
          <label>Note (Markdown)</label>
          <textarea aria-label="Note" value={details.note} onChange={set('note')} placeholder="# Notes support Markdown" />
          <label>Tags</label>
          <TagInput value={details.tags} onChange={(tags) => setDetails({ ...details, tags })} />
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="primary" onClick={commit} disabled={loading}>
              {loading ? 'Saving…' : 'Save bookmark'}
            </button>
            <button onClick={() => setStage('url')} disabled={loading}>
              Back
            </button>
          </div>
          <p className="hint">Saving captures a local snapshot in the background; it never overwrites your title or description.</p>
        </div>
      )}
    </div>
  );
}
