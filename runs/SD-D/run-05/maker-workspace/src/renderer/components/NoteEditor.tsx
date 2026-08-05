import { useEffect, useRef } from 'react'

// A small formatted-note editor (FR-014): a toolbar for bold, bullet list, and
// link, over an editable area. It emits HTML; the main process sanitizes it on
// save, so only safe basic formatting is ever stored. Deliberately dependency-
// free — enough for personal notes without a heavy editor library.
export function NoteEditor({
  valueHtml,
  onChange
}: {
  valueHtml: string
  onChange: (html: string) => void
}): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null)

  // Seed the editable area once from the stored note.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== valueHtml) {
      ref.current.innerHTML = valueHtml
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function emit(): void {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  function exec(command: string): void {
    document.execCommand(command)
    ref.current?.focus()
    emit()
  }

  function addLink(): void {
    const url = window.prompt('Link address (https://…)')
    if (url) {
      document.execCommand('createLink', false, url)
      emit()
    }
  }

  return (
    <div className="note-editor">
      <div className="note-toolbar">
        <button type="button" className="secondary" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}>
          <b>B</b>
        </button>
        <button
          type="button"
          className="secondary"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('insertUnorderedList')}
        >
          • List
        </button>
        <button type="button" className="secondary" onMouseDown={(e) => e.preventDefault()} onClick={addLink}>
          Link
        </button>
      </div>
      <div
        className="note-area"
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder="Why did you save this? (optional)"
      />
    </div>
  )
}
