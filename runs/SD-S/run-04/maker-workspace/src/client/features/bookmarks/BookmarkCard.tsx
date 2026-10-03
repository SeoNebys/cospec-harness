import type { Bookmark } from '../../../shared/contracts/bookmarks';

export function BookmarkCard({
  bookmark,
  onEdit,
  onFavorite,
  onArchive,
  onRestore,
  onDelete,
}: {
  bookmark: Bookmark;
  onEdit: () => void;
  onFavorite: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="bookmark-card">
      <div className="card-top">
        <div className="domain-mark" aria-hidden="true">
          {bookmark.domain.slice(0, 1).toUpperCase()}
        </div>
        <button
          className={`favorite-button ${bookmark.isFavorite ? 'active' : ''}`}
          onClick={onFavorite}
          aria-label={bookmark.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={bookmark.isFavorite}
        >
          ★
        </button>
      </div>
      <a className="bookmark-title" href={bookmark.url} target="_blank" rel="noopener noreferrer">
        {bookmark.title}
        <span aria-hidden="true">↗</span>
      </a>
      <p className="bookmark-domain">{bookmark.domain}</p>
      {bookmark.notes && <p className="bookmark-notes">{bookmark.notes}</p>}
      <div className="tag-row">
        {bookmark.tags.map((tag) => (
          <span className="tag" key={tag.id}>
            {tag.name}
          </span>
        ))}
      </div>
      <footer className="card-footer">
        <time dateTime={bookmark.createdAt}>
          {new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }).format(new Date(bookmark.createdAt))}
        </time>
        <div className="card-actions">
          <button onClick={onEdit}>Edit</button>
          {bookmark.status === 'active' ? (
            <button onClick={onArchive}>Archive</button>
          ) : (
            <button onClick={onRestore}>Restore</button>
          )}
          <button className="danger-link" onClick={onDelete}>
            Delete
          </button>
        </div>
      </footer>
    </article>
  );
}
