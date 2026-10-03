import React, { useState } from 'react';

export default function ImportExport({ onImported }) {
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function doImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true); setErr(''); setSummary(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const resp = await fetch('/api/import', { method: 'POST', body: fd });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ? data.error.message : 'Import failed');
      setSummary(data);
      onImported && onImported();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Import / Export</h2>
      <div className="field">
        <label>Import a browser bookmark file (Netscape HTML)</label>
        <input type="file" accept=".html,text/html" onChange={doImport} disabled={busy} />
      </div>
      {err && <div className="status-failed">{err}</div>}
      {summary && (
        <div className="card" style={{ background: '#f6fff6' }}>
          Imported: <strong>{summary.added}</strong> added,{' '}
          <strong>{summary.skipped_duplicates}</strong> skipped as duplicates,{' '}
          <strong>{summary.failed}</strong> failed.
        </div>
      )}
      <div className="field">
        <label>Export your collection</label>
        <a href="/api/export"><button type="button">Download bookmarks.html</button></a>
      </div>
    </div>
  );
}
