import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  type Bookmark,
  type BookmarkList as BookmarkListResponse,
  type CreateInput,
  type TagCount,
  createBookmark,
  deleteBookmark,
  listBookmarks,
  listTags,
  restoreBookmark,
  updateBookmark,
} from "../api/client";
import { BookmarkForm } from "../components/BookmarkForm";
import { BookmarkList } from "../components/BookmarkList";
import { EmptyState } from "../components/EmptyState";
import { SearchBar } from "../components/SearchBar";
import { TagFilter } from "../components/TagFilter";
import { UndoToast } from "../components/UndoToast";

const UNDO_TOAST_MS = 8000;

export function App() {
  const [data, setData] = useState<BookmarkListResponse>({ items: [], total: 0 });
  const [tags, setTags] = useState<TagCount[]>([]);
  const [q, setQ] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [editing, setEditing] = useState<Bookmark | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Bookmark | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Bookmark | null>(null);
  const [undo, setUndo] = useState<{ message: string; id: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, tagList] = await Promise.all([
        listBookmarks({ q: q || undefined, tags: selectedTags }),
        listTags(),
      ]);
      setData(list);
      setTags(tagList.tags);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load bookmarks.");
    }
  }, [q, selectedTags]);

  // Reload when the query or tag filter changes (light debounce on typing).
  useEffect(() => {
    const t = setTimeout(refresh, 150);
    return () => clearTimeout(t);
  }, [refresh]);

  const handleSubmit = async (input: CreateInput) => {
    setFormError(null);
    setDuplicate(null);
    try {
      if (editing) {
        await updateBookmark(editing.id, input);
      } else {
        await createBookmark(input);
      }
      setEditing(null);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "duplicate" && err.existing) {
          setDuplicate(err.existing);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteBookmark(target.id);
      await refresh();
      setUndo({ message: `Deleted "${target.title}".`, id: target.id });
    } catch {
      setLoadError("Could not delete the bookmark.");
    }
  };

  const handleUndo = async () => {
    if (!undo) return;
    try {
      await restoreBookmark(undo.id);
      await refresh();
    } catch {
      setLoadError("The bookmark could not be restored (undo window elapsed).");
    } finally {
      setUndo(null);
    }
  };

  // Auto-dismiss the undo toast.
  useEffect(() => {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_TOAST_MS);
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, [undo]);

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  const clearFilters = () => {
    setQ("");
    setSelectedTags([]);
  };

  const filtered = q.trim() !== "" || selectedTags.length > 0;

  return (
    <div className="app">
      <header className="app__header">
        <h1>Bookmark Manager</h1>
      </header>

      <BookmarkForm
        editing={editing}
        error={formError}
        onSubmit={handleSubmit}
        onCancelEdit={() => {
          setEditing(null);
          setFormError(null);
        }}
      />

      {duplicate && (
        <div className="duplicate-banner" role="alert">
          <span>
            You already saved this address as <strong>{duplicate.title}</strong>.
          </span>
          <a href={duplicate.url} target="_blank" rel="noopener noreferrer">
            Open existing
          </a>
          <button
            onClick={() => {
              setEditing(duplicate);
              setDuplicate(null);
            }}
          >
            Edit existing
          </button>
          <button onClick={() => setDuplicate(null)}>Dismiss</button>
        </div>
      )}

      <section className="controls">
        <SearchBar value={q} onChange={setQ} />
        <TagFilter tags={tags} selected={selectedTags} onToggle={toggleTag} />
      </section>

      {loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}

      <main>
        <p className="count" aria-live="polite">
          {data.total} {data.total === 1 ? "bookmark" : "bookmarks"}
        </p>
        {data.items.length === 0 ? (
          <EmptyState filtered={filtered} onClearFilters={clearFilters} />
        ) : (
          <BookmarkList
            items={data.items}
            onEdit={(b) => {
              setEditing(b);
              setFormError(null);
            }}
            onDelete={(b) => setPendingDelete(b)}
          />
        )}
      </main>

      {pendingDelete && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <p>
              Delete <strong>{pendingDelete.title}</strong>?
            </p>
            <div className="form-actions">
              <button className="danger" onClick={confirmDelete}>
                Delete
              </button>
              <button onClick={() => setPendingDelete(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {undo && (
        <UndoToast
          message={undo.message}
          onUndo={handleUndo}
          onDismiss={() => setUndo(null)}
        />
      )}
    </div>
  );
}
