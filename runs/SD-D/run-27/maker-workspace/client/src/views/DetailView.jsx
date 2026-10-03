import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import TagInput from '../components/TagInput.jsx';

export default function DetailView({ id, onClose, onSaved }) {
  const [bm, setBm] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [preserveMsg, setPreserveMsg] = useState('');

  useEffect(() => {
    api.getBookmark(id).then(r => setBm(r.bookmark)).catch(e => setErr(e.message));
  }, [id]);

  if (!bm) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          {err ? <div className="status-failed">{err}</div> : <div>Loading…</div>}
        </div>
      </div>
    );
  }

  function set(field, val) { setBm({ ...bm, [field]: val }); }

  async function save() {
    setBusy(true); setErr('');
    try {
      const r = await api.updateBookmark(id, {
        url: bm.url, title: bm.title, description: bm.description,
        note: bm.note, tags: bm.tags
      });
      setBm(r.bookmark);
      onSaved && onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function preserve(kind) {
    setPreserveMsg('Working…');
    try {
      const body = kind === 'archive' ? { local: false, archive_org: true } : { local: true };
      const r = await api.preserve(id, body);
      const detail = await api.getBookmark(id);
      setBm(detail.bookmark);
      const errs = (r.errors || []).map(e => e.message).join('; ');
      setPreserveMsg(errs || 'Preservation complete.');
    } catch (e) {
      setPreserveMsg('Preservation failed: ' + e.message);
    }
  }

  async function retry() {
    try { const r = await api.retryMetadata(id); setBm({ ...bm, ...r.bookmark }); onSaved && onSaved(); }
    catch (e) { setErr(e.message); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="row"><h2 style={{ flex: 1, margin: 0, fontSize: '1.1rem' }}>Edit bookmark</h2>
          <button onClick={onClose}>Close</button></div>
        {err && <div className="status-failed" style={{ margin: '8px 0' }}>{err}</div>}
        {bm.preview_image_url && <img src={bm.preview_image_url} alt="" style={{ maxWidth: '100%', borderRadius: 8, margin: '8px 0' }} onError={e => e.target.remove()} />}

        <div className="field"><label>Address</label>
          <input value={bm.url || ''} onChange={e => set('url', e.target.value)} /></div>
        <div className="field"><label>Title</label>
          <input value={bm.title || ''} onChange={e => set('title', e.target.value)} /></div>
        <div className="field"><label>Description</label>
          <textarea rows={2} value={bm.description || ''} onChange={e => set('description', e.target.value)} /></div>
        <div className="field"><label>Note (Markdown — bold, italic, lists, links)</label>
          <textarea rows={4} value={bm.note || ''} onChange={e => set('note', e.target.value)} />
          {bm.note_html && <div className="note-html" style={{ marginTop: 6 }} dangerouslySetInnerHTML={{ __html: bm.note_html }} />}
        </div>
        <div className="field"><label>Tags</label>
          <TagInput tags={bm.tags || []} onChange={t => set('tags', t)} /></div>

        {bm.metadata_status === 'failed' && (
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="status-failed">Metadata unavailable.</span>
            <button onClick={retry}>Retry fetch</button>
          </div>
        )}

        <div className="card" style={{ background: '#fafbff' }}>
          <div className="row wrap">
            <strong style={{ flex: 1 }}>Preserve page</strong>
            <button onClick={() => preserve('local')}>Save local copy</button>
            <button onClick={() => preserve('archive')}>Internet Archive</button>
          </div>
          {preserveMsg && <div className="muted" style={{ marginTop: 6 }}>{preserveMsg}</div>}
          {bm.preserved && bm.preserved.length > 0 && (
            <ul style={{ marginBottom: 0 }}>
              {bm.preserved.map(p => (
                <li key={p.id}>
                  {p.file_path
                    ? <a href={`/api/bookmarks/${id}/preserved/${p.id}`} target="_blank" rel="noopener noreferrer">Open preserved {p.kind.toUpperCase()}</a>
                    : null}
                  {p.archive_org_url && <> — <a href={p.archive_org_url} target="_blank" rel="noopener noreferrer">Internet Archive snapshot ({p.archive_org_status})</a></>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <div className="spacer" />
          <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
