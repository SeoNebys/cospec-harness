import { SearchHelp } from './SearchHelp';
import { SortControl } from './SortControl';
import { useSearchState } from './useSearchState';

export function SearchControls({
  query,
  tags,
  sort,
  direction,
  onQuery,
  onRemoveTag,
  onSort,
  onClear,
}: {
  query: string;
  tags: string[];
  sort: 'savedAt' | 'title';
  direction: 'asc' | 'desc';
  onQuery: (value: string) => void;
  onRemoveTag: (tag: string) => void;
  onSort: (sort: 'savedAt' | 'title', direction: 'asc' | 'desc') => void;
  onClear: () => void;
}) {
  const search = useSearchState(query, onQuery);
  const active = Boolean(query || tags.length);
  return (
    <div className="search-area">
      <div className="toolbar">
        <div className="search-wrap">
          <label className="sr-only" htmlFor="library-search">
            Search bookmarks
          </label>
          <input
            id="library-search"
            className="search-input"
            type="search"
            maxLength={500}
            value={search.input}
            onChange={(event) => search.setInput(event.target.value)}
            placeholder={'Search titles, notes, #tags, or "exact phrases"'}
          />
        </div>
        <SortControl sort={sort} direction={direction} onChange={onSort} />
        {active && (
          <button className="text-action" type="button" onClick={onClear}>
            Clear all
          </button>
        )}
      </div>
      {tags.length > 0 && (
        <div className="active-filters" aria-label="Active tag filters">
          {tags.map((tag) => (
            <button type="button" key={tag} onClick={() => onRemoveTag(tag)}>
              #{tag} ×
            </button>
          ))}
        </div>
      )}
      <SearchHelp />
    </div>
  );
}
