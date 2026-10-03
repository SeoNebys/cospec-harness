import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function Preferences({ prefs, onChange }) {
  const [local, setLocal] = useState(prefs);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setLocal(prefs); }, [prefs]);

  async function save(next) {
    setLocal(next);
    const r = await api.putPreferences(next);
    onChange(r.preferences);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Display preferences</h2>
      <div className="field">
        <label>Default sort</label>
        <select value={local.default_sort} onChange={e => save({ ...local, default_sort: e.target.value })}>
          <option value="date_added">Date added</option>
          <option value="title">Title</option>
          <option value="last_updated">Last updated</option>
        </select>
      </div>
      <div className="field">
        <label>Items shown per page</label>
        <select value={local.items_per_page} onChange={e => save({ ...local, items_per_page: parseInt(e.target.value, 10) })}>
          {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Text size</label>
        <select value={local.text_size} onChange={e => save({ ...local, text_size: e.target.value })}>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>
      {saved && <div className="muted">Saved.</div>}
    </div>
  );
}
