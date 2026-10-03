import type { TagSummary } from '../../shared/types.js';

interface SearchAndFilterProps {
  query: string;
  selectedTag: string;
  tags: TagSummary[];
  resultCount: number;
  onQueryChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onClear: () => void;
}

export function SearchAndFilter({ query, selectedTag, tags, resultCount, onQueryChange, onTagChange, onClear }: SearchAndFilterProps) {
  const hasCriteria = Boolean(query || selectedTag);
  return (
    <div className="search-panel">
      <div className="search-field">
        <label htmlFor="bookmark-search">Search bookmarks</label>
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          id="bookmark-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Title, address, description, or tag"
          maxLength={200}
        />
      </div>
      <div className="filter-field">
        <label htmlFor="tag-filter">Filter by tag</label>
        <select id="tag-filter" value={selectedTag} onChange={(event) => onTagChange(event.target.value)}>
          <option value="">All tags</option>
          {tags.map((tag) => <option value={tag.name} key={tag.name}>{tag.name} ({tag.count})</option>)}
        </select>
      </div>
      <div className="search-summary" role="status" aria-live="polite">
        <span>{resultCount} {resultCount === 1 ? 'result' : 'results'}</span>
        {hasCriteria ? <button type="button" className="text-button" onClick={onClear} aria-label="Clear search and filter">Clear</button> : null}
      </div>
    </div>
  );
}
