// Reusable empty-state message shown wherever a list has no items (FR-033):
// the main collection when nothing is saved yet, and later the archived view,
// search results, and the unread filter.
export function EmptyState({ title, hint }: { title: string; hint?: string }): JSX.Element {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {hint && <p>{hint}</p>}
    </div>
  )
}
