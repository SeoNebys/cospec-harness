"use client";
import type { Tag } from "@/lib/bookmarks/types";
export function BookmarkFilters({
  q,
  setQ,
  tag,
  setTag,
  reading,
  setReading,
  sort,
  setSort,
  tags
}: {
  q: string;
  setQ: (v: string) => void;
  tag: string;
  setTag: (v: string) => void;
  reading: string;
  setReading: (v: string) => void;
  sort: string;
  setSort: (v: string) => void;
  tags: Tag[];
}) {
  return (
    <div className="filters">
      <div className="search">
        <span>⌕</span>
        <input
          aria-label="Search bookmarks"
          placeholder="Search your shelf…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button aria-label="Clear search" onClick={() => setQ("")}>
            ×
          </button>
        )}
      </div>
      <select
        aria-label="Filter by tag"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
      >
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t.id} value={t.name}>
            {t.name} ({t.bookmarkCount})
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by reading status"
        value={reading}
        onChange={(e) => setReading(e.target.value)}
      >
        <option value="">Any status</option>
        <option value="to_read">To read</option>
        <option value="read">Read</option>
      </select>
      <select
        aria-label="Sort bookmarks"
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      >
        <option value="created_desc">Recently added</option>
        <option value="updated_desc">Recently updated</option>
        <option value="title_asc">Title A–Z</option>
      </select>
    </div>
  );
}
