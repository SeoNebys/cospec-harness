import type { SearchCriteria } from '../../../shared/contracts/search';
import type { CollectionOption } from '../collections/CollectionPicker';
type TagOption = { id: string; name: string };

export function SearchFilters({
  criteria,
  collections,
  tags,
  onChange,
}: {
  criteria: SearchCriteria;
  collections: CollectionOption[];
  tags: TagOption[];
  onChange(criteria: SearchCriteria): void;
}) {
  const addTag = (polarity: 'include' | 'exclude', id: string) => {
    if (!id) return;
    const includeTagIds = criteria.includeTagIds.filter((tagId) => tagId !== id);
    const excludeTagIds = criteria.excludeTagIds.filter((tagId) => tagId !== id);
    (polarity === 'include' ? includeTagIds : excludeTagIds).push(id);
    onChange({ ...criteria, includeTagIds, excludeTagIds });
  };
  const tagName = (id: string) => tags.find((tag) => tag.id === id)?.name ?? 'tag';

  return (
    <section className="search-filters" aria-label="Search filters">
      <div className="filter-row">
        <select
          aria-label="Favorite filter"
          value={criteria.favorite}
          onChange={(e) => onChange({ ...criteria, favorite: e.target.value as SearchCriteria['favorite'] })}
        >
          <option value="any">All favorites</option>
          <option value="favorite">Favorites only</option>
          <option value="not_favorite">Not favorites</option>
        </select>
        <select
          aria-label="Reading filter"
          value={criteria.reading}
          onChange={(e) => onChange({ ...criteria, reading: e.target.value as SearchCriteria['reading'] })}
        >
          <option value="any">Any reading state</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
          <option value="none">Not queued</option>
        </select>
        <select
          aria-label="Collection filter"
          value={criteria.collection.mode === 'id' ? criteria.collection.id : criteria.collection.mode}
          onChange={(e) =>
            onChange({
              ...criteria,
              collection:
                e.target.value === 'any' || e.target.value === 'unfiled'
                  ? { mode: e.target.value }
                  : { mode: 'id', id: e.target.value },
            })
          }
        >
          <option value="any">Any collection</option>
          <option value="unfiled">Unfiled</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort bookmarks"
          value={criteria.sort}
          onChange={(e) => onChange({ ...criteria, sort: e.target.value as SearchCriteria['sort'] })}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="title">Title</option>
          <option value="updated">Recently updated</option>
        </select>
      </div>
      <div className="tag-filter-row">
        <label>
          Include tag
          <select
            aria-label="Include tag"
            value=""
            onChange={(event) => addTag('include', event.target.value)}
          >
            <option value="">Choose…</option>
            {tags
              .filter(
                (tag) => !criteria.includeTagIds.includes(tag.id) && !criteria.excludeTagIds.includes(tag.id),
              )
              .map((tag) => (
                <option key={tag.id} value={tag.id}>
                  #{tag.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Exclude tag
          <select
            aria-label="Exclude tag"
            value=""
            onChange={(event) => addTag('exclude', event.target.value)}
          >
            <option value="">Choose…</option>
            {tags
              .filter(
                (tag) => !criteria.includeTagIds.includes(tag.id) && !criteria.excludeTagIds.includes(tag.id),
              )
              .map((tag) => (
                <option key={tag.id} value={tag.id}>
                  #{tag.name}
                </option>
              ))}
          </select>
        </label>
        <div className="active-filter-chips">
          {criteria.includeTagIds.map((id) => (
            <button
              key={`include-${id}`}
              onClick={() =>
                onChange({
                  ...criteria,
                  includeTagIds: criteria.includeTagIds.filter((value) => value !== id),
                })
              }
            >
              Includes #{tagName(id)} ×
            </button>
          ))}
          {criteria.excludeTagIds.map((id) => (
            <button
              key={`exclude-${id}`}
              onClick={() =>
                onChange({
                  ...criteria,
                  excludeTagIds: criteria.excludeTagIds.filter((value) => value !== id),
                })
              }
            >
              Excludes #{tagName(id)} ×
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
