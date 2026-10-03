import React, { useState } from 'react';
import { api } from '../api.js';

// Local self-contained copy + Internet Archive snapshot controls (US9).
export default function CaptureControls({ bookmark }) {
  const [capture, setCapture] = useState(bookmark.capture);
  const [snapshot, setSnapshot] = useState(bookmark.archiveSnapshot);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const doCapture = async () => {
    setBusy('capture');
    setMessage('');
    try {
      const r = await api.capture(bookmark.id);
      setCapture(r.capture);
      if (r.message) setMessage(r.message);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy('');
    }
  };

  const doSnapshot = async () => {
    setBusy('snapshot');
    setMessage('');
    try {
      const r = await api.archiveorg(bookmark.id);
      setSnapshot(r.snapshot);
      if (r.message) setMessage(r.message);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="capture-controls">
      <h3>Preserve this page</h3>
      {message && <p className="error">{message}</p>}
      <div className="row">
        <button type="button" onClick={doCapture} disabled={busy === 'capture'}>
          {busy === 'capture' ? 'Saving copy…' : 'Save local copy'}
        </button>
        {capture && capture.status === 'ready' && (
          <a href={`/api/bookmarks/${bookmark.id}/capture`} target="_blank" rel="noreferrer">
            Open saved {capture.kind === 'pdf' ? 'PDF' : 'copy'}
          </a>
        )}
        {capture && capture.status === 'failed' && <span className="muted">Copy failed</span>}
      </div>
      <div className="row">
        <button type="button" onClick={doSnapshot} disabled={busy === 'snapshot'}>
          {busy === 'snapshot' ? 'Requesting…' : 'Internet Archive snapshot'}
        </button>
        {snapshot && snapshot.snapshotUrl && (
          <a href={snapshot.snapshotUrl} target="_blank" rel="noreferrer">
            View snapshot
          </a>
        )}
        {snapshot && snapshot.status === 'pending' && <span className="muted">Snapshot pending…</span>}
        {snapshot && snapshot.status === 'failed' && <span className="muted">Snapshot failed</span>}
      </div>
    </div>
  );
}
