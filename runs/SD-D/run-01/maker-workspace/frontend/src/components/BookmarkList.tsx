import { Bookmark } from "../services/api";
import { BookmarkCard } from "./BookmarkCard";

interface Props {
  bookmarks: Bookmark[];
  highlightId: number | null;
  filtered: boolean;
  onEdit: (bookmark: Bookmark) => void;
  onFilterTag: (tag: string) => void;
}

export function BookmarkList({ bookmarks, highlightId, filtered, onEdit, onFilterTag }: Props) {
  if (bookmarks.length === 0) {
    return filtered ? (
      <div className="empty-state">
        <h2>No matches</h2>
        <p>No bookmarks match your search or filter.</p>
      </div>
    ) : (
      <div className="empty-state">
        <h2>No bookmarks yet</h2>
        <p>Paste a link above to save your first bookmark.</p>
      </div>
    );
  }

  return (
    <ul className="bookmark-list">
      {bookmarks.map((b) => (
        <BookmarkCard
          key={b.id}
          bookmark={b}
          highlighted={b.id === highlightId}
          onEdit={onEdit}
          onFilterTag={onFilterTag}
        />
      ))}
    </ul>
  );
}
