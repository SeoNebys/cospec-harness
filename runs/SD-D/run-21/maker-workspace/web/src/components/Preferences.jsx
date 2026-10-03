import React from 'react';

// Display preferences (US11): default sort, information density, text size.
export default function Preferences({ prefs, onChange, onClose }) {
  const set = (patch) => onChange({ ...prefs, ...patch });
  return (
    <div className="prefs-panel">
      <div className="prefs-head">
        <h3>Display preferences</h3>
        <button type="button" className="secondary" onClick={onClose}>Close</button>
      </div>
      <label>
        Default sort
        <select value={prefs.defaultSort} onChange={(e) => set({ defaultSort: e.target.value })}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title_az">Title A–Z</option>
          <option value="title_za">Title Z–A</option>
          <option value="recently_updated">Recently updated</option>
        </select>
      </label>
      <label>
        Information density
        <select value={prefs.density} onChange={(e) => set({ density: e.target.value })}>
          <option value="comfortable">Comfortable (more detail)</option>
          <option value="compact">Compact (less detail)</option>
        </select>
      </label>
      <label>
        Text size
        <select value={prefs.textSize} onChange={(e) => set({ textSize: e.target.value })}>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </label>
    </div>
  );
}
