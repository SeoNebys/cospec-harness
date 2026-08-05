// Saved searches (US7, FR-019): save the current filter combo, reopen in a click.

import type { SavedSearch } from "../api/client";

interface Props {
  searches: SavedSearch[];
  /** true when there is an active filter worth saving */
  canSave: boolean;
  onApply: (search: SavedSearch) => void;
  onSave: () => void;
  onDelete: (search: SavedSearch) => void;
}

export function SavedSearches({ searches, canSave, onApply, onSave, onDelete }: Props) {
  if (searches.length === 0 && !canSave) return null;

  return (
    <div className="saved-searches" data-testid="saved-searches">
      <span className="saved-searches-label">Saved:</span>
      {searches.map((s) => (
        <span key={s.id} className="saved-search-chip">
          <button
            type="button"
            className="saved-search-apply"
            onClick={() => onApply(s)}
            data-testid={`apply-saved-${s.id}`}
          >
            {s.name}
          </button>
          <button
            type="button"
            className="saved-search-remove"
            aria-label={`Delete saved search ${s.name}`}
            onClick={() => onDelete(s)}
          >
            ×
          </button>
        </span>
      ))}
      {canSave && (
        <button
          type="button"
          className="link-button"
          onClick={onSave}
          data-testid="save-current-search"
        >
          + Save this search
        </button>
      )}
    </div>
  );
}
