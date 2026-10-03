import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Tag editor with existing-tag type-ahead suggestions (FR-009).
export function TagInput({ value = [], onChange }) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    if (!text) {
      setSuggestions([]);
      return undefined;
    }
    api
      .tags(text)
      .then((tags) => {
        if (!active) return;
        setSuggestions(tags.map((t) => t.name).filter((n) => !value.includes(n)).slice(0, 8));
      })
      .catch(() => setSuggestions([]));
    return () => {
      active = false;
    };
  }, [text, value]);

  function add(name) {
    const clean = name.trim().replace(/^#/, '');
    if (clean && !value.some((v) => v.toLowerCase() === clean.toLowerCase())) {
      onChange([...value, clean]);
    }
    setText('');
    setSuggestions([]);
    setOpen(false);
  }

  function remove(name) {
    onChange(value.filter((v) => v !== name));
  }

  return (
    <div className="tagsuggest">
      <input
        type="text"
        placeholder="Add a tag and press Enter"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(text);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <div className="menu">
          {suggestions.map((s) => (
            <div key={s} onMouseDown={() => add(s)}>
              #{s}
            </div>
          ))}
        </div>
      )}
      <div className="chips">
        {value.map((t) => (
          <span key={t} className="chip">
            #{t}
            <button type="button" onClick={() => remove(t)} aria-label={`remove ${t}`}>
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
