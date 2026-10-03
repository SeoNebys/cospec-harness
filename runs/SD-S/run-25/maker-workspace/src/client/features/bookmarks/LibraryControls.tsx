import { useEffect, useState } from 'react';

import type { SortOrder, Tag } from '../../../shared/contracts.js';

export interface LibraryControlsProps {
  query: string;
  selectedTags: readonly string[];
  sort: SortOrder;
  tags: readonly Tag[];
  onQueryChange: (query: string) => void;
  onTagsChange: (tags: string[]) => void;
  onSortChange: (sort: SortOrder) => void;
}

export function LibraryControls({
  query,
  selectedTags,
  sort,
  tags,
  onQueryChange,
  onTagsChange,
  onSortChange,
}: LibraryControlsProps) {
  const [draftQuery, setDraftQuery] = useState(query);

  useEffect(() => setDraftQuery(query), [query]);
  useEffect(() => {
    if (draftQuery === query) return;
    const timer = window.setTimeout(() => onQueryChange(draftQuery), 250);
    return () => window.clearTimeout(timer);
  }, [draftQuery, onQueryChange, query]);

  const toggleTag = (normalizedName: string, selected: boolean) => {
    onTagsChange(
      selected
        ? [...selectedTags, normalizedName]
        : selectedTags.filter((tag) => tag !== normalizedName),
    );
  };

  return (
    <section aria-label="Find and organize bookmarks">
      <label htmlFor="bookmark-search">Search bookmarks</label>
      <input
        id="bookmark-search"
        type="search"
        value={draftQuery}
        onChange={(event) => setDraftQuery(event.target.value)}
      />

      {tags.length > 0 && (
        <fieldset>
          <legend>Filter by tags</legend>
          {tags.map((tag) => (
            <label key={tag.normalizedName}>
              <input
                type="checkbox"
                checked={selectedTags.includes(tag.normalizedName)}
                onChange={(event) => toggleTag(tag.normalizedName, event.target.checked)}
              />
              {tag.name} ({tag.bookmarkCount})
            </label>
          ))}
        </fieldset>
      )}

      <label htmlFor="bookmark-sort">Sort bookmarks</label>
      <select
        id="bookmark-sort"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as SortOrder)}
      >
        <option value="newest">Newest saved</option>
        <option value="oldest">Oldest saved</option>
        <option value="title">Title A–Z</option>
      </select>

      {selectedTags.length > 0 && (
        <div aria-label="Active filters">
          {selectedTags.map((normalizedName) => {
            const label = tags.find((tag) => tag.normalizedName === normalizedName)?.name ?? normalizedName;
            return (
              <button
                key={normalizedName}
                type="button"
                aria-label={`Remove ${label} filter`}
                onClick={() => toggleTag(normalizedName, false)}
              >
                {label} ×
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
