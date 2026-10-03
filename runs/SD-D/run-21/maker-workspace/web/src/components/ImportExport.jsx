import React, { useState } from 'react';
import { api } from '../api.js';

// Import a Netscape bookmark file (folders→tags, skip existing) and export
// the collection (US5).
export default function ImportExport({ onImported, onClose }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setSummary(null);
    try {
      const html = await file.text();
      const result = await api.importBookmarks(html);
      setSummary(result);
      onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="import-export">
      <div className="prefs-head">
        <h3>Import / export</h3>
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </div>
      <p className="muted small">
        Import a standard browser bookmark file. Folders become tags; addresses you already have are skipped.
      </p>
      {error && <p className="error">{error}</p>}
      <label className="file-label">
        {busy ? 'Importing…' : 'Choose bookmark file (.html)'}
        <input type="file" accept=".html,text/html" onChange={onFile} disabled={busy} />
      </label>
      {summary && (
        <p className="summary">
          Added {summary.added}, skipped {summary.skipped}.
        </p>
      )}
      <hr />
      <a className="button-link" href="/api/export">Export all bookmarks</a>
    </div>
  );
}
