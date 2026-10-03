import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Bookmark, CreateBookmarkInput, UpdateBookmarkInput } from '../../../shared/api-types';
import { createBookmarkSchema } from '../../../shared/bookmark-schemas';
import { ApiClientError } from '../../api';
import { TagInput } from './TagInput';

interface BookmarkFormProps { bookmark?: Bookmark; onSubmit: (input: CreateBookmarkInput | UpdateBookmarkInput) => Promise<void>; onCancel: () => void; }

export function BookmarkForm({ bookmark, onSubmit, onCancel }: BookmarkFormProps) {
  const [url, setUrl] = useState(bookmark?.url ?? '');
  const [title, setTitle] = useState(bookmark?.title ?? '');
  const [notes, setNotes] = useState(bookmark?.notes ?? '');
  const [tags, setTags] = useState(bookmark?.tags ?? []);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  useEffect(() => urlRef.current?.focus(), []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setFormError(null);
    const result = createBookmarkSchema.safeParse({ url, title, notes, tags, allowDuplicate: false });
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      setFieldErrors(errors);
      document.getElementById(`bookmark-${String(result.error.issues[0]?.path[0])}`)?.focus();
      return;
    }
    setFieldErrors({}); setSubmitting(true);
    try {
      const input = bookmark ? { url: result.data.url, title: result.data.title, notes: result.data.notes, tags: result.data.tags } : result.data;
      await onSubmit(input);
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.body.error.fieldErrors) setFieldErrors(caught.body.error.fieldErrors);
      else setFormError(caught instanceof Error ? caught.message : 'Could not save the bookmark.');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="form-backdrop" role="presentation">
      <section className="bookmark-form-panel" role="dialog" aria-modal="true" aria-labelledby="bookmark-form-title">
        <div className="panel-heading"><div><p className="eyebrow">{bookmark ? 'Update your library' : 'A new place to return to'}</p><h2 id="bookmark-form-title">{bookmark ? 'Edit bookmark' : 'Add a bookmark'}</h2></div><button className="icon-button" type="button" onClick={onCancel} aria-label="Close form">×</button></div>
        <form onSubmit={submit} noValidate>
          <div className="field-group"><label htmlFor="bookmark-url">Web address</label><input ref={urlRef} id="bookmark-url" type="url" value={url} maxLength={2048} onChange={(event) => setUrl(event.target.value)} aria-invalid={Boolean(fieldErrors.url)} aria-describedby={fieldErrors.url ? 'url-error' : undefined} placeholder="https://example.com/article" />{fieldErrors.url && <p className="field-error" id="url-error">{fieldErrors.url[0]}</p>}</div>
          <div className="field-group"><label htmlFor="bookmark-title">Title</label><input id="bookmark-title" value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? 'title-error' : 'title-hint'} placeholder="A title you'll recognize" /><small id="title-hint">Titles are entered by hand in this version.</small>{fieldErrors.title && <p className="field-error" id="title-error">{fieldErrors.title[0]}</p>}</div>
          <div className="field-group"><label htmlFor="bookmark-notes">Notes <span>Optional</span></label><textarea id="bookmark-notes" value={notes} maxLength={10000} rows={4} onChange={(event) => setNotes(event.target.value)} placeholder="Why is this worth saving?" />{fieldErrors.notes && <p className="field-error">{fieldErrors.notes[0]}</p>}</div>
          <TagInput tags={tags} onChange={setTags} error={fieldErrors.tags?.[0]} />
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="form-actions"><button className="button secondary" type="button" onClick={onCancel}>Cancel</button><button className="button primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : bookmark ? 'Save changes' : 'Save bookmark'}</button></div>
        </form>
      </section>
    </div>
  );
}
