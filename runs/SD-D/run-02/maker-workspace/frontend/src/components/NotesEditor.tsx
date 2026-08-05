import { useEffect, useRef } from 'react';

/**
 * Minimal rich-text notes editor supporting the agreed basic subset — headings,
 * bold/italic, and lists (FR-020). Stores/returns HTML.
 */
export function NotesEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);

  const cmd = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  return (
    <div className="notes-editor">
      <div className="notes-toolbar">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('formatBlock', 'h3'); }}>H</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('bold'); }}><b>B</b></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('italic'); }}><i>I</i></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('insertUnorderedList'); }}>• List</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd('insertOrderedList'); }}>1. List</button>
      </div>
      <div
        ref={ref}
        className="notes-surface"
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        data-placeholder="Your notes…"
      />
    </div>
  );
}
