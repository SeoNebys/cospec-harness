import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Bookmark, Collection } from '@shared/contracts.js';
import { SaveBookmarkForm } from '../features/bookmarks/SaveBookmarkForm.js';
import { BookmarkCard } from '../features/bookmarks/BookmarkCard.js';
import { SearchControls } from '../features/search/SearchControls.js';
import { BulkToolbar } from '../features/bookmarks/BulkToolbar.js';
import {
  bulkBookmarks,
  listBookmarks,
  listTags,
  type BookmarkPage
} from '../services/bookmarks-api.js';
const copy = {
  active: { title: 'Your library', subtitle: 'Everything you’ve chosen to keep.' },
  unread: { title: 'Read later', subtitle: 'Your unread pile, ready when you are.' },
  archive: { title: 'Archive', subtitle: 'Kept out of the way, never thrown away.' }
};
export function LibraryPage() {
  const [params, setParams] = useSearchParams(),
    collection = (params.get('collection') ?? 'active') as Collection,
    query = params.get('q') ?? '',
    tag = params.get('tag') ?? '',
    sort = params.get('sort') ?? 'recent';
  const [page, setPage] = useState<BookmarkPage | null>(null),
    [tags, setTags] = useState<{ name: string; count: number }[]>([]),
    [error, setError] = useState(''),
    [selected, setSelected] = useState(new Set<string>()),
    [excluded, setExcluded] = useState(new Set<string>()),
    [all, setAll] = useState(false);
  const load = useCallback(() => {
    setError('');
    Promise.all([listBookmarks({ collection, q: query, tag: tag || undefined, sort }), listTags()])
      .then(([p, t]) => {
        setPage(p);
        setTags(t.items);
      })
      .catch((e) => setError(e.message));
  }, [collection, query, tag, sort]);
  useEffect(() => {
    const timer = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);
  useEffect(() => {
    setSelected(new Set());
    setExcluded(new Set());
    setAll(false);
  }, [collection, query, tag, sort]);
  function setFilters(v: { query?: string; tag?: string; sort?: string }) {
    const next = new URLSearchParams(params);
    if (v.query !== undefined) v.query ? next.set('q', v.query) : next.delete('q');
    if (v.tag !== undefined) v.tag ? next.set('tag', v.tag) : next.delete('tag');
    if (v.sort !== undefined) v.sort === 'recent' ? next.delete('sort') : next.set('sort', v.sort);
    setParams(next, { replace: true });
  }
  async function bulk(action: any) {
    if (!page) return;
    const selection = all
      ? {
          allMatching: true,
          collection,
          query,
          tag: tag || undefined,
          sort,
          queryFingerprint: page.queryFingerprint,
          excludeIds: [...excluded]
        }
      : { ids: [...selected] };
    await bulkBookmarks({ selection, action });
    setSelected(new Set());
    setExcluded(new Set());
    setAll(false);
    load();
  }
  async function loadMore() {
    if (!page || page.items.length >= page.total) return;
    try {
      const next = await listBookmarks({
        collection,
        q: query,
        tag: tag || undefined,
        sort,
        offset: page.items.length
      });
      setPage({ ...next, items: [...page.items, ...next.items] });
    } catch (e: any) {
      setError(e.message);
    }
  }
  const heading = copy[collection] ?? copy.active;
  return (
    <main className="library-page">
      <section className="hero">
        <div>
          <p className="eyebrow">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </p>
          <h1>{heading.title}</h1>
          <p>{heading.subtitle}</p>
        </div>
        <SaveBookmarkForm onSaved={() => load()} />
      </section>
      <SearchControls query={query} tag={tag} sort={sort} tags={tags} onChange={setFilters} />
      {page && (
        <div className="collection-meta">
          <span>
            {page.total} {page.total === 1 ? 'bookmark' : 'bookmarks'}
          </span>
          <span>
            {page.counts.unread} unread · {page.counts.archive} archived
          </span>
        </div>
      )}
      {(selected.size > 0 || all) && page && (
        <BulkToolbar
          count={all ? page.total - excluded.size : selected.size}
          all={all}
          total={page.total}
          collection={collection}
          onAction={bulk}
          onSelectAll={() => {
            setAll(true);
            setExcluded(new Set());
          }}
          onClear={() => {
            setSelected(new Set());
            setExcluded(new Set());
            setAll(false);
          }}
        />
      )}
      {error && (
        <div className="error-banner" role="alert">
          <strong>Search needs a small fix</strong>
          <span>{error}</span>
        </div>
      )}
      {!page && !error && <div className="center-status">Gathering your bookmarks…</div>}
      {page?.items.length === 0 && !error && (
        <section className="empty-state">
          <span>⌁</span>
          <h2>{query || tag ? 'No bookmarks match that search' : 'This shelf is empty'}</h2>
          <p>
            {query || tag
              ? 'Try removing a term or clearing a filter.'
              : 'Save a link and it will be waiting here when you return.'}
          </p>
          {(query || tag) && (
            <button onClick={() => setParams(new URLSearchParams({ collection }))}>
              Clear search and filters
            </button>
          )}
        </section>
      )}
      <section className="bookmark-list" aria-live="polite">
        {page?.items.map((b) => (
          <BookmarkCard
            key={b.id}
            bookmark={b}
            selected={all ? !excluded.has(b.id) : selected.has(b.id)}
            onSelect={(v) => {
              if (all) {
                setExcluded((s) => {
                  const n = new Set(s);
                  v ? n.delete(b.id) : n.add(b.id);
                  return n;
                });
              } else {
                setSelected((s) => {
                  const n = new Set(s);
                  v ? n.add(b.id) : n.delete(b.id);
                  return n;
                });
              }
            }}
            onChanged={load}
          />
        ))}
      </section>
      {page && page.items.length < page.total && (
        <div className="load-more">
          <button onClick={() => void loadMore()}>Load more bookmarks</button>
        </div>
      )}
    </main>
  );
}
