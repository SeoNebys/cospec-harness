import { useRef, useState, type FormEvent } from 'react';
import type { Bookmark, BookmarkDraft, MetadataPreview } from './types';
import { useMetadataPreview } from './useMetadataPreview';

interface Props {
  bookmark: Bookmark;
  onSave: (patch: Partial<BookmarkDraft>) => Promise<void>;
  onCancel: () => void;
}
export function EditBookmarkForm({ bookmark, onSave, onCancel }: Props) {
  const [url, setUrl] = useState(bookmark.url),
    [title, setTitle] = useState(bookmark.title),
    [description, setDescription] = useState(bookmark.description ?? ''),
    [notes, setNotes] = useState(bookmark.notes ?? ''),
    [tags, setTags] = useState(bookmark.tags.join(', ')),
    [pending, setPending] = useState(false);
  const dirty = useRef({ title: false, description: false });
  const iconToken = useRef<string | null>(null);
  const apply = (preview: MetadataPreview) => {
    if (!dirty.current.title && preview.fields.title.value) setTitle(preview.fields.title.value);
    if (!dirty.current.description && preview.fields.description.value)
      setDescription(preview.fields.description.value);
    iconToken.current = preview.iconToken ?? null;
  };
  const metadata = useMetadataPreview('', { onPreview: apply });
  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await onSave({
        url: url.trim(),
        title: title.trim(),
        description: description.trim() || null,
        notes: notes.trim() || null,
        tags: [
          ...new Set(
            tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
          ),
        ],
        ...(iconToken.current ? { iconToken: iconToken.current } : {}),
      });
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="bookmark-form edit-form" onSubmit={(event) => void submit(event)}>
      <h2>Edit bookmark</h2>
      <p className="muted">
        Your edits stay in control. Page details are only refreshed when you ask.
      </p>
      <div className="field">
        <label htmlFor="edit-url">Web address</label>
        <div className="input-with-action">
          <input
            id="edit-url"
            type="url"
            required
            maxLength={4096}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            className="button secondary"
            type="button"
            disabled={metadata.isLoading}
            onClick={() => void metadata.retrieve(url)}
          >
            {metadata.isLoading ? 'Refreshing…' : 'Refresh page details'}
          </button>
        </div>
      </div>
      <p className={`metadata-status ${metadata.error ? 'error' : ''}`} role="status">
        {metadata.error ??
          (metadata.preview ? 'Suggestions refreshed. Existing edits were preserved.' : '')}
      </p>
      <div className="field">
        <label htmlFor="edit-title">Title</label>
        <input
          id="edit-title"
          required
          maxLength={300}
          value={title}
          onChange={(e) => {
            dirty.current.title = true;
            setTitle(e.target.value);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="edit-description">Description</label>
        <textarea
          id="edit-description"
          maxLength={2000}
          rows={3}
          value={description}
          onChange={(e) => {
            dirty.current.description = true;
            setDescription(e.target.value);
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="edit-notes">Personal notes</label>
        <textarea
          id="edit-notes"
          maxLength={10000}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="edit-tags">
          Tags <span>(comma separated)</span>
        </label>
        <input id="edit-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      <div className="dialog-actions">
        <button className="button ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
