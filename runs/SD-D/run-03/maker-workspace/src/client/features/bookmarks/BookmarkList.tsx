import type { Bookmark } from "../../lib/api";
import { BookmarkCard } from "./BookmarkCard";

export interface BookmarkListProps {
  bookmarks: Bookmark[];
  onOpen: (bookmark: Bookmark) => void;
  onToggleReadLater?: ((bookmark: Bookmark, unread: boolean) => Promise<void> | void) | undefined;
}

export function BookmarkList({ bookmarks, onOpen, onToggleReadLater }: BookmarkListProps) {
  return (
    <section className="bookmark-list" aria-label="Bookmark results">
      {bookmarks.map((bookmark) => (
        <BookmarkCard
          key={bookmark.id}
          bookmark={bookmark}
          onOpen={onOpen}
          onToggleReadLater={onToggleReadLater}
        />
      ))}
    </section>
  );
}
