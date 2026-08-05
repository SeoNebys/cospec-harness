import { useCallback, useEffect, useState } from 'react';
import {
  deleteBookmark,
  listBookmarks,
  listTags,
  removeTag as apiRemoveTag,
  renameTag as apiRenameTag,
  setBookmarkTags,
  undoDelete,
  type Bookmark,
  type Tag,
} from './api';
import { AddBookmarkForm } from './components/AddBookmarkForm';
import { BookmarkList } from './components/BookmarkList';
import { SearchBar } from './components/SearchBar';
import { TagFilter } from './components/TagFilter';
import { UndoToast } from './components/UndoToast';

export function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleted, setDeleted] = useState<{ id: number; title: string } | null>(
    null,
  );

  const refreshBookmarks = useCallback(() => {
    return listBookmarks({ q: query, tag: activeTag ?? undefined }).then(
      setBookmarks,
    );
  }, [query, activeTag]);

  const refreshTags = useCallback(() => listTags().then(setTags), []);

  // Debounced re-fetch as the keyword or active tag changes.
  useEffect(() => {
    const handle = setTimeout(() => {
      refreshBookmarks().finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(handle);
  }, [refreshBookmarks]);

  useEffect(() => {
    refreshTags();
  }, [refreshTags]);

  async function handleSetTags(bookmark: Bookmark, next: string[]) {
    await setBookmarkTags(bookmark.id, next);
    await Promise.all([refreshBookmarks(), refreshTags()]);
  }

  async function handleDelete(bookmark: Bookmark) {
    if (!window.confirm(`Delete “${bookmark.title}”?`)) return;
    await deleteBookmark(bookmark.id);
    setDeleted({ id: bookmark.id, title: bookmark.title });
    await Promise.all([refreshBookmarks(), refreshTags()]);
  }

  async function handleUndo() {
    if (!deleted) return;
    await undoDelete(deleted.id);
    setDeleted(null);
    await Promise.all([refreshBookmarks(), refreshTags()]);
  }

  async function handleRename(tag: Tag) {
    const name = window.prompt(`Rename tag “${tag.name}” to:`, tag.name);
    if (!name || name.trim() === tag.name) return;
    await apiRenameTag(tag.id, name.trim());
    if (activeTag === tag.name) setActiveTag(null);
    await Promise.all([refreshBookmarks(), refreshTags()]);
  }

  async function handleRemove(tag: Tag) {
    if (!window.confirm(`Remove tag “${tag.name}” from all bookmarks?`)) return;
    await apiRemoveTag(tag.id);
    if (activeTag === tag.name) setActiveTag(null);
    await Promise.all([refreshBookmarks(), refreshTags()]);
  }

  return (
    <main className="app">
      <h1>Bookmark Manager</h1>
      <AddBookmarkForm
        onAdded={async () => {
          await Promise.all([refreshBookmarks(), refreshTags()]);
        }}
      />
      <SearchBar value={query} onChange={setQuery} />
      <TagFilter
        tags={tags}
        active={activeTag}
        onSelect={setActiveTag}
        onRename={handleRename}
        onRemove={handleRemove}
      />
      {loading ? (
        <p>Loading…</p>
      ) : (
        <BookmarkList
          bookmarks={bookmarks}
          query={query || (activeTag ?? '')}
          onSetTags={handleSetTags}
          onUpdated={async () => {
            await Promise.all([refreshBookmarks(), refreshTags()]);
          }}
          onDelete={handleDelete}
        />
      )}
      {deleted && (
        <UndoToast
          title={deleted.title}
          onUndo={handleUndo}
          onDismiss={() => setDeleted(null)}
        />
      )}
    </main>
  );
}
