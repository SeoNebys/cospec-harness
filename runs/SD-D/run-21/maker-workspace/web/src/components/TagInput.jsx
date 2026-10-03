import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

// Tag editor with existing-tag suggestions while typing (FR-012).
export default function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (input.trim()) {
      api.suggestTags(input.trim()).then((r) => {
        if (active) {
          setSuggestions((r.tags || []).filter((t) => !tags.includes(t)));
          setOpen(true);
        }
      });
    } else {
      setSuggestions([]);
      setOpen(false);
    }
    return () => {
      active = false;
    };
  }, [input, tags]);

  const addTag = (name) => {
    const clean = name.trim();
    if (clean && !tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      onChange([...tags, clean]);
    }
    setInput('');
    setSuggestions([]);
    setOpen(false);
  };

  const removeTag = (name) => onChange(tags.filter((t) => t !== name));

  return (
    <div className="tag-input" ref={boxRef}>
      <div className="tag-chips">
        {tags.map((t) => (
          <span key={t} className="chip">
            {t}
            <button type="button" onClick={() => removeTag(t)} aria-label={`Remove ${t}`}>
              ×
            </button>
          </span>
        ))}
      </div>
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
      />
      {open && suggestions.length > 0 && (
        <ul className="suggestions">
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
