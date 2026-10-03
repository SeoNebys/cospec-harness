import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bookmark, BookmarkInput, BookmarkRepository } from '../domain/bookmark'
import { deriveTags, filterBookmarks } from '../domain/bookmarkSearch'
import { validateBookmarkInput, type ValidationErrors } from '../domain/urlNormalization'
import { bookmarkRepository } from '../storage/bookmarkRepository'
import { BookmarkForm } from '../components/BookmarkForm'
import { BookmarkList } from '../components/BookmarkList'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { SearchAndFilter } from '../components/SearchAndFilter'
import { messages } from './messages'
import './app.css'

interface AppProps {
  repository?: BookmarkRepository
}

type PendingSave = { input: BookmarkInput; bookmark?: Bookmark }

export function App({ repository = bookmarkRepository }: AppProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [formBookmark, setFormBookmark] = useState<Bookmark | null | undefined>(undefined)
  const [formErrors, setFormErrors] = useState<ValidationErrors>({})
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null)
  const [deleteBookmark, setDeleteBookmark] = useState<Bookmark | null>(null)
  const [busy, setBusy] = useState(false)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      setBookmarks(await repository.list())
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [repository])

  const tags = useMemo(() => deriveTags(bookmarks), [bookmarks])
  const visible = useMemo(() => filterBookmarks(bookmarks, query, tag), [bookmarks, query, tag])

  function closeOverlay() {
    setFormBookmark(undefined)
    setPendingSave(null)
    setDeleteBookmark(null)
    setFormErrors({})
    window.setTimeout(() => returnFocusRef.current?.focus(), 0)
  }

  function openCreate(trigger?: HTMLElement) {
    returnFocusRef.current = trigger ?? document.querySelector<HTMLElement>('[data-add-bookmark]')
    setFormErrors({})
    setFormBookmark(null)
  }

  function openEdit(bookmark: Bookmark, trigger: HTMLElement) {
    returnFocusRef.current = trigger
    setFormErrors({})
    setFormBookmark(bookmark)
  }

  function openDelete(bookmark: Bookmark, trigger: HTMLElement) {
    returnFocusRef.current = trigger
    setDeleteBookmark(bookmark)
  }

  async function persistSave(item: PendingSave) {
    setBusy(true)
    setMutationError('')
    try {
      const saved = item.bookmark
        ? await repository.update(item.bookmark.id, item.input)
        : await repository.create(item.input)
      setBookmarks((current) => item.bookmark
        ? current.map((bookmark) => bookmark.id === saved.id ? saved : bookmark)
        : [...current, saved])
      setStatus(item.bookmark ? `${saved.title} was updated.` : `${saved.title} was saved.`)
      closeOverlay()
    } catch {
      setMutationError(messages.saveError)
      setPendingSave(null)
    } finally {
      setBusy(false)
    }
  }

  function submitForm(input: BookmarkInput) {
    const validation = validateBookmarkInput(input)
    if (!validation.ok) {
      setFormErrors(validation.errors)
      return
    }
    setFormErrors({})
    const editing = formBookmark ?? undefined
    const duplicate = bookmarks.find((bookmark) => bookmark.url === validation.value.url && bookmark.id !== editing?.id)
    const pending = { input: validation.value, bookmark: editing }
    if (duplicate) setPendingSave(pending)
    else void persistSave(pending)
  }

  async function confirmDelete() {
    if (!deleteBookmark) return
    setBusy(true)
    setMutationError('')
    try {
      await repository.delete(deleteBookmark.id)
      setBookmarks((current) => current.filter((bookmark) => bookmark.id !== deleteBookmark.id))
      setStatus(`${deleteBookmark.title} was deleted.`)
      closeOverlay()
    } catch {
      setMutationError(messages.deleteError)
      setDeleteBookmark(null)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <main className="loading-shell"><span className="brand-mark">K</span><p>Opening your collection…</p></main>
  }

  if (loadError) {
    return <main className="error-page"><span className="brand-mark">K</span><h1>We couldn’t open Keepwise</h1><p>{messages.loadError}</p><button className="button primary" onClick={() => void load()}>Try again</button></main>
  }

  const filtered = Boolean(query || tag)

  return (
    <div className="app-shell" data-harness-ready="true">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Keepwise home"><span className="brand-mark">K</span><span>Keepwise</span></a>
        <p>Quietly keeping the good parts of the internet.</p>
        <button data-add-bookmark className="button primary" type="button" onClick={(event) => openCreate(event.currentTarget)}>+ Add bookmark</button>
      </header>
      <main>
        <section className="hero" aria-labelledby="page-title">
          <p className="eyebrow">Your personal library</p>
          <h1 id="page-title">A place for what’s<br /><em>worth returning to.</em></h1>
          <p className="hero-copy">Save the articles, tools, and small discoveries you don’t want the noise of the internet to bury.</p>
        </section>

        {bookmarks.length > 0 && <SearchAndFilter query={query} tag={tag} tags={tags} resultCount={visible.length} totalCount={bookmarks.length} onQueryChange={setQuery} onTagChange={setTag} onClear={() => { setQuery(''); setTag('') }} />}

        {mutationError && <div className="error-banner" role="alert">{mutationError}</div>}
        <p className="sr-only" role="status" aria-live="polite">{status}</p>

        {visible.length > 0 ? (
          <BookmarkList bookmarks={visible} onEdit={openEdit} onDelete={openDelete} />
        ) : (
          <EmptyState filtered={filtered} onAction={filtered ? () => { setQuery(''); setTag('') } : () => openCreate()} />
        )}
      </main>
      <footer><span>Keepwise</span><span>Stored privately in this browser</span></footer>

      {formBookmark !== undefined && !pendingSave && <BookmarkForm bookmark={formBookmark ?? undefined} busy={busy} errors={formErrors} onSubmit={submitForm} onCancel={closeOverlay} />}
      {pendingSave && <ConfirmDialog title="You already saved this address" confirmLabel="Save duplicate" busy={busy} onCancel={() => setPendingSave(null)} onConfirm={() => void persistSave(pendingSave)}><p>A bookmark with this same web address is already in your collection. Save another copy anyway?</p></ConfirmDialog>}
      {deleteBookmark && <ConfirmDialog title={`Delete “${deleteBookmark.title}”?`} confirmLabel="Delete bookmark" destructive busy={busy} onCancel={closeOverlay} onConfirm={() => void confirmDelete()}><p>This removes it from this browser. You can’t undo this action.</p></ConfirmDialog>}
    </div>
  )
}
