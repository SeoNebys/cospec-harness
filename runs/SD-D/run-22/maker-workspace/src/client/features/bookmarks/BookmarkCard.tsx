import type { Bookmark } from './types';
import { ReadingStatusControls } from '../read-later/ReadingStatusControls';

interface Props {
  bookmark: Bookmark;
  onReadingChange: (bookmark: Bookmark, readLater: boolean, isRead: boolean) => Promise<void>;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark, trigger: HTMLButtonElement) => void;
}
export function BookmarkCard({ bookmark, onReadingChange, onEdit, onDelete }: Props) {
  let hostname = bookmark.url;
  try {
    hostname = new URL(bookmark.url).hostname;
  } catch {
    /* display original */
  }
  return (
    <article className="bookmark-card" id={`bookmark-${bookmark.id}`} tabIndex={-1}>
      <div className="bookmark-main">
        <div className="site-icon" aria-hidden="true">
          {bookmark.iconUrl ? (
            <img src={bookmark.iconUrl} alt="" />
          ) : (
            hostname.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="bookmark-copy">
          <div className="bookmark-title-row">
            <h3>
              <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                {bookmark.title}
                <span className="external-mark" aria-label="opens in a new tab">
                  ↗
                </span>
              </a>
            </h3>
            {bookmark.readLater && (
              <span className={`status-badge ${bookmark.isRead ? 'read' : ''}`}>
                {bookmark.isRead ? 'Read' : 'Unread'}
              </span>
            )}
          </div>
          <p className="bookmark-url">{hostname}</p>
          {bookmark.description && <p className="bookmark-description">{bookmark.description}</p>}
          {bookmark.notes && (
            <p className="bookmark-notes">
              <span>Note</span> {bookmark.notes}
            </p>
          )}
          <div className="tag-list" aria-label="Tags">
            {bookmark.tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <footer>
        <time dateTime={bookmark.createdAt}>
          Saved{' '}
          {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
            new Date(bookmark.createdAt),
          )}
        </time>
        <div className="card-actions">
          <ReadingStatusControls
            bookmark={bookmark}
            onChange={(readLater, isRead) => onReadingChange(bookmark, readLater, isRead)}
          />
          <button
            className="button icon-button"
            aria-label={`Edit ${bookmark.title}`}
            onClick={() => onEdit(bookmark)}
          >
            Edit
          </button>
          <button
            className="button icon-button danger-text"
            aria-label={`Delete ${bookmark.title}`}
            onClick={(e) => onDelete(bookmark, e.currentTarget)}
          >
            Delete
          </button>
        </div>
      </footer>
    </article>
  );
}
