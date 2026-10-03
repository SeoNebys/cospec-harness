import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Bookmark } from '@shared/contracts.js';
import { deleteBookmark, getBookmark, updateBookmark } from '../services/bookmarks-api.js';
import { NoteRenderer } from '../features/bookmarks/NoteRenderer.js';
import { BookmarkEditor } from '../features/bookmarks/BookmarkEditor.js';
import { DeleteBookmarkDialog } from '../features/bookmarks/DeleteBookmarkDialog.js';
export function BookmarkDetailPage() {
  const { id } = useParams(),
    navigate = useNavigate(),
    [bookmark, setBookmark] = useState<Bookmark | null>(null),
    [editing, setEditing] = useState(false),
    [deleting, setDeleting] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (id)
      getBookmark(id)
        .then(setBookmark)
        .catch((e) => setError(e.message));
  }, [id]);
  if (error)
    return (
      <main className="detail-page">
        <Link to="/">← Back</Link>
        <div className="error-banner">{error}</div>
      </main>
    );
  if (!bookmark) return <main className="center-status">Opening bookmark…</main>;
  async function remove() {
    setBusy(true);
    await deleteBookmark(bookmark!.id);
    navigate('/');
  }
  async function state(value: any) {
    setBookmark(await updateBookmark(bookmark!.id, value));
  }
  return (
    <main className="detail-page">
      <Link to="/" className="back-link">
        ← Back to library
      </Link>
      <header className="detail-header">
        <div className="favicon large">
          {bookmark.iconUrl ? <img src={bookmark.iconUrl} alt="" /> : bookmark.displayLabel[0]}
        </div>
        <div>
          <p className="eyebrow">
            {bookmark.archivedAt
              ? 'Archived bookmark'
              : bookmark.isRead
                ? 'Read bookmark'
                : 'Unread bookmark'}
          </p>
          <h1>{bookmark.displayLabel}</h1>
          <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
            Open original ↗
          </a>
        </div>
      </header>
      {editing ? (
        <BookmarkEditor
          bookmark={bookmark}
          onSaved={(b) => {
            setBookmark(b);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <section className="detail-section">
            <h2>Description</h2>
            <p>{bookmark.description || 'No description.'}</p>
          </section>
          <section className="detail-section">
            <h2>Personal note</h2>
            <NoteRenderer value={bookmark.noteMarkdown} />
          </section>
          <div className="tag-row">
            {bookmark.tags.map((t) => (
              <span className="tag" key={t.id}>
                {t.name}
              </span>
            ))}
          </div>
          <div className="detail-actions">
            <button className="primary" onClick={() => setEditing(true)}>
              Edit bookmark
            </button>
            <button onClick={() => void state({ isRead: !bookmark.isRead })}>
              {bookmark.isRead ? 'Mark unread' : 'Mark read'}
            </button>
            <button onClick={() => void state({ archived: !bookmark.archivedAt })}>
              {bookmark.archivedAt ? 'Restore' : 'Archive'}
            </button>
            <button className="danger-text" onClick={() => setDeleting(true)}>
              Delete
            </button>
          </div>
        </>
      )}
      {deleting && (
        <DeleteBookmarkDialog
          title={bookmark.displayLabel}
          busy={busy}
          onCancel={() => setDeleting(false)}
          onConfirm={() => void remove()}
        />
      )}
    </main>
  );
}
