import type { Bookmark } from '../models/bookmark';
import { BookmarkItem } from './BookmarkItem';
import { EmptyState } from './EmptyState';

interface BookmarkListProps {
  bookmarks: Bookmark[];
  hasAny: boolean; // whether any bookmarks exist at all (before filtering)
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
  onAdd: () => void;
}

// Renders all bookmarks (FR-005) or the appropriate empty state (FR-012):
// "nothing saved" vs. "no results for this search/filter".
export function BookmarkList({
  bookmarks,
  hasAny,
  onEdit,
  onDelete,
  onAdd,
}: BookmarkListProps) {
  if (bookmarks.length === 0) {
    return <EmptyState variant={hasAny ? 'no-results' : 'empty'} onAdd={onAdd} />;
  }

  return (
    <ul className="bookmark-list">
      {bookmarks.map((bookmark) => (
        <BookmarkItem
          key={bookmark.id}
          bookmark={bookmark}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
