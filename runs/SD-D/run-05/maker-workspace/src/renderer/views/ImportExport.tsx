import { useEffect, useState } from 'react'
import type { ImportProgress } from '@shared/types'

// Import/export controls (US7): bring in a browser bookmarks file (with live
// progress and an added/skipped/failed summary) and export the whole collection
// to a portable file. File pickers are handled by the desktop app.
export function ImportExport({ onImported }: { onImported: () => void }): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => window.api.onImportProgress((p) => setProgress(p)), [])

  async function doImport(): Promise<void> {
    setBusy(true)
    setMessage(null)
    setProgress(null)
    const res = await window.api.importBookmarks()
    setBusy(false)
    setProgress(null)
    if (res.canceled) return
    setMessage(
      `Imported: ${res.added} added, ${res.skipped} already saved, ${res.failed} skipped. ` +
        `Saved copies are being captured in the background.`
    )
    onImported()
  }

  async function doExport(): Promise<void> {
    const res = await window.api.exportBookmarks()
    if (!res.canceled) setMessage(`Exported ${res.count} bookmark${res.count === 1 ? '' : 's'}.`)
  }

  return (
    <div className="io-bar">
      <button className="secondary" onClick={doImport} disabled={busy}>
        {busy ? 'Importing…' : 'Import browser bookmarks…'}
      </button>
      <button className="secondary" onClick={doExport} disabled={busy}>
        Export…
      </button>
      {progress && (
        <span className="io-progress">
          Importing {progress.processed} / {progress.total} — {progress.added} added,{' '}
          {progress.skipped} skipped
        </span>
      )}
      {message && !progress && <span className="io-message">{message}</span>}
    </div>
  )
}
