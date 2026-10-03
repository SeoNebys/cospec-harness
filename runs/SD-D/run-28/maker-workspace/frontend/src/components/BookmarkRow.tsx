import type { Bookmark } from '../api/client.ts';

interface Props {
  b: Bookmark;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (b: Bookmark) => void;
  onTagClick: (tag: string) => void;
}

/** One bookmark row: title, description, tags, favicon (FR-028). Activating the
 *  title opens the original link in a new tab (FR-029); the checkbox is a
 *  separate multi-select control for bulk actions. */
export function BookmarkRow({ b, selected, onToggleSelect, onEdit, onTagClick }: Props) {
  const meta = b.captureStatus.metadata;
  return (
    <div className="bookmark">
      <input
        className="check"
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(b.id)}
        aria-label="Select bookmark"
      />
      {b.favicon ? (
        <img className="fav" src={b.favicon} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
      ) : (
        <span className="fav" />
      )}
      <div className="body">
        <div className="row-flex wrap">
          <span className="title">
            <a href={b.url} target="_blank" rel="noopener noreferrer">
              {b.title}
            </a>
          </span>
          {b.unread && <span className="badge unread">unread</span>}
          {meta === 'pending' && <span className="badge">capturing…</span>}
          {meta === 'failed' && <span className="badge">metadata unavailable</span>}
        </div>
        <div className="url">{b.url}</div>
        {b.description && <div className="desc">{b.description}</div>}
        {b.tags.length > 0 && (
          <div className="tags">
            {b.tags.map((t) => (
              <span key={t} className="tag" onClick={() => onTagClick(t)}>
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="row-flex" style={{ flexDirection: 'column', gap: 6 }}>
        <button onClick={() => onEdit(b)}>Edit</button>
      </div>
    </div>
  );
}
