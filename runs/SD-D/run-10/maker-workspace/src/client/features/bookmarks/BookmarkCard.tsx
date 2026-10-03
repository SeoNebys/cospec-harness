import type { BookmarkDetail } from '../../../shared/contracts/bookmarks';
import './bookmark-card.css';

export function BookmarkCard({
  bookmark,
  onSelect,
  selected = false,
  onToggleSelect,
  onReading,
  onFavorite,
}: {
  bookmark: BookmarkDetail;
  onSelect(): void;
  selected?: boolean;
  onToggleSelect?(): void;
  onReading?(): void;
  onFavorite?(): void;
}) {
  let host = bookmark.url;
  try {
    host = new URL(bookmark.url).hostname.replace(/^www\./, '');
  } catch {
    /* retain URL */
  }
  return (
    <article className="bookmark-card">
      {onToggleSelect && (
        <label className="card-select">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} />
          <span>Select</span>
        </label>
      )}
      <button className="card-open" onClick={onSelect} aria-label={`View details for ${bookmark.title}`}>
        <div className="card-image">
          {bookmark.previewImage ? (
            <img src={bookmark.previewImage.url} alt="" />
          ) : (
            <div className="image-fallback">
              <span>{host.slice(0, 1).toUpperCase()}</span>
            </div>
          )}
          <span className="card-arrow">↗</span>
        </div>
        <div className="card-body">
          <div className="site-line">
            {bookmark.favicon ? (
              <img src={bookmark.favicon.url} alt="" />
            ) : (
              <span className="mini-favicon">{host.slice(0, 1).toUpperCase()}</span>
            )}
            <span>{host}</span>
          </div>
          <h3>{bookmark.title}</h3>
          <div className="card-tags">
            {bookmark.tags.slice(0, 4).map((tag) => (
              <span key={tag.id}>#{tag.name}</span>
            ))}
            {bookmark.collection && <span className="collection-chip">▣ {bookmark.collection.name}</span>}
          </div>
          <p>{bookmark.description || 'No description yet. Open the bookmark to add one.'}</p>
          <time dateTime={bookmark.createdAt}>
            Saved{' '}
            {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
              new Date(bookmark.createdAt),
            )}
          </time>
        </div>
      </button>
      {(onReading || onFavorite) && (
        <div className="card-state-actions">
          {onReading && (
            <button onClick={onReading}>{bookmark.readingState === 'unread' ? '✓ Read' : '◷ Later'}</button>
          )}
          {onFavorite && (
            <button
              onClick={onFavorite}
              aria-label={bookmark.isFavorite ? 'Remove favorite' : 'Add favorite'}
            >
              {bookmark.isFavorite ? '◆' : '◇'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
