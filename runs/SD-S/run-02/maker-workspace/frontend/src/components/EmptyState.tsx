interface Props {
  filtered: boolean;
  onClearFilters: () => void;
}

/** Shown when the list is empty — either no bookmarks yet, or none match filters. */
export function EmptyState({ filtered, onClearFilters }: Props) {
  if (filtered) {
    return (
      <div className="empty-state">
        <p>No bookmarks match your search or filters.</p>
        <button onClick={onClearFilters}>Clear filters</button>
      </div>
    );
  }
  return (
    <div className="empty-state">
      <h2>No bookmarks yet</h2>
      <p>Save your first link using the form above.</p>
    </div>
  );
}
