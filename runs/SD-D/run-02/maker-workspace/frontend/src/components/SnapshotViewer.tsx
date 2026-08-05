import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

/** Shows snapshot availability and links to the stored copy (FR-026/027). */
export function SnapshotViewer({ id }: { id: number }) {
  const [status, setStatus] = useState<{ status: string; kind: string | null; archive_url: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    api.snapshotStatus(id).then((s) => { if (active) setStatus(s); }).catch(() => {});
    return () => { active = false; };
  }, [id]);

  if (!status) return null;
  return (
    <div className="snapshot">
      {status.status === 'available' ? (
        <a href={api.snapshotUrl(id)} target="_blank" rel="noreferrer">
          📄 View saved copy{status.kind === 'pdf' ? ' (PDF)' : ''}
        </a>
      ) : status.status === 'pending' ? (
        <span className="muted">Saving a copy…</span>
      ) : (
        <span className="muted">No saved copy available</span>
      )}
      {status.archive_url && (
        <a href={status.archive_url} target="_blank" rel="noreferrer" className="archive-link">🌐 Public archive</a>
      )}
    </div>
  );
}
