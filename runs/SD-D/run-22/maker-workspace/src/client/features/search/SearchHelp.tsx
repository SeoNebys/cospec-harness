export function SearchHelp() {
  return (
    <details className="search-help">
      <summary>Search syntax</summary>
      <div>
        <p>Use ordinary words for broad search and quotes for an exact phrase.</p>
        <code>"ancient Rome"</code>
        <code>tag:book</code>
        <code>Rome tag:(article|book)</code>
      </div>
    </details>
  );
}
