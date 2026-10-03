import type { BookmarkDetail } from '../../shared/contracts/bookmarks';
import { useDialogFocus } from './useDialogFocus';

export function StaleVersionDialog({
  current,
  onKeepEditing,
  onReload,
}: {
  current: BookmarkDetail;
  onKeepEditing(): void;
  onReload(): void;
}) {
  const dialogRef = useDialogFocus<HTMLElement>(onKeepEditing);
  return (
    <div className="confirm-overlay confirm-overlay--nested">
      <section
        ref={dialogRef}
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="stale-title"
      >
        <p className="eyebrow">Newer changes found</p>
        <h2 id="stale-title">This bookmark changed in another session.</h2>
        <p>
          Your unsaved edits are still here. Reload the current saved version, or return to compare and copy
          anything you need.
        </p>
        <dl className="version-comparison">
          <div>
            <dt>Current saved title</dt>
            <dd>{current.title}</dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{new Date(current.updatedAt).toLocaleString()}</dd>
          </div>
        </dl>
        <div className="detail-actions">
          <button className="button button--ghost" onClick={onKeepEditing}>
            Keep my unsaved edits
          </button>
          <button className="button button--primary" onClick={onReload}>
            Reload saved version
          </button>
        </div>
      </section>
    </div>
  );
}
