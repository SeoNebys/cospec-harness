import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';

// Tag entry with existing-tag suggestions (FR-010).
export default function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (input.trim()) {
      api.tags(input.trim()).then(r => {
        if (active) {
          setSuggestions(r.tags.filter(t => !tags.some(x => x.toLowerCase() === t.toLowerCase())));
          setOpen(true);
        }
      }).catch(() => {});
    } else {
      setSuggestions([]);
      setOpen(false);
    }
    return () => { active = false; };
  }, [input, tags]);

  function addTag(name) {
    const t = name.trim();
    if (!t) return;
    if (!tags.some(x => x.toLowerCase() === t.toLowerCase())) {
      onChange([...tags, t]);
    }
    setInput('');
    setOpen(false);
  }

  function removeTag(name) {
    onChange(tags.filter(t => t !== name));
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <div className="tags" style={{ marginBottom: 6 }}>
        {tags.map(t => (
          <span key={t} className="tag">
            {t} <a role="button" onClick={() => removeTag(t)} style={{ cursor: 'pointer' }}>×</a>
          </span>
        ))}
      </div>
      <input
        value={input}
        placeholder="Add a tag and press Enter"
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); addTag(input); }
        }}
      />
      {open && suggestions.length > 0 && (
        <div className="card" style={{ position: 'absolute', zIndex: 10, width: '100%', marginTop: 2, maxHeight: 160, overflow: 'auto' }}>
          {suggestions.map(s => (
            <div key={s} role="button" style={{ padding: '4px 2px', cursor: 'pointer' }} onClick={() => addTag(s)}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
