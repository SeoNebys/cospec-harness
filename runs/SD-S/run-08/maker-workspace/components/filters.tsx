"use client";

import { useEffect, useState } from "react";

export type TagCount = { id: number; name: string; count: number };
export type FilterState = { q: string; tag: string; sort: "newest" | "oldest" | "alphabetical" };

export function Filters({ value, tags, onChange }: { value: FilterState; tags: TagCount[]; onChange: (next: FilterState) => void }) {
  const [query, setQuery] = useState(value.q);
  useEffect(() => { const timer = window.setTimeout(() => { if (query !== value.q) onChange({ ...value, q: query }); }, 300); return () => window.clearTimeout(timer); }, [query, value, onChange]);
  const active = Boolean(value.q || value.tag || value.sort !== "newest");
  return <section className="filters" aria-label="Find bookmarks">
    <div className="search-field"><label htmlFor="bookmark-search">Search your library</label><div className="search-wrap"><span aria-hidden="true">⌕</span><input id="bookmark-search" type="search" value={query} maxLength={200} placeholder="Search titles, notes, URLs, and tags" onChange={(e) => setQuery(e.target.value)} /></div></div>
    <div className="filter-row"><div className="field compact-field"><label htmlFor="tag-filter">Tag</label><select id="tag-filter" value={value.tag} onChange={(e) => onChange({ ...value, tag: e.target.value })}><option value="">All tags</option>{tags.map((tag) => <option key={tag.id} value={tag.name}>{tag.name} ({tag.count})</option>)}</select></div><div className="field compact-field"><label htmlFor="sort-order">Sort by</label><select id="sort-order" value={value.sort} onChange={(e) => onChange({ ...value, sort: e.target.value as FilterState["sort"] })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="alphabetical">Title A–Z</option></select></div>{active && <button className="button ghost clear-filters" onClick={() => { setQuery(""); onChange({ q: "", tag: "", sort: "newest" }); }}>Clear filters</button>}</div>
  </section>;
}
