import { useCallback, useEffect, useRef, useState } from 'react';

import type { Bookmark, CreateBookmarkInput, TagSummary } from '../shared/bookmark-types.js';
import { createBookmark, deleteBookmark, listBookmarks, listTags, updateBookmark } from './api.js';
import { BookmarkForm } from './components/BookmarkForm.js';
import { BookmarkList } from './components/BookmarkList.js';
import { CollectionControls } from './components/CollectionControls.js';
import { DeleteBookmarkDialog } from './components/DeleteBookmarkDialog.js';
import { useCollectionState } from './hooks/useCollectionState.js';

export function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [editing, setEditing] = useState<Bookmark | null>(null);
  const [deleting, setDeleting] = useState<Bookmark | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const { query, setQuery, reset } = useCollectionState();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const deleteInvokerRef = useRef<HTMLElement | null>(null);
  const queryRef = useRef(query);
  const loadSequence = useRef(0);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const currentQuery = queryRef.current;
    setLoading(true);
    setError(null);
    try {
      const [result, availableTags] = await Promise.all([
        listBookmarks(currentQuery),
        listTags(currentQuery.archived),
      ]);
      if (sequence !== loadSequence.current) return;
      setBookmarks(result.items);
      setTags(availableTags);
    } catch {
      if (sequence !== loadSequence.current) return;
      setError('Your bookmarks are still safe. Try loading them again.');
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, query]);

  const add = async (input: CreateBookmarkInput) => {
    const created = await createBookmark(input);
    setFormOpen(false);
    setStatus(`${created.title} was saved.`);
    await load();
  };

  const edit = async (input: CreateBookmarkInput) => {
    if (!editing) return;
    setPendingId(editing.id);
    try {
      const updated = await updateBookmark(editing.id, input);
      setEditing(null);
      setStatus(`${updated.title} was updated.`);
      await load();
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`#bookmark-${updated.id}`)?.focus(),
      );
    } finally {
      setPendingId(null);
    }
  };

  const changeState = async (
    bookmark: Bookmark,
    patch: { isFavorite?: boolean; isArchived?: boolean },
  ) => {
    setPendingId(bookmark.id);
    try {
      const updated = await updateBookmark(bookmark.id, patch);
      setStatus(
        patch.isFavorite !== undefined
          ? `${updated.title} ${updated.isFavorite ? 'was added to' : 'was removed from'} favorites.`
          : `${updated.title} was ${updated.isArchived ? 'archived' : 'restored'}.`,
      );
      await load();
    } catch {
      setStatus('That change could not be saved. Please try again.');
    } finally {
      setPendingId(null);
    }
  };

  const askDelete = (bookmark: Bookmark) => {
    deleteInvokerRef.current = document.activeElement as HTMLElement;
    setDeleting(bookmark);
  };

  const cancelDelete = () => {
    setDeleting(null);
    requestAnimationFrame(() => deleteInvokerRef.current?.focus());
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setPendingId(deleting.id);
    try {
      await deleteBookmark(deleting.id);
      setStatus(`${deleting.title} was permanently deleted.`);
      setDeleting(null);
      await load();
      requestAnimationFrame(() => addButtonRef.current?.focus());
    } catch {
      setStatus('The bookmark could not be deleted. Please try again.');
    } finally {
      setPendingId(null);
    }
  };

  const revealDuplicate = (id: number) => {
    setFormOpen(false);
    setStatus('This link is already saved.');
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`#bookmark-${id}`)?.focus());
  };

  return (
    <div className="app-shell" data-harness-ready={!loading && !error ? 'true' : undefined}>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Keep home">
          <span className="brand-mark">K</span>
          <span>Keep</span>
        </a>
        <button ref={addButtonRef} className="button primary" onClick={() => setFormOpen(true)}>
          <span aria-hidden="true">＋</span> Add bookmark
        </button>
      </header>
      <main>
        <section className="hero">
          <p className="eyebrow">Your private link library</p>
          <h1>Worth keeping.</h1>
          <p>Save the corners of the web you want to return to.</p>
        </section>
        <div className="collection-heading">
          <div>
            <p className="eyebrow">Collection</p>
            <h2>{bookmarks.length === 1 ? '1 saved link' : `${bookmarks.length} saved links`}</h2>
          </div>
        </div>
        <CollectionControls query={query} tags={tags} onChange={setQuery} onReset={reset} />
        <BookmarkList
          items={bookmarks}
          loading={loading}
          error={error}
          onRetry={load}
          filtered={Boolean(
            query.q ||
            query.tags.length ||
            query.favorite !== undefined ||
            query.archived ||
            query.sort !== 'newest',
          )}
          onReset={reset}
          pendingId={pendingId}
          onEdit={setEditing}
          onFavorite={(bookmark) =>
            void changeState(bookmark, { isFavorite: !bookmark.isFavorite })
          }
          onArchive={(bookmark) => void changeState(bookmark, { isArchived: !bookmark.isArchived })}
          onDelete={askDelete}
        />
      </main>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      <BookmarkForm
        open={formOpen}
        mode="create"
        onClose={() => setFormOpen(false)}
        onSubmit={add}
        onDuplicate={revealDuplicate}
      />
      <BookmarkForm
        open={Boolean(editing)}
        mode="edit"
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={edit}
        onDuplicate={revealDuplicate}
      />
      <DeleteBookmarkDialog
        title={deleting?.title ?? ''}
        open={Boolean(deleting)}
        pending={pendingId === deleting?.id}
        onCancel={cancelDelete}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
