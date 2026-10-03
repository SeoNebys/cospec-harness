import { useCallback, useEffect, useRef, useState } from 'react';

import { BOOKMARK_SORTS, type BookmarkQuery } from '../../shared/bookmark-types.js';

const defaults: BookmarkQuery = { q: '', tags: [], archived: false, sort: 'newest' };

const readQuery = (): BookmarkQuery => {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get('sort');
  const favorite = params.get('favorite');
  return {
    q: params.get('q') ?? '',
    tags: (params.get('tags') ?? '').split(',').filter(Boolean),
    ...(favorite === 'true' ? { favorite: true } : favorite === 'false' ? { favorite: false } : {}),
    archived: params.get('archived') === 'true',
    sort: BOOKMARK_SORTS.includes(sort as BookmarkQuery['sort'])
      ? (sort as BookmarkQuery['sort'])
      : 'newest',
  };
};

const writeQuery = (query: BookmarkQuery) => {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.tags.length) params.set('tags', query.tags.join(','));
  if (query.favorite !== undefined) params.set('favorite', String(query.favorite));
  if (query.archived) params.set('archived', 'true');
  if (query.sort !== 'newest') params.set('sort', query.sort);
  const search = params.toString();
  window.history.pushState({}, '', `${window.location.pathname}${search ? `?${search}` : ''}`);
};

export function useCollectionState() {
  const [query, setState] = useState<BookmarkQuery>(readQuery);
  const currentQuery = useRef(query);

  useEffect(() => {
    const onPopState = () => {
      const next = readQuery();
      currentQuery.current = next;
      setState(next);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const setQuery = useCallback((patch: Partial<BookmarkQuery>) => {
    const next = { ...currentQuery.current, ...patch };
    currentQuery.current = next;
    writeQuery(next);
    setState(next);
  }, []);

  const reset = useCallback(() => {
    currentQuery.current = defaults;
    writeQuery(defaults);
    setState(defaults);
  }, []);

  return { query, setQuery, reset };
}
