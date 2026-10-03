import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api/client.js';
import Sidebar from './components/Sidebar.jsx';
import BookmarkCard from './components/BookmarkCard.jsx';
import SaveDialog from './components/SaveDialog.jsx';
import BulkActionBar from './components/BulkActionBar.jsx';

const DEFAULT_PREFS = { default_sort: 'date_added_desc', items_per_page: 25, font_size: 'medium' };

export default function App() {
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  const [view, setView] = useState('normal');
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [includeTags, setIncludeTags] = useState([]);
  const [excludeTags, setExcludeTags] = useState([]);
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(1);
  const [activeSavedName, setActiveSavedName] = useState('');

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [searchError, setSearchError] = useState('');
  const [banner, setBanner] = useState('');

  const [tags, setTags] = useState([]);
  const [savedSearches, setSavedSearches] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [dialog, setDialog] = useState(null); // { mode:'save'|'edit', bookmark? }
  const [busyItem, setBusyItem] = useState({}); // id -> action

  const pollRef = useRef(null);

  const effectiveSort = sort || prefs.default_sort;

  const load = useCallback(async () => {
    setSearchError('');
    try {
      const params = {
        view,
        q: query,
        tag: activeTag,
        includeTags,
        excludeTags,
        sort: effectiveSort,
        page,
        pageSize: prefs.items_per_page,
      };
      const r = await api.listBookmarks(params);
      setItems(r.items);
      setTotal(r.total);
      setPageSize(r.pageSize);
    } catch (err) {
      if (err.code === 'invalid_query') {
        setSearchError(err.message);
        setItems([]);
        setTotal(0);
      } else {
        setBanner(err.message);
      }
    } finally {
      setReady(true);
    }
  }, [view, query, activeTag, includeTags, excludeTags, effectiveSort, page, prefs.items_per_page]);

  const loadTags = useCallback(async () => {
    const r = await api.tags();
    setTags(r.items);
  }, []);

  const loadSaved = useCallback(async () => {
    const r = await api.savedSearches();
    setSavedSearches(r.items);
  }, []);

  // Initial load: preferences, first list, tags, saved searches.
  useEffect(() => {
    (async () => {
      try {
        const p = await api.preferences();
        setPrefs(p.preferences);
      } catch {
        /* keep defaults */
      }
      await Promise.all([loadTags(), loadSaved()]);
    })();
  }, [loadTags, loadSaved]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while any bookmark's metadata is still pending.
  useEffect(() => {
    const pending = items.some((b) => b.metadata_status === 'pending');
    if (pending && !pollRef.current) {
      pollRef.current = setInterval(() => load(), 1500);
    } else if (!pending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {};
  }, [items, load]);

  // Apply font size preference to the root.
  const fontClass = `fs-${prefs.font_size}`;

  function resetSearchContext() {
    setActiveSavedName('');
    setIncludeTags([]);
    setExcludeTags([]);
  }

  function onView(v) {
    setView(v);
    setPage(1);
    resetSearchContext();
  }

  function onTagFilter(tag) {
    setActiveTag(tag);
    setPage(1);
    resetSearchContext();
  }

  function submitSearch(e) {
    e.preventDefault();
    setQuery(searchInput);
    setPage(1);
  }

  async function onPrefsChange(patch) {
    try {
      const r = await api.updatePreferences({ ...prefs, ...patch });
      setPrefs(r.preferences);
      setPage(1);
    } catch (err) {
      setBanner(err.message);
    }
  }

  // ---- Saved searches ----
  async function onSaveCurrentSearch(name) {
    try {
      const include = [...new Set([...(activeTag ? [activeTag] : []), ...includeTags])];
      await api.createSavedSearch({
        name,
        query_text: query,
        include_tags: include,
        exclude_tags: excludeTags,
        view_scope: view,
        sort: effectiveSort,
      });
      await loadSaved();
      setBanner(`Saved search "${name}".`);
    } catch (err) {
      setBanner(err.message);
    }
  }

  function onOpenSaved(s) {
    setView(s.view_scope);
    setQuery(s.query_text || '');
    setSearchInput(s.query_text || '');
    setActiveTag('');
    setIncludeTags(s.include_tags || []);
    setExcludeTags(s.exclude_tags || []);
    setSort(s.sort || '');
    setPage(1);
    setActiveSavedName(s.name);
  }

  async function onRenameSaved(s) {
    const name = window.prompt('Rename saved search', s.name);
    if (!name || name === s.name) return;
    try {
      await api.updateSavedSearch(s.id, { name });
      await loadSaved();
    } catch (err) {
      setBanner(err.message);
    }
  }

  async function onDeleteSaved(s) {
    if (!window.confirm(`Delete saved search "${s.name}"?`)) return;
    await api.deleteSavedSearch(s.id);
    await loadSaved();
  }

  // ---- Per-bookmark actions ----
  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function afterMutation() {
    await Promise.all([load(), loadTags()]);
  }

  function openEdit(b) {
    setDialog({ mode: 'edit', bookmark: b });
  }

  async function onToggleRead(b) {
    await api.updateBookmark(b.id, { read_state: b.read_state === 'read' ? 'unread' : 'read' });
    afterMutation();
  }

  async function onToggleArchive(b) {
    await api.updateBookmark(b.id, { archived: !b.archived });
    afterMutation();
  }

  async function onDelete(b) {
    if (!window.confirm(`Permanently delete "${b.title || b.url}"? This cannot be undone.`)) return;
    await api.deleteBookmark(b.id);
    afterMutation();
  }

  async function onSnapshot(b) {
    setBusyItem((m) => ({ ...m, [b.id]: 'snapshot' }));
    try {
      await api.snapshot(b.id);
      setBanner('Snapshot saved.');
      afterMutation();
    } catch (err) {
      setBanner(`Snapshot failed: ${err.message}`);
    } finally {
      setBusyItem((m) => ({ ...m, [b.id]: undefined }));
    }
  }

  async function onArchiveOrg(b) {
    setBusyItem((m) => ({ ...m, [b.id]: 'archive-org' }));
    try {
      await api.archiveOrg(b.id);
      setBanner('Saved to the Internet Archive.');
      afterMutation();
    } catch (err) {
      setBanner(`Internet Archive save failed (you can retry): ${err.message}`);
    } finally {
      setBusyItem((m) => ({ ...m, [b.id]: undefined }));
    }
  }

  // ---- Bulk ----
  async function onBulkApply({ action, value, scope }) {
    if (action === 'delete') {
      const count = scope === 'selected' ? selected.size : total;
      if (!window.confirm(`Delete ${count} bookmark(s)? This cannot be undone.`)) return;
    }
    const select =
      scope === 'selected'
        ? { ids: [...selected] }
        : { matchView: { view, q: query, tag: activeTag, includeTags, excludeTags } };
    try {
      const body = { action, value, select };
      if (action === 'delete') body.confirm = true;
      const r = await api.bulk(body);
      setBanner(`Updated ${r.affected} bookmark(s).`);
      setSelected(new Set());
      afterMutation();
    } catch (err) {
      setBanner(err.message);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / (pageSize || 1)));
  const contextLabel = activeSavedName
    ? `Saved: ${activeSavedName}`
    : activeTag
    ? `Tag: #${activeTag}`
    : view === 'unread'
    ? 'Unread'
    : view === 'archived'
    ? 'Archived'
    : 'All bookmarks';

  return (
    <div className={`app ${fontClass}`} data-harness-ready={ready ? 'true' : 'false'}>
      <Sidebar
        view={view}
        onView={onView}
        tags={tags}
        activeTag={activeTag}
        onTagFilter={onTagFilter}
        savedSearches={savedSearches}
        onOpenSaved={onOpenSaved}
        onSaveCurrentSearch={onSaveCurrentSearch}
        onRenameSaved={onRenameSaved}
        onDeleteSaved={onDeleteSaved}
        prefs={prefs}
        onPrefsChange={onPrefsChange}
        onImported={(r) => {
          setBanner(`Imported ${r.imported}, skipped ${r.skipped}.`);
          afterMutation();
        }}
        onError={setBanner}
      />

      <main className="main">
        <div className="toolbar">
          <form className="search" onSubmit={submitSearch}>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder='Search — words, "phrases", #tag, AND/OR/NOT, ( )'
              aria-label="Search"
            />
            <button type="submit">Search</button>
            {(query || activeTag || activeSavedName) && (
              <button
                type="button"
                className="link"
                onClick={() => {
                  setSearchInput('');
                  setQuery('');
                  setActiveTag('');
                  resetSearchContext();
                  setSort('');
                  setPage(1);
                }}
              >
                Clear
              </button>
            )}
          </form>
          <div className="toolbar-right">
            <select value={sort || prefs.default_sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="date_added_desc">Newest first</option>
              <option value="date_added_asc">Oldest first</option>
              <option value="title_asc">Title A→Z</option>
              <option value="title_desc">Title Z→A</option>
              <option value="read_state">Unread first</option>
            </select>
            <button className="primary" onClick={() => setDialog({ mode: 'save' })}>+ Save bookmark</button>
          </div>
        </div>

        <div className="context-row">
          <span className="context-label">{contextLabel}</span>
          <span className="muted">{total} item{total === 1 ? '' : 's'}</span>
        </div>

        {banner && (
          <div className="banner" onClick={() => setBanner('')}>
            {banner} <span className="banner-dismiss">(dismiss)</span>
          </div>
        )}
        {searchError && <div className="banner error">{searchError}</div>}

        <BulkActionBar selectedCount={selected.size} total={total} onApply={onBulkApply} />

        <div className="list">
          {ready && items.length === 0 && !searchError && (
            <div className="empty-state">
              {query || activeTag ? (
                <>
                  <h3>No matches</h3>
                  <p>Nothing matches the current view. Try clearing the search.</p>
                </>
              ) : view === 'archived' ? (
                <>
                  <h3>Nothing archived</h3>
                  <p>Archived bookmarks will appear here.</p>
                </>
              ) : view === 'unread' ? (
                <>
                  <h3>No unread bookmarks</h3>
                  <p>Bookmarks you mark unread show up here.</p>
                </>
              ) : (
                <>
                  <h3>No bookmarks yet</h3>
                  <p>Save your first bookmark to get started.</p>
                  <button className="primary" onClick={() => setDialog({ mode: 'save' })}>+ Save bookmark</button>
                </>
              )}
            </div>
          )}

          {items.map((b) => (
            <BookmarkCard
              key={b.id}
              bookmark={b}
              selected={selected.has(b.id)}
              onToggleSelect={toggleSelect}
              onTagClick={onTagFilter}
              onEdit={openEdit}
              onToggleRead={onToggleRead}
              onToggleArchive={onToggleArchive}
              onDelete={onDelete}
              onSnapshot={onSnapshot}
              onArchiveOrg={onArchiveOrg}
              busyAction={busyItem[b.id]}
            />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="pager">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </main>

      {dialog && (
        <SaveDialog
          existing={dialog.mode === 'edit' ? dialog.bookmark : null}
          onClose={() => setDialog(null)}
          onSaved={(bookmark, created) => {
            setDialog(null);
            setBanner(created ? 'Bookmark saved — fetching details…' : 'Bookmark updated.');
            afterMutation();
          }}
          onDuplicate={(bookmark) => {
            setDialog({ mode: 'edit', bookmark });
            setBanner('That address is already bookmarked — opened it for editing.');
          }}
        />
      )}
    </div>
  );
}
