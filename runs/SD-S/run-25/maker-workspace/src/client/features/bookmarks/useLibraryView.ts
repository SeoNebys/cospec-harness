import { useCallback, useEffect, useState } from 'react';

import type { BookmarkListView, SortOrder } from '../../../shared/contracts.js';

interface LibraryViewState {
  view: BookmarkListView;
  query: string;
  tags: string[];
  sort: SortOrder;
}

function readState(): LibraryViewState {
  const parameters = new URLSearchParams(window.location.search);
  const rawSort = parameters.get('sort');
  return {
    view: parameters.get('view') === 'read-later' ? 'read-later' : 'all',
    query: parameters.get('query') ?? '',
    tags: parameters.getAll('tag'),
    sort: rawSort === 'oldest' || rawSort === 'title' ? rawSort : 'newest',
  };
}

function writeState(state: LibraryViewState, push = false): void {
  const parameters = new URLSearchParams();
  if (state.view === 'read-later') parameters.set('view', state.view);
  if (state.query) parameters.set('query', state.query);
  for (const tag of state.tags) parameters.append('tag', tag);
  if (state.sort !== 'newest') parameters.set('sort', state.sort);
  const search = parameters.toString();
  window.history[push ? 'pushState' : 'replaceState'](
    {},
    '',
    `${window.location.pathname}${search ? `?${search}` : ''}`,
  );
}

export function useLibraryView() {
  const [state, setState] = useState<LibraryViewState>(readState);

  useEffect(() => {
    const handlePopState = () => setState(readState());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const update = useCallback(
    (changes: Partial<LibraryViewState>, push = false) => {
      setState((current) => {
        const next = { ...current, ...changes };
        writeState(next, push);
        return next;
      });
    },
    [],
  );

  return {
    ...state,
    setView: (view: BookmarkListView) => update({ view }, true),
    setQuery: (query: string) => update({ query }),
    setTags: (tags: string[]) => update({ tags }),
    setSort: (sort: SortOrder) => update({ sort }),
    clearCriteria: () => update({ query: '', tags: [] }),
  };
}
