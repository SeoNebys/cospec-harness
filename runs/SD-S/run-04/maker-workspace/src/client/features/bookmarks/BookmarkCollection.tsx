import { useEffect, useRef, useState } from 'react';
import type { CurrentUser } from '../../../shared/contracts/auth';
import type { Bookmark, BookmarkStatus } from '../../../shared/contracts/bookmarks';
import { BookmarkForm } from './BookmarkForm';
import { BookmarkCard } from './BookmarkCard';
import { CollectionToolbar } from './CollectionToolbar';
import { DeleteBookmarkDialog } from './DeleteBookmarkDialog';
import {
  archiveBookmark,
  deleteBookmark,
  favoriteBookmark,
  listBookmarks,
  listTags,
  restoreBookmark,
  type TagSummary,
} from './bookmark-api';
import { useDebouncedValue } from './useCollectionQuery';

function initialState() {
  const p = new URLSearchParams(location.search);
  return {
    view: (p.get('view') === 'archived' ? 'archived' : 'active') as BookmarkStatus,
    q: p.get('q') ?? '',
    favorite: p.get('favorite') === 'true',
    tags: p.getAll('tag'),
  };
}

export function BookmarkCollection({
  user,
  onSignOut,
}: {
  user: CurrentUser;
  onSignOut: () => void;
}) {
  const first = useRef(initialState()).current;
  const [view, setView] = useState(first.view);
  const [query, setQuery] = useState(first.q);
  const search = useDebouncedValue(query);
  const [favorite, setFavorite] = useState(first.favorite);
  const [selected, setSelected] = useState(first.tags);
  const [items, setItems] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Bookmark | null | false>(false);
  const [deleting, setDeleting] = useState<Bookmark | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);
  function params(cursor?: string) {
    const p = new URLSearchParams({ view, limit: '50' });
    if (search) p.set('q', search);
    if (favorite) p.set('favorite', 'true');
    selected.forEach((id) => p.append('tag', id));
    if (cursor) p.set('cursor', cursor);
    return p;
  }
  useEffect(() => {
    const p = new URLSearchParams({ view, limit: '50' });
    if (search) p.set('q', search);
    if (favorite) p.set('favorite', 'true');
    selected.forEach((id) => p.append('tag', id));
    history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}`);
    setLoading(true);
    setError('');
    Promise.all([listBookmarks(p), listTags(view)])
      .then(([page, tagPage]) => {
        setItems(page.items);
        setNext(page.nextCursor);
        setTags(tagPage.items);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your collection.'))
      .finally(() => setLoading(false));
  }, [view, search, favorite, selected, version]);
  function refresh(message?: string) {
    if (message) setNotice(message);
    setVersion((v) => v + 1);
  }
  function toggleTag(id: string) {
    setSelected((values) =>
      values.includes(id) ? values.filter((v) => v !== id) : [...values, id],
    );
  }
  async function toggleFavorite(bookmark: Bookmark) {
    setItems((values) =>
      values.map((b) => (b.id === bookmark.id ? { ...b, isFavorite: !b.isFavorite } : b)),
    );
    try {
      await favoriteBookmark(bookmark.id, !bookmark.isFavorite);
      refresh();
    } catch {
      setItems((values) => values.map((b) => (b.id === bookmark.id ? bookmark : b)));
      setNotice('Favorite change could not be saved.');
    }
  }
  async function move(bookmark: Bookmark) {
    if (bookmark.status === 'active') await archiveBookmark(bookmark.id);
    else await restoreBookmark(bookmark.id);
    refresh(bookmark.status === 'active' ? 'Bookmark archived.' : 'Bookmark restored.');
  }
  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteBookmark(deleting.id);
      setDeleting(null);
      refresh('Bookmark permanently deleted.');
    } finally {
      setDeleteBusy(false);
    }
  }
  const empty = !loading && !error && items.length === 0;
  const filtered = Boolean(search || favorite || selected.length);
  return (
    <div className="app-shell" data-harness-ready="true">
      <header className="site-header">
        <a className="brand" href="/">
          Keepsake<span>.</span>
        </a>
        <nav aria-label="Collection views">
          <button
            className={view === 'active' ? 'active' : ''}
            onClick={() => {
              setView('active');
              setSelected([]);
            }}
          >
            Collection
          </button>
          <button
            className={view === 'archived' ? 'active' : ''}
            onClick={() => {
              setView('archived');
              setSelected([]);
            }}
          >
            Archive
          </button>
        </nav>
        <div className="account">
          <span>{user.email.slice(0, 1).toUpperCase()}</span>
          <button onClick={onSignOut}>Sign out</button>
        </div>
      </header>
      <main className="collection-main">
        <section className="collection-heading">
          <div>
            <p className="eyebrow">
              {view === 'active' ? 'Your private library' : 'Out of sight, not gone'}
            </p>
            <h1>{view === 'active' ? 'The collection' : 'The archive'}</h1>
            <p>
              {view === 'active'
                ? 'Everything you thought was worth another look.'
                : 'Restore something whenever it feels useful again.'}
            </p>
          </div>
          {view === 'active' && (
            <button className="button primary add-button" onClick={() => setForm(null)}>
              <span>＋</span> Add bookmark
            </button>
          )}
        </section>
        <CollectionToolbar
          query={query}
          setQuery={setQuery}
          favorite={favorite}
          setFavorite={setFavorite}
          tags={tags}
          selected={selected}
          toggleTag={toggleTag}
          clear={() => {
            setQuery('');
            setFavorite(false);
            setSelected([]);
          }}
        />
        {notice && (
          <p className="status-toast" role="status" onAnimationEnd={() => setNotice('')}>
            {notice}
          </p>
        )}
        {error && (
          <div className="empty-state">
            <p className="empty-icon">↻</p>
            <h2>We couldn’t load your collection</h2>
            <p>{error}</p>
            <button className="button ghost" onClick={() => refresh()}>
              Try again
            </button>
          </div>
        )}
        {loading && (
          <div className="skeleton-grid" aria-label="Loading bookmarks">
            {[1, 2, 3].map((i) => (
              <div className="skeleton" key={i} />
            ))}
          </div>
        )}
        {empty && (
          <div className="empty-state">
            <p className="empty-icon">{filtered ? '⌕' : '◇'}</p>
            <h2>
              {filtered
                ? 'Nothing matches yet'
                : view === 'active'
                  ? 'Your collection is ready'
                  : 'Your archive is empty'}
            </h2>
            <p>
              {filtered
                ? 'Try a broader search or clear your filters.'
                : view === 'active'
                  ? 'Save your first link and we’ll keep it close.'
                  : 'Archived bookmarks will wait here until you need them.'}
            </p>
            {filtered ? (
              <button
                className="button ghost"
                onClick={() => {
                  setQuery('');
                  setFavorite(false);
                  setSelected([]);
                }}
              >
                Clear filters
              </button>
            ) : (
              view === 'active' && (
                <button className="button primary" onClick={() => setForm(null)}>
                  Save your first bookmark
                </button>
              )
            )}
          </div>
        )}
        {!loading && items.length > 0 && (
          <>
            <div className="result-line">
              <span>
                {items.length}
                {next ? '+' : ''} bookmark{items.length === 1 ? '' : 's'}
              </span>
              <span>Newest first</span>
            </div>
            <section className="bookmark-grid" aria-label={`${view} bookmarks`}>
              {items.map((bookmark) => (
                <BookmarkCard
                  key={bookmark.id}
                  bookmark={bookmark}
                  onEdit={() => setForm(bookmark)}
                  onFavorite={() => void toggleFavorite(bookmark)}
                  onArchive={() => void move(bookmark)}
                  onRestore={() => void move(bookmark)}
                  onDelete={() => setDeleting(bookmark)}
                />
              ))}
            </section>
            {next && (
              <div className="load-more">
                <button
                  className="button ghost"
                  onClick={async () => {
                    const page = await listBookmarks(params(next));
                    setItems((v) => [...v, ...page.items]);
                    setNext(page.nextCursor);
                  }}
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </main>
      {form !== false && (
        <BookmarkForm
          initial={form ?? undefined}
          onClose={() => setForm(false)}
          onSaved={() => {
            setForm(false);
            refresh(form ? 'Bookmark updated.' : 'Bookmark saved.');
          }}
          onEditExisting={(bookmark) => setForm(bookmark)}
        />
      )}
      {deleting && (
        <DeleteBookmarkDialog
          bookmark={deleting}
          busy={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}
