import { useEffect, useState } from 'react'
import type { Bookmark } from '@shared/types'
import { NoteEditor } from '../components/NoteEditor'
import { TagInput } from '../components/TagInput'

// The detail/edit panel (US4): edit title, address, description, and a
// formatted note; archive (set aside) or permanently delete (with a
// confirmation guard). Opened from a card's Edit button and from the
// duplicate-save flow (FR-010/011/013/015/016/017).
export function BookmarkDetail({
  bookmarkId,
  onClose,
  onChanged
}: {
  bookmarkId: string
  onClose: () => void
  onChanged: () => void
}): JSX.Element {
  const [bookmark, setBookmark] = useState<Bookmark | null>(null)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [noteHtml, setNoteHtml] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    let active = true
    void window.api.getBookmark(bookmarkId).then((b) => {
      if (!active || !b) return
      setBookmark(b)
      setTitle(b.title)
      setUrl(b.url)
      setDescription(b.description)
      setNoteHtml(b.noteHtml ?? '')
    })
    void window.api.getTags(bookmarkId).then((t) => {
      if (active) setTags(t)
    })
    return () => {
      active = false
    }
  }, [bookmarkId])

  async function addTag(name: string): Promise<void> {
    await window.api.assignTags(bookmarkId, [name])
    setTags(await window.api.getTags(bookmarkId))
    onChanged()
  }

  async function removeTag(name: string): Promise<void> {
    await window.api.removeTag(bookmarkId, name)
    setTags(await window.api.getTags(bookmarkId))
    onChanged()
  }

  async function save(): Promise<void> {
    setError(null)
    const res = await window.api.updateBookmark(bookmarkId, { title, url, description, noteHtml })
    if (!res.ok) {
      setError(res.message)
      return
    }
    onChanged()
    onClose()
  }

  async function archiveIt(): Promise<void> {
    await window.api.setArchived(bookmarkId, !bookmark?.isArchived)
    onChanged()
    onClose()
  }

  async function deleteIt(): Promise<void> {
    await window.api.deleteBookmark(bookmarkId, true)
    onChanged()
    onClose()
  }

  if (!bookmark) {
    return (
      <div className="reader-overlay" onClick={onClose}>
        <div className="reader-panel" onClick={(e) => e.stopPropagation()}>
          <div className="reader-message">Loading…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="reader-overlay" onClick={onClose}>
      <div className="reader-panel" onClick={(e) => e.stopPropagation()}>
        <div className="reader-head">
          <span className="title">Edit bookmark</span>
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="reader-body detail-form">
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Address
            <input value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </label>
          <label>
            Tags
            <TagInput tags={tags} onAdd={addTag} onRemove={removeTag} />
          </label>
          <label>
            Note
            <NoteEditor valueHtml={noteHtml} onChange={setNoteHtml} />
          </label>
          {error && <div className="error">{error}</div>}

          <div className="detail-actions">
            <button onClick={save}>Save changes</button>
            <button className="secondary" onClick={archiveIt}>
              {bookmark.isArchived ? 'Restore to list' : 'Set aside (archive)'}
            </button>
            {!confirmingDelete ? (
              <button className="danger" onClick={() => setConfirmingDelete(true)}>
                Delete…
              </button>
            ) : (
              <span className="confirm-delete">
                Delete permanently?
                <button className="danger" onClick={deleteIt}>
                  Yes, delete
                </button>
                <button className="secondary" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
