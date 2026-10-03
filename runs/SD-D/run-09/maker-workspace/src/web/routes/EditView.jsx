import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { navigate } from '../main.jsx';
import { TagInput } from '../components/TagInput.jsx';
import { MarkdownView } from '../components/MarkdownView.jsx';

export function EditView({ id }) {
  const [bm, setBm] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [showNotePreview, setShowNotePreview] = useState(true);
  const [archiving, setArchiving] = useState(false);

  async function load() {
    try {
      setBm(await api.getBookmark(id));
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!bm) return <div className="empty">Loading…</div>;

  const set = (k) => (e) => setBm({ ...bm, [k]: e.target.value });

  async function save() {
    setError('');
    setSaved(false);
    try {
      const updated = await api.updateBookmark(id, {
        url: bm.url,
        title: bm.title,
        description: bm.description,
        note: bm.note,
        tags: bm.tags,
      });
      setBm(updated);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggle(field) {
    const updated = await api.updateBookmark(id, { [field]: !bm[field] });
    setBm(updated);
  }

  async function remove() {
    if (!window.confirm('Permanently delete this bookmark? This cannot be undone.')) return;
    await api.deleteBookmark(id);
    navigate('/');
  }

  async function preserve() {
    setArchiving(true);
    setError('');
    try {
      const res = await api.webArchive(id);
      setBm({ ...bm, webArchiveUrl: res.webArchiveUrl });
    } catch (err) {
      setError('Internet Archive is unavailable right now. Please try again later.');
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="form">
      <h2>Edit bookmark</h2>
      {saved && <p style={{ color: '#1b7f43' }}>Saved.</p>}
      {error && <p className="error">{error}</p>}

      <label>Web address</label>
      <input type="text" value={bm.url} onChange={set('url')} />

      <label>Title</label>
      <input type="text" value={bm.title} onChange={set('title')} />

      <label>Description</label>
      <textarea value={bm.description} onChange={set('description')} />

      <label>
        Note (Markdown){' '}
        <button type="button" onClick={() => setShowNotePreview(!showNotePreview)} style={{ fontWeight: 400 }}>
          {showNotePreview ? 'Edit' : 'Preview'}
        </button>
      </label>
      {showNotePreview && bm.note ? (
        <MarkdownView source={bm.note} />
      ) : (
        <textarea value={bm.note} onChange={set('note')} placeholder="# Markdown supported" />
      )}

      <label>Tags</label>
      <TagInput value={bm.tags} onChange={(tags) => setBm({ ...bm, tags })} />

      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="primary" onClick={save}>
          Save changes
        </button>
        <button onClick={() => toggle('read')}>{bm.read ? 'Mark unread' : 'Mark read'}</button>
        <button onClick={() => toggle('archived')}>{bm.archived ? 'Un-archive' : 'Archive'}</button>
        <button className="danger" onClick={remove}>
          Delete
        </button>
      </div>

      <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      <h3>Snapshot & preservation</h3>
      <p className="meta" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span className={`status-pill ${bm.snapshotStatus}`}>Local snapshot: {bm.snapshotStatus}</span>
        {bm.snapshotStatus === 'available' && (
          <a href={api.snapshotUrl(id)} target="_blank" rel="noreferrer noopener">
            Open local snapshot ({bm.snapshotType})
          </a>
        )}
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={preserve} disabled={archiving}>
          {archiving ? 'Submitting…' : 'Preserve in Internet Archive'}
        </button>
        {bm.webArchiveUrl && (
          <a href={bm.webArchiveUrl} target="_blank" rel="noreferrer noopener">
            View archived copy
          </a>
        )}
      </div>
    </div>
  );
}
