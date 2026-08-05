// Search input for filtering bookmarks by keyword (FR-007).
export function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="search-bar">
      <input
        type="search"
        placeholder="Search title, address, or tag…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search bookmarks"
      />
      {value && (
        <button
          type="button"
          className="clear"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
