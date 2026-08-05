import type { SavedSearch } from '@shared/types'

// The search/filter controls (US5): a keyword box (quotes = exact phrase), the
// active tag filter, and saved searches you can reopen or remove. The actual
// querying and results live in the Collection; this is the control surface.
export function Search({
  query,
  onQueryChange,
  tagFilter,
  onClearTag,
  onClearAll,
  canSave,
  onSaveSearch,
  savedSearches,
  activeSavedId,
  onRunSaved,
  onDeleteSaved
}: {
  query: string
  onQueryChange: (s: string) => void
  tagFilter: string | null
  onClearTag: () => void
  onClearAll: () => void
  canSave: boolean
  onSaveSearch: () => void
  savedSearches: SavedSearch[]
  activeSavedId: string | null
  onRunSaved: (id: string) => void
  onDeleteSaved: (id: string) => void
}): JSX.Element {
  const searching = !!query.trim() || !!tagFilter || !!activeSavedId

  return (
    <div className="search">
      <div className="search-row">
        <input
          type="search"
          className="search-box"
          placeholder='Search title, description, notes, tags, address…  (use "quotes" for an exact phrase)'
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        {canSave && (
          <button className="secondary" onClick={onSaveSearch}>
            Save this search
          </button>
        )}
        {searching && (
          <button className="secondary" onClick={onClearAll}>
            Clear
          </button>
        )}
      </div>

      {tagFilter && (
        <div className="active-filter">
          Filtered by tag:
          <span className="tag-chip">
            {tagFilter}
            <button type="button" className="chip-x" onClick={onClearTag} aria-label="Clear tag filter">
              ×
            </button>
          </span>
        </div>
      )}

      {savedSearches.length > 0 && (
        <div className="saved-searches">
          <span className="saved-label">Saved:</span>
          {savedSearches.map((s) => (
            <span key={s.id} className={`tag-chip clickable-wrap${s.id === activeSavedId ? ' active' : ''}`}>
              <button type="button" className="saved-run" onClick={() => onRunSaved(s.id)}>
                {s.name}
              </button>
              <button
                type="button"
                className="chip-x"
                onClick={() => onDeleteSaved(s.id)}
                aria-label={`Delete saved search ${s.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
