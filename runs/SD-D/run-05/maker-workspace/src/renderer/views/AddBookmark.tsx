import { useState } from 'react'

// The add-bookmark form (US1): paste an address and save. Title/description are
// optional — the app fills them in on its own after saving. Invalid addresses
// are rejected with guidance; saving an address you already have takes you to
// the existing one rather than making a duplicate.
export function AddBookmark({
  onSaved,
  onDuplicate
}: {
  onSaved: () => void
  onDuplicate: (id: string) => void
}): JSX.Element {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!url.trim()) return
    setBusy(true)
    setError(null)
    const res = await window.api.saveBookmark({ url, title: title || undefined })
    setBusy(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    setUrl('')
    setTitle('')
    if (res.duplicate) {
      onDuplicate(res.bookmark.id)
    } else {
      onSaved()
    }
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <input
        type="url"
        placeholder="Paste a web address (https://…)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        autoFocus
      />
      <input
        type="text"
        placeholder="Title (optional — filled in for you)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  )
}
