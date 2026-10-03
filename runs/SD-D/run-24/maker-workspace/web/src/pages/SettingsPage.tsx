import { useRef, useState } from 'react';
import type { SortOrder, TextSize } from '../types';
import { usePreferences } from '../state/preferences';

export function SettingsPage() {
  const { prefs, save } = usePreferences();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState('');

  if (!prefs) return <div className="settings">Loading…</div>;

  async function doImport(file: File) {
    setImportMsg('Importing…');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/import', { method: 'POST', body: form });
    const data = await res.json();
    setImportMsg(
      `Imported ${data.imported}, merged ${data.merged}, skipped ${data.skippedInvalid ?? 0}.`
    );
  }

  return (
    <div className="settings">
      <h2>Settings</h2>

      <section>
        <h3>Display preferences</h3>
        <label>Default sort</label>
        <select
          value={prefs.default_sort}
          onChange={(e) => save({ default_sort: e.target.value as SortOrder })}
        >
          <option value="saved_desc">Newest saved</option>
          <option value="saved_asc">Oldest saved</option>
          <option value="title_asc">Title A–Z</option>
          <option value="title_desc">Title Z–A</option>
          <option value="updated_desc">Recently updated</option>
        </select>

        <label>Items per page</label>
        <select value={prefs.page_size} onChange={(e) => save({ page_size: Number(e.target.value) })}>
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <label>Text size</label>
        <select value={prefs.text_size} onChange={(e) => save({ text_size: e.target.value as TextSize })}>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </section>

      <section>
        <h3>Import / export</h3>
        <p className="muted">Standard browser bookmark HTML format (tags preserved via the TAGS attribute).</p>
        <div className="row">
          <a className="button" href="/api/export">
            Export bookmarks
          </a>
          <input
            ref={fileRef}
            type="file"
            accept=".html,text/html"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
          />
          <button onClick={() => fileRef.current?.click()}>Import bookmarks…</button>
        </div>
        {importMsg && <p className="muted">{importMsg}</p>}
      </section>
    </div>
  );
}
