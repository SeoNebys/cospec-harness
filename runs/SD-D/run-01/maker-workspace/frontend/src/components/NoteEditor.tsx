import { useEffect, useRef } from "react";

interface Props {
  valueHtml: string;
  onChange: (html: string) => void;
}

// A lightweight rich-text note editor (links, bold, bullet lists) producing HTML that the
// backend sanitizes to the same allowlist. Interim implementation in place of Tiptap
// (see plan research §7 fallback); the stored/emitted contract is identical.
export function NoteEditor({ valueHtml, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Seed the editable content once (and when switching to a different bookmark).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== valueHtml) {
      ref.current.innerHTML = valueHtml;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function exec(command: string, value?: string) {
    document.execCommand(command, false, value);
    ref.current?.focus();
    emit();
  }

  function addLink() {
    const url = window.prompt("Link address (https://…)");
    if (url) exec("createLink", url);
  }

  return (
    <div className="note-editor">
      <div className="note-toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}>
          <b>B</b>
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}>
          • List
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={addLink}>
          Link
        </button>
      </div>
      <div
        ref={ref}
        className="note-content"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Note"
        onInput={emit}
        onBlur={emit}
        suppressContentEditableWarning
      />
    </div>
  );
}
