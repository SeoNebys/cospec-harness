import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

export function FilterBar({ tags }: { tags: { id: string; name: string; bookmarkCount: number }[] }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeQuery = searchParams.get("query") ?? "";
  const activeTag = searchParams.get("tag") ?? "";
  const [query, setQuery] = useState(activeQuery);

  useEffect(() => {
    if (query.trim() === activeQuery) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (query.trim()) next.set("query", query.trim()); else next.delete("query");
      next.delete("cursor");
      void navigate(`?${next.toString()}`, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [activeQuery, navigate, query, searchParams]);

  const hasFilters = Boolean(activeQuery || activeTag);
  return (
    <div className="filter-panel" aria-label="Find bookmarks">
      <label className="search-field">
        <span className="sr-only">Search bookmarks</span>
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder="Search titles, links, descriptions, and tags" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <label className="tag-filter">
        <span className="sr-only">Filter by tag</span>
        <select aria-label="Filter by tag" value={activeTag} onChange={(event) => {
          const next = new URLSearchParams(searchParams);
          if (event.target.value) next.set("tag", event.target.value); else next.delete("tag");
          next.delete("cursor");
          void navigate(`?${next.toString()}`);
        }}>
          <option value="">All tags</option>
          {tags.map((tag) => <option key={tag.id} value={tag.name}>{tag.name} ({tag.bookmarkCount})</option>)}
        </select>
      </label>
      {hasFilters ? <button className="text-button filter-reset" type="button" onClick={() => { setQuery(""); void navigate("?"); }}>Clear search and filters</button> : null}
      {hasFilters ? <p className="active-filters" aria-live="polite">Showing bookmarks{activeQuery ? ` matching “${activeQuery}”` : ""}{activeTag ? ` tagged “${activeTag}”` : ""}.</p> : null}
    </div>
  );
}
