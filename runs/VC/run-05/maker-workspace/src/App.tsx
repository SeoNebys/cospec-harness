import { useCallback, useEffect, useState } from "react";
import type { Bookmark, BookmarkDraft, Tag } from "./types.ts";
import * as api from "./api.ts";
import { BookmarkForm } from "./components/BookmarkForm.tsx";
import { BookmarkItem } from "./components/BookmarkItem.tsx";

export function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [bms, tgs] = await Promise.all([
        api.fetchBookmarks({
          search: search.trim() || undefined,
          tag: activeTag ?? undefined,
        }),
        api.fetchTags(),
      ]);
      setBookmarks(bms);
      setTags(tgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bookmarks.");
    } finally {
      setLoading(false);
    }
  }, [search, activeTag]);

  // Debounce search / tag changes so we don't hammer the API on each keystroke.
  useEffect(() => {
    const t = setTimeout(refresh, 200);
    return () => clearTimeout(t);
  }, [refresh]);

  async function handleCreate(draft: BookmarkDraft) {
    await api.createBookmark(draft);
    await refresh();
  }

  async function handleSave(id: number, draft: BookmarkDraft) {
    await api.updateBookmark(id, draft);
    await refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this bookmark?")) return;
    try {
      await api.deleteBookmark(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.");
    }
  }

  function toggleTag(tag: string) {
    setActiveTag((cur) => (cur === tag ? null : tag));
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔖 Bookmarks</h1>
        <input
          className="input search"
          type="search"
          placeholder="Search title, URL, or notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </header>

      <main className="layout">
        <aside className="sidebar">
          <h2 className="sidebar-title">Add new</h2>
          <BookmarkForm onSubmit={handleCreate} />

          {tags.length > 0 && (
            <>
              <h2 className="sidebar-title">Tags</h2>
              <div className="tag-row">
                {activeTag && (
                  <button
                    className="tag tag-clear"
                    onClick={() => setActiveTag(null)}
                  >
                    ✕ clear
                  </button>
                )}
                {tags.map((t) => (
                  <button
                    key={t.name}
                    className={`tag ${activeTag === t.name ? "tag-active" : ""}`}
                    onClick={() => toggleTag(t.name)}
                  >
                    {t.name} <span className="tag-count">{t.count}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        <section className="content">
          {error && <p className="error banner">{error}</p>}
          {loading ? (
            <p className="muted">Loading…</p>
          ) : bookmarks.length === 0 ? (
            <p className="muted">
              {search || activeTag
                ? "No bookmarks match your filters."
                : "No bookmarks yet — add your first one on the left."}
            </p>
          ) : (
            <ul className="bookmark-list">
              {bookmarks.map((b) => (
                <BookmarkItem
                  key={b.id}
                  bookmark={b}
                  activeTag={activeTag}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onTagClick={toggleTag}
                />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
