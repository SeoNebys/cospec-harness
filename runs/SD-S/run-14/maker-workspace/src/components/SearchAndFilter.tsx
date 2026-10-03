import type { TagSummary } from '../domain/bookmarkSearch'

interface SearchAndFilterProps {
  query: string
  tag: string
  tags: TagSummary[]
  resultCount: number
  totalCount: number
  onQueryChange: (value: string) => void
  onTagChange: (value: string) => void
  onClear: () => void
}

export function SearchAndFilter(props: SearchAndFilterProps) {
  const active = Boolean(props.query || props.tag)
  return (
    <section className="finder" aria-label="Find bookmarks">
      <div className="search-field">
        <span aria-hidden="true">⌕</span>
        <label className="sr-only" htmlFor="bookmark-search">Search bookmarks</label>
        <input id="bookmark-search" type="search" value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Search titles, notes, links, or tags…" />
        {props.query && <button type="button" aria-label="Clear search" onClick={() => props.onQueryChange('')}>×</button>}
      </div>
      <label className="select-field">
        <span className="sr-only">Filter by tag</span>
        <select value={props.tag} onChange={(event) => props.onTagChange(event.target.value)}>
          <option value="">All tags</option>
          {props.tags.map((tag) => <option value={tag.label} key={tag.comparisonKey}>{tag.label} ({tag.bookmarkCount})</option>)}
        </select>
      </label>
      {active && <button className="clear-button" type="button" onClick={props.onClear}>Clear all</button>}
      <p className="result-count" aria-live="polite">Showing {props.resultCount} of {props.totalCount}</p>
    </section>
  )
}
