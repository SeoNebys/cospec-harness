import { useState, type FormEvent } from 'react';
import { SearchHelp } from './SearchHelp';

interface Props {
  value: string;
  labels?: string[];
  error?: { message: string; span?: { start: number; end: number } } | null;
  onSearch: (query: string) => void;
  onReset: () => void;
}

export function SearchBar({ value, labels = [], error, onSearch, onReset }: Props) {
  const [draft, setDraft] = useState(value);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(draft.trim());
  }
  return (
    <div className="search-region">
      <form className="search-form" role="search" onSubmit={submit}>
        <label className="sr-only" htmlFor="library-search">
          Search bookmarks
        </label>
        <span className="search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          id="library-search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={'Search bookmarks, try "ancient Rome" or tag:book'}
          aria-describedby={error ? 'search-error' : 'search-guidance'}
          aria-invalid={Boolean(error)}
        />
        <button className="button primary compact" type="submit">
          Search
        </button>
        {(value || draft) && (
          <button
            className="button ghost compact"
            type="button"
            onClick={() => {
              setDraft('');
              onReset();
            }}
          >
            Clear
          </button>
        )}
      </form>
      <div className="search-meta">
        <SearchHelp />
        <span id="search-guidance">Terms combine to narrow your results.</span>
      </div>
      {error ? (
        <p id="search-error" className="inline-error" role="alert">
          {error.message}
          {error.span ? ` (characters ${error.span.start + 1}–${error.span.end})` : ''}
        </p>
      ) : null}
      {labels.length ? (
        <div className="active-conditions" aria-label="Active search conditions">
          <span>Showing:</span>
          {labels.map((label) => (
            <span className="condition-pill" key={label}>
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
