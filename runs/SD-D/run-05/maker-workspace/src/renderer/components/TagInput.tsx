import { useEffect, useState } from 'react'

// Tag entry with reuse suggestions (FR-019, FR-022): shows the current tags as
// removable chips and, as you type, suggests existing tags so you reuse one
// instead of creating "recipe" / "recipes" duplicates.
export function TagInput({
  tags,
  onAdd,
  onRemove
}: {
  tags: string[]
  onAdd: (name: string) => void
  onRemove: (name: string) => void
}): JSX.Element {
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    let active = true
    if (text.trim()) {
      void window.api.suggestTags(text.trim()).then((s) => {
        if (active) setSuggestions(s.filter((name) => !tags.includes(name)))
      })
    } else {
      setSuggestions([])
    }
    return () => {
      active = false
    }
  }, [text, tags])

  function add(name: string): void {
    const clean = name.trim()
    if (!clean || tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setText('')
      setSuggestions([])
      return
    }
    onAdd(clean)
    setText('')
    setSuggestions([])
  }

  return (
    <div className="tag-input">
      <div className="tag-chips">
        {tags.map((t) => (
          <span className="tag-chip" key={t}>
            {t}
            <button type="button" className="chip-x" onClick={() => onRemove(t)} aria-label={`Remove ${t}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        value={text}
        placeholder="Add a tag…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(text)
          }
        }}
      />
      {suggestions.length > 0 && (
        <div className="tag-suggestions">
          {suggestions.map((s) => (
            <button type="button" key={s} className="secondary" onClick={() => add(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
