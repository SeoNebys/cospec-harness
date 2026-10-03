import type { Bookmark } from '../../../shared/api-types';

interface BookmarkCardProps { bookmark: Bookmark; onFavorite?: ((bookmark: Bookmark) => void) | undefined; onEdit?: ((bookmark: Bookmark) => void) | undefined; onArchive?: ((bookmark: Bookmark) => void) | undefined; pending?: boolean | undefined; }

export function BookmarkCard({ bookmark, onFavorite, onEdit, onArchive, pending }: BookmarkCardProps) {
  let host = bookmark.url;
  try { host = new URL(bookmark.url).hostname.replace(/^www\./, ''); } catch { /* retain address */ }
  return (
    <article className="bookmark-card"><div className="bookmark-main"><div className="bookmark-kicker"><span className="domain-dot" aria-hidden="true" /><span>{host}</span>{bookmark.isFavorite && <span className="favorite-label">★ Favorite</span>}</div><h2><a href={bookmark.url} target="_blank" rel="noopener noreferrer">{bookmark.title}</a></h2>{bookmark.notes && <p className="bookmark-notes">{bookmark.notes}</p>}{bookmark.tags.length > 0 && <ul className="tag-list" aria-label="Tags">{bookmark.tags.map((tag) => <li key={tag.toLocaleLowerCase()}>{tag}</li>)}</ul>}</div>
      {(onFavorite || onEdit || onArchive) && <div className="card-actions">{onFavorite && <button type="button" disabled={pending} aria-label={bookmark.isFavorite ? `Remove ${bookmark.title} from favorites` : `Add ${bookmark.title} to favorites`} onClick={() => onFavorite(bookmark)}>{bookmark.isFavorite ? '★' : '☆'}</button>}{onEdit && <button type="button" disabled={pending} onClick={() => onEdit(bookmark)}>Edit</button>}{onArchive && <button type="button" disabled={pending} onClick={() => onArchive(bookmark)}>Archive</button>}</div>}
    </article>
  );
}
