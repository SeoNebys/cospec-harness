import { useEffect, useRef, useState } from 'react';
import { suggestTags } from '../api/client';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

// Tag entry with reuse suggestions (FR-015a): typing shows existing matching
// tags so the same tag is reused rather than creating near-duplicates.
export function TagInput({ tags, onChange }: Props) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number>();

  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const { tags: found } = await suggestTags(input.trim());
      setSuggestions(found.filter((t) => !tags.includes(t)));
      setOpen(true);
    }, 150);
  }, [input, tags]);

  function addTag(name: string) {
    const clean = name.trim();
    if (clean && !tags.includes(clean)) onChange([...tags, clean]);
    setInput('');
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="tag-input">
      <div className="tag-chips">
        {tags.map((t) => (
          <span className="chip" key={t}>
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="tag-entry">
        <input
          value={input}
          placeholder="Add a tag…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(input);
            }
          }}
          onFocus={() => suggestions.length && setOpen(true)}
        />
        {open && suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.map((s) => (
              <li key={s}>
                <button type="button" onMouseDown={() => addTag(s)}>
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
