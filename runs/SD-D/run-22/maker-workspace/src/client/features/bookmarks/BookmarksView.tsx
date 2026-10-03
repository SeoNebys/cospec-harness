import { useCallback, useEffect, useState } from 'react';
import { SaveBookmarkForm } from './SaveBookmarkForm';
import { BookmarkLibrary } from './BookmarkLibrary';
import { EditBookmarkForm } from './EditBookmarkForm';
import { DeleteBookmarkDialog } from './DeleteBookmarkDialog';
import { SearchBar } from '../search/SearchBar';
import { LibraryControls, type TagOption } from '../search/LibraryControls';
import type { ApiError, Bookmark, BookmarkDraft, SortField, SortOrder } from './types';

interface Props {
  scope?: 'all' | 'unread-read-later';
  onUnreadCountChange?: (count: number) => void;
  announce?: (message: string) => void;
}
async function decode<T>(response: Response): Promise<T> {
  const body =
    response.status === 204 ? {} : ((await response.json()) as { data?: T; error?: ApiError });
  if (!response.ok) {
    const error = (body as { error?: ApiError }).error;
    const thrown = new Error(error?.message ?? 'The request did not complete.') as Error & {
      details?: ApiError;
    };
    thrown.details = error;
    throw thrown;
  }
  return (body as { data: T }).data;
}

export function BookmarksView({ scope = 'all', onUnreadCountChange, announce }: Props) {
  const initial = new URLSearchParams(window.location.search);
  const [items, setItems] = useState<Bookmark[]>([]),
    [tags, setTags] = useState<TagOption[]>([]),
    [query, setQuery] = useState(initial.get('q') ?? ''),
    [labels, setLabels] = useState<string[]>([]),
    [selectedTags, setSelectedTags] = useState<string[]>(initial.getAll('tag')),
    [sort, setSort] = useState<SortField>(initial.get('sort') === 'title' ? 'title' : 'createdAt'),
    [order, setOrder] = useState<SortOrder>(initial.get('order') === 'asc' ? 'asc' : 'desc'),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null),
    [searchError, setSearchError] = useState<{
      message: string;
      span?: { start: number; end: number };
    } | null>(null),
    [editing, setEditing] = useState<Bookmark | null>(null),
    [deleting, setDeleting] = useState<Bookmark | null>(null);
  const [deleteTrigger, setDeleteTrigger] = useState<HTMLButtonElement | null>(null);
  // Stable request identity keeps refresh actions and the query-driven effect in sync.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSearchError(null);
    const params = new URLSearchParams({ scope, sort, order });
    if (query) params.set('q', query);
    selectedTags.forEach((tag) => params.append('tag', tag));
    try {
      const result = await decode<{ items: Bookmark[]; query: { labels: string[] } }>(
        await fetch(`/api/bookmarks?${params}`),
      );
      setItems(result.items);
      setLabels(result.query.labels);
      onUnreadCountChange?.(result.items.filter((item) => item.readLater && !item.isRead).length);
    } catch (reason) {
      const failure = reason as Error & { details?: ApiError };
      if (failure.details?.span)
        setSearchError({ message: failure.message, span: failure.details.span });
      else setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [scope, sort, order, query, selectedTags, onUnreadCountChange]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    void fetch('/api/tags')
      .then((response) => decode<Array<TagOption & { bookmarkCount?: number }>>(response))
      .then((values) =>
        setTags(
          values.map((tag) => ({ name: tag.name, count: tag.count ?? tag.bookmarkCount ?? 0 })),
        ),
      )
      .catch(() => setTags([]));
  }, [items.length]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    selectedTags.forEach((tag) => params.append('tag', tag));
    if (sort !== 'createdAt') params.set('sort', sort);
    if (order !== 'desc') params.set('order', order);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${params.size ? `?${params}` : ''}`,
    );
  }, [query, selectedTags, sort, order]);
  async function save(draft: BookmarkDraft) {
    setSaving(true);
    try {
      const created = await decode<Bookmark>(
        await fetch('/api/bookmarks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(draft),
        }),
      );
      announce?.(`Saved ${created.title}.`);
      await load();
    } catch (reason) {
      const failure = reason as Error & { details?: ApiError };
      if (failure.details?.existingId) {
        announce?.('That link is already saved. Moving to the existing bookmark.');
        document.getElementById(`bookmark-${failure.details.existingId}`)?.focus();
      }
      throw reason;
    } finally {
      setSaving(false);
    }
  }
  async function reading(bookmark: Bookmark, readLater: boolean, isRead: boolean) {
    const updated = await decode<Bookmark>(
      await fetch(`/api/bookmarks/${bookmark.id}/reading-status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ readLater, isRead }),
      }),
    );
    setItems((current) =>
      scope === 'unread-read-later' && (!updated.readLater || updated.isRead)
        ? current.filter((item) => item.id !== updated.id)
        : current.map((item) => (item.id === updated.id ? updated : item)),
    );
    announce?.(`${updated.title} reading status updated.`);
    await load();
  }
  async function update(patch: Partial<BookmarkDraft>) {
    if (!editing) return;
    const updated = await decode<Bookmark>(
      await fetch(`/api/bookmarks/${editing.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    );
    setEditing(null);
    announce?.(`Updated ${updated.title}.`);
    await load();
    window.setTimeout(() => document.getElementById(`bookmark-${updated.id}`)?.focus(), 0);
  }
  async function remove(bookmark: Bookmark) {
    await decode<void>(await fetch(`/api/bookmarks/${bookmark.id}`, { method: 'DELETE' }));
    setItems((current) => current.filter((item) => item.id !== bookmark.id));
    announce?.(`Deleted ${bookmark.title}.`);
  }
  const reset = () => {
    setQuery('');
    setSelectedTags([]);
    setSort('createdAt');
    setOrder('desc');
  };
  return (
    <div className="bookmarks-view">
      {scope === 'all' && <SaveBookmarkForm onSave={save} isSaving={saving} />}
      <section className="library-section" aria-labelledby="library-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{scope === 'all' ? 'Your collection' : 'Focused queue'}</p>
            <h2 id="library-heading">{scope === 'all' ? 'Bookmark library' : 'Read later'}</h2>
          </div>
          <span className="count-badge">{items.length}</span>
        </div>
        <SearchBar
          key={`${scope}:${query}`}
          value={query}
          labels={labels}
          error={searchError}
          onSearch={setQuery}
          onReset={() => setQuery('')}
        />
        <LibraryControls
          tags={tags}
          selectedTags={selectedTags}
          sort={sort}
          order={order}
          onTagsChange={setSelectedTags}
          onSortChange={(field, direction) => {
            setSort(field);
            setOrder(direction);
          }}
        />
        <BookmarkLibrary
          bookmarks={items}
          isLoading={loading}
          error={error}
          hasCriteria={Boolean(query || selectedTags.length)}
          scope={scope}
          onReset={reset}
          onReadingChange={reading}
          onEdit={setEditing}
          onDelete={(bookmark, trigger) => {
            setDeleteTrigger(trigger);
            setDeleting(bookmark);
          }}
        />
      </section>
      {editing && (
        <div className="modal-backdrop">
          <div
            className="edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Edit ${editing.title}`}
          >
            <EditBookmarkForm
              bookmark={editing}
              onSave={update}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}
      <DeleteBookmarkDialog
        bookmark={deleting}
        returnFocus={deleteTrigger}
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
      />
    </div>
  );
}
