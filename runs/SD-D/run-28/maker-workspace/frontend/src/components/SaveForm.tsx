import { useState } from 'react';
import { api, type Bookmark } from '../api/client.ts';
import { TagInput } from './TagInput.tsx';
import { NoteEditor } from './NoteEditor.tsx';

interface Props {
  onSaved: (b: Bookmark) => void;
  onDuplicate: (existingId: string) => void;
}

/** Save flow with ALL FR-001 fields: url, title, tags(+suggestions),
 *  description, markdown note, read-later. */
export function SaveForm({ onSaved, onDuplicate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [unread, setUnread] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function reset() {
    setUrl('');
    setTitle('');
    setDescription('');
    setNote('');
    setTags([]);
    setUnread(false);
    setExpanded(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const b = await api.create({ url, title, description, note, tags, unread });
      reset();
      onSaved(b);
    } catch (err) {
      const e2 = err as Error & { status?: number; details?: { existingId?: string } };
      if (e2.status === 409 && e2.details?.existingId) {
        onDuplicate(e2.details.existingId);
        reset();
      } else {
        setError(e2.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="row-flex">
        <input
          type="text"
          placeholder="Paste a URL to save…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={() => setExpanded(true)}
          required
        />
        <button className="primary" type="submit" disabled={busy || !url.trim()}>
          Save
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: 12 }}>
          <div className="field">
            <label>Title (optional — captured automatically if blank)</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label>Tags</label>
            <TagInput tags={tags} onChange={setTags} />
          </div>
          <div className="field">
            <label>Note</label>
            <NoteEditor value={note} onChange={setNote} />
          </div>
          <label className="row-flex" style={{ gap: 6 }}>
            <input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} />
            Save to read later (unread)
          </label>
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </form>
  );
}
