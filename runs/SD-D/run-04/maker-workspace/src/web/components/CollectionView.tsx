import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bookmark, TagFilter, UpdateBookmarkInput, View } from '../../shared/types';
import { api, type TagInfo } from '../api/client';
import { BookmarkCard, type CardHandlers } from './BookmarkCard';
import { SearchBar } from './SearchBar';
import { SavedSearchBar } from './SavedSearchBar';
import { BatchToolbar } from './BatchToolbar';
import { EmptyState } from './EmptyState';

// Renders one view (all / readLater / archived): search bar, batch toolbar, and
// the matching cards. Owns its filter, selection, and data for that view.

export function CollectionView({
  view,
  reloadToken,
  emptyTitle,
  emptyHint,
}: {
  view: View;
  reloadToken: number;
  emptyTitle: string;
  emptyHint: string;
}) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [filter, setFilter] = useState<TagFilter>({ sort: 'newest' });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [localReload, setLocalReload] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const [list, tagList] = await Promise.all([api.list({ ...filter, view }), api.tags()]);
    setBookmarks(list.bookmarks);
    setTags(tagList.tags);
  }, [view, filter]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh, reloadToken, localReload]);

  // Poll while anything is still enriching (mainly the 'all' view).
  useEffect(() => {
    const anyPending = bookmarks.some((b) => b.enrichStatus === 'pending');
    if (anyPending && !pollRef.current) {
      pollRef.current = setInterval(() => void refresh(), 1500);
    } else if (!anyPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current && !anyPending) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [bookmarks, refresh]);

  const bump = () => setLocalReload((n) => n + 1);

  const handlers: CardHandlers = {
    onUpdate: async (id, patch: UpdateBookmarkInput) => {
      await api.update(id, patch);
      bump();
    },
    onDelete: async (id) => {
      await api.remove(id);
      bump();
    },
    onArchiveToggle: async (id, archived) => {
      await api.update(id, { archived });
      bump();
    },
    onReadLaterToggle: async (id, readLater) => {
      await api.update(id, { readLater });
      bump();
    },
    onToggleSelect: (id) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
  };

  const ids = () => [...selected];
  async function runBatch(fn: () => Promise<unknown>) {
    await fn();
    setSelected(new Set());
    bump();
  }

  const isSearching =
    !!filter.text ||
    (filter.tagsAny?.length ?? 0) > 0 ||
    (filter.tagsAll?.length ?? 0) > 0 ||
    (filter.tagsNot?.length ?? 0) > 0;

  return (
    <div>
      <SearchBar
        filter={filter}
        availableTags={tags}
        onChange={setFilter}
        onClear={() => setFilter({ sort: filter.sort })}
      />

      <SavedSearchBar
        currentFilter={filter}
        onApply={(f) => setFilter({ ...f, sort: f.sort ?? filter.sort })}
      />

      {selected.size > 0 ? (
        <BatchToolbar
          selectedCount={selected.size}
          showingCount={bookmarks.length}
          inArchivedView={view === 'archived'}
          onSelectAllShowing={() => setSelected(new Set(bookmarks.map((b) => b.id)))}
          onClear={() => setSelected(new Set())}
          onAddTag={(tag) => void runBatch(() => api.batch(ids(), 'addTag', tag))}
          onArchive={() => void runBatch(() => api.batch(ids(), 'archive'))}
          onUnarchive={() => void runBatch(() => api.batch(ids(), 'unarchive'))}
          onDelete={() => {
            if (window.confirm(`Delete ${selected.size} bookmark(s) permanently?`)) {
              void runBatch(() => api.batch(ids(), 'delete'));
            }
          }}
        />
      ) : null}

      {loading ? null : bookmarks.length === 0 ? (
        isSearching ? (
          <EmptyState
            title="No matches"
            hint="Nothing matches your search or tag filter. Try clearing it."
          />
        ) : (
          <EmptyState title={emptyTitle} hint={emptyHint} />
        )
      ) : (
        <div className="card-list">
          {bookmarks.map((b) => (
            <BookmarkCard
              key={b.id}
              bookmark={b}
              selected={selected.has(b.id)}
              suggestions={tags.map((t) => t.name)}
              handlers={handlers}
            />
          ))}
        </div>
      )}
    </div>
  );
}
