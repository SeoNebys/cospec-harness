import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function SavedSearches({ current, onApply }) {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  function load() { api.savedSearches().then(r => setList(r.saved_searches)).catch(() => {}); }
  useEffect(load, []);

  async function save() {
    setErr('');
    if (!name.trim()) { setErr('Enter a name'); return; }
    try {
      await api.saveSearch({
        name: name.trim(),
        query: current.q || '',
        include_tags: current.include_tags || [],
        exclude_tags: current.exclude_tags || []
      });
      setName('');
      load();
    } catch (e) { setErr(e.message); }
  }

  async function rename(s) {
    const n = prompt('New name', s.name);
    if (n && n.trim()) { await api.updateSavedSearch(s.id, { name: n.trim() }); load(); }
  }

  async function remove(s) {
    if (confirm(`Delete saved search "${s.name}"?`)) { await api.deleteSavedSearch(s.id); load(); }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Saved searches</h2>
      <div className="row" style={{ marginBottom: 10 }}>
        <input placeholder="Save current search as…" value={name} onChange={e => setName(e.target.value)} />
        <button onClick={save}>Save current</button>
      </div>
      {err && <div className="status-failed">{err}</div>}
      <div className="muted" style={{ marginBottom: 8 }}>
        Current: q="{current.q || ''}" · +[{(current.include_tags || []).join(', ')}] · −[{(current.exclude_tags || []).join(', ')}]
      </div>
      {list.length === 0 && <div className="muted">No saved searches yet.</div>}
      {list.map(s => (
        <div key={s.id} className="row wrap" style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
          <strong style={{ flex: 1 }}>{s.name}</strong>
          <span className="muted" style={{ fontSize: '.85em' }}>
            q="{s.query}" +[{s.include_tags.join(', ')}] −[{s.exclude_tags.join(', ')}]
          </span>
          <button onClick={() => onApply(s)}>Apply</button>
          <button onClick={() => rename(s)}>Rename</button>
          <button className="danger" onClick={() => remove(s)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
