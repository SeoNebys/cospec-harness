import type { Bookmark } from '../../../shared/api-types';
import { BookmarkCard } from './BookmarkCard';
interface BookmarkListProps {
  bookmarks: Bookmark[];
  pendingId?: string | null;
  onFavorite?: (bookmark: Bookmark) => void;
  onEdit?: (bookmark: Bookmark) => void;
  onArchive?: (bookmark: Bookmark) => void;
}
export function BookmarkList({ bookmarks, pendingId, onFavorite, onEdit, onArchive }: BookmarkListProps) {
  return <div className="bookmark-grid" aria-label="Bookmarks">{bookmarks.map((bookmark) => <BookmarkCard key={bookmark.id} bookmark={bookmark} pending={pendingId === bookmark.id} onFavorite={onFavorite} onEdit={onEdit} onArchive={onArchive} />)}</div>;
}
