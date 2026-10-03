import type { Bookmark } from '@shared/contracts.js';
import { Link } from 'react-router';
import { updateBookmark } from '../../services/bookmarks-api.js';
export function BookmarkCard({
  bookmark,
  selected,
  onSelect,
  onChanged
}: {
  bookmark: Bookmark;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onChanged: () => void;
}) {
  async function update(value: any) {
    await updateBookmark(bookmark.id, value);
    onChanged();
  }
  return (
    <article className={`bookmark-card ${selected ? 'selected' : ''}`}>
      <div className="card-select">
        <input
          type="checkbox"
          aria-label={`Select ${bookmark.displayLabel}`}
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
        />
      </div>
      <div className="favicon">
        {bookmark.iconUrl ? (
          <img src={bookmark.iconUrl} alt="" />
        ) : (
          <span>{bookmark.displayLabel[0]?.toUpperCase() ?? '↗'}</span>
        )}
      </div>
      <div className="card-body">
        <div className="card-title-row">
          <Link to={`/bookmarks/${bookmark.id}`} className="card-title">
            {bookmark.displayLabel}
          </Link>
          <span className={`read-dot ${bookmark.isRead ? 'read' : ''}`}>
            {bookmark.isRead ? 'Read' : 'Unread'}
          </span>
        </div>
        <a className="domain" href={bookmark.url} target="_blank" rel="noopener noreferrer">
          {new URL(bookmark.url).hostname} ↗
        </a>
        {bookmark.description && <p className="description">{bookmark.description}</p>}
        <div className="tag-row">
          {bookmark.tags.map((t) => (
            <span className="tag" key={t.id}>
              {t.name}
            </span>
          ))}
        </div>
      </div>
      <div className="card-actions">
        <button onClick={() => void update({ isRead: !bookmark.isRead })}>
          {bookmark.isRead ? 'Mark unread' : 'Mark read'}
        </button>
        <button onClick={() => void update({ archived: !bookmark.archivedAt })}>
          {bookmark.archivedAt ? 'Restore' : 'Archive'}
        </button>
      </div>
    </article>
  );
}
