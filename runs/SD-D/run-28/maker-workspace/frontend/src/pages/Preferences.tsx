import { useEffect, useRef, useState } from 'react';
import { api, type Preferences as Prefs } from '../api/client.ts';

interface Props {
  prefs: Prefs;
  onChange: (p: Prefs) => void;
}

/** Display preferences (FR-026) + import/export (FR-024/025). */
export function PreferencesPage({ prefs, onChange }: Props) {
  const [local, setLocal] = useState<Prefs>(prefs);
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setLocal(prefs), [prefs]);

  async function save() {
    const updated = await api.updatePreferences({ ...local });
    onChange(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function doImport(file: File) {
    setImportMsg('Importing…');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/import', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) {
      setImportMsg(data?.error?.message ?? 'Import failed.');
      return;
    }
    setImportMsg(`Imported ${data.imported}, merged ${data.merged}, skipped ${data.skipped}.`);
  }

  return (
    <div>
      <h2>Preferences</h2>
      <div className="card">
        <div className="field">
          <label>Default sort</label>
          <select value={local.defaultSort} onChange={(e) => setLocal({ ...local, defaultSort: e.target.value })}>
            <option value="date_added_desc">Newest first</option>
            <option value="date_added_asc">Oldest first</option>
            <option value="date_modified_desc">Recently modified</option>
            <option value="title_asc">Title A–Z</option>
            <option value="title_desc">Title Z–A</option>
            <option value="unread_first">Unread first</option>
          </select>
        </div>
        <div className="field">
          <label>Items shown per page</label>
          <input
            type="number"
            min={1}
            max={500}
            value={local.itemsShown}
            onChange={(e) => setLocal({ ...local, itemsShown: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>Text size</label>
          <select value={local.textSize} onChange={(e) => setLocal({ ...local, textSize: e.target.value })}>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
        <button className="primary" onClick={save}>
          Save preferences
        </button>
        {saved && <span className="muted" style={{ marginLeft: 10 }}>Saved.</span>}
      </div>

      <h2>Import / Export</h2>
      <div className="card">
        <p className="muted">Import or export bookmarks in the standard browser (Netscape) HTML format.</p>
        <div className="row-flex wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".html,text/html"
            style={{ width: 'auto' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
            }}
          />
          <a href="/api/export">
            <button type="button">Export bookmarks</button>
          </a>
        </div>
        {importMsg && <div className="muted" style={{ marginTop: 8 }}>{importMsg}</div>}
      </div>
    </div>
  );
}
