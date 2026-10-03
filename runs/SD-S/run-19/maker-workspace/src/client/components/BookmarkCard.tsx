import { useEffect, useRef, useState } from 'react';
import type { Bookmark } from '../../shared/types.js';
import { deleteBookmark } from '../api/client.js';
import { BookmarkEditor } from './BookmarkEditor.js';
import { DeleteConfirmation } from './DeleteConfirmation.js';

interface BookmarkCardProps {
  bookmark: Bookmark;
  onChanged?: () => void | Promise<void>;
}

function hostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function BookmarkCard({ bookmark, onChanged }: BookmarkCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState('');
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const restoreDeleteFocus = useRef(false);

  useEffect(() => {
    if (!confirmingDelete && restoreDeleteFocus.current) {
      restoreDeleteFocus.current = false;
      deleteButtonRef.current?.focus();
    }
  }, [confirmingDelete]);

  if (editing) {
    return <article className="bookmark-card editing-card"><BookmarkEditor
      bookmark={bookmark}
      onCancel={() => setEditing(false)}
      onSaved={async () => { setEditing(false); await onChanged?.(); }}
    /></article>;
  }

  async function confirmDelete() {
    try {
      await deleteBookmark(bookmark.id);
      setConfirmingDelete(false);
      await onChanged?.();
    } catch (caught) {
      setConfirmingDelete(false);
      setError(caught instanceof Error ? caught.message : 'The bookmark could not be deleted.');
    }
  }

  return (
    <article className="bookmark-card">
      <div className="bookmark-meta">
        <span className="site-mark" aria-hidden="true">{hostname(bookmark.url).charAt(0).toUpperCase()}</span>
        <span className="hostname">{hostname(bookmark.url)}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={bookmark.createdAt}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(bookmark.createdAt))}</time>
      </div>
      <h3><a href={bookmark.url} target="_blank" rel="noopener noreferrer">{bookmark.title}<span className="external-mark" aria-hidden="true">↗</span></a></h3>
      {bookmark.description ? <p className="bookmark-description">{bookmark.description}</p> : null}
      {bookmark.tags.length ? <ul className="tag-list" aria-label="Tags">{bookmark.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul> : null}
      {error ? <p className="message error-message" role="alert">{error}</p> : null}
      <div className="card-actions">
        <button className="card-action" type="button" onClick={() => setEditing(true)} aria-label={`Edit ${bookmark.title}`}>Edit</button>
        <button ref={deleteButtonRef} className="card-action danger-text" type="button" onClick={() => setConfirmingDelete(true)} aria-label={`Delete ${bookmark.title}`}>Delete</button>
      </div>
      {confirmingDelete ? <DeleteConfirmation
        bookmarkTitle={bookmark.title}
        onCancel={() => { restoreDeleteFocus.current = true; setConfirmingDelete(false); }}
        onConfirm={confirmDelete}
      /> : null}
    </article>
  );
}
