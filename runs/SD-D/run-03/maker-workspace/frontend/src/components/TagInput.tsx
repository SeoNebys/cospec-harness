// Tag input with autocomplete from existing tags, avoiding near-duplicates (US3, FR-004a).

import { useEffect, useId, useState } from "react";
import { fetchTags } from "../api/client";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ tags, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const listId = useId();

  useEffect(() => {
    let active = true;
    fetchTags({ prefix: draft }).then((all) => {
      if (active) setSuggestions(all.filter((t) => !tags.includes(t)));
    });
    return () => {
      active = false;
    };
  }, [draft, tags]);

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="tag-input" data-testid="tag-input">
      <div className="tag-input-chips">
        {tags.map((tag) => (
          <span key={tag} className="tag-chip tag-chip--selected">
            {tag}
            <button
              type="button"
              className="tag-remove"
              aria-label={`Remove tag ${tag}`}
              onClick={() => removeTag(tag)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        list={listId}
        value={draft}
        placeholder="Add a tag and press Enter"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag(draft);
          }
        }}
        data-testid="tag-input-field"
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
