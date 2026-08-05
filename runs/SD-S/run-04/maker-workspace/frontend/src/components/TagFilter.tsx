import type { Tag } from "../types";

interface Props {
  tags: (Tag & { count: number })[];
  active: string | null;
  onSelect: (tag: string | null) => void;
}

/** Chips for filtering the collection by a single tag (FR-009). */
export function TagFilter({ tags, active, onSelect }: Props) {
  if (tags.length === 0) return null;
  return (
    <div className="tag-filter" data-testid="tag-filter">
      <span
        className={`chip ${active === null ? "active" : ""}`}
        onClick={() => onSelect(null)}
      >
        All
      </span>
      {tags.map((t) => (
        <span
          key={t.id}
          className={`chip ${active?.toLowerCase() === t.name.toLowerCase() ? "active" : ""}`}
          onClick={() => onSelect(t.name)}
          data-testid={`tag-filter-${t.name}`}
        >
          #{t.name} ({t.count})
        </span>
      ))}
    </div>
  );
}
