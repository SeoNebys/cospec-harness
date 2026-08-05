import { useCallback, useEffect, useState } from 'react';
import type { SavedSearch, TagFilter } from '../../shared/types';
import { api } from '../api/client';

// Save the current search+tag combination under a name and re-apply it in one
// click (FR-021). Applying re-runs it against the live collection (the parent
// just sets the filter). Rename/remove persist.

export function SavedSearchBar({
  currentFilter,
  onApply,
}: {
  currentFilter: TagFilter;
  onApply: (filter: TagFilter) => void;
}) {
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    const res = await api.listSavedSearches();
    setSaved(res.savedSearches);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasFilter =
    !!currentFilter.text ||
    (currentFilter.tagsAny?.length ?? 0) > 0 ||
    (currentFilter.tagsAll?.length ?? 0) > 0 ||
    (currentFilter.tagsNot?.length ?? 0) > 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.createSavedSearch({
      name: name.trim(),
      queryText: currentFilter.text ?? '',
      filter: currentFilter,
    });
    setName('');
    await load();
  }

  async function rename(s: SavedSearch) {
    const next = window.prompt('Rename saved search:', s.name);
    if (next && next.trim() && next.trim() !== s.name) {
      await api.updateSavedSearch(s.id, { name: next.trim() });
      await load();
    }
  }

  async function remove(s: SavedSearch) {
    if (window.confirm(`Remove saved search “${s.name}”?`)) {
      await api.deleteSavedSearch(s.id);
      await load();
    }
  }

  return (
    <div className="saved-search-bar">
      {saved.length > 0 ? (
        <div className="saved-list">
          <span className="saved-label">Saved:</span>
          {saved.map((s) => (
            <span key={s.id} className="saved-item">
              <button
                type="button"
                className="saved-apply"
                onClick={() => onApply({ ...s.filter, text: s.queryText })}
                title="Apply this saved search"
              >
                {s.name}
              </button>
              <button
                type="button"
                className="saved-mini"
                onClick={() => void rename(s)}
                aria-label={`Rename ${s.name}`}
              >
                ✎
              </button>
              <button
                type="button"
                className="saved-mini"
                onClick={() => void remove(s)}
                aria-label={`Remove ${s.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {hasFilter ? (
        <form className="saved-save" onSubmit={save}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this search…"
            aria-label="Name for saved search"
          />
          <button type="submit" disabled={!name.trim()}>
            Save search
          </button>
        </form>
      ) : null}
    </div>
  );
}
