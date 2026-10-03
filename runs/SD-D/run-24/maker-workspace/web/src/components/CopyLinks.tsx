import { useState } from 'react';
import type { Bookmark } from '../types';
import { refreshArchiveCopy } from '../api/client';

// Local copy + Internet Archive links (US12).
export function CopyLinks({ bookmark }: { bookmark: Bookmark }) {
  const [wayback, setWayback] = useState(bookmark.copy.wayback_url);
  const [status, setStatus] = useState<string>('');

  const localAvailable = bookmark.copy.status === 'available';

  async function refresh() {
    setStatus('Checking Internet Archive…');
    try {
      const r = await refreshArchiveCopy(bookmark.id);
      if (r.wayback_url) {
        setWayback(r.wayback_url);
        setStatus('');
      } else if (r.requested) {
        setStatus('No snapshot yet — requested one be archived.');
      } else {
        setStatus('No snapshot available.');
      }
    } catch {
      setStatus('Internet Archive is currently unreachable.');
    }
  }

  return (
    <div className="copy-links">
      <span className="label">Copies:</span>
      {localAvailable ? (
        <a href={`/api/bookmarks/${bookmark.id}/copy`} target="_blank" rel="noreferrer">
          Local {bookmark.copy.type === 'pdf' ? 'PDF' : 'page'}
        </a>
      ) : (
        <span className="muted">
          Local copy {bookmark.copy.status === 'pending' ? 'in progress…' : 'unavailable'}
        </span>
      )}
      {wayback ? (
        <a href={wayback} target="_blank" rel="noreferrer">
          Internet Archive
        </a>
      ) : (
        <button type="button" className="linklike" onClick={refresh}>
          Find Internet Archive copy
        </button>
      )}
      {status && <span className="muted">{status}</span>}
    </div>
  );
}
