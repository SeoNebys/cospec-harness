interface EmptyStateProps {
  filtered?: boolean;
  onReset?: () => void;
}

export function EmptyState({ filtered = false, onReset }: EmptyStateProps) {
  if (filtered) {
    return (
      <section className="empty-state">
        <span className="empty-glyph">⌁</span>
        <h2>No links match this view</h2>
        <p>Try a broader search or clear the filters to see your collection again.</p>
        {onReset && (
          <button className="button secondary" onClick={onReset}>
            Reset search and filters
          </button>
        )}
      </section>
    );
  }
  return (
    <section className="empty-state">
      <span className="empty-glyph">↗</span>
      <h2>Save your first useful link</h2>
      <p>Keep articles, references, and ideas here so they are easy to find when you need them.</p>
    </section>
  );
}
