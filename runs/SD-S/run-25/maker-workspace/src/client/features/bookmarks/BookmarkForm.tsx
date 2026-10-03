import { useEffect, useRef, type FormEvent } from 'react';

import type { Bookmark } from '../../../shared/contracts.js';
import { useBookmarkForm } from './useBookmarkForm.js';

export interface BookmarkFormProps {
  onSaved: (bookmark: Bookmark) => void;
  onCancel?: () => void;
  bookmark?: Bookmark;
}

export function BookmarkForm({ onSaved, onCancel, bookmark }: BookmarkFormProps) {
  const form = useBookmarkForm(onSaved, bookmark);
  const urlRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (form.fieldErrors.url) urlRef.current?.focus();
    else if (form.fieldErrors.title) titleRef.current?.focus();
  }, [form.fieldErrors]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await form.submit();
  };

  const describedBy = (field: string) =>
    form.fieldErrors[field] ? `${field}-error` : undefined;

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div>
        <label htmlFor="bookmark-url">Web address</label>
        <input
          ref={urlRef}
          id="bookmark-url"
          name="url"
          type="url"
          value={form.fields.url}
          onChange={(event) => form.setUrl(event.target.value)}
          aria-invalid={Boolean(form.fieldErrors.url)}
          aria-describedby={describedBy('url')}
          autoFocus
        />
        {form.fieldErrors.url && <p id="url-error">{form.fieldErrors.url}</p>}
      </div>

      <p role="status" aria-live="polite">
        {form.metadataMessage}
      </p>

      <div>
        <label htmlFor="bookmark-title">Title</label>
        <input
          ref={titleRef}
          id="bookmark-title"
          name="title"
          value={form.fields.title}
          onChange={(event) => form.setTitle(event.target.value)}
          aria-invalid={Boolean(form.fieldErrors.title)}
          aria-describedby={describedBy('title')}
        />
        {form.fieldErrors.title && <p id="title-error">{form.fieldErrors.title}</p>}
      </div>

      <div>
        <label htmlFor="bookmark-description">Description</label>
        <textarea
          id="bookmark-description"
          name="description"
          value={form.fields.description}
          onChange={(event) => form.setDescription(event.target.value)}
          aria-invalid={Boolean(form.fieldErrors.description)}
          aria-describedby={describedBy('description')}
        />
        {form.fieldErrors.description && (
          <p id="description-error">{form.fieldErrors.description}</p>
        )}
      </div>

      <div>
        <label htmlFor="bookmark-tags">Tags</label>
        <input
          id="bookmark-tags"
          name="tags"
          value={form.fields.tags}
          onChange={(event) => form.setTags(event.target.value)}
          placeholder="research, design"
          aria-describedby="tags-hint"
        />
        <p id="tags-hint">Separate tags with commas.</p>
      </div>

      <div>
        <label htmlFor="bookmark-reading-state">Reading status</label>
        <select
          id="bookmark-reading-state"
          value={form.fields.readingState}
          onChange={(event) =>
            form.setReadingState(event.target.value as 'untracked' | 'to_read' | 'read')
          }
        >
          <option value="untracked">Untracked</option>
          <option value="to_read">To Read</option>
          <option value="read">Read</option>
        </select>
      </div>

      {form.submitMessage && !form.duplicate && <div role="alert">{form.submitMessage}</div>}
      {form.duplicate && (
        <div role="alert">
          <p>{form.submitMessage || 'This address is already saved.'}</p>
          <a
            href={form.duplicate.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open existing bookmark
          </a>
          <button type="button" onClick={() => void form.submit(true)}>
            Save anyway
          </button>
        </div>
      )}

      <div>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={form.submitting}>
          {form.submitting ? 'Saving…' : bookmark ? 'Save changes' : 'Save bookmark'}
        </button>
      </div>
    </form>
  );
}

export default BookmarkForm;
