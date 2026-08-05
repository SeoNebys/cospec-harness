import { useCallback, useEffect, useRef, useState } from "react";
import type { Bookmark, Tag } from "../types";
import { api } from "../services/apiClient";
import { AddBookmarkForm } from "../components/AddBookmarkForm";
import { BookmarkCard } from "../components/BookmarkCard";
import { SearchBar } from "../components/SearchBar";
import { EmptyState } from "../components/EmptyState";
import { TagFilter } from "../components/TagFilter";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { BookmarkDetail } from "./BookmarkDetail";

/** The main view: add, browse, search, filter, edit, and delete bookmarks. */
export function Collection() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<(Tag & { count: number })[]>([]);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Bookmark | null>(null);
  const [deleting, setDeleting] = useState<Bookmark | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [{ bookmarks }, { tags }] = await Promise.all([
      api.listBookmarks({ q: debouncedQ || undefined, tag: activeTag || undefined }),
      api.listTags(),
    ]);
    setBookmarks(bookmarks);
    setTags(tags);
    setLoading(false);
  }, [debouncedQ, activeTag]);

  // Debounce the search term.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll briefly while any bookmark is still being enriched, so the fetched
  // title/preview appears without a manual refresh (FR-014, async enrichment).
  useEffect(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    if (bookmarks.some((b) => b.fetchStatus === "pending")) {
      pollRef.current = setTimeout(() => void load(), 1200);
    }
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [bookmarks, load]);

  async function confirmDelete() {
    if (!deleting) return;
    await api.deleteBookmark(deleting.id);
    setDeleting(null);
    await load();
  }

  const isFiltering = Boolean(debouncedQ) || Boolean(activeTag);

  return (
    <div>
      <AddBookmarkForm onAdded={() => void load()} />

      <div className="toolbar">
        <SearchBar value={q} onChange={setQ} />
      </div>

      <TagFilter tags={tags} active={activeTag} onSelect={setActiveTag} />

      {!loading && bookmarks.length === 0 ? (
        <EmptyState kind={isFiltering ? "no-results" : "empty-collection"} />
      ) : (
        <div data-testid="bookmark-list">
          {bookmarks.map((b) => (
            <BookmarkCard
              key={b.id}
              bookmark={b}
              onEdit={setEditing}
              onDelete={setDeleting}
              onTagClick={setActiveTag}
            />
          ))}
        </div>
      )}

      {editing && (
        <BookmarkDetail
          bookmark={editing}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          message={`Delete “${deleting.title || deleting.url}”? This can't be undone.`}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
