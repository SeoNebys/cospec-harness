import { useRef, useState } from 'react';
import { api } from '../api/client';

// Export / import the whole collection (FR-026..FR-030). Export is a direct
// download of the portable JSON; import reads a chosen file and posts it, then
// shows a summary or a clear error (leaving the collection untouched on failure).

export function BackupPanel({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const text = await file.text();
      let doc: unknown;
      try {
        doc = JSON.parse(text);
      } catch {
        throw new Error('That file isn’t valid JSON — is it a Bookmark Manager export?');
      }
      const summary = await api.importCollection(doc);
      setMessage(
        `Imported: ${summary.added} added, ${summary.alreadyPresent} already present` +
          (summary.savedSearchesAdded ? `, ${summary.savedSearchesAdded} saved searches` : '') +
          '.'
      );
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="backup-panel">
      <span className="backup-title">Backup</span>
      <a className="backup-btn" href={api.exportUrl} download>
        Export to file
      </a>
      <button
        type="button"
        className="backup-btn secondary"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
      >
        {busy ? 'Importing…' : 'Import from file'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={onFile}
      />
      {message ? <span className="backup-msg">{message}</span> : null}
      {error ? <span className="backup-err">{error}</span> : null}
    </div>
  );
}
