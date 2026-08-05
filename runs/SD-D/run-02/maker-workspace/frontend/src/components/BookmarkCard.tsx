import type { Bookmark } from '../services/api.js';
import { SnapshotViewer } from './SnapshotViewer.js';

interface Props {
  bookmark: Bookmark;
  selected: boolean;
  onToggleSelect: (id: number) => void;
  onEdit: (b: Bookmark) => void;
  onDelete: (b: Bookmark) => void;
  onArchiveToggle: (b: Bookmark) => void;
  onReadToggle: (b: Bookmark) => void;
  onTagClick: (tag: string) => void;
}

/** A single bookmark in the list: title, address, tags, preview, and actions (FR-009/010). */
export function BookmarkCard(p: Props) {
  const b = p.bookmark;
  return (
    <div className={`card ${p.selected ? 'card-selected' : ''}`}>
      <input type="checkbox" className="card-select" checked={p.selected} onChange={() => p.onToggleSelect(b.id)} aria-label="Select bookmark" />
      {b.icon_ref && <img className="favicon" src={b.icon_ref} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
      <div className="card-body">
        <a className="card-title" href={b.url} target="_blank" rel="noreferrer">{b.title || b.url}</a>
        <div className="card-url">{b.url}</div>
        {b.description && <div className="card-desc">{b.description}</div>}
        <div className="card-tags">
          {b.tags.map((t) => (
            <button key={t} className="chip chip-clickable" onClick={() => p.onTagClick(t)}>{t}</button>
          ))}
          {b.read_state === 'to_read' && <span className="badge">to read</span>}
          {b.archived && <span className="badge badge-archived">archived</span>}
        </div>
        <SnapshotViewer id={b.id} />
      </div>
      {b.preview_ref && <img className="preview" src={b.preview_ref} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
      <div className="card-actions">
        <button onClick={() => p.onReadToggle(b)}>{b.read_state === 'to_read' ? 'Mark read' : 'Read later'}</button>
        <button onClick={() => p.onEdit(b)}>Edit</button>
        <button onClick={() => p.onArchiveToggle(b)}>{b.archived ? 'Unarchive' : 'Archive'}</button>
        <button className="danger" onClick={() => p.onDelete(b)}>Delete</button>
      </div>
    </div>
  );
}
