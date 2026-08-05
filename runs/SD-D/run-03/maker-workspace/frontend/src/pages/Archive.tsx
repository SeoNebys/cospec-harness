// Archive view: bookmarks tucked aside, retained and restorable (US5, FR-016).

import { BookmarkList } from "../components/BookmarkList";
import type { Bookmark } from "../api/client";

interface Props {
  bookmarks: Bookmark[];
  onRestore: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
}

export function Archive({ bookmarks, onRestore, onDelete }: Props) {
  if (bookmarks.length === 0) {
    return (
      <p className="muted" data-testid="archive-empty">
        Nothing archived. Archived bookmarks are tucked aside here — off your main list but never
        thrown away.
      </p>
    );
  }
  return (
    <BookmarkList
      bookmarks={bookmarks}
      archiveView
      onArchiveToggle={onRestore}
      onDelete={onDelete}
      onEdit={() => {}}
      onToggleRead={() => {}}
    />
  );
}
