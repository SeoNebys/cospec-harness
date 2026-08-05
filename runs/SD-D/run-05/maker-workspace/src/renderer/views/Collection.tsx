import { useCallback, useEffect, useState } from 'react'
import type { BookmarkSummary, SavedSearch, SortOrder } from '@shared/types'
import { AddBookmark } from './AddBookmark'
import { Reader } from './Reader'
import { Archived } from './Archived'
import { BookmarkDetail } from './BookmarkDetail'
import { Search } from './Search'
import { ImportExport } from './ImportExport'
import { BookmarkList } from '../components/BookmarkList'
import { BatchToolbar } from '../components/BatchToolbar'
import { EmptyState } from '../components/EmptyState'
import type { BatchAction } from '@shared/types'

type View = 'active' | 'archived'

// The main screen: add form, search/filter controls, and the bookmark list —
// with All/Archived views, per-bookmark actions, edit panel, and saved-copy
// reader. Search and tag filters exclude archived items (FR-023a); archived
// bookmarks appear only in the Archived view.
export function Collection(): JSX.Element {
  const [view, setView] = useState<View>('active')
  const [bookmarks, setBookmarks] = useState<BookmarkSummary[]>([])
  const [sort, setSort] = useState<SortOrder>('newest')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [readerFor, setReaderFor] = useState<BookmarkSummary | null>(null)
  const [detailFor, setDetailFor] = useState<string | null>(null)

  // Search / filter state (active view only).
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null)
  const [unreadOnly, setUnreadOnly] = useState(false)

  // Multi-select for batch actions.
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const isSearching = !!query.trim() || !!tagFilter || !!activeSavedId || unreadOnly

  const loadSaved = useCallback(async () => {
    setSavedSearches(await window.api.listSavedSearches())
  }, [])

  // On first load, restore the remembered sort order (FR-032) and saved searches.
  useEffect(() => {
    void loadSaved()
    void window.api.getSetting('sort_order').then((s) => {
      if (s === 'newest' || s === 'oldest' || s === 'title') setSort(s)
    })
  }, [loadSaved])

  const refresh = useCallback(async () => {
    let list: BookmarkSummary[]
    if (view === 'archived') {
      list = await window.api.listArchived(sort)
    } else if (activeSavedId) {
      list = await window.api.runSavedSearch(activeSavedId, sort)
    } else {
      // Browsing and searching share one path; with no text/tag/unread it simply
      // lists all active bookmarks (archived excluded — FR-023a).
      list = await window.api.search({
        text: query.trim() || undefined,
        tags: tagFilter ? [tagFilter] : [],
        unreadOnly,
        includeArchived: false,
        sort
      })
    }
    setBookmarks(list)
    setLoading(false)
  }, [sort, view, query, tagFilter, activeSavedId, unreadOnly])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Clear any selection when the set of what's shown changes identity, so a
  // batch action can't act on bookmarks that are no longer in view.
  useEffect(() => {
    setSelected(new Set())
  }, [view, query, tagFilter, activeSavedId, unreadOnly])

  // After a save, background metadata/copy lands shortly; refresh a few times.
  const refreshSoon = useCallback(() => {
    setNotice(null)
    setHighlightId(null)
    void refresh()
    let n = 0
    const id = setInterval(() => {
      void refresh()
      if (++n >= 4) clearInterval(id)
    }, 700)
  }, [refresh])

  // FR-017: re-saving an existing address opens that bookmark for editing.
  const onDuplicate = useCallback((id: string) => {
    setNotice("You've already saved this — opening it so you can update it.")
    setDetailFor(id)
  }, [])

  const onOpen = useCallback((id: string) => {
    void window.api.openOriginal(id)
  }, [])

  // Persist the sort choice so it's remembered next visit (FR-032).
  const changeSort = useCallback((s: SortOrder) => {
    setSort(s)
    void window.api.setSetting('sort_order', s)
  }, [])

  const onToggleRead = useCallback(
    async (id: string, current: boolean) => {
      await window.api.setRead(id, !current)
      await refresh()
    },
    [refresh]
  )

  const onOpenCopy = useCallback(
    (id: string) => setReaderFor(bookmarks.find((b) => b.id === id) ?? null),
    [bookmarks]
  )

  const onRestore = useCallback(
    async (id: string) => {
      await window.api.setArchived(id, false)
      await refresh()
    },
    [refresh]
  )

  // Clicking a tag filters the active view to that tag.
  const onTagClick = useCallback((tag: string) => {
    setView('active')
    setActiveSavedId(null)
    setQuery('')
    setTagFilter(tag)
  }, [])

  const clearAll = useCallback(() => {
    setQuery('')
    setTagFilter(null)
    setActiveSavedId(null)
    setUnreadOnly(false)
  }, [])

  const runSaved = useCallback((id: string) => {
    setQuery('')
    setTagFilter(null)
    setActiveSavedId(id)
  }, [])

  const saveCurrentSearch = useCallback(async () => {
    const name = window.prompt('Name this search (e.g. "unread recipes")')
    if (!name) return
    await window.api.saveSearch({
      name,
      text: query.trim() || undefined,
      tags: tagFilter ? [tagFilter] : []
    })
    await loadSaved()
  }, [query, tagFilter, loadSaved])

  const deleteSaved = useCallback(
    async (id: string) => {
      await window.api.deleteSavedSearch(id)
      if (activeSavedId === id) setActiveSavedId(null)
      await loadSaved()
    },
    [activeSavedId, loadSaved]
  )

  // --- Batch selection & actions (US6) ---
  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allShownSelected = bookmarks.length > 0 && bookmarks.every((b) => selected.has(b.id))

  const selectAllShown = useCallback(() => {
    setSelected((prev) =>
      bookmarks.length > 0 && bookmarks.every((b) => prev.has(b.id))
        ? new Set()
        : new Set(bookmarks.map((b) => b.id))
    )
  }, [bookmarks])

  const runBatch = useCallback(
    async (action: BatchAction) => {
      const ids = [...selected]
      if (!ids.length) return
      await window.api.applyBatch({ ids }, action)
      setSelected(new Set())
      await refresh()
    },
    [selected, refresh]
  )

  return (
    <div className="app">
      <div className="topbar">
        <h1>Bookmarks</h1>
        <nav className="views">
          <button className={view === 'active' ? '' : 'secondary'} onClick={() => setView('active')}>
            All
          </button>
          <button
            className={view === 'archived' ? '' : 'secondary'}
            onClick={() => setView('archived')}
          >
            Archived
          </button>
        </nav>
        <ImportExport onImported={refreshSoon} />
        {view === 'active' && (
          <label className="unread-toggle">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => {
                setActiveSavedId(null)
                setUnreadOnly(e.target.checked)
              }}
            />
            Unread only
          </label>
        )}
        <label className="sort">
          Sort:{' '}
          <select value={sort} onChange={(e) => changeSort(e.target.value as SortOrder)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">By title</option>
          </select>
        </label>
      </div>
      <div className="content">
        {view === 'active' && (
          <>
            <AddBookmark onSaved={refreshSoon} onDuplicate={onDuplicate} />
            <Search
              query={query}
              onQueryChange={(s) => {
                setActiveSavedId(null)
                setQuery(s)
              }}
              tagFilter={tagFilter}
              onClearTag={() => setTagFilter(null)}
              onClearAll={clearAll}
              canSave={isSearching}
              onSaveSearch={saveCurrentSearch}
              savedSearches={savedSearches}
              activeSavedId={activeSavedId}
              onRunSaved={runSaved}
              onDeleteSaved={deleteSaved}
            />
          </>
        )}
        {notice && <div className="notice">{notice}</div>}
        {view === 'active' && selected.size > 0 && (
          <BatchToolbar
            selectedCount={selected.size}
            shownCount={bookmarks.length}
            allShownSelected={allShownSelected}
            onSelectAllShown={selectAllShown}
            onClear={() => setSelected(new Set())}
            onAddTag={(name) => runBatch({ type: 'addTag', tagName: name })}
            onRemoveTag={(name) => runBatch({ type: 'removeTag', tagName: name })}
            onSetRead={(value) => runBatch({ type: 'setRead', value })}
            onArchive={() => runBatch({ type: 'archive', value: true })}
            onDelete={() => runBatch({ type: 'delete', confirmed: true })}
          />
        )}
        {loading ? null : view === 'archived' ? (
          <Archived
            bookmarks={bookmarks}
            onOpenCopy={onOpenCopy}
            onEdit={setDetailFor}
            onRestore={onRestore}
          />
        ) : bookmarks.length === 0 ? (
          <EmptyState
            title={
              unreadOnly && !query.trim() && !tagFilter
                ? 'Nothing unread'
                : isSearching
                  ? 'No matches'
                  : 'No bookmarks yet'
            }
            hint={
              unreadOnly && !query.trim() && !tagFilter
                ? "You're all caught up — nothing marked to read later."
                : isSearching
                  ? 'Nothing matches that search — try clearing it.'
                  : 'Paste a web address above to save your first one.'
            }
          />
        ) : (
          <BookmarkList
            bookmarks={bookmarks}
            onOpen={onOpen}
            onOpenCopy={onOpenCopy}
            onEdit={setDetailFor}
            onTagClick={onTagClick}
            onToggleRead={onToggleRead}
            selectedIds={selected}
            onToggleSelect={toggleSelect}
            highlightId={highlightId}
          />
        )}
      </div>

      {readerFor && (
        <Reader bookmarkId={readerFor.id} title={readerFor.title} onClose={() => setReaderFor(null)} />
      )}
      {detailFor && (
        <BookmarkDetail bookmarkId={detailFor} onClose={() => setDetailFor(null)} onChanged={refresh} />
      )}
    </div>
  )
}
