interface EmptyStateProps {
  filtered?: boolean
  onAction: () => void
}

export function EmptyState({ filtered = false, onAction }: EmptyStateProps) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <div className="empty-mark" aria-hidden="true">↗</div>
      <p className="eyebrow">{filtered ? 'Nothing here yet' : 'A fresh collection'}</p>
      <h2 id="empty-title">{filtered ? 'No bookmarks match that' : 'Save your first good find'}</h2>
      <p>{filtered ? 'Try a different search or clear your filters to see everything.' : 'Keep links worth returning to, then find them by a word or a tag.'}</p>
      <button className="button primary" type="button" onClick={onAction}>
        {filtered ? 'Clear search and filter' : 'Add your first bookmark'}
      </button>
    </section>
  )
}
