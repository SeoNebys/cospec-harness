import { useCallback, useEffect, useState } from 'react';
import type { Bookmark, NewBookmarkInput } from './models/bookmark';
import * as repo from './data/bookmarkRepository';
import { BookmarkList } from './components/BookmarkList';
import { BookmarkForm } from './components/BookmarkForm';
import { SearchBar } from './components/SearchBar';
import { TagFilter } from './components/TagFilter';
import { ConfirmDialog } from './components/ConfirmDialog';

type View = { name: 'list' } | { name: 'add' } | { name: 'edit'; bookmark: Bookmark };

export function App() {
  const [view, setView] = useState<View>({ name: 'list' });
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Bookmark | null>(null);

  const refresh = useCallback(async () => {
    const [results, allTags, total] = await Promise.all([
      repo.list({ keyword, tag: activeTag || undefined }),
      repo.listTags(),
      repo.list().then((all) => all.length),
    ]);
    setBookmarks(results);
    setTags(allTags);
    setTotalCount(total);
  }, [keyword, activeTag]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAddSave = async (input: NewBookmarkInput) => {
    await repo.add(input);
    setView({ name: 'list' });
    await refresh();
  };

  const handleEditSave = async (id: string, input: NewBookmarkInput) => {
    await repo.update(id, input);
    setView({ name: 'list' });
    await refresh();
  };

  const confirmDelete = async () => {
    if (pendingDelete) {
      await repo.remove(pendingDelete.id);
      setPendingDelete(null);
      await refresh();
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Bookmark Manager</h1>
        {view.name === 'list' && (
          <button className="primary" onClick={() => setView({ name: 'add' })}>
            Add bookmark
          </button>
        )}
      </header>

      {view.name === 'add' && (
        <BookmarkForm onSave={handleAddSave} onCancel={() => setView({ name: 'list' })} />
      )}

      {view.name === 'edit' && (
        <BookmarkForm
          initial={view.bookmark}
          onSave={(input) => handleEditSave(view.bookmark.id, input)}
          onCancel={() => setView({ name: 'list' })}
        />
      )}

      {view.name === 'list' && (
        <>
          <div className="toolbar">
            <SearchBar value={keyword} onChange={setKeyword} />
            <TagFilter tags={tags} selected={activeTag} onChange={setActiveTag} />
          </div>
          <BookmarkList
            bookmarks={bookmarks}
            hasAny={totalCount > 0}
            onAdd={() => setView({ name: 'add' })}
            onEdit={(bookmark) => setView({ name: 'edit', bookmark })}
            onDelete={(bookmark) => setPendingDelete(bookmark)}
          />
        </>
      )}

      {pendingDelete && (
        <ConfirmDialog
          message={`Delete “${pendingDelete.title}”? This can’t be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
