import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BookmarkDetail } from '../../shared/contracts/bookmarks';
import type { BulkAction, BulkSelection } from '../../shared/contracts/bulk';
import type { SearchCriteria } from '../../shared/contracts/search';
import { PermanentDeleteDialog } from '../components/PermanentDeleteDialog';
import { AuthPages } from '../features/auth/AuthPages';
import { SessionProvider, useSession } from '../features/auth/session-context';
import { BookmarkEditor } from '../features/bookmarks/BookmarkEditor';
import { BulkActionBar } from '../features/bulk-actions/BulkActionBar';
import { BulkConfirmDialog } from '../features/bulk-actions/BulkConfirmDialog';
import { BulkResultDialog, type BulkResult } from '../features/bulk-actions/BulkResultDialog';
import { SelectionController } from '../features/bulk-actions/SelectionController';
import { SaveSearchDialog } from '../features/saved-searches/SaveSearchDialog';
import { BookmarkDetailPage } from '../pages/BookmarkDetailPage';
import { CollectionsPage } from '../pages/CollectionsPage';
import { LibraryPage } from '../pages/LibraryPage';
import { SavedSearchesPage } from '../pages/SavedSearchesPage';
import { TagsPage } from '../pages/TagsPage';
import { ApiError, api } from './api-client';
import { AppShell, type AppView } from './AppShell';

type PaginatedBookmarks = {
  items: BookmarkDetail[];
  page: { total: number; nextCursor: string | null; hasMore: boolean };
};
type Collection = { id: string; name: string };
type Tag = { id: string; name: string };
type PendingBulk = { action: BulkAction; token: string; count: number };

const defaultCriteria: SearchCriteria = {
  query: '',
  includeTagIds: [],
  excludeTagIds: [],
  collection: { mode: 'any' },
  favorite: 'any',
  reading: 'any',
  context: 'active',
  sort: 'newest',
};
const bookmarkViews: AppView[] = ['library', 'read-later', 'favorites', 'archive'];

function criteriaUrl(criteria: SearchCriteria, cursor?: string) {
  const parameters = new URLSearchParams({
    query: criteria.query,
    favorite: criteria.favorite,
    reading: criteria.reading,
    context: criteria.context,
    sort: criteria.sort,
    collection: criteria.collection.mode === 'id' ? criteria.collection.id : criteria.collection.mode,
  });
  for (const id of criteria.includeTagIds) parameters.append('includeTag', id);
  for (const id of criteria.excludeTagIds) parameters.append('excludeTag', id);
  if (cursor) parameters.set('cursor', cursor);
  return `/api/bookmarks?${parameters}`;
}

function Application() {
  const session = useSession();
  const [view, setView] = useState<AppView>('library');
  const [criteria, setCriteria] = useState<SearchCriteria>(defaultCriteria);
  const [bookmarks, setBookmarks] = useState<BookmarkDetail[]>([]);
  const [pageInfo, setPageInfo] = useState<PaginatedBookmarks['page']>({
    total: 0,
    nextCursor: null,
    hasMore: false,
  });
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [fatalError, setFatalError] = useState('');
  const [editing, setEditing] = useState<BookmarkDetail | 'new' | null>(null);
  const [detail, setDetail] = useState<BookmarkDetail | null>(null);
  const [selected, setSelected] = useState(new Set<string>());
  const [allMatches, setAllMatches] = useState(false);
  const [saveSearch, setSaveSearch] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [pendingBulk, setPendingBulk] = useState<PendingBulk | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookmarkDetail | null>(null);

  const loadOrganization = useCallback(async () => {
    if (!session.user) return;
    const [collectionResult, tagResult] = await Promise.all([
      api.request<{ items: Collection[] }>('/api/collections'),
      api.request<{ items: Tag[] }>('/api/tags'),
    ]);
    setCollections(collectionResult.items);
    setTags(tagResult.items);
  }, [session.user]);

  const load = useCallback(
    async (showLoading = true) => {
      if (!session.user || !bookmarkViews.includes(view)) {
        setLoading(false);
        return;
      }
      if (showLoading) setLoading(true);
      setError('');
      setFatalError('');
      try {
        const page = await api.request<PaginatedBookmarks>(criteriaUrl(criteria));
        setBookmarks(page.items);
        setPageInfo(page.page);
      } catch (caught) {
        const message =
          caught instanceof ApiError ? caught.problem.detail : 'Your bookmarks could not be loaded.';
        setError(message);
        if (!(caught instanceof ApiError) || caught.problem.status >= 500) setFatalError(message);
      } finally {
        setLoading(false);
      }
    },
    [criteria, session.user, view],
  );

  useEffect(() => {
    void loadOrganization();
  }, [loadOrganization]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), criteria.query ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [load, criteria.query]);

  const navigate = (next: AppView) => {
    setView(next);
    setSelected(new Set());
    setAllMatches(false);
    setError('');
    if (next === 'read-later') setCriteria({ ...defaultCriteria, reading: 'unread' });
    else if (next === 'favorites') setCriteria({ ...defaultCriteria, favorite: 'favorite' });
    else if (next === 'archive') setCriteria({ ...defaultCriteria, context: 'archive' });
    else if (next === 'library') setCriteria(defaultCriteria);
    if (bookmarkViews.includes(next)) void loadOrganization();
  };

  const replace = (updated: BookmarkDetail) => {
    setBookmarks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setDetail((current) => (current?.id === updated.id ? updated : current));
  };
  const changeReading = async (bookmark: BookmarkDetail, value?: 'unread' | 'read') => {
    const updated = await api.request<BookmarkDetail>(`/api/bookmarks/${bookmark.id}/reading`, {
      method: 'POST',
      body: JSON.stringify({
        expectedVersion: bookmark.version,
        value: value ?? (bookmark.readingState === 'unread' ? 'read' : 'unread'),
      }),
    });
    replace(updated);
    if (view === 'read-later' && updated.readingState !== 'unread') void load(false);
  };
  const changeFavorite = async (bookmark: BookmarkDetail) => {
    const updated = await api.request<BookmarkDetail>(`/api/bookmarks/${bookmark.id}/favorite`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: bookmark.version, value: !bookmark.isFavorite }),
    });
    replace(updated);
    if (view === 'favorites' && !updated.isFavorite) void load(false);
  };
  const changeArchive = async (bookmark: BookmarkDetail) => {
    const action = bookmark.archivedAt ? 'restore' : 'archive';
    const updated = await api.request<BookmarkDetail>(`/api/bookmarks/${bookmark.id}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: bookmark.version }),
    });
    setDetail(null);
    void load(false);
    return updated;
  };
  const remove = async (bookmark: BookmarkDetail) => {
    await api.request(`/api/bookmarks/${bookmark.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ expectedVersion: bookmark.version, confirmation: 'permanent' }),
    });
    setDeleteTarget(null);
    setDetail(null);
    void load(false);
  };
  const loadMore = async () => {
    if (!pageInfo.nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await api.request<PaginatedBookmarks>(criteriaUrl(criteria, pageInfo.nextCursor));
      setBookmarks((current) => [...current, ...page.items]);
      setPageInfo(page.page);
    } finally {
      setLoadingMore(false);
    }
  };
  const toggle = (bookmark: BookmarkDetail) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(bookmark.id)) next.delete(bookmark.id);
      else next.add(bookmark.id);
      return next;
    });
  const selection = useMemo<BulkSelection>(
    () =>
      allMatches
        ? { mode: 'query', criteria }
        : {
            mode: 'ids',
            items: bookmarks
              .filter((bookmark) => selected.has(bookmark.id))
              .map((bookmark) => ({ id: bookmark.id, expectedVersion: bookmark.version })),
          },
    [allMatches, bookmarks, criteria, selected],
  );

  const executeBulk = async (action: BulkAction, token?: string) => {
    try {
      const result = await api.request<BulkResult>('/api/bookmarks/bulk/execute', {
        method: 'POST',
        body: JSON.stringify({ selection, action, confirmationToken: token }),
      });
      setBulkResult(result);
      setSelected(new Set());
      setAllMatches(false);
      setPendingBulk(null);
      await Promise.all([load(false), loadOrganization()]);
    } catch (caught) {
      setPendingBulk(null);
      if (caught instanceof ApiError && caught.problem.code === 'selection_changed') {
        setError(`${caught.problem.detail} Preview the action again to confirm the new count.`);
        await load(false);
        return;
      }
      setError(
        caught instanceof ApiError ? caught.problem.detail : 'The bulk action could not be completed.',
      );
    }
  };
  const runBulk = async (action: BulkAction) => {
    try {
      const preview = await api.request<{
        selectionCount: number;
        confirmation: { required: boolean; token?: string };
      }>('/api/bookmarks/bulk/preview', { method: 'POST', body: JSON.stringify({ selection, action }) });
      if (preview.confirmation.required && preview.confirmation.token)
        setPendingBulk({ action, token: preview.confirmation.token, count: preview.selectionCount });
      else await executeBulk(action);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.problem.detail : 'The selected action could not be previewed.',
      );
    }
  };

  if (session.loading)
    return (
      <div className="splash">
        <span className="wordmark-mark">K</span>
        <p>Opening your library…</p>
      </div>
    );
  if (!session.user) return <AuthPages />;
  if (loading && bookmarkViews.includes(view))
    return (
      <div className="splash">
        <span className="wordmark-mark">K</span>
        <p>Setting the shelves…</p>
      </div>
    );

  const metadata =
    view === 'read-later'
      ? {
          title: 'Read Later',
          eyebrow: 'Your unread queue',
          emptyTitle: 'Your reading queue is clear.',
          emptyDetail: 'Mark any active bookmark unread to keep it here.',
        }
      : view === 'favorites'
        ? {
            title: 'Favorites',
            eyebrow: 'Worth returning to',
            emptyTitle: 'No favorites yet.',
            emptyDetail: 'Use the diamond on any bookmark to keep it close.',
          }
        : view === 'archive'
          ? {
              title: 'Archive',
              eyebrow: 'Tucked away, not gone',
              emptyTitle: 'Your archive is empty.',
              emptyDetail: 'Archived bookmarks stay safe here until restored or permanently deleted.',
            }
          : {
              title: 'Library',
              eyebrow: 'Your collected web',
              emptyTitle: 'Save the page you don’t want to lose.',
              emptyDetail:
                'Paste a link and Keepwell will collect its useful details—then make every field your own.',
            };

  let content;
  if (fatalError) {
    content = (
      <main className="fatal-state">
        <h1>We couldn’t open this view.</h1>
        <p>{fatalError}</p>
        <button className="button button--primary" onClick={() => void load()}>
          Try again
        </button>
      </main>
    );
  } else if (bookmarkViews.includes(view)) {
    content = (
      <>
        <LibraryPage
          {...metadata}
          bookmarks={bookmarks}
          total={pageInfo.total}
          hasMore={pageInfo.hasMore}
          loadingMore={loadingMore}
          loadError={error}
          criteria={criteria}
          collections={collections}
          tags={tags}
          selected={selected}
          onCriteria={setCriteria}
          onToggleSelect={toggle}
          onLoadMore={() => void loadMore()}
          onAdd={() => setEditing('new')}
          onSelect={setDetail}
          onReading={(bookmark) => void changeReading(bookmark)}
          onFavorite={(bookmark) => void changeFavorite(bookmark)}
        />
        <div className="library-utilities">
          <button className="button button--ghost" onClick={() => setSaveSearch(true)}>
            ☆ Save this search
          </button>
          {selected.size > 0 && (
            <SelectionController
              selectedCount={selected.size}
              total={pageInfo.total}
              allMatches={allMatches}
              onSelectAll={() => setSelected(new Set(bookmarks.map((bookmark) => bookmark.id)))}
              onPromote={() => setAllMatches(true)}
              onClear={() => {
                setSelected(new Set());
                setAllMatches(false);
              }}
            />
          )}
        </div>
        <BulkActionBar
          count={allMatches ? pageInfo.total : selected.size}
          context={criteria.context}
          tags={tags}
          onAction={(action) => void runBulk(action)}
        />
      </>
    );
  } else if (view === 'tags') {
    content = (
      <TagsPage
        onBrowse={(tag) => {
          setView('library');
          setCriteria({ ...defaultCriteria, includeTagIds: [tag.id] });
        }}
      />
    );
  } else if (view === 'collections') {
    content = (
      <CollectionsPage
        onBrowse={(collection) => {
          setView('library');
          setCriteria({ ...defaultCriteria, collection: { mode: 'id', id: collection.id } });
        }}
      />
    );
  } else {
    content = (
      <SavedSearchesPage
        onOpen={(saved) => {
          setCriteria(saved);
          setView(saved.context === 'archive' ? 'archive' : 'library');
        }}
      />
    );
  }

  return (
    <div data-harness-ready={fatalError ? undefined : 'true'}>
      <AppShell count={pageInfo.total} view={view} onNavigate={navigate}>
        {content}
      </AppShell>
      {detail && !editing && (
        <BookmarkDetailPage
          bookmark={detail}
          onClose={() => setDetail(null)}
          onEdit={() => setEditing(detail)}
          onReading={(value) => void changeReading(detail, value)}
          onFavorite={() => void changeFavorite(detail)}
          onArchive={() => void changeArchive(detail)}
          onDelete={() => setDeleteTarget(detail)}
        />
      )}
      {editing && (
        <BookmarkEditor
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setDetail(saved);
            void Promise.all([load(false), loadOrganization()]);
          }}
        />
      )}
      {deleteTarget && (
        <PermanentDeleteDialog
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void remove(deleteTarget)}
        />
      )}
      {saveSearch && (
        <SaveSearchDialog
          criteria={criteria}
          onCancel={() => setSaveSearch(false)}
          onSave={async (name) => {
            await api.request('/api/saved-searches', {
              method: 'POST',
              body: JSON.stringify({ name, criteria }),
            });
            setSaveSearch(false);
          }}
        />
      )}
      {pendingBulk && (
        <BulkConfirmDialog
          action={pendingBulk.action}
          count={pendingBulk.count}
          onCancel={() => setPendingBulk(null)}
          onConfirm={() => void executeBulk(pendingBulk.action, pendingBulk.token)}
        />
      )}
      {bulkResult && <BulkResultDialog result={bulkResult} onClose={() => setBulkResult(null)} />}
    </div>
  );
}

export function App() {
  return (
    <SessionProvider>
      <Application />
    </SessionProvider>
  );
}
