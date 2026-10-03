export function StatusRegion({ message }: { message?: string | null }) {
  return <div className="status-region" role="status" aria-live="polite" aria-atomic="true">{message}</div>;
}
