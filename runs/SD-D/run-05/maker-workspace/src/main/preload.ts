import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS } from '@shared/channels'
import type {
  Bookmark,
  BookmarkSummary,
  BookmarkEdit,
  SaveResult,
  SortOrder,
  SavedCopyView,
  UpdateResult,
  SearchQuery,
  SavedSearch,
  SavedSearchInput,
  BatchSelection,
  BatchAction,
  BatchResult,
  ImportResult,
  ExportResult,
  ImportProgress
} from '@shared/types'

// The safe bridge: the UI calls window.api.* which forwards to the main process
// over IPC. The UI never touches the database, the network, or the filesystem
// directly.
const api = {
  saveBookmark: (input: { url: string; title?: string; description?: string }): Promise<SaveResult> =>
    ipcRenderer.invoke(CHANNELS.saveBookmark, input),
  updateBookmark: (id: string, patch: BookmarkEdit): Promise<UpdateResult> =>
    ipcRenderer.invoke(CHANNELS.updateBookmark, id, patch),
  listBookmarks: (sort: SortOrder): Promise<BookmarkSummary[]> =>
    ipcRenderer.invoke(CHANNELS.listBookmarks, sort),
  listArchived: (sort: SortOrder): Promise<BookmarkSummary[]> =>
    ipcRenderer.invoke(CHANNELS.listArchived, sort),
  setArchived: (id: string, value: boolean): Promise<Bookmark | null> =>
    ipcRenderer.invoke(CHANNELS.setArchived, id, value),
  setRead: (id: string, value: boolean): Promise<Bookmark | null> =>
    ipcRenderer.invoke(CHANNELS.setRead, id, value),
  deleteBookmark: (id: string, confirmed: boolean): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(CHANNELS.deleteBookmark, id, confirmed),
  getBookmark: (id: string): Promise<Bookmark | null> => ipcRenderer.invoke(CHANNELS.getBookmark, id),
  openOriginal: (id: string): Promise<{ ok: boolean }> => ipcRenderer.invoke(CHANNELS.openOriginal, id),
  getSavedCopy: (bookmarkId: string): Promise<SavedCopyView> =>
    ipcRenderer.invoke(CHANNELS.getSavedCopy, bookmarkId),
  openSavedCopyExternal: (bookmarkId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(CHANNELS.openSavedCopyExternal, bookmarkId),
  search: (query: SearchQuery): Promise<BookmarkSummary[]> =>
    ipcRenderer.invoke(CHANNELS.search, query),
  assignTags: (bookmarkId: string, names: string[]): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(CHANNELS.assignTags, bookmarkId, names),
  removeTag: (bookmarkId: string, name: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(CHANNELS.removeTag, bookmarkId, name),
  suggestTags: (prefix: string): Promise<string[]> => ipcRenderer.invoke(CHANNELS.suggestTags, prefix),
  getTags: (bookmarkId: string): Promise<string[]> => ipcRenderer.invoke(CHANNELS.getTags, bookmarkId),
  saveSearch: (input: SavedSearchInput): Promise<SavedSearch> =>
    ipcRenderer.invoke(CHANNELS.saveSearch, input),
  listSavedSearches: (): Promise<SavedSearch[]> => ipcRenderer.invoke(CHANNELS.listSavedSearches),
  runSavedSearch: (id: string, sort: SortOrder): Promise<BookmarkSummary[]> =>
    ipcRenderer.invoke(CHANNELS.runSavedSearch, id, sort),
  deleteSavedSearch: (id: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(CHANNELS.deleteSavedSearch, id),
  applyBatch: (selection: BatchSelection, action: BatchAction): Promise<BatchResult> =>
    ipcRenderer.invoke(CHANNELS.applyBatch, selection, action),
  importBookmarks: (): Promise<ImportResult> => ipcRenderer.invoke(CHANNELS.importBookmarks),
  exportBookmarks: (): Promise<ExportResult> => ipcRenderer.invoke(CHANNELS.exportBookmarks),
  // Subscribe to import progress; returns an unsubscribe function.
  onImportProgress: (cb: (p: ImportProgress) => void): (() => void) => {
    const listener = (_e: unknown, p: ImportProgress): void => cb(p)
    ipcRenderer.on(CHANNELS.importProgress, listener)
    return () => ipcRenderer.removeListener(CHANNELS.importProgress, listener)
  },
  getSetting: (key: string): Promise<string | null> => ipcRenderer.invoke(CHANNELS.getSetting, key),
  setSetting: (key: string, value: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(CHANNELS.setSetting, key, value)
}

export type BookmarksApi = typeof api

contextBridge.exposeInMainWorld('api', api)
