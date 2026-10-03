import React from 'react';

const SORTS = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['title_az', 'Title A–Z'],
  ['title_za', 'Title Z–A'],
  ['recently_updated', 'Recently updated'],
];

// Search box + sort control (US2). Shows the malformed-query message.
export default function SearchBar({ query, onQuery, sort, onSort, error }) {
  return (
    <div className="search-bar">
      <input
        className="search-input"
        type="search"
        value={query}
        placeholder='Search — e.g. #work AND ("release notes" OR changelog) NOT draft'
        onChange={(e) => onQuery(e.target.value)}
      />
      <select value={sort} onChange={(e) => onSort(e.target.value)} aria-label="Sort order">
        {SORTS.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
      {error && <p className="error search-error" role="alert">{error}</p>}
    </div>
  );
}
