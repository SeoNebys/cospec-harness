export function SortControl({
  sort,
  direction,
  onChange,
}: {
  sort: 'savedAt' | 'title';
  direction: 'asc' | 'desc';
  onChange: (sort: 'savedAt' | 'title', direction: 'asc' | 'desc') => void;
}) {
  const value = `${sort}-${direction}`;
  return (
    <label className="sort-label">
      Sort{' '}
      <select
        aria-label="Sort bookmarks"
        value={value}
        onChange={(event) => {
          const [nextSort, nextDirection] = event.target.value.split('-') as [
            'savedAt' | 'title',
            'asc' | 'desc',
          ];
          onChange(nextSort, nextDirection);
        }}
      >
        <option value="savedAt-desc">Newest saved</option>
        <option value="savedAt-asc">Oldest saved</option>
        <option value="title-asc">Title A–Z</option>
        <option value="title-desc">Title Z–A</option>
      </select>
    </label>
  );
}
