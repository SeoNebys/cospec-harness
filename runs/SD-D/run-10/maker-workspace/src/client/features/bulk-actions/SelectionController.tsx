export function SelectionController({
  selectedCount,
  total,
  allMatches,
  onSelectAll,
  onPromote,
  onClear,
}: {
  selectedCount: number;
  total: number;
  allMatches: boolean;
  onSelectAll(): void;
  onPromote(): void;
  onClear(): void;
}) {
  return (
    <div className="selection-strip" role="status">
      <strong>{allMatches ? `All ${total} matches selected` : `${selectedCount} selected`}</strong>
      {!allMatches && selectedCount > 0 && selectedCount < total && (
        <button onClick={onPromote}>Select all {total} matches</button>
      )}
      <button onClick={onSelectAll}>Select visible</button>
      <button onClick={onClear}>Clear</button>
    </div>
  );
}
