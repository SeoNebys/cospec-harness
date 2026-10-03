import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { navigate } from '../main.jsx';
import { setAppliedFilter } from '../lib/appliedFilter.js';
import { TagInput } from '../components/TagInput.jsx';

export function FiltersView() {
  const [filters, setFilters] = useState([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [includeTags, setIncludeTags] = useState([]);
  const [excludeTags, setExcludeTags] = useState([]);

  async function load() {
    try {
      setFilters(await api.filters());
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createFilter({ name, query, includeTags, excludeTags });
      setName('');
      setQuery('');
      setIncludeTags([]);
      setExcludeTags([]);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function apply(f) {
    setAppliedFilter(f);
    navigate('/');
  }

  async function remove(id) {
    if (!window.confirm('Delete this saved filter? Your bookmarks are not affected.')) return;
    await api.deleteFilter(id);
    load();
  }

  async function rename(f) {
    const newName = window.prompt('Rename filter:', f.name);
    if (!newName) return;
    await api.updateFilter(f.id, { name: newName });
    load();
  }

  return (
    <div>
      <h2>Saved filters</h2>
      {error && <p className="error">{error}</p>}

      <form className="form" onSubmit={create} style={{ marginBottom: 20 }}>
        <h3>New filter</h3>
        <label>Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        <label>Search query</label>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. react OR vue" />
        <label>Include tags</label>
        <TagInput value={includeTags} onChange={setIncludeTags} />
        <label>Exclude tags</label>
        <TagInput value={excludeTags} onChange={setExcludeTags} />
        <div style={{ marginTop: 12 }}>
          <button className="primary" type="submit" disabled={!name.trim()}>
            Save filter
          </button>
        </div>
      </form>

      {filters.length === 0 ? (
        <div className="empty">No saved filters yet.</div>
      ) : (
        filters.map((f) => (
          <div key={f.id} className="card">
            <div className="body">
              <p className="title">{f.name}</p>
              <div className="meta">
                {f.query && <span>“{f.query}”</span>}
                {f.includeTags.map((t) => (
                  <span key={t} className="tag">+#{t}</span>
                ))}
                {f.excludeTags.map((t) => (
                  <span key={t} className="tag" style={{ background: '#fde8e8', color: '#d23b3b' }}>−#{t}</span>
                ))}
              </div>
              <div className="row-actions" style={{ marginTop: 8 }}>
                <button className="primary" onClick={() => apply(f)}>Apply</button>
                <button onClick={() => rename(f)}>Rename</button>
                <button className="danger" onClick={() => remove(f.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
