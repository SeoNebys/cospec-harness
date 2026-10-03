import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';

import { createBookmarkSchema } from '../../shared/bookmark-schema.js';
import type { Bookmark, CreateBookmarkInput } from '../../shared/bookmark-types.js';
import { ApiClientError } from '../api.js';

interface BookmarkFormProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: Bookmark;
  onClose: () => void;
  onSubmit: (input: CreateBookmarkInput) => Promise<unknown>;
  onDuplicate?: (bookmarkId: number) => void;
}

export function BookmarkForm({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
  onDuplicate,
}: BookmarkFormProps) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '');
      setUrl(initial?.url ?? '');
      setNotes(initial?.notes ?? '');
      setTags(initial?.tags.join(', ') ?? '');
      setFieldErrors({});
      setFormError('');
    }
  }, [initial, open]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
      else dialog.setAttribute('open', '');
      titleRef.current?.focus();
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    const parsed = createBookmarkSchema.safeParse({
      title,
      url,
      notes,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setPending(true);
    try {
      await onSubmit(parsed.data);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFormError(error.message);
        setFieldErrors(error.fieldErrors ?? {});
        if (error.code === 'DUPLICATE_URL' && error.existingBookmarkId) {
          onDuplicate?.(error.existingBookmarkId);
        }
      } else {
        setFormError('Could not save the bookmark. Please try again.');
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <dialog
        ref={dialogRef}
        className="bookmark-dialog"
        aria-labelledby={headingId}
        onCancel={(event) => {
          event.preventDefault();
          if (!pending) onClose();
        }}
      >
        <form onSubmit={submit} noValidate>
          <div className="dialog-heading">
            <div>
              <p className="eyebrow">{mode === 'create' ? 'New bookmark' : 'Edit bookmark'}</p>
              <h2 id={headingId}>
                {mode === 'create' ? 'Save a useful link' : 'Update this link'}
              </h2>
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          {formError && (
            <p className="form-alert" role="alert">
              {formError}
            </p>
          )}
          <label>
            Title
            <input
              ref={titleRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={fieldErrors.title ? 'title-error' : undefined}
            />
          </label>
          {fieldErrors.title && (
            <p id="title-error" className="field-error">
              {fieldErrors.title[0]}
            </p>
          )}
          <label>
            Web address
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              inputMode="url"
              aria-invalid={Boolean(fieldErrors.url)}
              aria-describedby={fieldErrors.url ? 'url-error' : undefined}
              placeholder="https://example.com"
            />
          </label>
          {fieldErrors.url && (
            <p id="url-error" className="field-error">
              {fieldErrors.url[0]}
            </p>
          )}
          <label>
            Notes{' '}
            <span className="optional" aria-hidden="true">
              Optional
            </span>
            <textarea
              aria-label="Notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              aria-invalid={Boolean(fieldErrors.notes)}
            />
          </label>
          {fieldErrors.notes && <p className="field-error">{fieldErrors.notes[0]}</p>}
          <label>
            Tags{' '}
            <span className="optional" aria-hidden="true">
              Optional
            </span>
            <input
              aria-label="Tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="research, design, reading"
              aria-invalid={Boolean(fieldErrors.tags)}
            />
          </label>
          <p className="field-hint">Separate tags with commas.</p>
          {fieldErrors.tags && <p className="field-error">{fieldErrors.tags[0]}</p>}
          <div className="dialog-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={pending}>
              {pending ? 'Saving…' : mode === 'create' ? 'Save bookmark' : 'Save changes'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
