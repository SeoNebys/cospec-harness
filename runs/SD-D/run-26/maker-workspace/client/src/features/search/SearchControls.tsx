import { SearchHelp } from './SearchHelp.js';
export function SearchControls({
  query,
  tag,
  sort,
  tags,
  onChange
}: {
  query: string;
  tag: string;
  sort: string;
  tags: { name: string; count: number }[];
  onChange: (v: { query?: string; tag?: string; sort?: string }) => void;
}) {
  return (
    <section className="search-controls">
      <div className="search-box">
        <span aria-hidden="true">⌕</span>
        <input
          aria-label="Search bookmarks"
          value={query}
          onChange={(e) => onChange({ query: e.target.value })}
          placeholder="Search titles, notes, tags…"
        />
        {query && (
          <button aria-label="Clear search" onClick={() => onChange({ query: '' })}>
            ×
          </button>
        )}
      </div>
      <select
        aria-label="Filter by tag"
        value={tag}
        onChange={(e) => onChange({ tag: e.target.value })}
      >
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name} ({t.count})
          </option>
        ))}
      </select>
      <select
        aria-label="Sort bookmarks"
        value={sort}
        onChange={(e) => onChange({ sort: e.target.value })}
      >
        <option value="recent">Recently updated</option>
        <option value="title">Title A–Z</option>
      </select>
      <SearchHelp />
    </section>
  );
}
