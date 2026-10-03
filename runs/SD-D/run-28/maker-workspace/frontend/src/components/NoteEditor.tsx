import { useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

/** Lightweight markdown note editor with sanitized preview (FR-018). */
export function NoteEditor({ value, onChange }: Props) {
  const [preview, setPreview] = useState(false);
  const html = DOMPurify.sanitize(marked.parse(value || '', { async: false }) as string);
  return (
    <div>
      <div className="row-flex" style={{ marginBottom: 6 }}>
        <button type="button" onClick={() => setPreview(false)} disabled={!preview}>
          Write
        </button>
        <button type="button" onClick={() => setPreview(true)} disabled={preview}>
          Preview
        </button>
        <span className="muted">Markdown: **bold**, *italic*, # heading, - list, [link](url)</span>
      </div>
      {preview ? (
        <div className="note-render" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <textarea
          rows={5}
          value={value}
          placeholder="Your notes (markdown supported)…"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export function NoteView({ value }: { value: string }) {
  if (!value) return null;
  const html = DOMPurify.sanitize(marked.parse(value, { async: false }) as string);
  return <div className="note-render" dangerouslySetInnerHTML={{ __html: html }} />;
}
