import type { DB } from '../db/connection'
import type { BatchAction, BatchResult, BatchSelection } from '@shared/types'
import type { BookmarksService } from './bookmarks'
import type { TagsService } from './tags'
import type { SearchService } from './search'

export interface BatchDeps {
  bookmarks: BookmarksService
  tags: TagsService
  search: SearchService
  // Removes stored favicon/saved-copy files for deleted bookmarks.
  onRemoveFiles: (paths: string[]) => void
}

// Applies one action to many bookmarks at once (FR-024/025/026). The target set
// is either an explicit list of ids or everything a search/filter matches.
export class BatchService {
  constructor(
    private readonly db: DB,
    private readonly deps: BatchDeps
  ) {}

  private resolve(selection: BatchSelection): string[] {
    if ('ids' in selection) return selection.ids
    return this.deps.search.search(selection.query).map((b) => b.id)
  }

  apply(selection: BatchSelection, action: BatchAction): BatchResult {
    // Batch delete is held behind the same confirmation guard as single delete.
    if (action.type === 'delete' && !action.confirmed) {
      return { ok: false, affected: 0 }
    }

    const ids = this.resolve(selection)
    const filesToRemove: string[] = []

    const run = this.db.transaction(() => {
      for (const id of ids) {
        switch (action.type) {
          case 'addTag':
            this.deps.tags.assign(id, [action.tagName])
            break
          case 'removeTag':
            this.deps.tags.remove(id, action.tagName)
            break
          case 'setRead':
            this.deps.bookmarks.setRead(id, action.value)
            break
          case 'archive':
            this.deps.bookmarks.setArchived(id, action.value)
            break
          case 'delete':
            filesToRemove.push(...this.deps.bookmarks.remove(id).files)
            break
        }
      }
    })
    run()

    // File cleanup happens after the DB transaction commits (the filesystem is
    // not part of the transaction).
    if (filesToRemove.length) this.deps.onRemoveFiles(filesToRemove)

    return { ok: true, affected: ids.length }
  }
}
