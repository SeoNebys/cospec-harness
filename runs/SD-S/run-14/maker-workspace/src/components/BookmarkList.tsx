import type { Bookmark } from '../domain/bookmark'
import { BookmarkCard } from './BookmarkCard'

interface BookmarkListProps {
  bookmarks: Bookmark[]
  onEdit: (bookmark: Bookmark, trigger: HTMLElement) => void
  onDelete: (bookmark: Bookmark, trigger: HTMLElement) => void
}

export function BookmarkList({ bookmarks, onEdit, onDelete }: BookmarkListProps) {
  return (
    <div className="bookmark-grid">
      {bookmarks.map((bookmark) => (
        <BookmarkCard key={bookmark.id} bookmark={bookmark} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  )
}
