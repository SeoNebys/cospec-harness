interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

// Keyword search across title, address, and tags (FR-011).
export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <input
      className="search-bar"
      type="search"
      placeholder="Search bookmarks…"
      aria-label="Search bookmarks"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
