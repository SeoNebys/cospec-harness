import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

export function ConfirmDialog({ message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  return (
    <div className="modal-bg" role="dialog" aria-modal="true">
      <div className="modal">
        <p>{message}</p>
        <div className="row" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} data-testid="confirm-cancel">Cancel</button>
          <button className="danger" onClick={onConfirm} data-testid="confirm-ok">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatusBadges({ bm }) {
  const s = bm.snapshot || {};
  const a = bm.archiveOrg || {};
  return (
    <>
      {bm.isUnread && <span className="badge unread">read later</span>}
      {s.status === 'ready' && s.url && (
        <a className="badge ok" href={s.url} target="_blank" rel="noreferrer">
          snapshot ({s.kind})
        </a>
      )}
      {s.status === 'pending' && <span className="badge pending">snapshot…</span>}
      {s.status === 'failed' && (
        <span className="badge failed" title="Snapshot failed">snapshot failed</span>
      )}
      {a.status === 'pending' && <span className="badge pending">archive.org…</span>}
      {a.status === 'ready' && a.url && (
        <a className="badge ok" href={a.url} target="_blank" rel="noreferrer">archive.org</a>
      )}
      {a.status === 'failed' && (
        <span className="badge failed" title="Internet Archive failed">archive.org failed</span>
      )}
    </>
  );
}

export function BookmarkCard({ bm, selectable, selected, onSelect, onOpen, onChanged, onDelete }) {
  return (
    <div className="card" data-testid="bookmark-card">
      {selectable && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={(e) => onSelect(bm.id, e.target.checked)}
          aria-label={`select ${bm.title}`}
        />
      )}
      {bm.faviconUrl ? <img className="fav" src={bm.faviconUrl} alt="" /> : <span className="fav" />}
      {bm.previewUrl && <img className="preview" src={bm.previewUrl} alt="" />}
      <div className="body">
        <div className="title">
          <a href={bm.url} target="_blank" rel="noreferrer" onClick={() => onOpen && onOpen(bm)}>
            {bm.title || bm.url}
          </a>
        </div>
        {bm.description && <div className="desc">{bm.description}</div>}
        <div className="url">{bm.url}</div>
        <div className="row">
          {bm.tags.map((t) => (
            <span className="tag" key={t}>#{t}</span>
          ))}
          <StatusBadges bm={bm} />
        </div>
        <div className="row">
          <a href={`#/bookmark/${bm.id}`}>Edit</a>
          <button onClick={() => api.setReadState(bm.id, !bm.isUnread).then(onChanged)}>
            {bm.isUnread ? 'Mark read' : 'Read later'}
          </button>
          {bm.isArchived ? (
            <button onClick={() => api.restore(bm.id).then(onChanged)}>Restore</button>
          ) : (
            <button onClick={() => api.archive(bm.id).then(onChanged)}>Archive</button>
          )}
          <button className="danger" onClick={() => onDelete(bm)}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (input.trim()) {
      api.listTags(input.trim()).then((rows) => {
        if (active) {
          setSuggestions(rows.filter((r) => !tags.includes(r.name)));
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

  const add = (name) => {
    const clean = name.trim();
    if (clean && !tags.includes(clean)) onChange([...tags, clean]);
    setInput('');
    setOpen(false);
  };

  return (
    <div className="suggest" ref={boxRef}>
      <div className="row">
        {tags.map((t) => (
          <span className="tag" key={t}>
            #{t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}>×</button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        placeholder="add tag…"
        aria-label="add tag"
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(input);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <div className="suggest-list" data-testid="tag-suggestions">
          {suggestions.map((s) => (
            <div key={s.id} onClick={() => add(s.name)}>
              #{s.name} <span className="muted">({s.count})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SearchBar({ value, onSearch }) {
  const [q, setQ] = useState(value || '');
  return (
    <input
      className="search"
      type="search"
      value={q}
      placeholder='Search… e.g. report #work OR "exact phrase"'
      aria-label="search"
      onChange={(e) => setQ(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch(q);
      }}
      onBlur={() => onSearch(q)}
    />
  );
}

export function MarkdownNote({ value, html, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  useEffect(() => setDraft(value || ''), [value]);

  if (editing) {
    return (
      <div>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="note markdown" />
        <div className="row">
          <button className="primary" onClick={() => { onSave(draft); setEditing(false); }}>
            Save note
          </button>
          <button onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      {html ? (
        <div className="note-preview" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="muted">No note yet.</p>
      )}
      <button onClick={() => setEditing(true)}>{value ? 'Edit note' : 'Add note'}</button>
    </div>
  );
}
