import React, { useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { PrefsContext, navigate } from '../main.jsx';
import { BookmarkRow } from './BookmarkRow.jsx';
import { SortControl } from './SortControl.jsx';
import { BulkActionBar } from './BulkActionBar.jsx';

// Shared list used by All / Unread / Archived. `view` selects the server view.
export function BookmarkList({ view, title, initialQuery = '', initialIncludeTags = [], initialExcludeTags = [], showSaveFilter = false }) {
  const { prefs } = useContext(PrefsContext);
  const [q, setQ] = useState(initialQuery);
  const [sort, setSort] = useState(prefs?.defaultSort || 'dateAdded_desc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 25 });
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [allMatching, setAllMatching] = useState(false);

  const pageSize = prefs?.itemsPerPage || 25;
  const includeTags = initialIncludeTags;
  const excludeTags = initialExcludeTags;

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.listBookmarks({ view, q, sort, page, pageSize, includeTags, excludeTags });
      setData(res);
    } catch (err) {
      setError(err.message);
      setData({ items: [], total: 0, page: 1, pageSize });
    }
  }, [view, q, sort, page, pageSize, includeTags, excludeTags]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelected(new Set());
    setAllMatching(false);
  }, [view, q, sort, page]);

  function toggleSelect(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setAllMatching(false);
  }

  async function applyBulk(action, value) {
    const payload = { action, value };
    if (action === 'delete') payload.confirmDelete = true;
    if (allMatching) payload.match = { view, q, includeTags, excludeTags };
    else payload.ids = [...selected];
    try {
      await api.bulk(payload);
      setSelected(new Set());
      setAllMatching(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveAsFilter() {
    const name = window.prompt('Name this filter:');
    if (!name) return;
    try {
      await api.createFilter({ name, query: q, includeTags, excludeTags });
      navigate('/filters');
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleRead(b) {
    await api.updateBookmark(b.id, { read: !b.read });
    load();
  }
  async function toggleArchive(b) {
    await api.updateBookmark(b.id, { archived: !b.archived });
    load();
  }

  const totalPages = pageSize ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div>
      <h2>{title}</h2>
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search title, description, notes, address, #tag, AND/OR/NOT…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <SortControl value={sort} onChange={setSort} />
        {showSaveFilter && <button onClick={saveAsFilter}>Save as filter</button>}
      </div>

      {error && <p className="error">{error}</p>}

      <BulkActionBar
        selectedCount={selected.size}
        totalCount={data.total}
        allMatchingSelected={allMatching}
        onSelectAllMatching={() => setAllMatching(true)}
        onClear={() => {
          setSelected(new Set());
          setAllMatching(false);
        }}
        onApply={applyBulk}
      />

      {data.items.length === 0 ? (
        <div className="empty">
          {q ? 'No bookmarks match your search.' : emptyMessage(view)}
        </div>
      ) : (
        data.items.map((b) => (
          <BookmarkRow
            key={b.id}
            bookmark={b}
            selected={allMatching || selected.has(b.id)}
            onToggleSelect={toggleSelect}
            onEdit={(id) => navigate(`/edit/${id}`)}
            onToggleRead={toggleRead}
            onToggleArchive={toggleArchive}
          />
        ))
      )}

      {totalPages > 1 && (
        <div className="toolbar" style={{ justifyContent: 'center' }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Prev
          </button>
          <span>
            Page {data.page} of {totalPages} · {data.total} total
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function emptyMessage(view) {
  if (view === 'unread') return 'Nothing to read later — you’re all caught up!';
  if (view === 'archived') return 'No archived bookmarks.';
  return 'No bookmarks yet. Add your first one from “+ Add bookmark”.';
}
