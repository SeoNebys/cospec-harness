import { useRef, type ChangeEvent } from 'react';
import { FormattedNote } from './FormattedNote';

type Props = { value: string; onChange(value: string): void };

export function NoteEditor({ value, onChange }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after = before, placeholder = 'text') {
    const element = textarea.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    onChange(`${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function line(prefix: string) {
    const element = textarea.current;
    if (!element) return;
    const start = value.lastIndexOf('\n', element.selectionStart - 1) + 1;
    onChange(`${value.slice(0, start)}${prefix}${value.slice(start)}`);
    requestAnimationFrame(() => element.focus());
  }

  return (
    <div className="note-editor">
      <div className="format-toolbar" aria-label="Note formatting">
        <button type="button" title="Heading" onClick={() => line('## ')}>
          H
        </button>
        <button type="button" title="Bold" onClick={() => wrap('**')}>
          <strong>B</strong>
        </button>
        <button type="button" title="Italic" onClick={() => wrap('_')}>
          <em>I</em>
        </button>
        <button type="button" title="Bulleted list" onClick={() => line('- ')}>
          • List
        </button>
        <button type="button" title="Numbered list" onClick={() => line('1. ')}>
          1. List
        </button>
        <button type="button" title="Link" onClick={() => wrap('[', '](https://)', 'link text')}>
          ↗ Link
        </button>
      </div>
      <textarea
        ref={textarea}
        aria-label="Your note"
        maxLength={100_000}
        rows={7}
        value={value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
        placeholder="Why is this worth keeping? Add headings, lists, emphasis, or links…"
      />
      {value.trim() && (
        <div className="note-preview">
          <span className="field-hint">Preview</span>
          <FormattedNote value={value} />
        </div>
      )}
    </div>
  );
}
