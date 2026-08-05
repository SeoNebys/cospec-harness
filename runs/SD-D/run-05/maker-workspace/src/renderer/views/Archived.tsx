import type { BookmarkSummary } from '@shared/types'
import { BookmarkList } from '../components/BookmarkList'
import { EmptyState } from '../components/EmptyState'

// The archived ("set aside") view (US4, FR-016): bookmarks kept out of the main
// list but not deleted, each restorable or editable. Distinct from permanent
// deletion, which happens in the detail panel.
export function Archived({
  bookmarks,
  onOpenCopy,
  onEdit,
  onRestore
}: {
  bookmarks: BookmarkSummary[]
  onOpenCopy: (id: string) => void
  onEdit: (id: string) => void
  onRestore: (id: string) => void
}): JSX.Element {
  if (bookmarks.length === 0) {
    return (
      <EmptyState
        title="Nothing set aside"
        hint="Bookmarks you archive will wait here until you restore or delete them."
      />
    )
  }
  return (
    <BookmarkList bookmarks={bookmarks} onOpenCopy={onOpenCopy} onEdit={onEdit} onRestore={onRestore} />
  )
}
