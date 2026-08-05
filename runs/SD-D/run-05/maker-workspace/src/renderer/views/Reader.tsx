import { useEffect, useState } from 'react'
import type { SavedCopyView } from '@shared/types'

// Shows a bookmark's saved copy (US3): the readable article rendered in-app for
// a normal page, or the retained PDF for a PDF target — both served from the
// local copy, so they work with no network and after the original is gone.
export function Reader({
  bookmarkId,
  title,
  onClose
}: {
  bookmarkId: string
  title: string
  onClose: () => void
}): JSX.Element {
  const [copy, setCopy] = useState<SavedCopyView | null>(null)

  useEffect(() => {
    let active = true
    void window.api.getSavedCopy(bookmarkId).then((c) => {
      if (active) setCopy(c)
    })
    return () => {
      active = false
    }
  }, [bookmarkId])

  return (
    <div className="reader-overlay" onClick={onClose}>
      <div className="reader-panel" onClick={(e) => e.stopPropagation()}>
        <div className="reader-head">
          <span className="title">{title}</span>
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
        {copy === null && <div className="reader-message">Loading saved copy…</div>}
        {copy && copy.status !== 'captured' && (
          <div className="reader-message">
            {copy.status === 'pending'
              ? 'The saved copy is still being captured. Try again in a moment.'
              : 'No saved copy is available for this bookmark.'}
          </div>
        )}
        {copy && copy.status === 'captured' && copy.kind === 'reader' && (
          <div className="reader-body" dangerouslySetInnerHTML={{ __html: copy.html }} />
        )}
        {copy && copy.status === 'captured' && copy.kind === 'pdf' && (
          <>
            <iframe className="reader-pdf" src={`file://${copy.filePath}`} title={title} />
            <div className="reader-head" style={{ borderTop: '1px solid var(--border)', borderBottom: 'none' }}>
              <span className="title" style={{ fontWeight: 400, fontSize: 13 }}>
                Can’t see the PDF above?
              </span>
              <button onClick={() => window.api.openSavedCopyExternal(bookmarkId)}>
                Open in system viewer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
