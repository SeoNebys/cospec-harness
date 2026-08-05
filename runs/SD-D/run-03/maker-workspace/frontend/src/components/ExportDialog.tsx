// Export in two clearly-labeled formats (US4, FR-015).
// The labeling is the point: the portable file is lossy; the backup is complete.

import { exportUrl } from "../api/client";

interface Props {
  onClose: () => void;
}

export function ExportDialog({ onClose }: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="export-dialog">
      <div className="modal">
        <h2>Export bookmarks</h2>
        <p className="muted">Two formats — pick based on what you need to keep.</p>

        <div className="export-option">
          <div className="export-option-head">
            <strong>Full backup (.json)</strong>
            <span className="badge badge--complete">Keeps everything</span>
          </div>
          <p className="muted">
            Tags, formatted notes, read/unread, archived state, and dates. Re-imports here with
            nothing lost. Use this to back up or move your whole collection.
          </p>
          <a
            className="btn-primary"
            href={exportUrl("json")}
            download="bookmarks-backup.json"
            data-testid="export-json"
          >
            Download backup
          </a>
        </div>

        <div className="export-option">
          <div className="export-option-head">
            <strong>Browser file (.html)</strong>
            <span className="badge badge--lossy">Some detail dropped</span>
          </div>
          <p className="muted">
            Opens in any web browser. Tags come across as folders; notes become plain text;
            read/unread and archived aren’t included. Use this to move links into a browser — not
            as your safety-net backup.
          </p>
          <a
            className="btn-secondary"
            href={exportUrl("html")}
            download="bookmarks.html"
            data-testid="export-html"
          >
            Download browser file
          </a>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
