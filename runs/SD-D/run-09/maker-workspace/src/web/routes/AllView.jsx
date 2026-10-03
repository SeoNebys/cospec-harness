import React from 'react';
import { BookmarkList } from '../components/BookmarkList.jsx';
import { takeAppliedFilter } from '../lib/appliedFilter.js';

export function AllView() {
  const f = takeAppliedFilter();
  return (
    <BookmarkList
      view="all"
      title={f ? `Filter: ${f.name || 'applied'}` : 'All bookmarks'}
      initialQuery={f?.query || ''}
      initialIncludeTags={f?.includeTags || []}
      initialExcludeTags={f?.excludeTags || []}
      showSaveFilter
    />
  );
}
