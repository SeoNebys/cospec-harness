import { useRef, useState } from 'react';
import type { Bookmark, ReadingState } from '../../../shared/contracts.js';
import { DeleteConfirmation } from './DeleteConfirmation.js';

export interface BookmarkCardProps {
  bookmark: Bookmark;
  onReadingStateChange?: (bookmark: Bookmark, readingState: ReadingState) => void;
  onEdit?: (bookmark: Bookmark) => void;
  onDelete?: (bookmark: Bookmark) => void;
}

const readingStateLabels: Record<ReadingState, string> = {
  untracked: 'Untracked',
  to_read: 'To Read',
  read: 'Read',
};

const savedDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

export function formatSavedDate(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : savedDateFormatter.format(date);
}

export function BookmarkCard({
  bookmark,
  onReadingStateChange,
  onEdit,
  onDelete,
}: BookmarkCardProps) {
  const titleId = `bookmark-title-${bookmark.id}`;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteTrigger = useRef<HTMLButtonElement>(null);

  const cancelDelete = () => {
    setConfirmingDelete(false);
    window.setTimeout(() => deleteTrigger.current?.focus(), 0);
  };

  return (
    <article aria-labelledby={titleId}>
      <header>
        <h3 id={titleId}>
          <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
            {bookmark.title}
          </a>
        </h3>
        <p>{bookmark.url}</p>
      </header>

      {bookmark.description && <p>{bookmark.description}</p>}

      <dl>
        <div>
          <dt>Saved</dt>
          <dd>
            <time dateTime={bookmark.createdAt}>{formatSavedDate(bookmark.createdAt)}</time>
          </dd>
        </div>
        <div>
          <dt>Reading status</dt>
          <dd>{readingStateLabels[bookmark.readingState]}</dd>
        </div>
      </dl>

      {bookmark.tags.length > 0 && (
        <ul aria-label={`Tags for ${bookmark.title}`}>
          {bookmark.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}

      {onReadingStateChange && (
        <button
          type="button"
          onClick={() =>
            onReadingStateChange(
              bookmark,
              bookmark.readingState === 'to_read' ? 'read' : 'to_read',
            )
          }
        >
          {bookmark.readingState === 'to_read' ? 'Mark as Read' : 'Mark as To Read'}
        </button>
      )}

      {onEdit && (
        <button type="button" onClick={() => onEdit(bookmark)}>
          Edit
        </button>
      )}
      {onDelete && (
        <button
          ref={deleteTrigger}
          type="button"
          hidden={confirmingDelete}
          onClick={() => setConfirmingDelete(true)}
        >
          Delete
        </button>
      )}
      {onDelete && confirmingDelete && (
        <DeleteConfirmation
          title={bookmark.title}
          onCancel={cancelDelete}
          onConfirm={() => onDelete(bookmark)}
        />
      )}
    </article>
  );
}

export default BookmarkCard;
