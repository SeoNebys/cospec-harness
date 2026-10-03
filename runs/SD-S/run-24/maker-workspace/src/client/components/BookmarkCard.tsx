import type { Bookmark } from '../../shared/bookmark-types.js';
import { BookmarkActions } from './BookmarkActions.js';

interface BookmarkCardProps {
  bookmark: Bookmark;
  pending?: boolean;
  onEdit?: (bookmark: Bookmark) => void;
  onFavorite?: (bookmark: Bookmark) => void;
  onArchive?: (bookmark: Bookmark) => void;
  onDelete?: (bookmark: Bookmark) => void;
}

export function BookmarkCard({
  bookmark,
  pending = false,
  onEdit,
  onFavorite,
  onArchive,
  onDelete,
}: BookmarkCardProps) {
  const host = (() => {
    try {
      return new URL(bookmark.url).hostname;
    } catch {
      return bookmark.url;
    }
  })();
  return (
    <article className="bookmark-card" id={`bookmark-${bookmark.id}`} tabIndex={-1}>
      <div className="bookmark-main">
        <div className="bookmark-title-row">
          <div>
            <p className="bookmark-host">{host}</p>
            <h2>{bookmark.title}</h2>
          </div>
          <a
            className="open-link"
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${bookmark.title}`}
          >
            ↗
          </a>
        </div>
        {bookmark.notes && <p className="bookmark-notes">{bookmark.notes}</p>}
        {bookmark.tags.length > 0 && (
          <ul className="tag-list" aria-label="Tags">
            {bookmark.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
      </div>
      <footer className="bookmark-footer">
        <div className="bookmark-meta">
          <span>Saved {new Date(bookmark.createdAt).toLocaleDateString()}</span>
          {bookmark.isFavorite && <span>★ Favorite</span>}
          {bookmark.isArchived && <span>Archived</span>}
        </div>
        {onEdit && onFavorite && onArchive && onDelete && (
          <BookmarkActions
            title={bookmark.title}
            isFavorite={bookmark.isFavorite}
            isArchived={bookmark.isArchived}
            pending={pending}
            onEdit={() => onEdit(bookmark)}
            onFavorite={() => onFavorite(bookmark)}
            onArchive={() => onArchive(bookmark)}
            onDelete={() => onDelete(bookmark)}
          />
        )}
      </footer>
    </article>
  );
}
