import type { Bookmark } from '../../../shared/contracts.js';
import type { ReadingState } from '../../../shared/contracts.js';
import { BookmarkCard } from './BookmarkCard.js';

export type BookmarkListEmptyState = 'library' | 'read-later' | 'no-results';

export interface BookmarkListProps {
  bookmarks: readonly Bookmark[];
  emptyState?: BookmarkListEmptyState;
  onClearCriteria?: () => void;
  onReadingStateChange?: (bookmark: Bookmark, readingState: ReadingState) => void;
  onEdit?: (bookmark: Bookmark) => void;
  onDelete?: (bookmark: Bookmark) => void;
}

interface EmptyStateCopy {
  title: string;
  description: string;
}

const emptyStateCopy: Record<BookmarkListEmptyState, EmptyStateCopy> = {
  library: {
    title: 'Your library is empty',
    description: 'Save your first bookmark to start building your collection.',
  },
  'read-later': {
    title: 'Nothing to read later',
    description: 'Bookmarks marked To Read will appear here.',
  },
  'no-results': {
    title: 'No bookmarks match your search',
    description: 'Try changing or clearing your search and filters.',
  },
};

function BookmarkListEmpty({
  state,
  onClearCriteria,
}: {
  state: BookmarkListEmptyState;
  onClearCriteria?: () => void;
}) {
  const copy = emptyStateCopy[state];

  return (
    <section role="status" aria-labelledby="bookmark-empty-heading">
      <h3 id="bookmark-empty-heading">{copy.title}</h3>
      <p>{copy.description}</p>
      {state === 'no-results' && onClearCriteria && (
        <button type="button" onClick={onClearCriteria}>
          Clear search and filters
        </button>
      )}
    </section>
  );
}

export function BookmarkList({
  bookmarks,
  emptyState = 'library',
  onClearCriteria,
  onReadingStateChange,
  onEdit,
  onDelete,
}: BookmarkListProps) {
  if (bookmarks.length === 0) {
    return <BookmarkListEmpty state={emptyState} onClearCriteria={onClearCriteria} />;
  }

  return (
    <ul aria-label="Bookmarks">
      {bookmarks.map((bookmark) => (
        <li key={bookmark.id}>
          <BookmarkCard
            bookmark={bookmark}
            onReadingStateChange={onReadingStateChange}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </li>
      ))}
    </ul>
  );
}

export default BookmarkList;
