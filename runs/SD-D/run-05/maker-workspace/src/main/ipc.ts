import { ipcMain, shell, dialog } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import type { DB } from './db/connection'
import type {
  SortOrder,
  SavedCopyView,
  BookmarkEdit,
  SearchQuery,
  SavedSearchInput,
  BatchSelection,
  BatchAction
} from '@shared/types'
import { CHANNELS } from '@shared/channels'
import { BookmarksService } from './services/bookmarks'
import { SavedCopiesService } from './services/savedCopies'
import { TagsService } from './services/tags'
import { SearchService, SavedSearchesService } from './services/search'
import { BatchService } from './services/batch'
import { ImportExportService } from './services/importExport'
import { SettingsService } from './services/settings'
import { FileStore } from './storage/files'
import { WorkQueue } from './services/queue'
import { makeIngestJob } from './services/ingest'

// Registers the handlers for the named operations the UI can call
// (contracts/bookmark-operations.md, contracts/capture-operations.md). Each
// channel maps to one method; the renderer reaches them through the preload
// bridge. All file/network/database access stays here in the main process.
export function registerIpc(db: DB, dataDir: string): void {
  const files = new FileStore(`${dataDir}/saved-copies`)
  const queue = new WorkQueue()
  const savedCopies = new SavedCopiesService(db)
  const tags = new TagsService(db)
  const searchService = new SearchService(db)
  const savedSearches = new SavedSearchesService(db, searchService)
  const bookmarks = new BookmarksService({
    db,
    // On save, fetch metadata + capture the saved copy in the background.
    onCreated: (b) => queue.enqueue(makeIngestJob(b, { bookmarks, savedCopies, files }))
  })
  const batch = new BatchService(db, {
    bookmarks,
    tags,
    search: searchService,
    onRemoveFiles: (paths) => paths.forEach((p) => files.remove(p))
  })
  const importExport = new ImportExportService(db, { bookmarks, tags })
  const settings = new SettingsService(db)

  ipcMain.handle(CHANNELS.saveBookmark, (_e, input: { url: string; title?: string; description?: string }) =>
    bookmarks.save(input)
  )

  ipcMain.handle(CHANNELS.updateBookmark, (_e, id: string, patch: BookmarkEdit) =>
    bookmarks.update(id, patch)
  )

  ipcMain.handle(CHANNELS.listBookmarks, (_e, sort: SortOrder) => bookmarks.listActive(sort))

  ipcMain.handle(CHANNELS.listArchived, (_e, sort: SortOrder) => bookmarks.listArchived(sort))

  ipcMain.handle(CHANNELS.setArchived, (_e, id: string, value: boolean) =>
    bookmarks.setArchived(id, value)
  )

  ipcMain.handle(CHANNELS.setRead, (_e, id: string, value: boolean) => bookmarks.setRead(id, value))

  // Permanent delete — the UI must pass confirmed=true (accidental-deletion
  // guard, FR-015). Also removes the stored favicon and saved-copy files.
  ipcMain.handle(CHANNELS.deleteBookmark, (_e, id: string, confirmed: boolean) => {
    if (!confirmed) return { ok: false as const }
    const { files: paths } = bookmarks.remove(id)
    for (const p of paths) files.remove(p)
    return { ok: true as const }
  })

  ipcMain.handle(CHANNELS.getBookmark, (_e, id: string) => bookmarks.getById(id))

  ipcMain.handle(CHANNELS.openOriginal, async (_e, id: string) => {
    const b = bookmarks.getById(id)
    if (b) await shell.openExternal(b.url)
    return { ok: true }
  })

  // Serve the locally stored saved copy for offline viewing — never re-fetch the
  // live page (FR-007). Reader copies return sanitized HTML ready to render;
  // PDFs return the local file path.
  ipcMain.handle(CHANNELS.getSavedCopy, (_e, bookmarkId: string): SavedCopyView => {
    const copy = savedCopies.getForBookmark(bookmarkId)
    if (!copy || copy.status !== 'captured' || !copy.filePath) {
      return { status: copy && copy.status === 'pending' ? 'pending' : 'unavailable' }
    }
    if (copy.kind === 'reader') {
      try {
        return { status: 'captured', kind: 'reader', html: readFileSync(copy.filePath, 'utf8') }
      } catch {
        // saved-copy file missing/unreadable → treat as no copy rather than crash
        return { status: 'unavailable' }
      }
    }
    return { status: 'captured', kind: 'pdf', filePath: copy.filePath }
  })

  // Open a retained PDF in the operating system's default viewer (works offline
  // from the local copy).
  ipcMain.handle(CHANNELS.openSavedCopyExternal, async (_e, bookmarkId: string) => {
    const copy = savedCopies.getForBookmark(bookmarkId)
    if (copy?.filePath) await shell.openPath(copy.filePath)
    return { ok: true }
  })

  // Find & organize (US5).
  ipcMain.handle(CHANNELS.search, (_e, query: SearchQuery) => searchService.search(query))
  ipcMain.handle(CHANNELS.assignTags, (_e, bookmarkId: string, names: string[]) => {
    tags.assign(bookmarkId, names)
    return { ok: true }
  })
  ipcMain.handle(CHANNELS.removeTag, (_e, bookmarkId: string, name: string) => {
    tags.remove(bookmarkId, name)
    return { ok: true }
  })
  ipcMain.handle(CHANNELS.suggestTags, (_e, prefix: string) => tags.suggest(prefix))
  ipcMain.handle(CHANNELS.getTags, (_e, bookmarkId: string) => tags.listForBookmark(bookmarkId))

  ipcMain.handle(CHANNELS.saveSearch, (_e, input: SavedSearchInput) => savedSearches.create(input))
  ipcMain.handle(CHANNELS.listSavedSearches, () => savedSearches.list())
  ipcMain.handle(CHANNELS.runSavedSearch, (_e, id: string, sort: SortOrder) =>
    savedSearches.run(id, sort)
  )
  ipcMain.handle(CHANNELS.deleteSavedSearch, (_e, id: string) => {
    savedSearches.delete(id)
    return { ok: true }
  })

  // Batch actions (US6).
  ipcMain.handle(CHANNELS.applyBatch, (_e, selection: BatchSelection, action: BatchAction) =>
    batch.apply(selection, action)
  )

  // Import / export (US7). Both use a native file picker; import streams
  // progress back on the importProgress channel and returns the final summary.
  ipcMain.handle(CHANNELS.importBookmarks, async (e) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Choose a browser bookmarks file',
      filters: [{ name: 'Bookmarks', extensions: ['html', 'htm'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return { canceled: true as const }
    let html: string
    try {
      html = readFileSync(filePaths[0], 'utf8')
    } catch {
      // Unreadable file → report as an import that added nothing rather than throw.
      return { canceled: false as const, added: 0, skipped: 0, failed: 0 }
    }
    const summary = importExport.import(html, {
      onProgress: (p) => e.sender.send(CHANNELS.importProgress, p)
    })
    return { canceled: false as const, ...summary }
  })

  ipcMain.handle(CHANNELS.exportBookmarks, async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export bookmarks',
      defaultPath: 'bookmarks.html',
      filters: [{ name: 'Bookmarks', extensions: ['html'] }]
    })
    if (canceled || !filePath) return { canceled: true as const }
    writeFileSync(filePath, importExport.buildExport(), 'utf8')
    return { canceled: false as const, count: importExport.countAll() }
  })

  // Remembered preferences, e.g. the chosen sort order (US8, FR-032).
  ipcMain.handle(CHANNELS.getSetting, (_e, key: string) => settings.get(key))
  ipcMain.handle(CHANNELS.setSetting, (_e, key: string, value: string) => {
    settings.set(key, value)
    return { ok: true }
  })
}
