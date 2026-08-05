import { useMemo, useState } from 'react';

// Chip-based tag entry with suggestions drawn from tags already in use (FR-012),
// so the same concept isn't duplicated under near-identical spellings. Type and
// press Enter (or comma), or click a suggestion; tags are lowercased.

export function TagInput({
  value,
  suggestions,
  onChange,
}: {
  value: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function add(tag: string) {
    const t = tag.trim().toLowerCase();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  }
  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase();
    return suggestions
      .filter((s) => !value.includes(s) && (q === '' ? false : s.includes(q)))
      .slice(0, 6);
  }, [draft, suggestions, value]);

  return (
    <div className="tag-input">
      <div className="tag-input-chips">
        {value.map((t) => (
          <span className="tag chip-removable" key={t}>
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => remove(t)}>
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && draft === '' && value.length) {
              remove(value[value.length - 1]);
            }
          }}
          placeholder="Add a tag…"
          aria-label="Add a tag"
        />
      </div>
      {matches.length > 0 ? (
        <div className="tag-suggestions">
          {matches.map((s) => (
            <button type="button" key={s} className="tag-suggestion" onClick={() => add(s)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
