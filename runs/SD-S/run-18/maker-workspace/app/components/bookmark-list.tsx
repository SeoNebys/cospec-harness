import type { BookmarkView } from "~/features/bookmarks/bookmark.repository.server";
import { BookmarkCard } from "./bookmark-card";

export function BookmarkList({ bookmarks, filtered = false, tagSuggestions = [], onChanged }: { bookmarks: BookmarkView[]; filtered?: boolean; tagSuggestions?: string[]; onChanged?: () => void | Promise<void> }) {
  if (bookmarks.length === 0) {
    return (
      <div className="empty-state">
        <span aria-hidden="true">⌁</span>
        <h3>{filtered ? "No bookmarks match." : "Your library is ready."}</h3>
        <p>{filtered ? "Try another search or clear your filters." : "Paste your first link above. Its title will appear automatically."}</p>
      </div>
    );
  }
  return <div className="bookmark-list">{bookmarks.map((bookmark) => <BookmarkCard key={bookmark.id} bookmark={bookmark} tagSuggestions={tagSuggestions} onChanged={onChanged} />)}</div>;
}
