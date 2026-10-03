export type CollectionOption = { id: string; name: string };
export function CollectionPicker({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: CollectionOption[];
  onChange(value: string | null): void;
}) {
  return (
    <label>
      Collection <small>Optional</small>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">Unfiled</option>
        {options.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}
          </option>
        ))}
      </select>
    </label>
  );
}
