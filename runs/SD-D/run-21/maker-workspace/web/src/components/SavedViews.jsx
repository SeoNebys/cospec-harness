import React, { useState } from 'react';

// Reusable saved views (US8): save current search + included/excluded tags,
// list/open/delete. Views resolve live and never alter bookmarks (FR-014).
export default function SavedViews({ views, activeViewId, currentQuery, onOpen, onCreate, onDelete, onClearView }) {
  const [name, setName] = useState('');
  const [included, setIncluded] = useState('');
  const [excluded, setExcluded] = useState('');
  const [showForm, setShowForm] = useState(false);

  const parseTags = (s) => s.split(',').map((t) => t.trim()).filter(Boolean);

  return (
    <div className="saved-views">
      <div className="saved-views-head">
        <h3>Saved views</h3>
        <button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '−' : '+ New'}
        </button>
      </div>
      {showForm && (
        <div className="view-form">
          <input placeholder="View name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Include tags (comma)" value={included} onChange={(e) => setIncluded(e.target.value)} />
          <input placeholder="Exclude tags (comma)" value={excluded} onChange={(e) => setExcluded(e.target.value)} />
          <p className="muted small">Search used: <code>{currentQuery || '(none)'}</code></p>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => {
              onCreate({
                name: name.trim(),
                query: currentQuery,
                includedTags: parseTags(included),
                excludedTags: parseTags(excluded),
              });
              setName('');
              setIncluded('');
              setExcluded('');
              setShowForm(false);
            }}
          >
            Save view
          </button>
        </div>
      )}
      <ul className="view-list">
        {activeViewId && (
          <li>
            <button type="button" className="secondary" onClick={onClearView}>
              ← Back to all
            </button>
          </li>
        )}
        {views.map((v) => (
          <li key={v.id} className={v.id === activeViewId ? 'active' : ''}>
            <button type="button" className="view-open" onClick={() => onOpen(v)}>
              {v.name}
            </button>
            <button type="button" className="danger tiny" onClick={() => onDelete(v)} aria-label={`Delete ${v.name}`}>
              ×
            </button>
          </li>
        ))}
        {views.length === 0 && <li className="muted small">No saved views yet.</li>}
      </ul>
    </div>
  );
}
