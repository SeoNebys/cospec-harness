import { useEffect, useRef, useState } from 'react'
import type { Bookmark, BookmarkInput } from '../domain/bookmark'
import type { ValidationErrors } from '../domain/urlNormalization'
import { parseTags } from '../domain/tagNormalization'

interface BookmarkFormProps {
  bookmark?: Bookmark
  busy: boolean
  errors: ValidationErrors
  onSubmit: (input: BookmarkInput) => void
  onCancel: () => void
}

export function BookmarkForm({ bookmark, busy, errors, onSubmit, onCancel }: BookmarkFormProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(bookmark?.title ?? '')
  const [url, setUrl] = useState(bookmark?.url ?? '')
  const [description, setDescription] = useState(bookmark?.description ?? '')
  const [tags, setTags] = useState(bookmark?.tags.join(', ') ?? '')

  useEffect(() => {
    dialogRef.current?.showModal()
    titleRef.current?.focus()
  }, [])

  return (
    <dialog ref={dialogRef} className="dialog form-dialog" aria-labelledby="form-title" onCancel={(event) => { event.preventDefault(); onCancel() }}>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit({ title, url, description, tags: parseTags(tags) }) }} noValidate>
        <button className="dialog-close" aria-label="Cancel and close" type="button" onClick={onCancel}>×</button>
        <p className="eyebrow">{bookmark ? 'Update your collection' : 'A link worth keeping'}</p>
        <h2 id="form-title">{bookmark ? 'Edit bookmark' : 'Add a bookmark'}</h2>
        <div className="field">
          <label htmlFor="title">Title <span aria-hidden="true">*</span></label>
          <input ref={titleRef} id="title" value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'title-error' : undefined} />
          {errors.title && <p className="field-error" id="title-error">{errors.title}</p>}
        </div>
        <div className="field">
          <label htmlFor="url">Web address <span aria-hidden="true">*</span></label>
          <input id="url" type="text" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="example.com" aria-invalid={Boolean(errors.url)} aria-describedby={errors.url ? 'url-error' : 'url-help'} />
          <p className="field-help" id="url-help">We’ll add https:// if you leave it out.</p>
          {errors.url && <p className="field-error" id="url-error">{errors.url}</p>}
        </div>
        <div className="field">
          <label htmlFor="description">Notes <span className="optional">Optional</span></label>
          <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
        </div>
        <div className="field">
          <label htmlFor="tags">Tags <span className="optional">Optional</span></label>
          <input id="tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="design, research, weekend" />
          <p className="field-help">Separate tags with commas.</p>
        </div>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : bookmark ? 'Save changes' : 'Save bookmark'}</button>
        </div>
      </form>
    </dialog>
  )
}
