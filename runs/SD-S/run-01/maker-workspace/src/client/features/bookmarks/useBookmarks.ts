import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bookmark, BookmarkList, CreateBookmarkInput, ListCriteria, UpdateBookmarkInput } from '../../../shared/api-types';
import { ApiClientError, bookmarkApi } from '../../api';

function initialCriteria(): ListCriteria {
  if (typeof window === 'undefined') return { scope: 'active', q: '', tag: null, favorite: null, sort: 'newest' };
  const params = new URLSearchParams(window.location.search);
  const sort = params.get('sort');
  return {
    scope: params.get('view') === 'archive' ? 'archived' : 'active',
    q: params.get('q') ?? '',
    tag: params.get('tag'),
    favorite: params.get('favorite') === 'true' ? true : null,
    sort: sort === 'oldest' || sort === 'updated' || sort === 'title' ? sort : 'newest',
  };
}

export function useBookmarks() {
  const [criteria, setCriteria] = useState<ListCriteria>(initialCriteria);
  const [data, setData] = useState<BookmarkList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await bookmarkApi.list(criteria);
      if (currentRequest === requestId.current) setData(result);
    } catch (caught) {
      if (currentRequest === requestId.current) setError(caught instanceof Error ? caught.message : 'Could not load bookmarks.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [criteria]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (criteria.scope === 'archived') params.set('view', 'archive');
    if (criteria.q) params.set('q', criteria.q);
    if (criteria.tag) params.set('tag', criteria.tag);
    if (criteria.favorite) params.set('favorite', 'true');
    if (criteria.sort !== 'newest') params.set('sort', criteria.sort);
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
  }, [criteria]);

  const mutate = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    const result = await operation();
    await reload();
    return result;
  }, [reload]);

  return {
    criteria, setCriteria, data, loading, error, reload,
    create: (input: CreateBookmarkInput) => mutate(() => bookmarkApi.create(input)),
    update: (id: string, input: UpdateBookmarkInput) => mutate(() => bookmarkApi.update(id, input)),
    archive: (id: string) => mutate(() => bookmarkApi.archive(id)),
    restore: (id: string) => mutate(() => bookmarkApi.restore(id)),
    deleteBookmark: (id: string) => mutate(() => bookmarkApi.delete(id)),
  };
}

export function duplicateFrom(error: unknown): Bookmark | null {
  if (!(error instanceof ApiClientError) || error.body.error.code !== 'DUPLICATE_BOOKMARK') return null;
  return (error.body.error.details?.existingBookmark as Bookmark | undefined) ?? null;
}
