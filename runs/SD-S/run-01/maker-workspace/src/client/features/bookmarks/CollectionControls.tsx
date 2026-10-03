import { useEffect, useState } from 'react';
import type { ListCriteria } from '../../../shared/api-types';
import { ActiveCriteria } from './ActiveCriteria';

interface CollectionControlsProps {
  criteria: ListCriteria;
  tags: string[];
  onChange: (criteria: ListCriteria) => void;
}

export function CollectionControls({ criteria, tags, onChange }: CollectionControlsProps) {
  const [search, setSearch] = useState(criteria.q);
  useEffect(() => setSearch(criteria.q), [criteria.q]);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (search !== criteria.q) onChange({ ...criteria, q: search });
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [search, criteria, onChange]);

  const clear = () => { setSearch(''); onChange({ ...criteria, q: '', tag: null, favorite: null }); };
  return (
    <section className="collection-controls" aria-label="Find and organize bookmarks">
      <div className="search-field"><label className="sr-only" htmlFor="bookmark-search">Search bookmarks</label><span aria-hidden="true">⌕</span><input id="bookmark-search" type="search" value={search} maxLength={200} placeholder="Search titles, notes, URLs, and tags" onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="filter-row">
        <label>Tag<select value={criteria.tag ?? ''} onChange={(event) => onChange({ ...criteria, tag: event.target.value || null })}><option value="">All tags</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label>
        <label className="favorite-filter"><input type="checkbox" checked={criteria.favorite === true} onChange={(event) => onChange({ ...criteria, favorite: event.target.checked ? true : null })} /> Favorites only</label>
        <label>Sort<select value={criteria.sort} onChange={(event) => onChange({ ...criteria, sort: event.target.value as ListCriteria['sort'] })}><option value="newest">Newest saved</option><option value="oldest">Oldest saved</option><option value="updated">Recently updated</option><option value="title">Title A–Z</option></select></label>
      </div>
      <ActiveCriteria criteria={criteria} onClear={clear} />
    </section>
  );
}
