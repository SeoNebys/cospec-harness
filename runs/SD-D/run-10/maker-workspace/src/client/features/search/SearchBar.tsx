export function SearchBar({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange(value: string): void;
  error?: string;
}) {
  return (
    <div className="search-box">
      <span>⌕</span>
      <input
        aria-label="Search bookmarks"
        value={value}
        placeholder='Search words, "exact phrases", #tags, AND / OR / NOT'
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button aria-label="Clear search" onClick={() => onChange('')}>
          ×
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
