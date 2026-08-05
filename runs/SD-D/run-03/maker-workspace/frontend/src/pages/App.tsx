// Main page: add, browse/open, search, multi-tag filter, sort, edit, delete
// (User Stories 1–3).

import { useCallback, useEffect, useState } from "react";
import { AddBookmark } from "../components/AddBookmark";
import { BookmarkList } from "../components/BookmarkList";
import { EmptyState } from "../components/EmptyState";
import { SearchBar } from "../components/SearchBar";
import { TagFilter } from "../components/TagFilter";
import { EditBookmark } from "../components/EditBookmark";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ImportDialog } from "../components/ImportDialog";
import { ExportDialog } from "../components/ExportDialog";
import { Archive } from "./Archive";
import { BulkActionBar } from "../components/BulkActionBar";
import { SavedSearches } from "../components/SavedSearches";
import {
  bulkAction,
  createSavedSearch,
  deleteBookmark,
  deleteSavedSearch,
  fetchTags,
  listBookmarks,
  listSavedSearches,
  updateBookmark,
  type Bookmark,
  type BulkActionType,
  type BulkFilter,
  type SavedSearch,
  type SortOrder,
} from "../api/client";

type View = "all" | "unread" | "archive";

export function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("recent");
  const [include, setInclude] = useState<string[]>([]);
  const [exclude, setExclude] = useState<string[]>([]);
  const [view, setView] = useState<View>("all");

  // Modal state
  const [editing, setEditing] = useState<Bookmark | null>(null);
  const [editReason, setEditReason] = useState<"resave" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bookmark | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Bulk selection (US6)
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Saved searches (US7)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [savingName, setSavingName] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    const list = await listBookmarks({
      q: query,
      tagsAny: include,
      tagsNot: exclude,
      sort,
      unread: view === "unread",
      archived: view === "archive",
    });
    setBookmarks(list.items);
    setLoaded(true);
  }, [query, include, exclude, sort, view]);

  const refreshTags = useCallback(async () => {
    setAvailableTags(await fetchTags({ inUse: true }));
  }, []);

  const refreshSaved = useCallback(async () => {
    setSavedSearches(await listSavedSearches());
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    void refreshTags();
  }, [refreshTags]);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  // Changing the view or filters clears any selection to avoid acting on a
  // set the user can no longer see.
  useEffect(() => {
    setSelected(new Set());
    setSelectAllMatching(false);
  }, [query, include, exclude, view]);

  function toggleSelect(id: number) {
    setSelectAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectAllMatching(false);
  }

  function currentFilter(): BulkFilter {
    return {
      q: query || undefined,
      tags_any: include,
      tags_not: exclude,
      unread: view === "unread",
      archived: view === "archive",
    };
  }

  async function runBulk(type: BulkActionType, tag?: string) {
    const target = selectAllMatching ? { filter: currentFilter() } : { ids: [...selected] };
    await bulkAction(target, { type, tag, confirm: type === "delete" });
    clearSelection();
    setBulkDeleteOpen(false);
    await refreshList();
    await refreshTags();
  }

  const handleSaved = useCallback(
    (bookmark: Bookmark, existing: boolean) => {
      if (existing) {
        // FR-011: re-saving an existing link drops you into it, ready to tweak.
        setEditing(bookmark);
        setEditReason("resave");
        return;
      }
      setNotice(`Saved “${bookmark.title}”.`);
      void refreshList();
      // Re-fetch shortly after so background-captured title/icon appear.
      setTimeout(() => void refreshList(), 1500);
    },
    [refreshList]
  );

  function cycleTag(tag: string) {
    if (include.includes(tag)) {
      setInclude(include.filter((t) => t !== tag));
      setExclude([...exclude, tag]);
    } else if (exclude.includes(tag)) {
      setExclude(exclude.filter((t) => t !== tag));
    } else {
      setInclude([...include, tag]);
    }
  }

  async function afterMutation() {
    setEditing(null);
    setEditReason(null);
    setDeleteTarget(null);
    await refreshList();
    await refreshTags();
  }

  async function toggleRead(b: Bookmark) {
    await updateBookmark(b.id, { is_read: !b.is_read });
    await refreshList();
  }

  async function toggleArchive(b: Bookmark) {
    await updateBookmark(b.id, { is_archived: !b.is_archived });
    await refreshList();
    await refreshTags();
  }

  function applySavedSearch(s: SavedSearch) {
    setView(s.unread_only ? "unread" : "all");
    setQuery(s.keyword ?? "");
    setInclude(s.include_tags);
    setExclude(s.exclude_tags);
  }

  async function saveCurrentSearch(name: string) {
    await createSavedSearch({
      name,
      keyword: query || undefined,
      include_tags: include,
      exclude_tags: exclude,
      unread_only: view === "unread",
    });
    setSavingName(null);
    await refreshSaved();
  }

  const hasFilters = query.trim() !== "" || include.length > 0 || exclude.length > 0;
  const canSaveSearch = hasFilters || view === "unread";

  return (
    <main className="app">
      <div className="app-header">
        <h1>Bookmarks</h1>
        <div className="toolbar">
          <button type="button" onClick={() => setShowImport(true)} data-testid="open-import">
            Import
          </button>
          <button type="button" onClick={() => setShowExport(true)} data-testid="open-export">
            Export
          </button>
        </div>
      </div>
      <nav className="view-tabs" data-testid="view-tabs">
        {(["all", "unread", "archive"] as const).map((v) => (
          <button
            key={v}
            type="button"
            className={view === v ? "view-tab view-tab--active" : "view-tab"}
            onClick={() => setView(v)}
            data-testid={`view-${v}`}
          >
            {v === "all" ? "All" : v === "unread" ? "Read later" : "Archive"}
          </button>
        ))}
      </nav>

      {view === "archive" ? (
        <Archive
          bookmarks={bookmarks}
          onRestore={(b) => void toggleArchive(b)}
          onDelete={(b) => setDeleteTarget(b)}
        />
      ) : (
        <>
          <AddBookmark onSaved={handleSaved} />
          {notice && (
            <p className="notice" data-testid="notice">
              {notice}
            </p>
          )}

          <SearchBar query={query} sort={sort} onQueryChange={setQuery} onSortChange={setSort} />
      <TagFilter
        availableTags={availableTags}
        include={include}
        exclude={exclude}
        onCycle={cycleTag}
      />
      {(include.length > 0 || exclude.length > 0) && (
        <p className="active-filters" data-testid="active-filters">
          Showing:{" "}
          <strong>{include.length > 0 ? include.join(", ") : "everything"}</strong>
          {exclude.length > 0 && (
            <>
              {" "}
              — not: <strong>{exclude.join(", ")}</strong>
            </>
          )}{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setInclude([]);
              setExclude([]);
            }}
            data-testid="clear-tag-filters"
          >
            Clear tags
          </button>
        </p>
      )}

          <SavedSearches
            searches={savedSearches}
            canSave={canSaveSearch}
            onApply={applySavedSearch}
            onSave={() => setSavingName("")}
            onDelete={async (s) => {
              await deleteSavedSearch(s.id);
              await refreshSaved();
            }}
          />
          {savingName !== null && (
            <form
              className="save-search-form"
              data-testid="save-search-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (savingName.trim()) void saveCurrentSearch(savingName.trim());
              }}
            >
              <input
                type="text"
                placeholder="Name this search (e.g. unread cooking articles)"
                value={savingName}
                onChange={(e) => setSavingName(e.target.value)}
                autoFocus
                data-testid="save-search-name"
              />
              <button
                type="submit"
                disabled={savingName.trim() === ""}
                data-testid="save-search-confirm"
              >
                Save
              </button>
              <button type="button" className="link-button" onClick={() => setSavingName(null)}>
                Cancel
              </button>
            </form>
          )}

          {loaded && bookmarks.length === 0 ? (
            hasFilters ? (
              <p className="no-results" data-testid="no-results">
                No bookmarks match your search.{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setQuery("");
                    setInclude([]);
                    setExclude([]);
                  }}
                >
                  Clear
                </button>
              </p>
            ) : view === "unread" ? (
              <p className="no-results" data-testid="unread-empty">
                Nothing flagged to read later yet. Use “Mark unread” on a
                bookmark to add it here.
              </p>
            ) : (
              <EmptyState />
            )
          ) : (
            <>
              {(selected.size > 0 || selectAllMatching) && (
                <BulkActionBar
                  count={selected.size}
                  selectAllMatching={selectAllMatching}
                  totalMatching={bookmarks.length}
                  onSelectAllMatching={() => setSelectAllMatching(true)}
                  onAddTag={(tag) => void runBulk("add_tag", tag)}
                  onRemoveTag={(tag) => void runBulk("remove_tag", tag)}
                  onArchive={() => void runBulk("archive")}
                  onMarkRead={() => void runBulk("mark_read")}
                  onMarkUnread={() => void runBulk("mark_unread")}
                  onDelete={() => setBulkDeleteOpen(true)}
                  onClear={clearSelection}
                />
              )}
              <BookmarkList
                bookmarks={bookmarks}
                selectedIds={selected}
                onToggleSelect={toggleSelect}
                onEdit={(b) => {
                  setEditing(b);
                  setEditReason(null);
                }}
                onDelete={(b) => setDeleteTarget(b)}
                onToggleRead={(b) => void toggleRead(b)}
                onArchiveToggle={(b) => void toggleArchive(b)}
              />
            </>
          )}
        </>
      )}

      {editing && (
        <EditBookmark
          bookmark={editing}
          reason={editReason}
          onSaved={() => void afterMutation()}
          onCancel={() => {
            setEditing(null);
            setEditReason(null);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Permanently delete “${deleteTarget.title}”? This cannot be undone.`}
          onConfirm={async () => {
            await deleteBookmark(deleteTarget.id);
            await afterMutation();
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {bulkDeleteOpen && (
        <ConfirmDialog
          message={
            selectAllMatching
              ? `Permanently delete all ${bookmarks.length} matching bookmarks? This cannot be undone.`
              : `Permanently delete ${selected.size} selected bookmark${
                  selected.size === 1 ? "" : "s"
                }? This cannot be undone.`
          }
          confirmLabel="Delete all"
          onConfirm={() => void runBulk("delete")}
          onCancel={() => setBulkDeleteOpen(false)}
        />
      )}

      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onDone={async () => {
            setShowImport(false);
            await refreshList();
            await refreshTags();
          }}
        />
      )}

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
    </main>
  );
}
