import type { Bookmark } from '../../../shared/contracts/bookmarks';

export function DuplicateDialog({
  existing,
  onCancel,
  onContinue,
  onEdit,
}: {
  existing: Bookmark;
  onCancel: () => void;
  onContinue: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        className="dialog duplicate-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-title"
      >
        <p className="dialog-icon">↗</p>
        <p className="eyebrow">Already in your collection</p>
        <h2 id="duplicate-title">You’ve saved this before</h2>
        <div className="duplicate-preview">
          <strong>{existing.title}</strong>
          <span>{existing.domain}</span>
        </div>
        <p className="muted">
          You can open the existing bookmark, edit it, or keep a second copy intentionally.
        </p>
        <div className="dialog-actions">
          <button className="button ghost" onClick={onCancel}>
            Back
          </button>
          <a className="button ghost" href={existing.url} target="_blank" rel="noopener noreferrer">
            Open existing
          </a>
          <button className="button ghost" onClick={onEdit}>
            Edit existing
          </button>
          <button className="button primary" onClick={onContinue}>
            Save anyway
          </button>
        </div>
      </div>
    </div>
  );
}
