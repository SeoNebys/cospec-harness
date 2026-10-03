import type { BookmarkDetail } from '../../shared/contracts/bookmarks';
import { FormattedNote } from '../components/FormattedNote';
import { ArchiveActions } from '../features/bookmarks/ArchiveActions';
import { useDialogFocus } from '../components/useDialogFocus';

export function BookmarkDetailPage({
  bookmark,
  onClose,
  onEdit,
  onReading,
  onFavorite,
  onArchive,
  onDelete,
}: {
  bookmark: BookmarkDetail;
  onClose(): void;
  onEdit(): void;
  onReading(value: 'unread' | 'read'): void;
  onFavorite(): void;
  onArchive(): void;
  onDelete(): void;
}) {
  const dialogRef = useDialogFocus<HTMLElement>(onClose);
  let host = bookmark.url;
  try {
    host = new URL(bookmark.url).hostname.replace(/^www\./, '');
  } catch {
    /* retain URL */
  }
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <article
        ref={dialogRef}
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <div className="detail-hero">
          {bookmark.previewImage ? (
            <img src={bookmark.previewImage.url} alt="" />
          ) : (
            <div className="detail-fallback">{host.slice(0, 1).toUpperCase()}</div>
          )}
          <button
            className="icon-button icon-button--large detail-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="detail-body">
          <div className="site-line">
            {bookmark.favicon ? (
              <img src={bookmark.favicon.url} alt="" />
            ) : (
              <span className="mini-favicon">{host.slice(0, 1).toUpperCase()}</span>
            )}
            <span>{host}</span>
          </div>
          <h2 id="detail-title">{bookmark.title}</h2>
          {bookmark.description && <p className="detail-description">{bookmark.description}</p>}
          {bookmark.noteMarkdown && (
            <section className="detail-note">
              <p className="eyebrow">Your note</p>
              <FormattedNote value={bookmark.noteMarkdown} />
            </section>
          )}
          <div className="detail-tags">
            {bookmark.tags.map((tag) => (
              <span className="chip" key={tag.id}>
                #{tag.name}
              </span>
            ))}
            {bookmark.collection && (
              <span className="chip collection-chip">▣ {bookmark.collection.name}</span>
            )}
          </div>
          <ArchiveActions
            bookmark={bookmark}
            onReading={onReading}
            onFavorite={onFavorite}
            onArchive={onArchive}
            onDelete={onDelete}
          />
          <div className="detail-meta">
            <span>Saved {new Date(bookmark.createdAt).toLocaleDateString()}</span>
            <span>Edited {new Date(bookmark.updatedAt).toLocaleDateString()}</span>
          </div>
          <footer className="detail-actions">
            <button className="button button--ghost" onClick={onEdit}>
              Edit details
            </button>
            <a
              className="button button--primary"
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit page ↗
            </a>
          </footer>
        </div>
      </article>
    </div>
  );
}
