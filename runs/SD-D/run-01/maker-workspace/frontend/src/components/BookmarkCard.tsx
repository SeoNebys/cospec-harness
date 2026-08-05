import { Bookmark } from "../services/api";

interface Props {
  bookmark: Bookmark;
  highlighted?: boolean;
  onEdit: (bookmark: Bookmark) => void;
  onFilterTag: (tag: string) => void;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function BookmarkCard({ bookmark, highlighted, onEdit, onFilterTag }: Props) {
  return (
    <li className={`bookmark-card${highlighted ? " highlighted" : ""}`}>
      <div className="favicon">
        {bookmark.faviconUrl ? (
          <img src={bookmark.faviconUrl} alt="" width={20} height={20} />
        ) : (
          <span className="favicon-fallback" aria-hidden>
            {hostOf(bookmark.url).charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="bookmark-body">
        <a
          className="bookmark-title"
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          title={bookmark.title}
        >
          {bookmark.title}
        </a>
        <span className="bookmark-url" title={bookmark.url}>
          {bookmark.url}
        </span>
        {bookmark.tags.length > 0 && (
          <div className="card-tags">
            {bookmark.tags.map((t) => (
              <button
                key={t}
                type="button"
                className="tag-chip small"
                onClick={() => onFilterTag(t)}
                title={`Filter by ${t}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="edit-btn" onClick={() => onEdit(bookmark)}>
        Edit
      </button>
    </li>
  );
}
