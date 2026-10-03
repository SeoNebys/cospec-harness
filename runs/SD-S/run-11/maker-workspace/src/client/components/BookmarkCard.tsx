import type { Bookmark } from '../api/types.ts';

export function BookmarkCard({ item, onEdit, onArchive, onRestore, onDelete }: { item: Bookmark; onEdit: (b: Bookmark) => void; onArchive: (b: Bookmark) => void; onRestore: (b: Bookmark) => void; onDelete: (b: Bookmark) => void }) {
  let host = item.url;
  try { host = new URL(item.url).hostname; } catch { host = item.url; }
  return <article className="bookmark-card" id={`bookmark-${item.id}`}>
    <div className="card-top"><div className="site-mark" aria-hidden="true">{item.title.charAt(0).toUpperCase()}</div><div className="card-copy"><div className="title-line"><h3>{item.title}</h3>{item.favorite && <span className="favorite" aria-label="Favorite">★</span>}</div><a className="domain" href={item.url} target="_blank" rel="noopener noreferrer">{host} <span aria-hidden="true">↗</span></a></div><button className="icon-button" onClick={() => onEdit(item)} aria-label={`Edit ${item.title}`}>•••</button></div>
    {item.description && <p className="description">{item.description}</p>}
    <div className="card-footer"><div className="tags">{item.tags.map(t => <span key={t.id}>#{t.name}</span>)}</div><div className="card-actions"><button onClick={() => onEdit(item)}>Edit</button>{item.archivedAt ? <button onClick={() => onRestore(item)}>Restore</button> : <button onClick={() => onArchive(item)}>Archive</button>}<button className="danger-link" onClick={() => onDelete(item)}>Delete</button></div></div>
  </article>;
}
