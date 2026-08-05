import type { Tag } from '../api';

// Tag-filter control: click a tag to filter the list to it; counts show how many
// bookmarks carry each. Rename/remove act on the tag everywhere (FR-009, FR-010).
export function TagFilter({
  tags,
  active,
  onSelect,
  onRename,
  onRemove,
}: {
  tags: Tag[];
  active: string | null;
  onSelect: (name: string | null) => void;
  onRename: (tag: Tag) => void;
  onRemove: (tag: Tag) => void;
}) {
  if (tags.length === 0) return null;

  return (
    <div className="tag-filter">
      <button
        type="button"
        className={active === null ? 'chip active' : 'chip'}
        onClick={() => onSelect(null)}
      >
        All
      </button>
      {tags.map((t) => (
        <span key={t.id} className="chip-group">
          <button
            type="button"
            className={active === t.name ? 'chip active' : 'chip'}
            onClick={() => onSelect(t.name)}
          >
            {t.name} <span className="count">{t.count}</span>
          </button>
          <button
            type="button"
            className="mini"
            title="Rename tag"
            onClick={() => onRename(t)}
          >
            ✎
          </button>
          <button
            type="button"
            className="mini"
            title="Remove tag"
            onClick={() => onRemove(t)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
