import { useState } from 'react';
import type { Bookmark } from '../api';
import { EditBookmarkForm } from './EditBookmarkForm';

// Bookmark list showing title, address, save date, and editable tags. Shows a
// first-run empty-state guide, or a distinct "no matches" message while
// filtering, instead of a blank screen (FR-006, FR-009, FR-015).
export function BookmarkList({
  bookmarks,
  query,
  onSetTags,
  onUpdated,
  onDelete,
}: {
  bookmarks: Bookmark[];
  query: string;
  onSetTags: (bookmark: Bookmark, tags: string[]) => void;
  onUpdated: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
}) {
  if (bookmarks.length === 0) {
    if (query.trim()) {
      return (
        <div className="empty">
          <h2>No matches</h2>
          <p>
            No bookmarks match “{query.trim()}”. Try a different keyword or clear
            the filters.
          </p>
        </div>
      );
    }
    return (
      <div className="empty">
        <h2>No bookmarks yet</h2>
        <p>
          Paste a web address above and choose <strong>Save bookmark</strong> to
          add your first one.
        </p>
      </div>
    );
  }

  return (
    <ul className="bookmark-list">
      {bookmarks.map((b) => (
        <BookmarkItem
          key={b.id}
          bookmark={b}
          onSetTags={onSetTags}
          onUpdated={onUpdated}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function BookmarkItem({
  bookmark: b,
  onSetTags,
  onUpdated,
  onDelete,
}: {
  bookmark: Bookmark;
  onSetTags: (bookmark: Bookmark, tags: string[]) => void;
  onUpdated: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
}) {
  const [newTag, setNewTag] = useState('');
  const [editing, setEditing] = useState(false);

  function addTag() {
    const name = newTag.trim();
    if (!name) return;
    if (b.tags.some((t) => t.toLowerCase() === name.toLowerCase())) {
      setNewTag('');
      return;
    }
    onSetTags(b, [...b.tags, name]);
    setNewTag('');
  }

  if (editing) {
    return (
      <li className="bookmark">
        <EditBookmarkForm
          bookmark={b}
          onSaved={(saved) => {
            onUpdated(saved);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="bookmark">
      <div className="bookmark-head">
        <a href={b.url} target="_blank" rel="noreferrer" className="title">
          {b.title}
        </a>
        <span className="actions">
          <button type="button" className="link-btn" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            type="button"
            className="link-btn danger"
            onClick={() => onDelete(b)}
          >
            Delete
          </button>
        </span>
      </div>
      <span className="url">{b.url}</span>
      <span className="date">
        Saved {new Date(b.createdAt).toLocaleDateString()}
      </span>
      <span className="tags">
        {b.tags.map((t) => (
          <span key={t} className="tag">
            {t}
            <button
              type="button"
              className="tag-remove"
              title={`Remove ${t} from this bookmark`}
              onClick={() => onSetTags(b, b.tags.filter((x) => x !== t))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="tag-input"
          placeholder="+ tag"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
          aria-label={`Add a tag to ${b.title}`}
        />
      </span>
    </li>
  );
}
