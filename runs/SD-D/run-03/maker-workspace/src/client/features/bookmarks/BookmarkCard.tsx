import { useState } from "react";
import { Button, IconPlaceholder } from "../../components";
import type { Bookmark } from "../../lib/api";

export interface BookmarkCardProps {
  bookmark: Bookmark;
  onOpen: (bookmark: Bookmark) => void;
  onToggleReadLater?: ((bookmark: Bookmark, unread: boolean) => Promise<void> | void) | undefined;
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function BookmarkCard({ bookmark, onOpen, onToggleReadLater }: BookmarkCardProps) {
  const [updatingReadingState, setUpdatingReadingState] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);

  async function toggleReadLater() {
    if (!onToggleReadLater) return;
    setUpdatingReadingState(true);
    setReadingError(null);
    try {
      await onToggleReadLater(bookmark, !bookmark.unread);
    } catch {
      setReadingError("Reading state could not be changed. Please try again.");
    } finally {
      setUpdatingReadingState(false);
    }
  }

  return (
    <article className="bookmark-card" aria-label={bookmark.title}>
      <div className="bookmark-card__icon">
        {bookmark.iconUrl ? (
          <img
            src={bookmark.iconUrl}
            alt={`Site icon for ${bookmark.title}`}
            width="40"
            height="40"
          />
        ) : (
          <IconPlaceholder label={`No site icon for ${bookmark.title}`} />
        )}
      </div>
      <div className="bookmark-card__content">
        <div className="bookmark-card__heading">
          <Button variant="quiet" className="bookmark-card__title" onClick={() => onOpen(bookmark)}>
            {bookmark.title}
          </Button>
          <div className="bookmark-card__badges">
            {bookmark.favorite ? <span className="bookmark-badge">★ Favorite</span> : null}
            {bookmark.unread ? <span className="bookmark-badge">Read Later</span> : null}
          </div>
        </div>
        <p className="bookmark-card__address" title={bookmark.address}>
          {bookmark.address}
        </p>
        {bookmark.description ? (
          <p className="bookmark-card__description">{bookmark.description}</p>
        ) : null}
        <div className="bookmark-card__meta">
          {bookmark.tags.length ? (
            <ul className="tag-list" aria-label="Tags">
              {bookmark.tags.map((tag) => (
                <li key={tag.id}>{tag.name}</li>
              ))}
            </ul>
          ) : (
            <span>No tags</span>
          )}
          <span>Saved {displayDate(bookmark.createdAt)}</span>
        </div>
      </div>
      <div className="bookmark-card__actions">
        {onToggleReadLater ? (
          <Button
            variant="quiet"
            size="small"
            busy={updatingReadingState}
            busyLabel="Updating…"
            aria-label={
              bookmark.unread
                ? `Mark ${bookmark.title} as read`
                : `Add ${bookmark.title} to Read Later`
            }
            onClick={toggleReadLater}
          >
            {bookmark.unread ? "Mark read" : "Read Later"}
          </Button>
        ) : null}
        <a
          className="bookmark-card__open"
          href={bookmark.address}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open destination for ${bookmark.title}`}
        >
          Open <span aria-hidden="true">↗</span>
        </a>
        {readingError ? (
          <span className="bookmark-card__error" role="alert">
            {readingError}
          </span>
        ) : null}
      </div>
    </article>
  );
}
