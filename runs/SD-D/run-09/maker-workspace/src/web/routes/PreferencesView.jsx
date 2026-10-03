import React, { useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { PrefsContext } from '../main.jsx';

export function PreferencesView() {
  const { prefs, reloadPrefs } = useContext(PrefsContext);
  const [form, setForm] = useState(prefs);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(prefs);
  }, [prefs]);

  if (!form) return <div className="empty">Loading…</div>;

  const set = (k) => (e) => setForm({ ...form, [k]: k === 'itemsPerPage' ? Number(e.target.value) : e.target.value });

  async function save(e) {
    e.preventDefault();
    setSaved(false);
    setError('');
    try {
      await api.updatePreferences(form);
      await reloadPrefs();
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Display preferences</h2>
      <form className="form" onSubmit={save}>
        {saved && <p style={{ color: '#1b7f43' }}>Preferences saved.</p>}
        {error && <p className="error">{error}</p>}

        <label>Default sort order</label>
        <select value={form.defaultSort} onChange={set('defaultSort')}>
          <option value="dateAdded_desc">Newest first</option>
          <option value="dateAdded_asc">Oldest first</option>
          <option value="title_asc">Title A–Z</option>
          <option value="title_desc">Title Z–A</option>
          <option value="dateUpdated_desc">Recently updated</option>
        </select>

        <label>Items shown per page</label>
        <input
          type="number"
          min="10"
          max="200"
          value={form.itemsPerPage}
          onChange={set('itemsPerPage')}
        />
        <p className="hint">Between 10 and 200.</p>

        <label>Font size</label>
        <select value={form.fontSize} onChange={set('fontSize')}>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>

        <div style={{ marginTop: 16 }}>
          <button className="primary" type="submit">
            Save preferences
          </button>
        </div>
      </form>
    </div>
  );
}
