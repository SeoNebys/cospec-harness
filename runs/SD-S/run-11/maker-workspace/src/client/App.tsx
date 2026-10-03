import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bookmark, Tag } from './api/types.ts';
import { archiveBookmark, deleteBookmark, listBookmarks, listTags, restoreBookmark } from './api/bookmarks.ts';
import { useLibraryViewState } from './hooks/useLibraryViewState.ts';
import { SaveBookmarkForm } from './components/SaveBookmarkForm.tsx';
import { LibraryToolbar } from './components/LibraryToolbar.tsx';
import { ActiveFilters } from './components/ActiveFilters.tsx';
import { BookmarkList } from './components/BookmarkList.tsx';
import { LibraryResults } from './components/LibraryResults.tsx';
import { EmptyState } from './components/EmptyState.tsx';
import { EditBookmarkDialog } from './components/EditBookmarkDialog.tsx';
import { DeleteBookmarkDialog } from './components/DeleteBookmarkDialog.tsx';

export default function App() {
  const { query, update } = useLibraryViewState();
  const [items, setItems] = useState<Bookmark[]>([]), [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<Bookmark | null>(null), [deleting, setDeleting] = useState<Bookmark | null>(null);
  const [displayLimit, setDisplayLimit] = useState(100);
  const saveRef = useRef<HTMLDivElement>(null), refresh = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => setDisplayLimit(100), [query]);
  useEffect(() => { let live = true; setLoading(true); setLoadError(''); Promise.all([listBookmarks(query), listTags(query.view)]).then(([bookmarks, tagList]) => { if (live) { setItems(bookmarks.items); setTags(tagList.items); setLoading(false); } }).catch(() => { if (live) { setLoadError('We couldn’t load your bookmarks.'); setLoading(false); } }); return () => { live = false; }; }, [query, version]);
  const clear = () => update({ q: '', tags: [], favorite: false, sort: 'newest' }), act = async (operation: () => Promise<unknown>) => { await operation(); refresh(); };
  function duplicate(id: string) { update({ view: 'active', q: '', tags: [], favorite: false }); setTimeout(() => document.getElementById(`bookmark-${id}`)?.scrollIntoView({ behavior: 'smooth' }), 100); }
  const hasFilters = Boolean(query.q || query.tags.length || query.favorite), visibleItems = items.slice(0, displayLimit);
  return <div className="app" data-harness-ready={!loading && !loadError ? 'true' : undefined}>
    <header className="site-header"><a className="brand" href="/" aria-label="Bookkeep home"><span className="brand-mark">B</span><span>Bookkeep</span></a><nav aria-label="Library views"><button className={query.view === 'active' ? 'active' : ''} onClick={() => update({ view: 'active' })}>Bookmarks</button><button className={query.view === 'archived' ? 'active' : ''} onClick={() => update({ view: 'archived' })}>Archive</button></nav><button className="header-save" onClick={() => { update({ view: 'active' }); saveRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>＋ Save a link</button></header>
    <main><section className="hero"><span className="eyebrow">Your private reading shelf</span><h1>Keep the web worth<br /><em>coming back to.</em></h1><p>Save useful links, let Bookkeep name them, and find them again without the clutter.</p></section><div ref={saveRef}>{query.view === 'active' && <SaveBookmarkForm onSaved={refresh} onDuplicate={duplicate} />}</div><section className="library"><div className="section-kicker">{query.view === 'active' ? 'The library' : 'Put aside for later'}</div><h2 className="library-title">{query.view === 'active' ? 'Your bookmarks' : 'Archive'}</h2><LibraryToolbar query={query} tags={tags} onChange={update} /><ActiveFilters query={query} clear={clear} />
      {loading ? <div className="loading" role="status">Loading your library…</div> : loadError ? <div className="empty"><h2>Couldn’t load the library</h2><p>{loadError}</p><button onClick={refresh}>Try again</button></div> : items.length ? <><LibraryResults count={items.length} /><BookmarkList items={visibleItems} onEdit={setEditing} onArchive={bookmark => act(() => archiveBookmark(bookmark.id))} onRestore={bookmark => act(() => restoreBookmark(bookmark.id))} onDelete={setDeleting} />{items.length > visibleItems.length && <div className="load-more"><button className="secondary" onClick={() => setDisplayLimit(value => value + 100)}>Show more bookmarks</button></div>}</> : <EmptyState kind={hasFilters ? 'results' : query.view === 'archived' ? 'archive' : 'library'} onAction={hasFilters ? clear : query.view === 'archived' ? () => update({ view: 'active' }) : () => saveRef.current?.scrollIntoView({ behavior: 'smooth' })} />}
    </section></main><footer><span>Bookkeep</span><span>Made for the links that matter.</span></footer>{editing && <EditBookmarkDialog item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}{deleting && <DeleteBookmarkDialog item={deleting} onClose={() => setDeleting(null)} onConfirm={async () => { await deleteBookmark(deleting.id); setDeleting(null); refresh(); }} />}
  </div>;
}
