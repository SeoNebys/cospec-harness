// Named IPC channels shared between the main process (which handles them) and
// the preload bridge (which invokes them). Kept in a tiny standalone module so
// the preload does not pull in the whole main process.
export const CHANNELS = {
  saveBookmark: 'bookmark:save',
  updateBookmark: 'bookmark:update',
  listBookmarks: 'bookmark:list',
  listArchived: 'bookmark:list-archived',
  setArchived: 'bookmark:set-archived',
  deleteBookmark: 'bookmark:delete',
  getBookmark: 'bookmark:get',
  openOriginal: 'bookmark:open',
  getSavedCopy: 'copy:get',
  openSavedCopyExternal: 'copy:open-external',
  search: 'search:run',
  assignTags: 'tags:assign',
  removeTag: 'tags:remove',
  suggestTags: 'tags:suggest',
  getTags: 'tags:get',
  saveSearch: 'saved-search:create',
  listSavedSearches: 'saved-search:list',
  runSavedSearch: 'saved-search:run',
  deleteSavedSearch: 'saved-search:delete',
  applyBatch: 'batch:apply',
  importBookmarks: 'io:import',
  exportBookmarks: 'io:export',
  importProgress: 'io:import-progress',
  setRead: 'bookmark:set-read',
  getSetting: 'settings:get',
  setSetting: 'settings:set'
} as const
