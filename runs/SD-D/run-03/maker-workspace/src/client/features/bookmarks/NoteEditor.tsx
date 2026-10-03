import { useId, useRef, useState } from "react";
import { Button } from "../../components";
import { FormattedNote } from "./FormattedNote";

export interface NoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  initialMode?: "source" | "preview";
}

type Wrapper = { before: string; after: string; placeholder: string };

const wrappers = {
  heading: { before: "## ", after: "", placeholder: "Heading" },
  bold: { before: "**", after: "**", placeholder: "bold text" },
  italic: { before: "*", after: "*", placeholder: "italic text" },
  bullets: { before: "- ", after: "", placeholder: "list item" },
  numbers: { before: "1. ", after: "", placeholder: "list item" },
  link: { before: "[", after: "](https://example.com)", placeholder: "link text" },
  code: { before: "`", after: "`", placeholder: "code" },
} satisfies Record<string, Wrapper>;

export function NoteEditor({ value, onChange, initialMode = "source" }: NoteEditorProps) {
  const [mode, setMode] = useState(initialMode);
  const [showHelp, setShowHelp] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  function apply(wrapper: Wrapper) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || wrapper.placeholder;
    const replacement = `${wrapper.before}${selected}${wrapper.after}`;
    onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    textarea.focus();
    window.requestAnimationFrame(() => {
      const selectionStart = start + wrapper.before.length;
      textarea.setSelectionRange(selectionStart, selectionStart + selected.length);
    });
  }

  return (
    <section className="note-editor" aria-labelledby={`${id}-label`}>
      <div className="note-editor__heading">
        <label id={`${id}-label`} htmlFor={`${id}-source`}>
          Formatted note
        </label>
        <div className="note-editor__modes">
          <Button
            size="small"
            variant={mode === "source" ? "secondary" : "quiet"}
            aria-pressed={mode === "source"}
            onClick={() => setMode("source")}
          >
            Edit source
          </Button>
          <Button
            size="small"
            variant={mode === "preview" ? "secondary" : "quiet"}
            aria-pressed={mode === "preview"}
            onClick={() => setMode("preview")}
          >
            Preview note
          </Button>
        </div>
      </div>

      {mode === "source" ? (
        <>
          <div className="note-toolbar" role="toolbar" aria-label="Note formatting">
            <Button size="small" variant="quiet" onClick={() => apply(wrappers.heading)}>
              Heading
            </Button>
            <Button size="small" variant="quiet" onClick={() => apply(wrappers.bold)}>
              Bold
            </Button>
            <Button size="small" variant="quiet" onClick={() => apply(wrappers.italic)}>
              Italic
            </Button>
            <Button size="small" variant="quiet" onClick={() => apply(wrappers.bullets)}>
              Bulleted list
            </Button>
            <Button size="small" variant="quiet" onClick={() => apply(wrappers.numbers)}>
              Numbered list
            </Button>
            <Button size="small" variant="quiet" onClick={() => apply(wrappers.link)}>
              Link
            </Button>
            <Button size="small" variant="quiet" onClick={() => apply(wrappers.code)}>
              Inline code
            </Button>
          </div>
          <textarea
            ref={textareaRef}
            id={`${id}-source`}
            className="text-input text-area note-editor__source"
            aria-label="Note source"
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        </>
      ) : (
        <section className="note-editor__preview" aria-label="Formatted note preview">
          {value.trim() ? (
            <FormattedNote markdown={value} />
          ) : (
            <p className="note-editor__empty">Nothing to preview yet.</p>
          )}
        </section>
      )}

      <Button
        size="small"
        variant="quiet"
        aria-expanded={showHelp}
        onClick={() => setShowHelp((current) => !current)}
      >
        Formatting help
      </Button>
      {showHelp ? (
        <p className="note-editor__help">
          Headings, bold, italic, ordered and unordered lists, links, and inline code are supported.
          Raw HTML, images, and active content are not displayed.
        </p>
      ) : null}
    </section>
  );
}
