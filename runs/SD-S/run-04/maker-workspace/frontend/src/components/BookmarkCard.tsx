import type { Bookmark } from "../types";
import { displayLabel } from "../types";

interface Props {
  bookmark: Bookmark;
  onEdit: (b: Bookmark) => void;
  onDelete: (b: Bookmark) => void;
  onTagClick?: (tag: string) => void;
}

/** A single bookmark, with fetching/failed states and an address fallback (FR-003, FR-016). */
export function BookmarkCard({ bookmark, onEdit, onDelete, onTagClick }: Props) {
  const label = displayLabel(bookmark);
  return (
    <div className="card" data-testid="bookmark-card">
      {bookmark.previewImageUrl ? (
        <img className="thumb" src={bookmark.previewImageUrl} alt="" />
      ) : null}
      <div className="body">
        <p className="title">
          <a href={bookmark.url} target="_blank" rel="noreferrer">
            {label}
          </a>
        </p>
        <div className="url">{bookmark.url}</div>

        {bookmark.fetchStatus === "pending" && (
          <div className="status" data-testid="fetch-pending">
            Fetching details…
          </div>
        )}
        {bookmark.fetchStatus === "failed" && !bookmark.title && (
          <div className="status failed" data-testid="fetch-failed">
            Couldn’t fetch page details — using the address. You can edit the title.
          </div>
        )}

        {bookmark.previewDescription && <p className="desc">{bookmark.previewDescription}</p>}
        {bookmark.note && <p className="note">📝 {bookmark.note}</p>}

        {bookmark.tags.length > 0 && (
          <div className="tags">
            {bookmark.tags.map((t) => (
              <span
                key={t}
                className="chip"
                onClick={onTagClick ? () => onTagClick(t) : undefined}
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="actions">
          <button onClick={() => onEdit(bookmark)}>Edit</button>
          <button className="danger" onClick={() => onDelete(bookmark)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
