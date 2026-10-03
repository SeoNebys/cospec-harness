import { useRef, useState, type FormEvent } from 'react';
import { useMetadataPreview } from './useMetadataPreview';
import type { BookmarkDraft, MetadataPreview } from './types';

interface Props {
  onSave: (draft: BookmarkDraft) => Promise<void>;
  isSaving?: boolean;
}

const splitTags = (value: string) => [
  ...new Set(
    value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
];

export function SaveBookmarkForm({ onSave, isSaving = false }: Props) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [readLater, setReadLater] = useState(false);
  const [message, setMessage] = useState('Paste a link to retrieve its page details.');
  const [saveError, setSaveError] = useState<string | null>(null);
  const dirty = useRef({ title: false, description: false });
  const iconToken = useRef<string | null>(null);

  const applyPreview = (result: MetadataPreview) => {
    if (!dirty.current.title && result.fields.title.value) setTitle(result.fields.title.value);
    if (!dirty.current.description && result.fields.description.value)
      setDescription(result.fields.description.value);
    iconToken.current = result.iconToken ?? null;
    setMessage(
      result.outcome === 'complete'
        ? 'Page details retrieved. You can edit them before saving.'
        : 'Some page details were unavailable. You can still save this bookmark.',
    );
  };
  const metadata = useMetadataPreview(url, { onPreview: applyPreview });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    try {
      await onSave({
        url: url.trim(),
        title: title.trim(),
        description: description.trim() || null,
        notes: notes.trim() || null,
        tags: splitTags(tags),
        readLater,
        iconToken: iconToken.current,
      });
      setUrl('');
      setTitle('');
      setDescription('');
      setNotes('');
      setTags('');
      setReadLater(false);
      dirty.current = { title: false, description: false };
      iconToken.current = null;
    } catch (reason) {
      setSaveError(
        reason instanceof Error
          ? reason.message
          : 'The bookmark could not be saved. Your details are still here.',
      );
    }
  }

  return (
    <section className="capture-panel" aria-labelledby="save-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Quick capture</p>
          <h2 id="save-heading">Save something worth returning to</h2>
        </div>
        <span className="shortcut-hint" aria-hidden="true">
          Paste → review → save
        </span>
      </div>
      <form className="bookmark-form" onSubmit={(event) => void submit(event)}>
        <div className="field field-url">
          <label htmlFor="bookmark-url">Web address</label>
          <div className="input-with-action">
            <input
              id="bookmark-url"
              name="url"
              type="url"
              required
              maxLength={4096}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              autoComplete="url"
            />
            <button
              className="button secondary"
              type="button"
              disabled={!url.trim() || metadata.isLoading}
              onClick={() => void metadata.retrieve()}
            >
              {metadata.isLoading ? 'Retrieving…' : 'Get details'}
            </button>
          </div>
        </div>
        <p
          className={`metadata-status ${metadata.error ? 'error' : ''}`}
          role="status"
          aria-live="polite"
        >
          {metadata.isLoading
            ? 'Retrieving title, description, and site icon…'
            : (metadata.error ?? message)}
        </p>
        {metadata.preview?.warnings.length ? (
          <ul className="warning-list">
            {metadata.preview.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="bookmark-title">Title</label>
            <input
              id="bookmark-title"
              required
              maxLength={300}
              value={title}
              onChange={(e) => {
                dirty.current.title = true;
                setTitle(e.target.value);
              }}
              placeholder="Filled in from the page"
            />
          </div>
          <div className="field">
            <label htmlFor="bookmark-tags">
              Tags <span>(comma separated)</span>
            </label>
            <input
              id="bookmark-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="article, travel"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="bookmark-description">Description</label>
          <textarea
            id="bookmark-description"
            maxLength={2000}
            rows={2}
            value={description}
            onChange={(e) => {
              dirty.current.description = true;
              setDescription(e.target.value);
            }}
            placeholder="A short summary, filled in when available"
          />
        </div>
        <div className="field">
          <label htmlFor="bookmark-notes">Personal notes</label>
          <textarea
            id="bookmark-notes"
            maxLength={10000}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why are you saving this?"
          />
        </div>
        <div className="form-actions">
          <label className="check-control">
            <input
              type="checkbox"
              checked={readLater}
              onChange={(e) => setReadLater(e.target.checked)}
            />
            <span>Read this later</span>
          </label>
          <button className="button primary" type="submit" disabled={isSaving || !url.trim()}>
            {isSaving ? 'Saving…' : 'Save bookmark'}
          </button>
        </div>
        {saveError && (
          <p className="inline-error" role="alert">
            {saveError}
          </p>
        )}
      </form>
    </section>
  );
}
