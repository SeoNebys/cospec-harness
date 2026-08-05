import { useCallback, useEffect, useState } from "react";
import { AddBookmark } from "../components/AddBookmark";
import { BookmarkList } from "../components/BookmarkList";
import { EditDialog } from "../components/EditDialog";
import { ImportExport } from "../components/ImportExport";
import { SearchBar } from "../components/SearchBar";
import { SortControl } from "../components/SortControl";
import { Bookmark, Sort, listBookmarks } from "../services/api";

export function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Bookmark | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listBookmarks({
        q: query,
        tag: tagFilter ?? undefined,
        sort,
      });
      setBookmarks(data.items);
    } catch {
      setLoadError("Could not load your bookmarks.");
    } finally {
      setLoading(false);
    }
  }, [query, sort, tagFilter]);

  // Debounce so typing in the search box doesn't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => void refresh(), 200);
    return () => clearTimeout(t);
  }, [refresh]);

  function handleSaved(bookmark: Bookmark, duplicate: boolean) {
    setHighlightId(bookmark.id);
    if (duplicate) {
      setNotice("You already saved that link — opening it so you can edit it.");
      setEditing(bookmark);
    } else {
      setNotice("Saved.");
    }
    void refresh();
  }

  const isFiltered = Boolean(query.trim()) || tagFilter !== null;

  return (
    <main className="app">
      <header className="app-header">
        <h1>Bookmark Manager</h1>
        <ImportExport
          onImported={() => {
            setNotice(null);
            void refresh();
          }}
        />
      </header>

      <AddBookmark onSaved={handleSaved} />
      {notice && <p className="notice">{notice}</p>}

      <div className="toolbar">
        <SearchBar value={query} onChange={setQuery} />
        <SortControl value={sort} onChange={setSort} />
      </div>

      {tagFilter && (
        <div className="active-filter">
          Filtered by tag: <strong>{tagFilter}</strong>
          <button type="button" onClick={() => setTagFilter(null)}>
            Clear
          </button>
        </div>
      )}

      {loading && <p className="muted">Loading…</p>}
      {loadError && <p className="error" role="alert">{loadError}</p>}
      {!loading && !loadError && (
        <BookmarkList
          bookmarks={bookmarks}
          highlightId={highlightId}
          filtered={isFiltered}
          onEdit={setEditing}
          onFilterTag={setTagFilter}
        />
      )}

      {editing && (
        <EditDialog
          bookmark={editing}
          onSaved={(updated) => {
            setEditing(null);
            setNotice("Changes saved.");
            setHighlightId(updated.id);
            void refresh();
          }}
          onDeleted={() => {
            setEditing(null);
            setNotice("Bookmark deleted.");
            void refresh();
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}
