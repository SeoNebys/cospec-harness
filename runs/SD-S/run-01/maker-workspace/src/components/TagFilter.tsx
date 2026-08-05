interface TagFilterProps {
  tags: string[];
  selected: string;
  onChange: (tag: string) => void;
}

// Filter bookmarks by tag (FR-010). Empty value means "all tags".
export function TagFilter({ tags, selected, onChange }: TagFilterProps) {
  if (tags.length === 0) return null;

  return (
    <select
      className="tag-filter"
      aria-label="Filter by tag"
      value={selected}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">All tags</option>
      {tags.map((tag) => (
        <option key={tag} value={tag}>
          {tag}
        </option>
      ))}
    </select>
  );
}
