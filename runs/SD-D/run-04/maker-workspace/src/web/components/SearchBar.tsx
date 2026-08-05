import type { SortOrder, TagFilter } from '../../shared/types';
import type { TagInfo } from '../api/client';

// Search + filter controls (FR-009/FR-010/FR-011/FR-014). Text box (quote a
// phrase for exact match), a sort selector, and per-tag cycling chips that move
// through: neutral → any → all → not. The parent owns the filter state.

type TagMode = 'none' | 'any' | 'all' | 'not';

function modeOf(filter: TagFilter, tag: string): TagMode {
  if (filter.tagsNot?.includes(tag)) return 'not';
  if (filter.tagsAll?.includes(tag)) return 'all';
  if (filter.tagsAny?.includes(tag)) return 'any';
  return 'none';
}

function without(list: string[] | undefined, tag: string): string[] {
  return (list ?? []).filter((t) => t !== tag);
}

const NEXT: Record<TagMode, TagMode> = { none: 'any', any: 'all', all: 'not', not: 'none' };
const LABEL: Record<TagMode, string> = { none: '', any: 'any', all: 'all', not: 'not' };

export function SearchBar({
  filter,
  availableTags,
  onChange,
  onClear,
}: {
  filter: TagFilter;
  availableTags: TagInfo[];
  onChange: (next: TagFilter) => void;
  onClear: () => void;
}) {
  function cycleTag(tag: string) {
    const next = NEXT[modeOf(filter, tag)];
    const base: TagFilter = {
      ...filter,
      tagsAny: without(filter.tagsAny, tag),
      tagsAll: without(filter.tagsAll, tag),
      tagsNot: without(filter.tagsNot, tag),
    };
    if (next === 'any') base.tagsAny = [...(base.tagsAny ?? []), tag];
    else if (next === 'all') base.tagsAll = [...(base.tagsAll ?? []), tag];
    else if (next === 'not') base.tagsNot = [...(base.tagsNot ?? []), tag];
    onChange(base);
  }

  const hasFilter =
    !!filter.text ||
    (filter.tagsAny?.length ?? 0) > 0 ||
    (filter.tagsAll?.length ?? 0) > 0 ||
    (filter.tagsNot?.length ?? 0) > 0;

  return (
    <div className="search-bar">
      <div className="search-row">
        <input
          type="search"
          className="search-text"
          value={filter.text ?? ''}
          onChange={(e) => onChange({ ...filter, text: e.target.value })}
          placeholder='Search title, address, notes, tags… ("quote" for exact phrase)'
          aria-label="Search bookmarks"
        />
        <select
          className="sort-select"
          value={filter.sort ?? 'newest'}
          onChange={(e) => onChange({ ...filter, sort: e.target.value as SortOrder })}
          aria-label="Sort order"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">By title</option>
        </select>
        {hasFilter ? (
          <button type="button" className="secondary" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>

      {availableTags.length > 0 ? (
        <div className="tag-filter">
          <span className="tag-filter-hint">Tags (click to cycle any → all → not):</span>
          {availableTags.map((t) => {
            const mode = modeOf(filter, t.name);
            return (
              <button
                type="button"
                key={t.name}
                className={`tag-chip mode-${mode}`}
                onClick={() => cycleTag(t.name)}
                aria-pressed={mode !== 'none'}
              >
                {t.name}
                {mode !== 'none' ? <span className="mode-badge">{LABEL[mode]}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
