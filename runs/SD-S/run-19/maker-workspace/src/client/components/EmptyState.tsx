interface EmptyStateProps {
  hasCriteria?: boolean;
  onClear?: () => void;
}

export function EmptyState({ hasCriteria = false, onClear }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-glyph" aria-hidden="true">⌁</div>
      <h3>{hasCriteria ? 'No bookmarks match that.' : 'Nothing saved yet.'}</h3>
      <p>{hasCriteria ? 'Try a broader search or clear the active filter.' : 'Paste your first link above. Its title will arrive automatically.'}</p>
      {hasCriteria && onClear ? <button className="secondary-button" type="button" onClick={onClear}>Clear search and filters</button> : null}
    </div>
  );
}
