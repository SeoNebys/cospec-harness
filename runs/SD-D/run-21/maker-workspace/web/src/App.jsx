import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import SaveForm from './components/SaveForm.jsx';
import BookmarkCard from './components/BookmarkCard.jsx';
import SearchBar from './components/SearchBar.jsx';
import BulkBar from './components/BulkBar.jsx';
import SavedViews from './components/SavedViews.jsx';
import Preferences from './components/Preferences.jsx';
import ImportExport from './components/ImportExport.jsx';

const VIEWS = [
  ['normal', 'All'],
  ['read_later', 'Read later'],
  ['archive', 'Archive'],
];

export default function App() {
  const [prefs, setPrefs] = useState(null);
  const [view, setView] = useState('normal'); // normal | read_later | archive
  const [savedView, setSavedView] = useState(null); // active SavedView object
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [bookmarks, setBookmarks] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [views, setViews] = useState([]);
  const [selection, setSelection] = useState(new Set());
  const [editing, setEditing] = useState(null); // bookmark being edited, or 'new'
  const [panel, setPanel] = useState(null); // 'prefs' | 'io' | null
  const readyRef = useRef(false);

  // Initial preferences load sets the default sort (FR-028).
  useEffect(() => {
    (async () => {
      const p = await api.getPreferences();
      setPrefs(p);
      setSort(p.defaultSort);
      const v = await api.listViews();
      setViews(v.views);
    })();
  }, []);

  const refreshViews = useCallback(async () => {
    const v = await api.listViews();
    setViews(v.views);
  }, []);

  const load = useCallback(async () => {
    setSearchError('');
    try {
      let result;
      if (savedView) {
        result = await api.viewResults(savedView.id, { sort });
      } else {
        result = await api.listBookmarks({ view, q: query, sort });
      }
      setBookmarks(result.bookmarks);
    } catch (e) {
      if (e.status === 400) {
        setSearchError(e.message);
      } else {
        setSearchError(e.message);
      }
    } finally {
      setLoaded(true);
    }
  }, [view, savedView, query, sort]);

  // Debounced reload on query/view/sort change.
  useEffect(() => {
    if (prefs === null) return;
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load, prefs]);

  // Mark presentation-ready after first load (harness contract).
  useEffect(() => {
    if (loaded && !readyRef.current) {
      readyRef.current = true;
      document.body.setAttribute('data-harness-ready', 'true');
    }
  }, [loaded]);

  // Apply text-size to the root.
  useEffect(() => {
    if (prefs) document.documentElement.dataset.textSize = prefs.textSize;
  }, [prefs]);

  const clearSelection = () => setSelection(new Set());

  const onSelect = (id, checked) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allSelected = bookmarks.length > 0 && selection.size === bookmarks.length;
  const selectAll = (on) => {
    if (on) setSelection(new Set(bookmarks.map((b) => b.id)));
    else clearSelection();
  };

  const savePrefs = async (next) => {
    const saved = await api.savePreferences(next);
    setPrefs(saved);
  };

  const onSaved = async (bookmark, meta) => {
    setEditing(null);
    await load();
    if (meta?.openedExisting) {
      // Immediately open the existing bookmark for editing (FR-015).
      setEditing(bookmark);
    }
  };

  const toggleRead = async (b) => {
    await api.setStatus(b.id, { isRead: !b.isRead });
    load();
  };
  const toggleArchive = async (b) => {
    await api.setStatus(b.id, { isArchived: !b.isArchived });
    load();
  };
  const onDelete = async (b) => {
    if (window.confirm(`Permanently delete "${b.title}"? This is different from archiving and cannot be undone.`)) {
      await api.deleteBookmark(b.id);
      load();
    }
  };

  const runBulk = async (action) => {
    const ids = [...selection];
    await api.bulk({ ids }, action);
    clearSelection();
    load();
  };

  const openSavedView = (v) => {
    setSavedView(v);
    setView('normal');
    setQuery('');
    clearSelection();
  };
  const clearSavedView = () => {
    setSavedView(null);
    clearSelection();
  };

  const emptyMessage = useMemo(() => {
    if (searchError) return null;
    if (query.trim() || savedView) return 'No matches.';
    if (view === 'read_later') return 'Nothing to read later — unread bookmarks appear here.';
    if (view === 'archive') return 'The archive is empty.';
    return 'No bookmarks yet. Save your first one above.';
  }, [query, view, savedView, searchError]);

  if (prefs === null) {
    return <div className="app-loading">Loading…</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔖 Bookmark Manager</h1>
        <div className="header-actions">
          <button type="button" onClick={() => setEditing('new')}>+ Save bookmark</button>
          <button type="button" className="secondary" onClick={() => setPanel(panel === 'io' ? null : 'io')}>Import / Export</button>
          <button type="button" className="secondary" onClick={() => setPanel(panel === 'prefs' ? null : 'prefs')}>Preferences</button>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <nav className="view-nav">
            {VIEWS.map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={!savedView && view === v ? 'active' : ''}
                onClick={() => {
                  setSavedView(null);
                  setView(v);
                  clearSelection();
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <SavedViews
            views={views}
            activeViewId={savedView?.id}
            currentQuery={query}
            onOpen={openSavedView}
            onClearView={clearSavedView}
            onCreate={async (data) => {
              await api.createView(data);
              refreshViews();
            }}
            onDelete={async (v) => {
              await api.deleteView(v.id);
              if (savedView?.id === v.id) clearSavedView();
              refreshViews();
            }}
          />
        </aside>

        <main className="main">
          {panel === 'prefs' && (
            <Preferences prefs={prefs} onChange={savePrefs} onClose={() => setPanel(null)} />
          )}
          {panel === 'io' && (
            <ImportExport onImported={load} onClose={() => setPanel(null)} />
          )}

          {editing && (
            <div className="modal">
              <SaveForm
                existing={editing === 'new' ? null : editing}
                onSaved={onSaved}
                onCancel={() => setEditing(null)}
              />
            </div>
          )}

          {!savedView && (
            <SearchBar query={query} onQuery={setQuery} sort={sort} onSort={setSort} error={searchError} />
          )}
          {savedView && (
            <div className="active-view-banner">
              Viewing saved view: <strong>{savedView.name}</strong>
              <button type="button" className="secondary" onClick={clearSavedView}>Clear</button>
            </div>
          )}

          <BulkBar
            selectedCount={selection.size}
            totalCount={bookmarks.length}
            allSelected={allSelected}
            onSelectAll={selectAll}
            onClear={clearSelection}
            onAction={runBulk}
          />

          {bookmarks.length === 0 ? (
            <p className="empty-state">{emptyMessage}</p>
          ) : (
            <ul className={`bookmark-list ${prefs.density}`}>
              {bookmarks.map((b) => (
                <BookmarkCard
                  key={b.id}
                  bookmark={b}
                  density={prefs.density}
                  selected={selection.has(b.id)}
                  onSelect={onSelect}
                  onEdit={setEditing}
                  onToggleRead={toggleRead}
                  onToggleArchive={toggleArchive}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}
