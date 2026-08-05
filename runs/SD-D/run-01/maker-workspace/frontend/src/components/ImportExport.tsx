import { useRef, useState } from "react";
import { ApiError, importBookmarks } from "../services/api";

interface Props {
  onImported: () => void;
}

// Import UI (User Story 5). Export (User Story 6) will be added here later.
export function ImportExport({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const { added, skipped } = await importBookmarks(file);
      setMessage(
        `Imported ${added} bookmark${added === 1 ? "" : "s"}` +
          (skipped ? `, skipped ${skipped} already saved.` : ".")
      );
      onImported();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not import that file."
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="import-export">
      <input
        ref={inputRef}
        type="file"
        accept=".html,text/html"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Importing…" : "Import browser bookmarks"}
      </button>
      <a className="export-link" href="/api/export" download="bookmarks.html">
        Export to a file
      </a>
      {message && <span className="import-msg">{message}</span>}
      {error && <span className="error" role="alert">{error}</span>}
    </div>
  );
}
