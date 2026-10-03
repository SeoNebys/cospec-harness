import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Bookmark, ListResult, SavedFilter, SortOrder, ViewName } from '../types';
import { bulkAction, createFilter, deleteFilter, listBookmarks, listFilters, ApiError } from '../api/client';
import { BookmarkCard } from '../components/BookmarkCard';
import { SaveDialog } from '../components/SaveDialog';
import { EditDialog } from '../components/EditDialog';
import { usePreferences } from '../state/preferences';

const SORTS: { value: SortOrder; label: string }[] = [
  { value: 'saved_desc', label: 'Newest saved' },
  { value: 'saved_asc', label: 'Oldest saved' },
  { value: 'title_asc', label: 'Title A–Z' },
  { value: 'title_desc', label: 'Title Z–A' },
  { value: 'updated_desc', label: 'Recently updated' },
];

const VIEW_TITLES: Record<ViewName, string> = {
  all: 'All bookmarks',
  readlater: 'Read Later',
  archive: 'Archive',
};

export function ListPage({ view }: { view: ViewName }) {
  const { prefs } = usePreferences();
  const [q, setQ] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('saved_desc');
  const [filterId, setFilterId] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ListResult | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [editing, setEditing] = useState<Bookmark | null>(null);

  const pageSize = prefs?.page_size ?? 50;
  useEffect(() => {
    if (prefs) setSort(prefs.default_sort);
  }, [prefs]);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await listBookmarks({ q: activeQuery, sort, view, filterId, page, pageSize });
      setResult(res);
    } catch (e) {
      setResult({ items: [], total: 0, page: 1, pageSize });
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setLoaded(true);
    }
  }, [activeQuery, sort, view, filterId, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    listFilters().then((r) => setFilters(r.filters)).catch(() => undefined);
  }, []);

  // Signal presentation readiness once the first list load completes.
  useEffect(() => {
    if (loaded) document.documentElement.setAttribute('data-harness-ready', 'true');
  }, [loaded]);

  function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setFilterId(undefined);
    setPage(1);
    setActiveQuery(q);
  }

  function applyTag(tag: string) {
    setQ(`#${tag}`);
    setActiveQuery(`#${tag}`);
    setFilterId(undefined);
    setPage(1);
  }

  function toggleSelect(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function quick(bm: Bookmark, action: string) {
    await bulkAction({ ids: [bm.id] }, action);
    load();
  }

  async function runBulk(action: string, payload?: { tags?: string[] }, allMatching = false) {
    if (action === 'delete' && !confirm('Delete the selected bookmarks permanently?')) return;
    const target = allMatching
      ? { allMatching: { q: activeQuery, sort, view, filterId } }
      : { ids: [...selected] };
    if (!allMatching && selected.size === 0) return;
    await bulkAction(target, action, payload, action === 'delete');
    setSelected(new Set());
    load();
  }

  async function saveCurrentAsFilter() {
    const name = prompt('Name this filter:');
    if (!name) return;
    const f = await createFilter({ name, search_expression: activeQuery });
    setFilters((prev) => [...prev, f]);
  }

  const empty = loaded && result && result.items.length === 0;
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  const emptyMessage = useMemo(() => {
    if (activeQuery || filterId) return 'No bookmarks match your search.';
    if (view === 'readlater') return 'Nothing marked “read later”.';
    if (view === 'archive') return 'The archive is empty.';
    return 'No bookmarks yet — save your first one.';
  }, [activeQuery, filterId, view]);

  return (
    <div className="list-page">
      <div className="list-head">
        <h2>{VIEW_TITLES[view]}</h2>
        {view === 'all' && (
          <button className="primary" onClick={() => setShowSave(true)}>
            + Save bookmark
          </button>
        )}
      </div>

      <form className="search-row" onSubmit={runSearch}>
        <input
          className="search"
          value={q}
          placeholder='Search — try #tag, "exact phrase", AND/OR/NOT'
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit">Search</button>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortOrder)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {activeQuery && (
          <button type="button" className="linklike" onClick={saveCurrentAsFilter}>
            Save as filter
          </button>
        )}
      </form>

      {filters.length > 0 && (
        <div className="filters-bar">
          <span className="label">Saved filters:</span>
          {filters.map((f) => (
            <span key={f.id} className={`chip filter${filterId === f.id ? ' selected' : ''}`}>
              <button
                type="button"
                onClick={() => {
                  setFilterId(f.id);
                  setActiveQuery('');
                  setQ('');
                  setPage(1);
                }}
              >
                {f.name}
              </button>
              <button
                type="button"
                aria-label={`Delete ${f.name}`}
                onClick={async () => {
                  await deleteFilter(f.id);
                  setFilters((prev) => prev.filter((x) => x.id !== f.id));
                  if (filterId === f.id) setFilterId(undefined);
                }}
              >
                ×
              </button>
            </span>
          ))}
          {filterId && (
            <button type="button" className="linklike" onClick={() => setFilterId(undefined)}>
              Clear filter
            </button>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span>{selected.size} selected</span>
          <button onClick={() => runBulk('markReadLater')}>Read later</button>
          <button onClick={() => runBulk('markRead')}>Mark read</button>
          <button
            onClick={() => {
              const t = prompt('Add tag to selected:');
              if (t) runBulk('addTags', { tags: [t] });
            }}
          >
            Add tag
          </button>
          {view === 'archive' ? (
            <button onClick={() => runBulk('restore')}>Restore</button>
          ) : (
            <button onClick={() => runBulk('archive')}>Archive</button>
          )}
          <button className="danger" onClick={() => runBulk('delete')}>
            Delete
          </button>
          <button onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {(activeQuery || filterId) && result && result.total > result.items.length && (
        <div className="all-matching">
          <button
            className="linklike"
            onClick={() => {
              const action = prompt(
                'Apply to ALL ' + result.total + ' matching. Type: read, readlater, archive, or delete'
              );
              if (!action) return;
              const map: Record<string, string> = {
                read: 'markRead',
                readlater: 'markReadLater',
                archive: view === 'archive' ? 'restore' : 'archive',
                delete: 'delete',
              };
              if (map[action]) runBulk(map[action], undefined, true);
            }}
          >
            Apply an action to all {result.total} matching results
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {empty ? (
        <div className="empty">{emptyMessage}</div>
      ) : (
        <div className="cards">
          {result?.items.map((bm) => (
            <BookmarkCard
              key={bm.id}
              bookmark={bm}
              selected={selected.has(bm.id)}
              onToggleSelect={toggleSelect}
              onEdit={setEditing}
              onQuick={quick}
              onTagClick={applyTag}
            />
          ))}
        </div>
      )}

      {result && totalPages > 1 && (
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Prev
          </button>
          <span>
            Page {page} of {totalPages} · {result.total} total
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </button>
        </div>
      )}

      {showSave && (
        <SaveDialog
          onClose={() => setShowSave(false)}
          onSaved={() => {
            setShowSave(false);
            load();
          }}
          onDuplicate={(bm) => {
            setShowSave(false);
            setEditing(bm);
          }}
        />
      )}
      {editing && (
        <EditDialog
          bookmark={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
