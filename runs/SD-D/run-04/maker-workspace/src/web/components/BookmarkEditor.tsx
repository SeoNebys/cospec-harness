import { useState } from 'react';
import type { CreateBookmarkInput } from '../../shared/types';
import { parseTags } from '../lib/tags';

// US1 save form. The address is all that's required; an optional "Add details"
// section lets a person set their own title, tags, and a note right at save time
// (FR-003). Reports validation errors and surfaces the "already saved" case (FR-023).

export interface SaveOutcome {
  existing: boolean;
}

export function BookmarkEditor({
  onSave,
}: {
  onSave: (input: CreateBookmarkInput) => Promise<SaveOutcome>;
}) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setUrl('');
    setTitle('');
    setTags('');
    setNotes('');
    setShowDetails(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const outcome = await onSave({
        url: url.trim(),
        title: title.trim() || undefined,
        tags: parseTags(tags),
        notes: notes.trim() || undefined,
      });
      if (outcome.existing) {
        setNote('You already saved this — showing your existing bookmark.');
      }
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that address.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="save-box">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a web address to save…"
          aria-label="Web address"
          autoFocus
        />
        <button type="submit" disabled={busy || !url.trim()}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>

      <button
        type="button"
        className="link-button"
        onClick={() => setShowDetails((v) => !v)}
        aria-expanded={showDetails}
      >
        {showDetails ? '− Hide details' : '+ Add title, tags, or a note'}
      </button>

      {showDetails ? (
        <div className="details-box">
          <label>
            Your title <span className="muted">(optional — otherwise we use the page’s)</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My own title for this"
            />
          </label>
          <label>
            Tags <span className="muted">(comma-separated)</span>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="recipes, dinner"
            />
          </label>
          <label>
            Note
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="A quick note to your future self…"
              rows={3}
            />
          </label>
        </div>
      ) : null}

      {error ? <div className="form-error">{error}</div> : null}
      {note ? <div className="form-note">{note}</div> : null}
    </form>
  );
}
