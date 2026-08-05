interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="search-bar">
      <input
        type="search"
        placeholder="Search title, address, note, or tags…"
        aria-label="Search bookmarks"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
