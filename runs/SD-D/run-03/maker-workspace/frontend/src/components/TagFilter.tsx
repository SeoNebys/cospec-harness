// Multi-tag filter: click a tag to cycle none -> include -> exclude -> none.
// Included tags match any-of (OR); excluded tags are removed (NOT). (US3, FR-010)

interface Props {
  availableTags: string[];
  include: string[];
  exclude: string[];
  onCycle: (tag: string) => void;
}

export function TagFilter({ availableTags, include, exclude, onCycle }: Props) {
  if (availableTags.length === 0) return null;

  function state(tag: string): "include" | "exclude" | "none" {
    if (include.includes(tag)) return "include";
    if (exclude.includes(tag)) return "exclude";
    return "none";
  }

  return (
    <div className="tag-filter" data-testid="tag-filter">
      <span className="tag-filter-label">Tags:</span>
      {availableTags.map((tag) => (
        <button
          key={tag}
          type="button"
          className={`tag-chip tag-chip--${state(tag)}`}
          onClick={() => onCycle(tag)}
          data-testid={`tag-filter-${tag}`}
          title="Click to include, again to exclude, again to clear"
        >
          {state(tag) === "exclude" ? "−" : state(tag) === "include" ? "✓" : ""} {tag}
        </button>
      ))}
      <span className="tag-filter-hint">click: include ✓ → exclude − → off</span>
    </div>
  );
}
