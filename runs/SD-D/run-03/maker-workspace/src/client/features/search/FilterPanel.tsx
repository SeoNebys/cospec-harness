import type { Scope, SortOrder, TagSummary } from "../../lib/api";
import type { ViewState } from "../../lib/view-state";

export interface FilterPanelProps {
  view: ViewState;
  tags: TagSummary[];
  onChange: (next: ViewState) => void;
}

const sorts: Array<{ value: SortOrder; label: string }> = [
  { value: "created_desc", label: "Newest saved" },
  { value: "created_asc", label: "Oldest saved" },
  { value: "updated_desc", label: "Recently modified" },
  { value: "title_asc", label: "Title" },
];

function nullableBoolean(value: string): boolean | null {
  return value === "true" ? true : value === "false" ? false : null;
}

function withReset(view: ViewState, changes: Partial<ViewState>): ViewState {
  return { ...view, ...changes, cursor: null, savedViewId: null };
}

export function FilterPanel({ view, tags, onChange }: FilterPanelProps) {
  function toggleTag(name: string, selected: boolean) {
    const next = selected
      ? [...view.tags, name]
      : view.tags.filter((candidate) => candidate !== name);
    onChange(withReset(view, { tags: Array.from(new Set(next)) }));
  }

  return (
    <div className="filter-panel">
      {tags.length ? (
        <fieldset className="filter-group filter-group--tags">
          <legend>Tags — all selected are required</legend>
          <div className="filter-tags">
            {tags.map((tag) => (
              <label key={tag.id}>
                <input
                  type="checkbox"
                  checked={view.tags.includes(tag.name)}
                  onChange={(event) => toggleTag(tag.name, event.currentTarget.checked)}
                />
                <span>{tag.name}</span>
                <small>{tag.activeBookmarkCount}</small>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="filter-selects">
        <label>
          <span>Favorite filter</span>
          <select
            value={view.favorite === null ? "any" : String(view.favorite)}
            onChange={(event) =>
              onChange(withReset(view, { favorite: nullableBoolean(event.currentTarget.value) }))
            }
          >
            <option value="any">Any</option>
            <option value="true">Favorites only</option>
            <option value="false">Not favorites</option>
          </select>
        </label>

        {view.scope !== ("read_later" satisfies Scope) ? (
          <label>
            <span>Reading filter</span>
            <select
              value={view.unread === null ? "any" : String(view.unread)}
              onChange={(event) =>
                onChange(withReset(view, { unread: nullableBoolean(event.currentTarget.value) }))
              }
            >
              <option value="any">Any</option>
              <option value="true">Read Later</option>
              <option value="false">Read</option>
            </select>
          </label>
        ) : null}

        <label>
          <span>Sort bookmarks</span>
          <select
            value={view.sort}
            onChange={(event) =>
              onChange(withReset(view, { sort: event.currentTarget.value as SortOrder }))
            }
          >
            {sorts.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
