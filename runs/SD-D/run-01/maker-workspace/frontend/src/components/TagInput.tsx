import { KeyboardEvent, useEffect, useState } from "react";
import { suggestTags } from "../services/api";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

// Tag entry with suggestions drawn from already-used tags (FR-010a), so similar tags
// don't proliferate. Add with Enter or comma; remove with the × on each chip.
export function TagInput({ tags, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const value = draft.trim();
    if (!value) {
      setSuggestions([]);
      return;
    }
    void suggestTags(value).then((all) => {
      if (active) {
        const lowerExisting = new Set(tags.map((t) => t.toLowerCase()));
        setSuggestions(all.filter((s) => !lowerExisting.has(s.toLowerCase())).slice(0, 8));
      }
    });
    return () => {
      active = false;
    };
  }, [draft, tags]);

  function addTag(name: string) {
    const clean = name.trim();
    if (!clean) return;
    if (!tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      onChange([...tags, clean]);
    }
    setDraft("");
    setSuggestions([]);
  }

  function removeTag(name: string) {
    onChange(tags.filter((t) => t !== name));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && tags.length) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className="tag-input">
      <div className="tag-chips">
        {tags.map((t) => (
          <span key={t} className="tag-chip">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => removeTag(t)}>
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          placeholder={tags.length ? "" : "Add tags…"}
          aria-label="Add a tag"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {suggestions.length > 0 && (
        <ul className="tag-suggestions">
          {suggestions.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => addTag(s)}>
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
