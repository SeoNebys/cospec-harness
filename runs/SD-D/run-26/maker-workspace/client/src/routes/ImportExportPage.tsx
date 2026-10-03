import { useState, type ChangeEvent } from 'react';
import { api } from '../services/api.js';
type Preview = {
  id: string;
  newCount: number;
  duplicateCount: number;
  invalidCount: number;
  sourceKind: string;
};
export function ImportExportPage() {
  const [preview, setPreview] = useState<Preview | null>(null),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  async function choose(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus('Reading your bookmark file…');
    try {
      const html = await file.text();
      const p = await api<Preview>(
        `/api/imports/preview?fileName=${encodeURIComponent(file.name)}`,
        { method: 'POST', headers: { 'Content-Type': 'text/html' }, body: html }
      );
      setPreview(p);
      setStatus('Preview ready. Nothing has been changed yet.');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await api<any>(`/api/imports/${preview.id}/commit`, { method: 'POST', body: '{}' });
      setStatus(
        `Imported ${r.importedCount} bookmarks; skipped ${r.duplicateCount} duplicates and ${r.invalidCount} invalid entries.`
      );
      setPreview(null);
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!preview) return;
    setBusy(true);
    try {
      await api(`/api/imports/${preview.id}`, { method: 'DELETE' });
      setPreview(null);
      setStatus('Import cancelled. Your library was not changed.');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="portable-page">
      <header>
        <p className="eyebrow">Portability</p>
        <h1>Bring your bookmarks with you</h1>
        <p>
          Import a standard browser bookmarks HTML file, or download a complete copy of this
          library.
        </p>
      </header>
      <div className="portable-grid">
        <section className="portable-card">
          <span className="feature-icon">⇣</span>
          <h2>Import bookmarks</h2>
          <p>Folders become tags. We’ll show duplicates and problems before adding anything.</p>
          <label className="file-button">
            <input
              type="file"
              accept=".html,.htm,text/html"
              onChange={(e) => void choose(e)}
              disabled={busy}
            />
            <span>Choose bookmarks file</span>
          </label>
          {preview && (
            <div className="import-preview">
              <h3>Ready to import</h3>
              <dl>
                <div>
                  <dt>New</dt>
                  <dd>{preview.newCount}</dd>
                </div>
                <div>
                  <dt>Already saved</dt>
                  <dd>{preview.duplicateCount}</dd>
                </div>
                <div>
                  <dt>Couldn’t use</dt>
                  <dd>{preview.invalidCount}</dd>
                </div>
              </dl>
              <div className="form-actions">
                <button onClick={() => void cancel()} disabled={busy}>
                  Cancel import
                </button>
                <button className="primary" onClick={() => void commit()} disabled={busy}>
                  Import {preview.newCount} bookmarks
                </button>
              </div>
            </div>
          )}
        </section>
        <section className="portable-card">
          <span className="feature-icon">⇡</span>
          <h2>Export everything</h2>
          <p>
            Download a standard HTML bookmarks file that browsers can open. Larder details are
            included for round-trip restoration.
          </p>
          <a className="button-link" href="/api/exports/bookmarks.html" download>
            Download bookmark file
          </a>
        </section>
      </div>
      {status && (
        <p className="status-line" role="status">
          {status}
        </p>
      )}
    </main>
  );
}
