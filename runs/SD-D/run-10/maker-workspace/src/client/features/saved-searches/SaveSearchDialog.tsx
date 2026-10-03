import { useState } from 'react';
import type { SearchCriteria } from '../../../shared/contracts/search';
import { ApiError } from '../../app/api-client';
import { useDialogFocus } from '../../components/useDialogFocus';

export function SaveSearchDialog({
  criteria,
  onCancel,
  onSave,
}: {
  criteria: SearchCriteria;
  onCancel(): void;
  onSave(name: string): Promise<void>;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useDialogFocus<HTMLElement>(onCancel);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave(name);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.problem.detail : 'The search could not be saved.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="confirm-overlay">
      <section
        ref={dialogRef}
        className="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-search-title"
      >
        <p className="eyebrow">Reusable live view</p>
        <h2 id="save-search-title">Save this search</h2>
        <p className="muted">
          {criteria.query || 'All bookmarks'} · {criteria.includeTagIds.length} included tags ·{' '}
          {criteria.excludeTagIds.length} excluded tags
        </p>
        <label>
          Name
          <input autoFocus maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        {error && (
          <p className="message message--error" role="alert">
            {error}
          </p>
        )}
        <div className="detail-actions">
          <button className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="button button--primary"
            disabled={!name.trim() || busy}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : 'Save search'}
          </button>
        </div>
      </section>
    </div>
  );
}
