import type { Bookmark } from '../domain/bookmark'

interface BookmarkCardProps {
  bookmark: Bookmark
  onEdit: (bookmark: Bookmark, trigger: HTMLElement) => void
  onDelete: (bookmark: Bookmark, trigger: HTMLElement) => void
}

function hostname(url: string) {
  return new URL(url).hostname.replace(/^www\./, '')
}

export function BookmarkCard({ bookmark, onEdit, onDelete }: BookmarkCardProps) {
  return (
    <article className="bookmark-card">
      <div className="card-topline">
        <span className="site-monogram" aria-hidden="true">{hostname(bookmark.url).charAt(0).toUpperCase()}</span>
        <span className="site-host">{hostname(bookmark.url)}</span>
        <div className="card-actions">
          <button type="button" className="icon-button" aria-label={`Edit ${bookmark.title}`} onClick={(event) => onEdit(bookmark, event.currentTarget)}>Edit</button>
          <button type="button" className="icon-button danger-text" aria-label={`Delete ${bookmark.title}`} onClick={(event) => onDelete(bookmark, event.currentTarget)}>Delete</button>
        </div>
      </div>
      <h2>
        <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
          {bookmark.title}<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </h2>
      {bookmark.description && <p className="description">{bookmark.description}</p>}
      <div className="card-footer">
        <div className="tag-row" aria-label="Tags">
          {bookmark.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
        </div>
        <time dateTime={bookmark.createdAt}>Saved {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(bookmark.createdAt))}</time>
      </div>
    </article>
  )
}
