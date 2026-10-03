import type { Bookmark } from '../../../shared/api-types';

export function ArchiveCard({ bookmark, pending, onRestore, onDelete }: { bookmark: Bookmark; pending: boolean; onRestore: (bookmark: Bookmark) => void; onDelete: (bookmark: Bookmark) => void }) {
  let host = bookmark.url;
  try { host = new URL(bookmark.url).hostname.replace(/^www\./, ''); } catch { /* retain address */ }
  return (
    <article className="bookmark-card archive-card">
      <div className="bookmark-main"><div className="bookmark-kicker"><span className="domain-dot" aria-hidden="true" /><span>{host}</span><span>Archived</span></div><h2><a href={bookmark.url} target="_blank" rel="noopener noreferrer">{bookmark.title}</a></h2>{bookmark.notes && <p className="bookmark-notes">{bookmark.notes}</p>}{bookmark.tags.length > 0 && <ul className="tag-list" aria-label="Tags">{bookmark.tags.map((tag) => <li key={tag.toLocaleLowerCase()}>{tag}</li>)}</ul>}</div>
      <div className="card-actions"><button type="button" disabled={pending} onClick={() => onRestore(bookmark)}>Restore</button><button className="danger-action" type="button" disabled={pending} onClick={() => onDelete(bookmark)}>Delete permanently</button></div>
    </article>
  );
}
