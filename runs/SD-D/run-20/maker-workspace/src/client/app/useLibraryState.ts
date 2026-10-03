import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BookmarkDto } from '../../shared/schemas/api';
import { api } from '../lib/api';
import type { LibraryView } from './AppShell';

export interface LibraryParams {
  view: LibraryView;
  query: string;
  tags: string[];
  sort: 'savedAt' | 'title';
  direction: 'asc' | 'desc';
  page: number;
}
export interface BookmarkPage {
  items: BookmarkDto[];
  page: number;
  pageSize: number;
  total: number;
}

export function useLibraryState() {
  const [params, setParams] = useState<LibraryParams>({
    view: 'active',
    query: '',
    tags: [],
    sort: 'savedAt',
    direction: 'desc',
    page: 1,
  });
  const [page, setPage] = useState<BookmarkPage>({ items: [], page: 1, pageSize: 50, total: 0 });
  const [counts, setCounts] = useState<Record<LibraryView, number>>({ active: 0, unread: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const contextKey = useMemo(
    () => JSON.stringify([params.view, params.query, params.tags]),
    [params.view, params.query, params.tags],
  );
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const search = new URLSearchParams({
        view: params.view,
        q: params.query,
        sort: params.sort,
        direction: params.direction,
        page: String(params.page),
        pageSize: '50',
      });
      for (const tag of params.tags) search.append('tag', tag);
      const [result, active, unread, archived] = await Promise.all([
        api<BookmarkPage>(`/api/bookmarks?${search}`),
        api<BookmarkPage>('/api/bookmarks?view=active&pageSize=1'),
        api<BookmarkPage>('/api/bookmarks?view=unread&pageSize=1'),
        api<BookmarkPage>('/api/bookmarks?view=archived&pageSize=1'),
      ]);
      setPage(result);
      setCounts({ active: active.total, unread: unread.total, archived: archived.total });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The library could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [params]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const update = useCallback(
    (change: Partial<LibraryParams>) =>
      setParams((current) => ({ ...current, ...change, page: change.page ?? 1 })),
    [],
  );
  return { params, update, page, counts, loading, error, refresh, contextKey };
}
