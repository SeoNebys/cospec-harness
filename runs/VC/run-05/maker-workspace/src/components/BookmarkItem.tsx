import { useState } from "react";
import type { Bookmark, BookmarkDraft } from "../types.ts";
import { BookmarkForm } from "./BookmarkForm.tsx";

interface Props {
  bookmark: Bookmark;
  activeTag: string | null;
  onSave: (id: number, draft: BookmarkDraft) => Promise<void>;
  onDelete: (id: number) => void;
  onTagClick: (tag: string) => void;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function faviconUrl(url: string): string {
  return `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(
    hostname(url)
  )}`;
}

export function BookmarkItem({
  bookmark,
  activeTag,
  onSave,
  onDelete,
  onTagClick,
}: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="card">
        <BookmarkForm
          initial={bookmark}
          onSubmit={async (draft) => {
            await onSave(bookmark.id, draft);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="card bookmark">
      <img className="favicon" src={faviconUrl(bookmark.url)} alt="" />
      <div className="bookmark-body">
        <a
          className="bookmark-title"
          href={bookmark.url}
          target="_blank"
          rel="noreferrer noopener"
        >
          {bookmark.title || bookmark.url}
        </a>
        <div className="bookmark-host">{hostname(bookmark.url)}</div>
        {bookmark.notes && <p className="bookmark-notes">{bookmark.notes}</p>}
        {bookmark.tags.length > 0 && (
          <div className="tag-row">
            {bookmark.tags.map((tag) => (
              <button
                key={tag}
                className={`tag ${activeTag === tag ? "tag-active" : ""}`}
                onClick={() => onTagClick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="bookmark-actions">
        <button className="btn btn-ghost" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className="btn btn-ghost btn-danger"
          onClick={() => onDelete(bookmark.id)}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
