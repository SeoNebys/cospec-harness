import { useState } from 'react';
import type { Bookmark, CreateBookmarkInput, UpdateBookmarkInput } from '../shared/api-types';
import { BookmarkForm } from './features/bookmarks/BookmarkForm';
import { BookmarkList } from './features/bookmarks/BookmarkList';
import { CollectionState } from './features/bookmarks/CollectionState';
import { CollectionControls } from './features/bookmarks/CollectionControls';
import { DuplicateDialog } from './features/bookmarks/DuplicateDialog';
import { ArchiveView } from './features/bookmarks/ArchiveView';
import { DeleteBookmarkDialog } from './features/bookmarks/DeleteBookmarkDialog';
import { duplicateFrom, useBookmarks } from './features/bookmarks/useBookmarks';

export function App() {
  const bookmarks = useBookmarks();
  const [formOpen, setFormOpen] = useState(false);
  const [duplicate, setDuplicate] = useState<Bookmark | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<CreateBookmarkInput | null>(null);
  const [duplicateBusy, setDuplicateBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Bookmark | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bookmark | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function saveForm(input: CreateBookmarkInput | UpdateBookmarkInput) {
    if (editing) {
      await bookmarks.update(editing.id, input as UpdateBookmarkInput);
      setStatus(`Updated ${editing.title}.`);
      setEditing(null);
      return;
    }
    const createInput = input as CreateBookmarkInput;
    try {
      await bookmarks.create(createInput);
      setFormOpen(false);
      setStatus(`Saved ${createInput.title}.`);
    } catch (error) {
      const existing = duplicateFrom(error);
      if (existing) {
        setDuplicate(existing);
        setPendingDuplicate(createInput);
        return;
      }
      throw error;
    }
  }

  async function confirmDuplicate() {
    if (!pendingDuplicate) return;
    setDuplicateBusy(true);
    try {
      await bookmarks.create({ ...pendingDuplicate, allowDuplicate: true });
      setDuplicate(null);
      setPendingDuplicate(null);
      setFormOpen(false);
      setStatus(`Saved another copy of ${pendingDuplicate.title}.`);
    } finally {
      setDuplicateBusy(false);
    }
  }

  async function favorite(bookmark: Bookmark) {
    setPendingId(bookmark.id);
    try {
      await bookmarks.update(bookmark.id, { isFavorite: !bookmark.isFavorite });
      setStatus(bookmark.isFavorite ? `Removed ${bookmark.title} from favorites.` : `Added ${bookmark.title} to favorites.`);
    } catch {
      setStatus(`Could not update ${bookmark.title}. Please try again.`);
    } finally {
      setPendingId(null);
    }
  }

  function switchScope(scope: 'active' | 'archived') {
    bookmarks.setCriteria({ ...bookmarks.criteria, scope, q: '', tag: null, favorite: null });
  }

  async function archive(bookmark: Bookmark) {
    setPendingId(bookmark.id);
    try { await bookmarks.archive(bookmark.id); setStatus(`Archived ${bookmark.title}.`); }
    catch { setStatus(`Could not archive ${bookmark.title}. Please try again.`); }
    finally { setPendingId(null); }
  }

  async function restore(bookmark: Bookmark) {
    setPendingId(bookmark.id);
    try { await bookmarks.restore(bookmark.id); setStatus(`Restored ${bookmark.title}.`); }
    catch { setStatus(`Could not restore ${bookmark.title}. Please try again.`); }
    finally { setPendingId(null); }
  }

  async function deleteBookmark() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await bookmarks.deleteBookmark(deleteTarget.id);
      setStatus(`Deleted ${deleteTarget.title} permanently.`);
      setDeleteTarget(null);
    } catch {
      setStatus(`Could not delete ${deleteTarget.title}. Please try again.`);
    } finally { setDeleteBusy(false); }
  }

  const isReady = !bookmarks.loading && !bookmarks.error;
  const items = bookmarks.data?.items ?? [];

  return (
    <div className="app-shell" {...(isReady ? { 'data-harness-ready': 'true' } : {})}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Pinboard home"><span className="brand-mark" aria-hidden="true">P</span><span>Pinboard</span></a>
        <nav aria-label="Primary"><button type="button" aria-current={bookmarks.criteria.scope === 'active' ? 'page' : undefined} onClick={() => switchScope('active')}>Bookmarks</button><button type="button" aria-current={bookmarks.criteria.scope === 'archived' ? 'page' : undefined} onClick={() => switchScope('archived')}>Archive</button></nav>
      </header>
      <main className="page-shell">
        <section className="collection-heading">
          <div><p className="eyebrow">{bookmarks.criteria.scope === 'active' ? 'Your personal library' : 'Out of sight, still in reach'}</p><h1>{bookmarks.criteria.scope === 'active' ? 'Bookmarks' : 'Archive'}</h1><p>{bookmarks.data ? `${bookmarks.data.total.toLocaleString()} ${bookmarks.data.total === 1 ? 'place' : 'places'} ${bookmarks.criteria.scope === 'active' ? 'worth returning to' : 'set aside'}` : 'Everything worth returning to, in one quiet place.'}</p></div>
          {bookmarks.criteria.scope === 'active' && <button className="button primary add-button" type="button" onClick={() => setFormOpen(true)}><span aria-hidden="true">＋</span> Add bookmark</button>}
        </section>
        {bookmarks.data && <CollectionControls criteria={bookmarks.criteria} tags={bookmarks.data.availableTags} onChange={bookmarks.setCriteria} />}
        {bookmarks.loading && !bookmarks.data && <p className="loading-state" role="status">Loading your bookmarks…</p>}
        {bookmarks.error && <CollectionState kind="error" onAction={() => void bookmarks.reload()} />}
        {!bookmarks.loading && !bookmarks.error && items.length === 0 && <CollectionState kind={bookmarks.criteria.q || bookmarks.criteria.tag || bookmarks.criteria.favorite ? 'none' : bookmarks.criteria.scope === 'archived' ? 'archive' : 'new'} onAction={() => bookmarks.criteria.q || bookmarks.criteria.tag || bookmarks.criteria.favorite ? bookmarks.setCriteria({ ...bookmarks.criteria, q: '', tag: null, favorite: null }) : bookmarks.criteria.scope === 'archived' ? switchScope('active') : setFormOpen(true)} />}
        {items.length > 0 && bookmarks.criteria.scope === 'active' && <BookmarkList bookmarks={items} pendingId={pendingId} onFavorite={(bookmark) => void favorite(bookmark)} onEdit={setEditing} onArchive={(bookmark) => void archive(bookmark)} />}
        {items.length > 0 && bookmarks.criteria.scope === 'archived' && <ArchiveView bookmarks={items} pendingId={pendingId} onRestore={(bookmark) => void restore(bookmark)} onDelete={setDeleteTarget} />}
      </main>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{status}</div>
      {(formOpen || editing) && <BookmarkForm {...(editing ? { bookmark: editing } : {})} onSubmit={saveForm} onCancel={() => { setFormOpen(false); setEditing(null); }} />}
      {duplicate && <DuplicateDialog bookmark={duplicate} busy={duplicateBusy} onCancel={() => { setDuplicate(null); setPendingDuplicate(null); }} onConfirm={() => void confirmDuplicate()} />}
      {deleteTarget && <DeleteBookmarkDialog bookmark={deleteTarget} busy={deleteBusy} onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteBookmark()} />}
    </div>
  );
}
