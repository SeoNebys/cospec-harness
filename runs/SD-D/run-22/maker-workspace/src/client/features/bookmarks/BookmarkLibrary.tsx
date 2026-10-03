import type { Bookmark } from './types';
import { BookmarkCard } from './BookmarkCard';

interface Props {
  bookmarks: Bookmark[];
  isLoading: boolean;
  error?: string | null;
  hasCriteria?: boolean;
  scope?: 'all' | 'unread-read-later';
  onReset?: () => void;
  onReadingChange: (bookmark: Bookmark, readLater: boolean, isRead: boolean) => Promise<void>;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark, trigger: HTMLButtonElement) => void;
}
export function BookmarkLibrary({
  bookmarks,
  isLoading,
  error,
  hasCriteria,
  scope = 'all',
  onReset,
  ...actions
}: Props) {
  if (isLoading)
    return (
      <div className="state-panel" role="status">
        <span className="spinner" />
        Loading your bookmarks…
      </div>
    );
  if (error)
    return (
      <div className="state-panel error" role="alert">
        <h3>Your library couldn’t be loaded</h3>
        <p>{error}</p>
      </div>
    );
  if (!bookmarks.length)
    return (
      <div className="state-panel">
        <div className="empty-glyph" aria-hidden="true">
          ⌑
        </div>
        <h3>
          {scope === 'unread-read-later'
            ? 'Your reading queue is clear'
            : hasCriteria
              ? 'No bookmarks match'
              : 'Your library is ready for its first link'}
        </h3>
        <p>
          {scope === 'unread-read-later'
            ? 'Add a bookmark to read later, or mark a read item unread.'
            : hasCriteria
              ? 'Try removing a filter or simplifying the search.'
              : 'Paste a web address above and the page details will be filled in for you.'}
        </p>
        {hasCriteria && onReset ? (
          <button className="button secondary" onClick={onReset}>
            Reset search and filters
          </button>
        ) : null}
      </div>
    );
  return (
    <div className="bookmark-grid">
      {bookmarks.map((bookmark) => (
        <BookmarkCard key={bookmark.id} bookmark={bookmark} {...actions} />
      ))}
    </div>
  );
}
