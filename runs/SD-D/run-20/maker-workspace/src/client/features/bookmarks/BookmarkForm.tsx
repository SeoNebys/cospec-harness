import { useState } from 'react';
import type { BookmarkDto } from '../../../shared/schemas/api';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { StatusMessage } from '../../components/StatusMessage';
import { api } from '../../lib/api';
import { NoteEditor } from '../editor/NoteEditor';
import { TagAutocomplete } from '../tags/TagAutocomplete';
import { useBookmarkDraft } from './useBookmarkDraft';

export function BookmarkForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: BookmarkDto;
  onSaved: (bookmark: BookmarkDto) => void;
  onCancel: () => void;
}) {
  const { draft, patch, preview, loading, error: previewError, retrieve } = useBookmarkDraft(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        url: draft.url,
        metadataPreviewId: draft.previewId,
        title: draft.title || undefined,
        description: draft.description || null,
        noteDocument: draft.noteDocument,
        tagLabels: draft.tagLabels,
        readingState: draft.readingState,
      };
      const result = await api<BookmarkDto>(initial ? `/api/bookmarks/${initial.id}` : '/api/bookmarks', {
        method: initial ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      onSaved(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The bookmark could not be saved.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="panel" aria-labelledby="bookmark-form-title">
      <div className="form-heading">
        <div>
          <p className="eyebrow">{initial ? 'Edit details' : 'New bookmark'}</p>
          <h2 id="bookmark-form-title">
            {initial ? 'Make this bookmark yours' : 'Save something worth returning to'}
          </h2>
        </div>
        <button type="button" className="icon-button" aria-label="Close form" onClick={onCancel}>
          ×
        </button>
      </div>
      <form onSubmit={save}>
        <div className="form-grid">
          <Field label="Web address" htmlFor="url" className="wide">
            <div className="url-row">
              <input
                id="url"
                type="url"
                required
                maxLength={2048}
                value={draft.url}
                placeholder="https://example.com/article"
                onChange={(event) => patch({ url: event.target.value, previewId: undefined })}
                onPaste={(event) => {
                  const pasted = event.clipboardData.getData('text').trim();
                  if (pasted) {
                    event.preventDefault();
                    patch({ url: pasted, previewId: undefined });
                    void retrieve(pasted);
                  }
                }}
                onBlur={() => {
                  if (draft.url && draft.url !== initial?.url && !loading) void retrieve();
                }}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={loading || !draft.url}
                onClick={() => void retrieve()}
              >
                {loading ? 'Fetching…' : 'Fetch details'}
              </Button>
            </div>
          </Field>
          {(preview || loading) && (
            <div className="metadata-preview wide" aria-live="polite">
              {preview?.previewImageUrl ? (
                <img src={preview.previewImageUrl} alt="" />
              ) : (
                <div className="preview preview-fallback">{loading ? '…' : '↗'}</div>
              )}
              <div>
                <strong>{loading ? 'Looking up page details…' : 'Details ready to edit'}</strong>
                {preview?.warnings.map((warning) => (
                  <p className="warning" key={warning.code}>
                    {warning.message}
                  </p>
                ))}
              </div>
            </div>
          )}
          {previewError && (
            <div className="wide">
              <StatusMessage error>{previewError} You can still enter a title and save.</StatusMessage>
            </div>
          )}
          <Field label="Title" htmlFor="title">
            <input
              id="title"
              required
              maxLength={200}
              value={draft.title}
              onChange={(event) => patch({ title: event.target.value })}
              placeholder="Filled in automatically"
            />
          </Field>
          <Field label="Read later" htmlFor="reading">
            <select
              id="reading"
              value={draft.readingState}
              onChange={(event) => patch({ readingState: event.target.value as BookmarkDto['readingState'] })}
            >
              <option value="none">Not in reading list</option>
              <option value="unread">To read</option>
              <option value="read">Already read</option>
            </select>
          </Field>
          <Field label="Description" htmlFor="description" className="wide">
            <textarea
              id="description"
              rows={3}
              maxLength={500}
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </Field>
          <Field label="Tags" htmlFor="tags" className="wide">
            <TagAutocomplete
              labels={draft.tagLabels}
              onChange={(tagLabels) => patch({ tagLabels })}
              excludeBookmarkId={initial?.id}
            />
          </Field>
          <Field label="Notes" htmlFor="note" className="wide">
            <NoteEditor value={draft.noteDocument} onChange={(noteDocument) => patch({ noteDocument })} />
          </Field>
        </div>
        {error && <StatusMessage error>{error}</StatusMessage>}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={saving || loading}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Save bookmark'}
          </Button>
        </div>
      </form>
    </section>
  );
}
