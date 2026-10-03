import { useRef, useState, type FormEvent, type ClipboardEvent } from 'react';
import type { Bookmark, BookmarkInput } from '../../../shared/contracts/bookmarks';
import { ApiError } from '../../api/client';
import { createBookmark, updateBookmark } from './bookmark-api';
import { useTitlePreview } from './useTitlePreview';
import { DuplicateDialog } from './DuplicateDialog';

const blank = { url: '', title: '', notes: '', tags: '', isFavorite: false };

export function BookmarkForm({
  initial,
  onClose,
  onSaved,
  onEditExisting,
}: {
  initial?: Bookmark;
  onClose: () => void;
  onSaved: (bookmark: Bookmark) => void;
  onEditExisting: (bookmark: Bookmark) => void;
}) {
  const [form, setForm] = useState(
    initial
      ? {
          url: initial.url,
          title: initial.title,
          notes: initial.notes,
          tags: initial.tags.map((t) => t.name).join(', '),
          isFavorite: initial.isFavorite,
        }
      : blank,
  );
  const [titleDirty, setTitleDirty] = useState(Boolean(initial));
  const stateRef = useRef({ title: form.title, dirty: titleDirty });
  stateRef.current = { title: form.title, dirty: titleDirty };
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [duplicate, setDuplicate] = useState<Bookmark | null>(null);
  const pending = useRef<BookmarkInput | null>(null);
  const preview = useTitlePreview(
    (title) => setForm((value) => ({ ...value, title })),
    () => !stateRef.current.dirty && !stateRef.current.title,
  );
  function titleLookup(url: string) {
    window.setTimeout(() => preview.request(url), 120);
  }
  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').trim();
    if (!stateRef.current.dirty && !stateRef.current.title) titleLookup(pasted);
  }
  function input(allowDuplicate = false): BookmarkInput {
    return {
      url: form.url,
      title: form.title,
      notes: form.notes,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      isFavorite: form.isFavorite,
      allowDuplicate,
    };
  }
  async function save(payload: BookmarkInput) {
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      onSaved(initial ? await updateBookmark(initial.id, payload) : await createBookmark(payload));
    } catch (value) {
      if (value instanceof ApiError && value.status === 409 && value.problem.existingBookmark) {
        pending.current = payload;
        setDuplicate(value.problem.existingBookmark as Bookmark);
      } else if (value instanceof ApiError && value.problem.issues)
        setFieldErrors(Object.fromEntries(value.problem.issues.map((i) => [i.field, i.message])));
      else setError(value instanceof Error ? value.message : 'Could not save this bookmark.');
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void save(input());
  }
  return (
    <>
      <div className="dialog-backdrop" role="presentation">
        <form
          className="dialog bookmark-form"
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-title"
          onSubmit={submit}
        >
          <header className="dialog-header">
            <div>
              <p className="eyebrow">{initial ? 'Make a change' : 'Add to your collection'}</p>
              <h2 id="form-title">{initial ? 'Edit bookmark' : 'Save something good'}</h2>
            </div>
            <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>
          <label>
            Web address <span className="required">Required</span>
            <input
              autoFocus
              name="url"
              type="url"
              maxLength={2048}
              required
              value={form.url}
              onPaste={onPaste}
              onBlur={() => titleLookup(form.url)}
              onChange={(e) => {
                setForm({ ...form, url: e.target.value });
                if (e.target.value !== form.url) preview.cancel();
              }}
              placeholder="https://example.com/article"
            />
            {fieldErrors.url && <small className="field-error">{fieldErrors.url}</small>}
          </label>
          <label>
            Title <span className="required">Required</span>
            <input
              name="title"
              maxLength={300}
              required
              value={form.title}
              onChange={(e) => {
                setTitleDirty(Boolean(e.target.value));
                preview.cancel();
                setForm({ ...form, title: e.target.value });
              }}
              placeholder="We’ll try to find this for you"
            />
            <small className={`title-status ${preview.status}`}>
              {preview.status === 'loading'
                ? 'Finding the page title…'
                : preview.status === 'failed'
                  ? 'We couldn’t find a title. Add one above to keep saving.'
                  : 'Paste a link and we’ll suggest a title automatically.'}
            </small>
            {fieldErrors.title && <small className="field-error">{fieldErrors.title}</small>}
          </label>
          <label>
            Notes <span className="optional">Optional</span>
            <textarea
              maxLength={5000}
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Why is this worth keeping?"
            />
          </label>
          <label>
            Tags <span className="optional">Comma separated</span>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="design, reading, inspiration"
            />
            {fieldErrors.tags && <small className="field-error">{fieldErrors.tags}</small>}
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={form.isFavorite}
              onChange={(e) => setForm({ ...form, isFavorite: e.target.checked })}
            />
            <span>Mark as a favorite</span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <footer className="dialog-actions">
            <button type="button" className="button ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy || (preview.status === 'loading' && false)}
            >
              {busy ? 'Saving…' : initial ? 'Save changes' : 'Save bookmark'}
            </button>
          </footer>
        </form>
      </div>
      {duplicate && (
        <DuplicateDialog
          existing={duplicate}
          onCancel={() => setDuplicate(null)}
          onEdit={() => {
            setDuplicate(null);
            onEditExisting(duplicate);
          }}
          onContinue={() => {
            setDuplicate(null);
            void save({ ...pending.current!, allowDuplicate: true });
          }}
        />
      )}
    </>
  );
}
