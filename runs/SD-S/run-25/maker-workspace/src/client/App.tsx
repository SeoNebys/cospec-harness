import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';

import type { Bookmark, Tag } from '../shared/contracts.js';
import {
  deleteBookmark,
  listBookmarks,
  updateBookmarkReadingState,
} from './api/bookmarks.js';
import { listTags } from './api/tags.js';
import { BookmarkForm } from './features/bookmarks/BookmarkForm.js';
import { BookmarkList } from './features/bookmarks/BookmarkList.js';
import { LibraryTabs } from './features/bookmarks/LibraryTabs.js';
import { LibraryControls } from './features/bookmarks/LibraryControls.js';
import { useLibraryView } from './features/bookmarks/useLibraryView.js';

export function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | undefined>();
  const [tags, setTags] = useState<Tag[]>([]);
  const {
    view,
    query,
    tags: selectedTags,
    sort,
    setView,
    setQuery,
    setTags: setSelectedTags,
    setSort,
    clearCriteria,
  } = useLibraryView();

  const load = useCallback(async () => {
    try {
      const result = await listBookmarks({ view, query, tag: selectedTags, sort });
      setBookmarks(result.items);
      setLoaded(true);
      setErrorMessage('');
    } catch {
      setErrorMessage('Your bookmarks could not be loaded.');
    }
  }, [query, selectedTags, sort, view]);

  const loadTags = useCallback(async () => {
    try {
      setTags((await listTags()).items);
    } catch {
      // Bookmark data remains usable when the supporting tag list cannot refresh.
    }
  }, []);

  useEffect(() => {
    void load();
    void loadTags();
  }, [load, loadTags]);

  const handleSaved = (_bookmark: Bookmark) => {
    setLoaded(true);
    setErrorMessage('');
    setShowForm(false);
    setEditingBookmark(undefined);
    void load();
    void loadTags();
    window.setTimeout(() => document.getElementById('library-tab')?.focus(), 0);
  };

  const handleDelete = async (bookmark: Bookmark) => {
    try {
      await deleteBookmark(bookmark.id);
      await Promise.all([load(), loadTags()]);
      window.setTimeout(() => document.getElementById('library-tab')?.focus(), 0);
    } catch {
      setErrorMessage('The bookmark could not be deleted.');
    }
  };

  const handleReadingStateChange = async (
    bookmark: Bookmark,
    readingState: Bookmark['readingState'],
  ) => {
    try {
      const updated = await updateBookmarkReadingState(bookmark.id, readingState);
      setBookmarks((current) =>
        view === 'read-later' && updated.readingState !== 'to_read'
          ? current.filter(({ id }) => id !== updated.id)
          : current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setErrorMessage('');
    } catch {
      setErrorMessage('The reading status could not be changed.');
    }
  };

  return (
    <main {...(loaded ? { 'data-harness-ready': 'true' } : {})}>
      <header>
        <a href="/" aria-label="Trove home">Trove</a>
        <div>
          <p>Personal bookmark library</p>
          <h1>Your bookmarks, kept close.</h1>
          <p>Save useful corners of the web and return when the time is right.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingBookmark(undefined);
            setShowForm(true);
          }}
        >
          Add bookmark
        </button>
      </header>

      {showForm && (
        <section aria-labelledby="add-bookmark-heading">
          <h2 id="add-bookmark-heading">
            {editingBookmark ? 'Edit bookmark' : 'Add a bookmark'}
          </h2>
          <BookmarkForm
            key={editingBookmark?.id ?? 'create'}
            bookmark={editingBookmark}
            onSaved={handleSaved}
            onCancel={() => {
              setShowForm(false);
              setEditingBookmark(undefined);
            }}
          />
        </section>
      )}

      <LibraryTabs view={view} onChange={setView} />

      <LibraryControls
        query={query}
        selectedTags={selectedTags}
        sort={sort}
        tags={tags}
        onQueryChange={setQuery}
        onTagsChange={setSelectedTags}
        onSortChange={setSort}
      />

      <section
        id={view === 'all' ? 'library-tab-panel' : 'read-later-tab-panel'}
        role="tabpanel"
        aria-labelledby={view === 'all' ? 'library-tab' : 'read-later-tab'}
      >
        <div>
          <p>Collection</p>
          <h2>{view === 'all' ? 'Library' : 'Read Later'}</h2>
          {loaded && <p>{bookmarks.length} saved</p>}
        </div>

        {!loaded && !errorMessage && (
          <p role="status" aria-live="polite">
            Loading your bookmarks…
          </p>
        )}

        {errorMessage && (
          <div role="alert">
            <p>{errorMessage}</p>
            <button type="button" onClick={() => void load()}>
              Try again
            </button>
          </div>
        )}

        {loaded && (
          <BookmarkList
            bookmarks={bookmarks}
            emptyState={
              query || selectedTags.length > 0
                ? 'no-results'
                : view === 'read-later'
                  ? 'read-later'
                  : 'library'
            }
            onClearCriteria={clearCriteria}
            onReadingStateChange={(bookmark, readingState) =>
              void handleReadingStateChange(bookmark, readingState)
            }
            onEdit={(bookmark) => {
              setEditingBookmark(bookmark);
              setShowForm(true);
            }}
            onDelete={(bookmark) => void handleDelete(bookmark)}
          />
        )}
      </section>
    </main>
  );
}

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  public state: AppErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('The bookmark application could not be rendered.', error, info);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main>
          <h1>Trove</h1>
          <div role="alert">
            <h2>Something went wrong</h2>
            <p>Refresh the page to return to your bookmarks.</p>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default App;
