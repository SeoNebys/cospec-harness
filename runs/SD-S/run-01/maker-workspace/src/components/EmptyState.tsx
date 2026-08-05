interface EmptyStateProps {
  variant: 'empty' | 'no-results';
  onAdd?: () => void;
}

// Friendly empty state (FR-012): distinguishes "nothing saved yet" from
// "your search/filter matched nothing".
export function EmptyState({ variant, onAdd }: EmptyStateProps) {
  if (variant === 'no-results') {
    return (
      <div className="empty-state" role="status">
        <p>No bookmarks match your search or filter.</p>
      </div>
    );
  }

  return (
    <div className="empty-state" role="status">
      <p>You haven’t saved any bookmarks yet.</p>
      {onAdd && (
        <button className="primary" onClick={onAdd}>
          Add your first bookmark
        </button>
      )}
    </div>
  );
}
