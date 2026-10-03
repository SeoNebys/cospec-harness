import { useState } from 'react';
import { NoteRenderer } from './NoteRenderer.js';
export function NoteEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [preview, setPreview] = useState(false);
  return (
    <div className="note-editor">
      <div className="editor-tabs">
        <button
          type="button"
          className={!preview ? 'active' : ''}
          onClick={() => setPreview(false)}
        >
          Write
        </button>
        <button type="button" className={preview ? 'active' : ''} onClick={() => setPreview(true)}>
          Preview
        </button>
      </div>
      {preview ? (
        <NoteRenderer value={value} />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={9}
          maxLength={50000}
        />
      )}
      <details>
        <summary>Formatting help</summary>
        <p>
          Use <code>**bold**</code>, <code>*italic*</code>, <code>- list items</code>, numbered
          lists, and <code>[link text](https://…)</code>.
        </p>
      </details>
    </div>
  );
}
