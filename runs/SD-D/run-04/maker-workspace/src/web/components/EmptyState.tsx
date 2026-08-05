// Reusable empty / no-results state (FR-024). Variant text is caller-supplied so
// each view (main, read-later, archived, search) shows its own message.

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}
