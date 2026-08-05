import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';

/** Tag editor with reuse suggestions while typing (FR-018). */
export function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!draft.trim()) return setSuggestions([]);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const { tags: t } = await api.tags(draft.trim());
      setSuggestions(t.filter((x) => !tags.includes(x)));
    }, 120);
  }, [draft, tags]);

  const add = (name: string) => {
    const clean = name.trim();
    if (clean && !tags.includes(clean)) onChange([...tags, clean]);
    setDraft('');
    setSuggestions([]);
  };

  return (
    <div className="tag-input">
      <div className="tag-chips">
        {tags.map((t) => (
          <span key={t} className="chip">
            {t}
            <button className="chip-x" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>×</button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        placeholder="Add a tag…"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } }}
      />
      {suggestions.length > 0 && (
        <div className="suggestions">
          {suggestions.map((s) => (
            <button key={s} className="suggestion" onMouseDown={() => add(s)}>{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
