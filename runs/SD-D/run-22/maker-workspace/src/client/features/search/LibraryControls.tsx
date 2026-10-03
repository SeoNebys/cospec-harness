import type { SortField, SortOrder } from '../bookmarks/types';

export interface TagOption {
  name: string;
  count: number;
}
interface Props {
  tags: TagOption[];
  selectedTags: string[];
  sort: SortField;
  order: SortOrder;
  onTagsChange: (tags: string[]) => void;
  onSortChange: (sort: SortField, order: SortOrder) => void;
}

export function LibraryControls({
  tags,
  selectedTags,
  sort,
  order,
  onTagsChange,
  onSortChange,
}: Props) {
  const sortValue = `${sort}:${order}`;
  return (
    <div className="library-controls">
      <fieldset>
        <legend>Filter by tag</legend>
        <div className="filter-pills">
          {tags.length ? (
            tags.map((tag) => {
              const checked = selectedTags.includes(tag.name);
              return (
                <label className={`filter-pill ${checked ? 'selected' : ''}`} key={tag.name}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onTagsChange(
                        checked
                          ? selectedTags.filter((item) => item !== tag.name)
                          : [...selectedTags, tag.name],
                      )
                    }
                  />
                  <span>{tag.name}</span>
                  <small>{tag.count}</small>
                </label>
              );
            })
          ) : (
            <span className="muted">No tags yet</span>
          )}
        </div>
        {selectedTags.length ? (
          <button className="text-button" type="button" onClick={() => onTagsChange([])}>
            Clear tag filters
          </button>
        ) : null}
      </fieldset>
      <div className="sort-control">
        <label htmlFor="library-sort">Sort</label>
        <select
          id="library-sort"
          value={sortValue}
          onChange={(e) => {
            const [nextSort, nextOrder] = e.target.value.split(':') as [SortField, SortOrder];
            onSortChange(nextSort, nextOrder);
          }}
        >
          <option value="createdAt:desc">Newest saved</option>
          <option value="createdAt:asc">Oldest saved</option>
          <option value="title:asc">Title A–Z</option>
          <option value="title:desc">Title Z–A</option>
        </select>
      </div>
    </div>
  );
}
