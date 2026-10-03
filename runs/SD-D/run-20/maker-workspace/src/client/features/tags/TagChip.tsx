export function TagChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="tag-chip" onClick={onClick} aria-label={`Filter by tag ${label}`}>
      #{label}
    </button>
  );
}
