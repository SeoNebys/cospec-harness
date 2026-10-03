"use client";

import { useState } from "react";

export function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [value, setValue] = useState("");
  function add() {
    const name = value.trim().replace(/\s+/g, " ");
    if (!name || tags.some((tag) => tag.toLocaleLowerCase() === name.toLocaleLowerCase())) return setValue("");
    if (tags.length < 50) onChange([...tags, name]);
    setValue("");
  }
  return (
    <div className="tag-editor">
      {tags.length > 0 && <ul className="tag-list" aria-label="Selected tags">{tags.map((tag) => (
        <li key={tag} className="tag"><span>{tag}</span><button type="button" onClick={() => onChange(tags.filter((item) => item !== tag))} aria-label={`Remove ${tag} tag`}>×</button></li>
      ))}</ul>}
      <div className="tag-entry">
        <input value={value} maxLength={50} placeholder="Add a tag" aria-label="Tag name" onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(); } }} />
        <button className="button secondary small" type="button" onClick={add} disabled={!value.trim()}>Add</button>
      </div>
      <p className="field-hint">Press Enter or comma to add a tag.</p>
    </div>
  );
}
