interface Props {
  value: string;
  onChange: (sort: string) => void;
}

const OPTIONS: { value: string; label: string }[] = [
  { value: 'date_added_desc', label: 'Newest first' },
  { value: 'date_added_asc', label: 'Oldest first' },
  { value: 'date_modified_desc', label: 'Recently modified' },
  { value: 'title_asc', label: 'Title A–Z' },
  { value: 'title_desc', label: 'Title Z–A' },
  { value: 'unread_first', label: 'Unread first' },
];

export function SortMenu({ value, onChange }: Props) {
  return (
    <select style={{ width: 'auto' }} value={value} onChange={(e) => onChange(e.target.value)}>
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
