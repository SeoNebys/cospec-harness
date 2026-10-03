import type { Bookmark } from '../types';

interface Props {
  bookmark: Bookmark;
  selected: boolean;
  onToggleSelect: (id: number) => void;
  onEdit: (bm: Bookmark) => void;
  onQuick: (bm: Bookmark, action: string) => void;
  onTagClick: (tag: string) => void;
}

// Readable bookmark row: title, description, tags, site icon (FR-008).
export function BookmarkCard({ bookmark, selected, onToggleSelect, onEdit, onQuick, onTagClick }: Props) {
  const host = safeHost(bookmark.url);
  return (
    <div className={`card${selected ? ' selected' : ''}`}>
      <input
        type="checkbox"
        className="select"
        checked={selected}
        onChange={() => onToggleSelect(bookmark.id)}
        aria-label={`Select ${bookmark.title}`}
      />
      <img className="favicon" src={bookmark.iconUrl || fallbackIcon(host)} alt="" width={20} height={20} />
      <div className="card-body">
        <div className="card-head">
          <a className="title" href={bookmark.url} target="_blank" rel="noreferrer">
            {bookmark.title}
          </a>
          {!bookmark.read && <span className="badge">read later</span>}
        </div>
        <div className="host">{host}</div>
        {bookmark.description && <p className="desc">{bookmark.description}</p>}
        <div className="tags">
          {bookmark.tags.map((t) => (
            <button type="button" className="chip small" key={t} onClick={() => onTagClick(t)}>
              #{t}
            </button>
          ))}
        </div>
      </div>
      <div className="card-actions">
        <button type="button" onClick={() => onEdit(bookmark)}>
          Edit
        </button>
        {bookmark.archived ? (
          <button type="button" onClick={() => onQuick(bookmark, 'restore')}>
            Restore
          </button>
        ) : (
          <>
            <button type="button" onClick={() => onQuick(bookmark, bookmark.read ? 'markReadLater' : 'markRead')}>
              {bookmark.read ? 'Read later' : 'Mark read'}
            </button>
            <button type="button" onClick={() => onQuick(bookmark, 'archive')}>
              Archive
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function fallbackIcon(host: string): string {
  // Neutral inline SVG dot as a fallback favicon.
  void host;
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="7" fill="%23bbb"/></svg>'
    )
  );
}
