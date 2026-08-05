interface Props {
  kind: "empty-collection" | "no-results";
}

/** Helpful empty state (new collection) or no-results state after a search (FR-007). */
export function EmptyState({ kind }: Props) {
  if (kind === "no-results") {
    return (
      <div className="empty" data-testid="no-results">
        <p>No bookmarks match your search or filter.</p>
        <p>Try a different term, or clear the filter.</p>
      </div>
    );
  }
  return (
    <div className="empty" data-testid="empty-collection">
      <p>No bookmarks yet.</p>
      <p>Paste a link above to save your first bookmark — the title fills in automatically.</p>
    </div>
  );
}
