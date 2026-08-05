import type { TagCount } from "../api/client";

interface Props {
  tags: TagCount[];
  selected: string[];
  onToggle: (tag: string) => void;
}

export function TagFilter({ tags, selected, onToggle }: Props) {
  if (tags.length === 0) return null;
  return (
    <div className="tag-filter" role="group" aria-label="Filter by tag">
      {tags.map((t) => {
        const active = selected.includes(t.name);
        return (
          <button
            key={t.name}
            className={active ? "tag-chip tag-chip--active" : "tag-chip"}
            aria-pressed={active}
            onClick={() => onToggle(t.name)}
          >
            {t.name} <span className="tag-count">{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}
