import type { TagSummary } from './bookmark-api';

export function CollectionToolbar({
  query,
  setQuery,
  favorite,
  setFavorite,
  tags,
  selected,
  toggleTag,
  clear,
}: {
  query: string;
  setQuery: (v: string) => void;
  favorite: boolean;
  setFavorite: (v: boolean) => void;
  tags: TagSummary[];
  selected: string[];
  toggleTag: (id: string) => void;
  clear: () => void;
}) {
  const filtered = Boolean(query || favorite || selected.length);
  return (
    <section className="toolbar" aria-label="Find bookmarks">
      <div className="search-wrap">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          aria-label="Search bookmarks"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles, links, notes, and tags…"
        />
        {query && (
          <button aria-label="Clear search" onClick={() => setQuery('')}>
            ×
          </button>
        )}
      </div>
      <div className="filters">
        <button
          className={`filter-pill ${favorite ? 'selected' : ''}`}
          aria-pressed={favorite}
          onClick={() => setFavorite(!favorite)}
        >
          ★ Favorites
        </button>
        {tags.map((tag) => (
          <button
            key={tag.id}
            className={`filter-pill ${selected.includes(tag.id) ? 'selected' : ''}`}
            aria-pressed={selected.includes(tag.id)}
            onClick={() => toggleTag(tag.id)}
          >
            {tag.name} <span>{tag.bookmarkCount}</span>
          </button>
        ))}
        {filtered && (
          <button className="clear-button" onClick={clear}>
            Clear all
          </button>
        )}
      </div>
    </section>
  );
}
