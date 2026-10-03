import React, { useState } from 'react';
import { api } from '../api/client.js';

// Left rail: views, tag filter, saved searches, import/export, preferences.
export default function Sidebar({
  view,
  onView,
  tags,
  activeTag,
  onTagFilter,
  savedSearches,
  onOpenSaved,
  onSaveCurrentSearch,
  onRenameSaved,
  onDeleteSaved,
  prefs,
  onPrefsChange,
  onImported,
  onError,
}) {
  const [savedName, setSavedName] = useState('');
  const fileRef = React.useRef(null);

  async function doImport(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const r = await api.import(file);
      onImported(r);
    } catch (err) {
      onError(err.message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <aside className="sidebar">
      <div className="brand">🔖 Bookmarks</div>

      <nav className="views">
        <button className={view === 'normal' ? 'active' : ''} onClick={() => onView('normal')}>All</button>
        <button className={view === 'unread' ? 'active' : ''} onClick={() => onView('unread')}>Unread</button>
        <button className={view === 'archived' ? 'active' : ''} onClick={() => onView('archived')}>Archived</button>
      </nav>

      <section className="side-section">
        <h3>Tags</h3>
        <div className="side-tags">
          {tags.length === 0 && <div className="muted">No tags yet</div>}
          {tags.map((t) => (
            <button
              key={t.name}
              className={`side-tag ${activeTag === t.name ? 'active' : ''}`}
              onClick={() => onTagFilter(activeTag === t.name ? '' : t.name)}
            >
              #{t.name} <span className="count">{t.count}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="side-section">
        <h3>Saved searches</h3>
        <div className="saved-list">
          {savedSearches.map((s) => (
            <div key={s.id} className="saved-item">
              <button className="saved-open" onClick={() => onOpenSaved(s)}>{s.name}</button>
              <button className="mini" title="Rename" onClick={() => onRenameSaved(s)}>✎</button>
              <button className="mini" title="Delete" onClick={() => onDeleteSaved(s)}>×</button>
            </div>
          ))}
        </div>
        <div className="saved-create">
          <input value={savedName} placeholder="Name this search" onChange={(e) => setSavedName(e.target.value)} />
          <button
            onClick={() => {
              if (savedName.trim()) {
                onSaveCurrentSearch(savedName.trim());
                setSavedName('');
              }
            }}
          >
            Save current
          </button>
        </div>
      </section>

      <section className="side-section">
        <h3>Import / Export</h3>
        <input ref={fileRef} type="file" accept=".html,text/html" onChange={doImport} />
        <a className="btn-link" href="/api/export">Export (Netscape)</a>
      </section>

      <section className="side-section">
        <h3>Display</h3>
        <label className="pref">
          Sort
          <select value={prefs.default_sort} onChange={(e) => onPrefsChange({ default_sort: e.target.value })}>
            <option value="date_added_desc">Newest first</option>
            <option value="date_added_asc">Oldest first</option>
            <option value="title_asc">Title A→Z</option>
            <option value="title_desc">Title Z→A</option>
            <option value="read_state">Unread first</option>
          </select>
        </label>
        <label className="pref">
          Items per page
          <input
            type="number"
            min="1"
            value={prefs.items_per_page}
            onChange={(e) => onPrefsChange({ items_per_page: Number(e.target.value) })}
          />
        </label>
        <label className="pref">
          Font size
          <select value={prefs.font_size} onChange={(e) => onPrefsChange({ font_size: e.target.value })}>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>
      </section>
    </aside>
  );
}
