import { useState } from 'react';
import type { Bookmark, UpdateBookmarkInput } from '../../shared/types';
import { ApiRequestError } from '../api/client';
import { TagInput } from './TagInput';
import { NotesEditor } from './NotesEditor';

// A bookmark card with full US3 affordances: open (title/image), select for batch,
// edit (address/title/description/tags/notes — FR-013/FR-006), archive/restore
// (FR-016), and delete with confirmation (FR-017). Notes render as sanitized,
// formatted HTML (FR-018).

export interface CardHandlers {
  onUpdate: (id: number, patch: UpdateBookmarkInput) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onArchiveToggle: (id: number, archived: boolean) => Promise<void>;
  onReadLaterToggle: (id: number, readLater: boolean) => Promise<void>;
  onToggleSelect?: (id: number) => void;
}

export function BookmarkCard({
  bookmark,
  selected,
  suggestions,
  handlers,
}: {
  bookmark: Bookmark;
  selected: boolean;
  suggestions: string[];
  handlers: CardHandlers;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <EditCard
        bookmark={bookmark}
        suggestions={suggestions}
        onCancel={() => setEditing(false)}
        onSave={async (patch) => {
          await handlers.onUpdate(bookmark.id, patch);
          setEditing(false);
        }}
      />
    );
  }

  const enriching = bookmark.enrichStatus === 'pending';
  async function confirmDelete() {
    if (window.confirm(`Delete “${bookmark.title}” permanently?`)) {
      await handlers.onDelete(bookmark.id);
    }
  }

  return (
    <div className={`card${selected ? ' selected' : ''}`}>
      {handlers.onToggleSelect ? (
        <input
          type="checkbox"
          className="select-box"
          checked={selected}
          onChange={() => handlers.onToggleSelect!(bookmark.id)}
          aria-label={`Select ${bookmark.title}`}
        />
      ) : null}
      <a
        className="thumb-link"
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${bookmark.title}`}
      >
        {bookmark.imageUrl ? (
          <img className="thumb" src={bookmark.imageUrl} alt="" loading="lazy" />
        ) : (
          <div className="thumb" aria-hidden="true" />
        )}
      </a>
      <div className="body">
        <div className="title-row">
          {bookmark.iconUrl ? (
            <img className="favicon" src={bookmark.iconUrl} alt="" loading="lazy" />
          ) : null}
          <a
            className="title"
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            title={bookmark.title}
          >
            {bookmark.title}
          </a>
        </div>
        <div className="url">{bookmark.url}</div>
        {bookmark.description ? (
          <p className="desc">{bookmark.description}</p>
        ) : enriching ? (
          <p className="pending">Fetching preview…</p>
        ) : null}
        {bookmark.notesHtml ? (
          <div className="notes" dangerouslySetInnerHTML={{ __html: bookmark.notesHtml }} />
        ) : null}
        {bookmark.tags.length > 0 ? (
          <div className="tags">
            {bookmark.tags.map((t) => (
              <span className="tag" key={t}>
                {t}
              </span>
            ))}
          </div>
        ) : null}
        <div className="card-actions">
          <button
            type="button"
            className={`link-button${bookmark.readLater ? ' active-flag' : ''}`}
            onClick={() => void handlers.onReadLaterToggle(bookmark.id, !bookmark.readLater)}
            aria-pressed={bookmark.readLater}
          >
            {bookmark.readLater ? '★ Read later' : '☆ Read later'}
          </button>
          <button type="button" className="link-button" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            type="button"
            className="link-button"
            onClick={() => void handlers.onArchiveToggle(bookmark.id, !bookmark.archived)}
          >
            {bookmark.archived ? 'Restore' : 'Archive'}
          </button>
          <button type="button" className="link-button danger" onClick={() => void confirmDelete()}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCard({
  bookmark,
  suggestions,
  onSave,
  onCancel,
}: {
  bookmark: Bookmark;
  suggestions: string[];
  onSave: (patch: UpdateBookmarkInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState(bookmark.url);
  const [title, setTitle] = useState(bookmark.title);
  const [description, setDescription] = useState(bookmark.description);
  const [tags, setTags] = useState<string[]>(bookmark.tags);
  const [notes, setNotes] = useState(bookmark.notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave({ url, title, description, notes, tags });
    } catch (err) {
      // Address collision (FR-023) or validation error.
      setError(
        err instanceof ApiRequestError && err.code === 'duplicate_url'
          ? 'That address is already saved on another bookmark.'
          : err instanceof Error
            ? err.message
            : 'Could not save changes.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card editing">
      <div className="body details-box">
        <label>
          Address <span className="muted">(you can fix a moved or mistyped link)</span>
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label>
          Title
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Description <span className="muted">(fix a weird auto-fetched one here)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </label>
        <label>
          Tags
          <TagInput value={tags} suggestions={suggestions} onChange={setTags} />
        </label>
        <label>
          Note
          <NotesEditor value={notes} onChange={setNotes} />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="edit-actions">
          <button type="button" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
