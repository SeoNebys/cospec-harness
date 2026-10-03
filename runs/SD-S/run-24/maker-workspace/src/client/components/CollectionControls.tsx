import type { BookmarkQuery, TagSummary } from '../../shared/bookmark-types.js';

interface CollectionControlsProps {
  query: BookmarkQuery;
  tags: TagSummary[];
  onChange: (patch: Partial<BookmarkQuery>) => void;
  onReset: () => void;
}

export function CollectionControls({ query, tags, onChange, onReset }: CollectionControlsProps) {
  const activeCount =
    Number(Boolean(query.q)) +
    query.tags.length +
    Number(query.favorite !== undefined) +
    Number(query.archived) +
    Number(query.sort !== 'newest');

  const toggleTag = (name: string) => {
    onChange({
      tags: query.tags.includes(name)
        ? query.tags.filter((tag) => tag !== name)
        : [...query.tags, name],
    });
  };

  return (
    <section className="collection-controls" aria-label="Find bookmarks">
      <div className="search-field">
        <span aria-hidden="true">⌕</span>
        <label className="sr-only" htmlFor="bookmark-search">
          Search bookmarks
        </label>
        <input
          id="bookmark-search"
          type="search"
          value={query.q}
          onChange={(event) => onChange({ q: event.target.value })}
          placeholder="Search titles, links, notes, or tags"
        />
      </div>
      <div className="control-row">
        <label>
          <span>Status</span>
          <select
            aria-label="Bookmark status"
            value={query.archived ? 'archived' : 'active'}
            onChange={(event) => onChange({ archived: event.target.value === 'archived' })}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label>
          <span>Favorite</span>
          <select
            aria-label="Favorite status"
            value={query.favorite === undefined ? 'all' : String(query.favorite)}
            onChange={(event) =>
              onChange({
                favorite: event.target.value === 'all' ? undefined : event.target.value === 'true',
              })
            }
          >
            <option value="all">Any</option>
            <option value="true">Favorites</option>
            <option value="false">Not favorites</option>
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select
            aria-label="Sort bookmarks"
            value={query.sort}
            onChange={(event) => onChange({ sort: event.target.value as BookmarkQuery['sort'] })}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="title">Title</option>
            <option value="updated">Recently updated</option>
          </select>
        </label>
        {activeCount > 0 && (
          <button className="reset-button" onClick={onReset}>
            Reset filters
          </button>
        )}
      </div>
      {tags.length > 0 && (
        <div className="tag-filters" aria-label="Filter by tags">
          {tags.map((tag) => (
            <button
              key={tag.name}
              aria-pressed={query.tags.includes(tag.name)}
              onClick={() => toggleTag(tag.name)}
            >
              {tag.name} <span>{tag.bookmarkCount}</span>
            </button>
          ))}
        </div>
      )}
      <p className="filter-summary" aria-live="polite">
        {activeCount === 0
          ? 'Showing the default collection view'
          : `${activeCount} active filter${activeCount === 1 ? '' : 's'}`}
      </p>
    </section>
  );
}
