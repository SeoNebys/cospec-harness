import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Bookmark, type ListParams, type SavedView } from '../api/client.ts';
import { SaveForm } from '../components/SaveForm.tsx';
import { SearchBar } from '../components/SearchBar.tsx';
import { SortMenu } from '../components/SortMenu.tsx';
import { BookmarkRow } from '../components/BookmarkRow.tsx';
import { BulkBar } from '../components/BulkBar.tsx';
import { BookmarkDetail } from '../components/BookmarkDetail.tsx';

interface Props {
  scope: 'active' | 'unread' | 'archived';
  view?: SavedView | null;
  defaultSort: string;
  pageSize: number;
  onViewsChanged?: () => void;
}

let markedReady = false;

export function BookmarksView({ scope, view, defaultSort, pageSize, onViewsChanged }: Props) {
  const [q, setQ] = useState('');
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [sort, setSort] = useState(defaultSort);
  const [result, setResult] = useState<{ items: Bookmark[]; total: number } | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showSaveView, setShowSaveView] = useState(false);

  useEffect(() => setSort(defaultSort), [defaultSort]);

  const params: ListParams = useMemo(
    () => ({
      q: q || undefined,
      tag: tagFilters.length ? tagFilters : undefined,
      view: view?.id,
      scope,
      sort,
      pageSize,
    }),
    [q, tagFilters, view, scope, sort, pageSize],
  );

  const load = useCallback(() => {
    setError('');
    api
      .list(params)
      .then((r) => setResult({ items: r.items, total: r.total }))
      .catch((e) => {
        setError((e as Error).message);
        setResult({ items: [], total: 0 });
      })
      .finally(() => {
        if (!markedReady) {
          markedReady = true;
          document.getElementById('root')?.setAttribute('data-harness-ready', 'true');
        }
      });
  }, [params]);

  useEffect(() => {
    load();
    setSelected(new Set());
    setSelectAllMatching(false);
  }, [load]);

  function toggleSelect(id: string) {
    setSelectAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulkSelector() {
    if (selectAllMatching) {
      return { match: { q: q || undefined, tag: tagFilters, view: view?.id, scope } };
    }
    return { ids: Array.from(selected) };
  }

  async function runBulk(action: unknown, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    await api.bulk(bulkSelector(), action);
    setSelected(new Set());
    setSelectAllMatching(false);
    load();
  }

  function addTagFilter(tag: string) {
    if (!tagFilters.includes(tag)) setTagFilters([...tagFilters, tag]);
  }

  const items = result?.items ?? [];
  const total = result?.total ?? 0;

  return (
    <div>
      {scope === 'active' && !view && (
        <SaveForm onSaved={() => load()} onDuplicate={(id) => setEditId(id)} />
      )}

      <div className="toolbar">
        <SearchBar value={q} onSubmit={setQ} error={error && error.toLowerCase().includes('search') ? error : undefined} />
        <SortMenu value={sort} onChange={setSort} />
        <button onClick={() => setShowSaveView((s) => !s)}>Save as view</button>
      </div>

      {tagFilters.length > 0 && (
        <div className="row-flex wrap" style={{ marginBottom: 10 }}>
          <span className="muted">Filtering by:</span>
          {tagFilters.map((t) => (
            <span key={t} className="tag" onClick={() => setTagFilters(tagFilters.filter((x) => x !== t))}>
              #{t} ✕
            </span>
          ))}
          <button onClick={() => setTagFilters([])}>Clear tags</button>
        </div>
      )}

      {showSaveView && (
        <SaveViewForm
          initialQuery={q}
          initialInclude={tagFilters}
          onDone={() => {
            setShowSaveView(false);
            onViewsChanged?.();
          }}
        />
      )}

      <BulkBar
        selectedCount={selected.size}
        totalMatching={total}
        selectAllMatching={selectAllMatching}
        onSelectAllMatching={setSelectAllMatching}
        onClear={() => {
          setSelected(new Set());
          setSelectAllMatching(false);
        }}
        onAddTags={(tags) => runBulk({ type: 'addTags', tags })}
        onRemoveTags={(tags) => runBulk({ type: 'removeTags', tags })}
        onSetUnread={(unread) => runBulk({ type: 'setUnread', unread })}
        onArchive={(archived) => runBulk({ type: 'archive', archived })}
        onDelete={() =>
          runBulk({ type: 'delete' }, `Permanently delete ${selectAllMatching ? total : selected.size} bookmark(s)?`)
        }
        scope={scope}
      />

      {error && !error.toLowerCase().includes('search') && <div className="error">{error}</div>}

      {items.length === 0 ? (
        <div className="empty">
          {q || tagFilters.length ? 'No bookmarks match your search.' : emptyMessage(scope, view)}
        </div>
      ) : (
        items.map((b) => (
          <BookmarkRow
            key={b.id}
            b={b}
            selected={selected.has(b.id)}
            onToggleSelect={toggleSelect}
            onEdit={(bm) => setEditId(bm.id)}
            onTagClick={addTagFilter}
          />
        ))
      )}

      {editId && (
        <BookmarkDetail
          id={editId}
          onClose={() => setEditId(null)}
          onChanged={() => {
            load();
            onViewsChanged?.();
          }}
        />
      )}
    </div>
  );
}

function emptyMessage(scope: string, view?: SavedView | null): string {
  if (view) return `No bookmarks match the saved view "${view.name}" yet.`;
  if (scope === 'unread') return 'Nothing to read later. Mark bookmarks as unread to see them here.';
  if (scope === 'archived') return 'No archived bookmarks.';
  return 'No bookmarks yet. Paste a URL above to save your first one.';
}

function SaveViewForm({
  initialQuery,
  initialInclude,
  onDone,
}: {
  initialQuery: string;
  initialInclude: string[];
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [query, setQuery] = useState(initialQuery);
  const [include, setInclude] = useState(initialInclude.join(', '));
  const [exclude, setExclude] = useState('');
  const [err, setErr] = useState('');
  const split = (s: string) => s.split(',').map((t) => t.trim()).filter(Boolean);

  async function save() {
    if (!name.trim()) {
      setErr('Please name the view.');
      return;
    }
    await api.createView({
      name,
      query,
      includeTags: split(include),
      excludeTags: split(exclude),
    });
    onDone();
  }

  return (
    <div className="card">
      <div className="field">
        <label>View name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Query</label>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="row-flex wrap">
        <div className="field" style={{ flex: 1 }}>
          <label>Include tags (comma-separated)</label>
          <input type="text" value={include} onChange={(e) => setInclude(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Exclude tags (comma-separated)</label>
          <input type="text" value={exclude} onChange={(e) => setExclude(e.target.value)} />
        </div>
      </div>
      {err && <div className="error">{err}</div>}
      <button className="primary" onClick={save}>
        Save view
      </button>
    </div>
  );
}
