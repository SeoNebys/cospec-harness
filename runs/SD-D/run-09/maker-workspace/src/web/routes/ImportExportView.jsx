import React, { useState } from 'react';
import { api } from '../api/client.js';

export function ImportExportView() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await api.importFile(file);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div>
      <h2>Import / Export</h2>

      <div className="form" style={{ marginBottom: 20 }}>
        <h3>Import</h3>
        <p className="hint">
          Import a standard browser bookmarks HTML file (Chrome, Firefox, Safari, Edge). Titles,
          dates and folder tags are preserved; duplicates are skipped.
        </p>
        <input type="file" accept=".html,text/html" onChange={onImport} disabled={busy} />
        {busy && <p>Importing…</p>}
        {result && (
          <p style={{ color: '#1b7f43' }}>
            Imported {result.added} bookmark(s); skipped {result.skipped} duplicate(s).
          </p>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="form">
        <h3>Export</h3>
        <p className="hint">Download your whole collection as a standard bookmarks HTML file.</p>
        <a href={api.exportUrl()} download="bookmarks.html">
          <button className="primary" type="button">
            Export bookmarks
          </button>
        </a>
      </div>
    </div>
  );
}
