// Friendly empty state shown when no bookmarks are saved yet (US2 scenario 3).

export function EmptyState() {
  return (
    <div className="empty-state" data-testid="empty-state">
      <h2>No bookmarks yet</h2>
      <p>Paste a web address above and press Save to keep your first link.</p>
    </div>
  );
}
