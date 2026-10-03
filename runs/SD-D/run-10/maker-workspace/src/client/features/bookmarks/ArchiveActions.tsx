import type { BookmarkDetail } from '../../../shared/contracts/bookmarks';
import { FavoriteButton } from './FavoriteButton';
import { ReadingStateButton } from './ReadingStateButton';
export function ArchiveActions({
  bookmark,
  onReading,
  onFavorite,
  onArchive,
  onDelete,
}: {
  bookmark: BookmarkDetail;
  onReading(value: 'unread' | 'read'): void;
  onFavorite(): void;
  onArchive(): void;
  onDelete(): void;
}) {
  return (
    <div className="bookmark-state-row">
      <ReadingStateButton state={bookmark.readingState} onChange={onReading} />
      <FavoriteButton active={bookmark.isFavorite} onClick={onFavorite} />
      <button type="button" className="state-button" onClick={onArchive}>
        {bookmark.archivedAt ? '↥ Restore' : '▣ Archive'}
      </button>
      <button type="button" className="state-button state-button--danger" onClick={onDelete}>
        Delete…
      </button>
    </div>
  );
}
