import type { Bookmark } from "../api/client";

interface Props {
  items: Bookmark[];
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
}

export function BookmarkList({ items, onEdit, onDelete }: Props) {
  return (
    <ul className="bookmark-list">
      {items.map((b) => (
        <li key={b.id} className="bookmark" data-testid="bookmark">
          <div className="bookmark__main">
            <a
              className="bookmark__title"
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              title={b.title}
            >
              {b.title}
            </a>
            <a
              className="bookmark__url"
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              title={b.url}
            >
              {b.url}
            </a>
            {b.tags.length > 0 && (
              <div className="bookmark__tags">
                {b.tags.map((t) => (
                  <span key={t} className="tag-chip tag-chip--static">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="bookmark__actions">
            <button onClick={() => onEdit(b)} aria-label={`Edit ${b.title}`}>
              Edit
            </button>
            <button
              className="danger"
              onClick={() => onDelete(b)}
              aria-label={`Delete ${b.title}`}
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
