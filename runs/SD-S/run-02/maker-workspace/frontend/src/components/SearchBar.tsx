interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  return (
    <input
      type="search"
      className="search-bar"
      placeholder="Search title, address, or tags…"
      aria-label="Search bookmarks"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
