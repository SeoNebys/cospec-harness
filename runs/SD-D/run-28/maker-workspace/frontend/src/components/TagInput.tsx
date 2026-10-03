import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.ts';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

/** Tag entry with existing-tag suggestions (FR-017). Shared by save + edit. */
export function TagInput({ tags, onChange, placeholder }: Props) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancel = false;
    const term = input.trim();
    if (!term) {
      setSuggestions([]);
      return;
    }
    api
      .tags(term)
      .then((r) => {
        if (cancel) return;
        setSuggestions(r.tags.map((t) => t.name).filter((n) => !tags.includes(n)).slice(0, 8));
        setActive(0);
      })
      .catch(() => setSuggestions([]));
    return () => {
      cancel = true;
    };
  }, [input, tags]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function add(name: string) {
    const t = name.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
    setSuggestions([]);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      if (open && suggestions[active]) add(suggestions[active]);
      else add(input);
    } else if (e.key === 'ArrowDown') {
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Backspace' && !input && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="tag-input-wrap" ref={boxRef}>
      <div className="tags" style={{ marginBottom: 6 }}>
        {tags.map((t) => (
          <span key={t} className="tag" onClick={() => onChange(tags.filter((x) => x !== t))}>
            {t} ✕
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        placeholder={placeholder ?? 'Add tags…'}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && suggestions.length > 0 && (
        <div className="suggest">
          {suggestions.map((s, i) => (
            <div key={s} className={i === active ? 'active' : ''} onMouseDown={() => add(s)}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
