// Search input (with quoted-phrase support) and sort toggle (US3, FR-009/013).

import type { SortOrder } from "../api/client";

interface Props {
  query: string;
  sort: SortOrder;
  onQueryChange: (q: string) => void;
  onSortChange: (s: SortOrder) => void;
}

export function SearchBar({ query, sort, onQueryChange, onSortChange }: Props) {
  return (
    <div className="search-bar">
      <input
        type="search"
        className="search-input"
        placeholder={'Search title, notes, tags…  (use "quotes" for an exact phrase)'}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label="Search bookmarks"
        data-testid="search-input"
      />
      <label className="sort-control">
        Sort:{" "}
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortOrder)}
          data-testid="sort-select"
        >
          <option value="recent">Newest first</option>
          <option value="title">Title A–Z</option>
        </select>
      </label>
    </div>
  );
}
