import type { Bookmark } from '../../shared/bookmark-types.js';
import { BookmarkCard } from './BookmarkCard.js';
import { EmptyState } from './EmptyState.js';

interface BookmarkListProps {
  items: Bookmark[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  filtered?: boolean;
  onReset?: () => void;
  pendingId?: number | null;
  onEdit?: (bookmark: Bookmark) => void;
  onFavorite?: (bookmark: Bookmark) => void;
  onArchive?: (bookmark: Bookmark) => void;
  onDelete?: (bookmark: Bookmark) => void;
}

export function BookmarkList({
  items,
  loading,
  error,
  onRetry,
  filtered,
  onReset,
  pendingId,
  onEdit,
  onFavorite,
  onArchive,
  onDelete,
}: BookmarkListProps) {
  if (loading) return <p className="loading-state">Gathering your bookmarks…</p>;
  if (error) {
    return (
      <section className="error-state" role="alert">
        <h2>We couldn’t load your links</h2>
        <p>{error}</p>
        <button className="button secondary" onClick={onRetry}>
          Try again
        </button>
      </section>
    );
  }
  if (items.length === 0) return <EmptyState filtered={filtered} onReset={onReset} />;
  return (
    <div className="bookmark-grid">
      {items.map((bookmark) => (
        <BookmarkCard
          key={bookmark.id}
          bookmark={bookmark}
          pending={pendingId === bookmark.id}
          onEdit={onEdit}
          onFavorite={onFavorite}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
