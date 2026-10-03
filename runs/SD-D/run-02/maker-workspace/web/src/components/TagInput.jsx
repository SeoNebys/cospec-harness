import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';

// Editable tag list with suggestions drawn from existing tags (FR-008).
export default function TagInput({ tags, onChange }) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    let active = true;
    if (text.trim()) {
      api.tags(text.trim()).then((r) => {
        if (active) setSuggestions(r.items.map((t) => t.name).filter((n) => !tags.includes(n)).slice(0, 6));
      });
    } else {
      setSuggestions([]);
    }
    return () => {
      active = false;
    };
  }, [text, tags]);

  function addTag(name) {
    const t = name.trim();
    if (!t) return;
    if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      onChange([...tags, t]);
    }
    setText('');
    setSuggestions([]);
  }

  function removeTag(name) {
    onChange(tags.filter((t) => t !== name));
  }

  return (
    <div className="tag-input">
      <div className="tag-chips">
        {tags.map((t) => (
          <span key={t} className="chip">
            {t}
            <button type="button" className="chip-x" onClick={() => removeTag(t)} aria-label={`Remove ${t}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="tag-text"
        value={text}
        placeholder="Add a tag and press Enter"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addTag(text);
          }
        }}
      />
      {suggestions.length > 0 && (
        <div className="tag-suggestions">
          {suggestions.map((s) => (
            <button key={s} type="button" className="suggestion" onClick={() => addTag(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
