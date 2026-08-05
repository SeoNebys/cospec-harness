// Import a browser bookmark file (or a JSON backup) (US4, FR-014).

import { useState } from "react";
import { importBookmarks, type ImportResult } from "../api/client";

interface Props {
  onDone: () => void;
  onClose: () => void;
}

export function ImportDialog({ onDone, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await importBookmarks(file));
    } catch {
      setError("Could not import that file. Is it a browser bookmark export or a backup?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="import-dialog">
      <div className="modal">
        <h2>Import bookmarks</h2>
        <p className="muted">
          Choose a browser bookmark file (exported as HTML) or a backup file made here. Your
          folders come in as tags, original dates are kept, and links you already have are skipped.
        </p>
        <input
          type="file"
          accept=".html,.htm,.json"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          data-testid="import-file"
        />
        {result && (
          <p className="notice" data-testid="import-result">
            Imported {result.imported} bookmark{result.imported === 1 ? "" : "s"}
            {result.skipped_duplicates > 0
              ? `, skipped ${result.skipped_duplicates} you already had`
              : ""}
            .
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={result ? onDone : onClose}>
            {result ? "Done" : "Cancel"}
          </button>
          {!result && (
            <button
              type="button"
              className="btn-primary"
              disabled={!file || busy}
              onClick={handleImport}
              data-testid="import-confirm"
            >
              {busy ? "Importing…" : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
