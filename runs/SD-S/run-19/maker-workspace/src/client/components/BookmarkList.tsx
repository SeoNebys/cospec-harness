import type { Bookmark } from '../../shared/types.js';
import { BookmarkCard } from './BookmarkCard.js';
import { EmptyState } from './EmptyState.js';

interface BookmarkListProps {
  bookmarks: Bookmark[];
  hasCriteria?: boolean;
  onClear?: () => void;
  onChanged?: () => void | Promise<void>;
}

export function BookmarkList({ bookmarks, hasCriteria = false, onClear, onChanged }: BookmarkListProps) {
  if (!bookmarks.length) return <EmptyState hasCriteria={hasCriteria} {...(onClear ? { onClear } : {})} />;
  return <div className="bookmark-grid">{bookmarks.map((bookmark) => <BookmarkCard key={bookmark.id} bookmark={bookmark} {...(onChanged ? { onChanged } : {})} />)}</div>;
}
