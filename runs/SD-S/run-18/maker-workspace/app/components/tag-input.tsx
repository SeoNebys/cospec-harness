import { useState } from "react";

export function TagInput({ value, onChange, suggestions = [], id = "bookmark-tags", label = "Tags" }: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  id?: string;
  label?: string;
}) {
  const [draft, setDraft] = useState("");

  function addTag(raw: string) {
    const trimmed = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
    if (!trimmed || trimmed.length > 50 || value.length >= 20) return;
    const suggestion = suggestions.find((item) => item.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
    const display = suggestion ?? trimmed;
    if (!value.some((item) => item.toLocaleLowerCase() === display.toLocaleLowerCase())) onChange([...value, display]);
    setDraft("");
  }

  return (
    <div className="tag-field">
      <label htmlFor={id}>{label} <small>Optional</small></label>
      <div className="tag-input-wrap">
        {value.map((tag) => (
          <span className="tag-chip" key={tag}>{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((item) => item !== tag))}>×</button></span>
        ))}
        <input id={id} aria-label={label} list={`${id}-suggestions`} maxLength={50} value={draft} placeholder={value.length ? "Add another" : "Add tags"} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(draft); }
          if (event.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }} onBlur={() => addTag(draft)} />
        <datalist id={`${id}-suggestions`}>{suggestions.map((tag) => <option key={tag} value={tag} />)}</datalist>
      </div>
      <span className="field-help">Press Enter to add · {value.length}/20</span>
    </div>
  );
}
