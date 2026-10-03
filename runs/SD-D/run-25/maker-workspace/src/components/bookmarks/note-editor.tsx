"use client";

import { useState } from "react";
import { NoteRenderer } from "./note-renderer";

export function NoteEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [preview, setPreview] = useState(false);
  return (
    <div className="note-editor">
      <div className="note-tabs" role="tablist" aria-label="Personal note view">
        <button type="button" role="tab" aria-selected={!preview} onClick={() => setPreview(false)}>Write</button>
        <button type="button" role="tab" aria-selected={preview} onClick={() => setPreview(true)}>Preview</button>
      </div>
      {preview ? <div className="note-preview"><NoteRenderer>{value || "Nothing to preview yet."}</NoteRenderer></div> : <textarea className="textarea note-input" value={value} maxLength={50000} onChange={(event) => onChange(event.target.value)} placeholder="Add your thoughts… Use Markdown for headings, emphasis, lists, quotes, links, and code." />}
      <div className="note-footer"><small className="muted">Markdown supported · raw HTML stays inactive</small><small className="muted">{value.length.toLocaleString()} / 50,000</small></div>
    </div>
  );
}
