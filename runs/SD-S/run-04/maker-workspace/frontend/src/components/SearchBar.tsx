interface Props {
  value: string;
  onChange: (v: string) => void;
}

/** Free-text search across title/address/note (FR-006). */
export function SearchBar({ value, onChange }: Props) {
  return (
    <input
      type="text"
      className="search"
      placeholder="Search your bookmarks…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid="search-input"
      aria-label="Search bookmarks"
    />
  );
}
