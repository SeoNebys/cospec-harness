import { useEffect, useState } from 'react';
import { api, type Bookmark } from '../api/client.ts';
import { TagInput } from './TagInput.tsx';
import { NoteEditor } from './NoteEditor.tsx';

interface Props {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}

/** Edit view for a single bookmark: title, description, url, tags, note,
 *  read/archive, preserved copy + Internet Archive (FR-003/009/014/015/022/023). */
export function BookmarkDetail({ id, onClose, onChanged }: Props) {
  const [b, setB] = useState<Bookmark | null>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [archiveMsg, setArchiveMsg] = useState('');

  useEffect(() => {
    api.get(id).then((data) => {
      setB(data);
      setUrl(data.url);
      setTitle(data.titleUser ?? '');
      setDescription(data.descriptionUser ?? '');
      setNote(data.note ?? '');
      setTags(data.tags);
    });
  }, [id]);

  if (!b) return null;

  async function save() {
    setError('');
    try {
      await api.patch(id, { url, title, description, note, tags });
      onChanged();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggle(field: 'unread' | 'archived') {
    await api.patch(id, { [field]: !b![field] });
    const fresh = await api.get(id);
    setB(fresh);
    onChanged();
  }

  async function remove() {
    if (!confirm('Delete this bookmark permanently? This cannot be undone.')) return;
    await api.remove(id);
    onChanged();
    onClose();
  }

  async function submitArchiveOrg() {
    setArchiveMsg('Submitting to the Internet Archive…');
    try {
      const r = await api.archiveOrg(id);
      setArchiveMsg(`Archived: ${r.archiveOrgUrl}`);
      onChanged();
    } catch (err) {
      setArchiveMsg((err as Error).message);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row-flex">
          <h2 style={{ margin: 0 }}>Edit bookmark</h2>
          <div className="spacer" />
          <button onClick={onClose}>Close</button>
        </div>
        <div className="field">
          <label>Address</label>
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="field">
          <label>Title {b.titleCaptured && <span className="muted">(captured: {b.titleCaptured})</span>}</label>
          <input type="text" value={title} placeholder={b.titleCaptured ?? ''} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Description</label>
          <input
            type="text"
            value={description}
            placeholder={b.descriptionCaptured ?? ''}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Tags</label>
          <TagInput tags={tags} onChange={setTags} />
        </div>
        <div className="field">
          <label>Note</label>
          <NoteEditor value={note} onChange={setNote} />
        </div>

        <div className="row-flex wrap" style={{ marginTop: 8 }}>
          <button onClick={() => toggle('unread')}>{b.unread ? 'Mark read' : 'Mark unread'}</button>
          <button onClick={() => toggle('archived')}>{b.archived ? 'Restore' : 'Archive'}</button>
          {b.hasSnapshot && (
            <a href={`/api/bookmarks/${id}/snapshot`} target="_blank" rel="noopener noreferrer">
              <button type="button">View preserved copy ({b.snapshotKind})</button>
            </a>
          )}
          <button type="button" onClick={submitArchiveOrg}>
            Save to Internet Archive
          </button>
        </div>
        {b.archiveOrgUrl && (
          <div className="muted" style={{ marginTop: 6 }}>
            Internet Archive: <a href={b.archiveOrgUrl} target="_blank" rel="noopener noreferrer">{b.archiveOrgUrl}</a>
          </div>
        )}
        {archiveMsg && <div className="muted" style={{ marginTop: 6 }}>{archiveMsg}</div>}

        {error && <div className="error">{error}</div>}
        <div className="row-flex" style={{ marginTop: 16 }}>
          <button className="primary" onClick={save}>
            Save changes
          </button>
          <div className="spacer" />
          <button className="danger" onClick={remove}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
