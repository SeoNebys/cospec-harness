import { useState, type FormEvent } from 'react';
import type { Bookmark, NewBookmarkInput } from '../models/bookmark';
import { ValidationError } from '../models/bookmark';
import { isValidUrl } from '../lib/url';
import { findByUrl } from '../data/bookmarkRepository';

interface BookmarkFormProps {
  initial?: Bookmark; // present => edit mode
  onSave: (input: NewBookmarkInput) => Promise<void>;
  onCancel: () => void;
}

// Add/edit form (FR-001, FR-002, FR-003, FR-007). Warns on duplicate addresses
// but still allows saving (FR-013).
export function BookmarkForm({ initial, onSave, onCancel }: BookmarkFormProps) {
  const isEdit = initial !== undefined;
  const [url, setUrl] = useState(initial?.url ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(', '));
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [saving, setSaving] = useState(false);

  const parseTags = (): string[] =>
    tagsText
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '');

  // Warn when the entered address already exists on another bookmark (FR-013).
  const checkDuplicate = async () => {
    if (!isValidUrl(url)) {
      setDuplicateWarning(false);
      return;
    }
    const matches = await findByUrl(url);
    const others = matches.filter((m) => m.id !== initial?.id);
    setDuplicateWarning(others.length > 0);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({ url, title, notes, tags: parseTags() });
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.message);
      } else {
        setError('Something went wrong while saving. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="bm-url">Web address</label>
        <input
          id="bm-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={checkDuplicate}
          placeholder="https://example.com/article"
          autoFocus
        />
      </div>

      <div className="field">
        <label htmlFor="bm-title">Title</label>
        <input
          id="bm-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Optional — defaults to the address"
        />
        <p className="hint">Leave blank to use the address as the title.</p>
      </div>

      <div className="field">
        <label htmlFor="bm-tags">Tags</label>
        <input
          id="bm-tags"
          type="text"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="Comma-separated, e.g. reading, work"
        />
      </div>

      <div className="field">
        <label htmlFor="bm-notes">Notes</label>
        <textarea
          id="bm-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
        />
      </div>

      {duplicateWarning && (
        <div className="form-warning" role="alert">
          You already have a bookmark with this address. You can still save it.
        </div>
      )}

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={saving}>
          {isEdit ? 'Save changes' : 'Save bookmark'}
        </button>
      </div>
    </form>
  );
}
