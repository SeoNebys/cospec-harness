import { Sort } from "../services/api";

interface Props {
  value: Sort;
  onChange: (sort: Sort) => void;
}

export function SortControl({ value, onChange }: Props) {
  return (
    <label className="sort-control">
      Sort
      <select value={value} onChange={(e) => onChange(e.target.value as Sort)} aria-label="Sort order">
        <option value="recent">Newest first</option>
        <option value="title">Title (A–Z)</option>
      </select>
    </label>
  );
}
