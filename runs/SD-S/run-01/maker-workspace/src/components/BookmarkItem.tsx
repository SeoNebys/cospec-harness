import type { Bookmark } from '../models/bookmark';

interface BookmarkItemProps {
  bookmark: Bookmark;
  onEdit: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
}

// A single bookmark row: title links to the original page (FR-006), with
// edit and delete actions (FR-007, FR-008).
export function BookmarkItem({ bookmark, onEdit, onDelete }: BookmarkItemProps) {
  return (
    <li className="bookmark-item">
      <div className="body">
        <a
          className="title"
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {bookmark.title}
        </a>
        <span className="url">{bookmark.url}</span>
        {bookmark.notes && <p className="notes">{bookmark.notes}</p>}
        {bookmark.tags.length > 0 && (
          <div className="tags">
            {bookmark.tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="actions">
        <button className="link" onClick={() => onEdit(bookmark)}>
          Edit
        </button>
        <button className="link danger" onClick={() => onDelete(bookmark)}>
          Delete
        </button>
      </div>
    </li>
  );
}
