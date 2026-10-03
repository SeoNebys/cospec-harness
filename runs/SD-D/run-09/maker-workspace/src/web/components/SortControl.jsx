import React from 'react';

const OPTIONS = [
  ['dateAdded_desc', 'Newest first'],
  ['dateAdded_asc', 'Oldest first'],
  ['title_asc', 'Title A–Z'],
  ['title_desc', 'Title Z–A'],
  ['dateUpdated_desc', 'Recently updated'],
];

export function SortControl({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Sort order">
      {OPTIONS.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
