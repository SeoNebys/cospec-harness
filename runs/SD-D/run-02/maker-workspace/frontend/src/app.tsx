import { useCallback, useEffect, useState } from 'react';
import { api, type Bookmark, type Preferences, type SavedSearch, type BulkAction } from './services/api.js';
import { BookmarkCard } from './components/BookmarkCard.js';
import { TagInput } from './components/TagInput.js';
import { NotesEditor } from './components/NotesEditor.js';

type View = 'all' | 'to_read' | 'archive' | 'importexport' | 'settings';

export function App() {
  const [view, setView] = useState<View>('all');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [editing, setEditing] = useState<Bookmark | null>(null);
  const [banner, setBanner] = useState<string>('');

  const archived = view === 'archive';

  const refresh = useCallback(async () => {
    let res;
    if (query.trim()) res = await api.search(query, archived);
    else res = await api.list({ sort, archived, read_state: view === 'to_read' ? 'to_read' : undefined });
    setBookmarks(res.bookmarks);
  }, [query, sort, archived, view]);

  useEffect(() => { refresh().catch((e) => setBanner(String(e.message))); }, [refresh]);

  // After saving, page details arrive asynchronously — refresh a couple of times
  // shortly after so the title/description/icon/preview appear on their own.
  const refreshSoon = useCallback(() => {
    [1200, 3000, 6000].forEach((ms) => window.setTimeout(() => refresh().catch(() => {}), ms));
  }, [refresh]);

  const handleSaveResult = (res: { bookmark: Bookmark; deduped: boolean }) => {
    if (res.deduped) {
      // Duplicate: quietly open the existing bookmark for editing (FR-006).
      setBanner('You already saved that — opening the one you have.');
      setEditing(res.bookmark);
    } else {
      setBanner('Saved! Fetching the page details…');
      refresh();
      refreshSoon();
    }
  };
  useEffect(() => { api.savedSearches().then((r) => setSaved(r.savedSearches)); }, [banner]);
  useEffect(() => {
    api.preferences().then((r) => {
      setPrefs(r.preferences);
      setSort(r.preferences.default_sort);
      document.documentElement.dataset.textSize = r.preferences.text_size;
    });
  }, []);

  const toggleSelect = (id: number) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllMatching = () => setSelected(new Set(bookmarks.map((b) => b.id)));
  const clearSelection = () => setSelected(new Set());

  const runBulk = async (action: BulkAction, tag?: string) => {
    if (action === 'delete' && !confirm(`Delete ${selected.size} bookmark(s)? This cannot be undone.`)) return;
    await api.bulk({ ids: [...selected], action, tag, archivedScope: archived });
    clearSelection();
    await refresh();
  };

  const deleteOne = async (b: Bookmark) => {
    if (!confirm(`Delete "${b.title || b.url}"? This cannot be undone.`)) return;
    await api.remove(b.id);
    await refresh();
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>📚 Bookmarks</h1>
        <nav>
          <button className={view === 'all' ? 'active' : ''} onClick={() => { setView('all'); setQuery(''); }}>All</button>
          <button className={view === 'to_read' ? 'active' : ''} onClick={() => { setView('to_read'); setQuery(''); }}>Read later</button>
          <button className={view === 'archive' ? 'active' : ''} onClick={() => { setView('archive'); setQuery(''); }}>Archive</button>
          <button className={view === 'importexport' ? 'active' : ''} onClick={() => setView('importexport')}>Import / Export</button>
          <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>Settings</button>
        </nav>
      </header>

      {banner && <div className="banner" onClick={() => setBanner('')}>{banner} ✕</div>}

      {view === 'importexport' ? (
        <ImportExport onDone={(msg) => { setBanner(msg); setView('all'); }} />
      ) : view === 'settings' ? (
        <Settings prefs={prefs} onSaved={(p) => { setPrefs(p); setSort(p.default_sort); document.documentElement.dataset.textSize = p.text_size; }} />
      ) : (
        <>
          <AddBookmark onResult={handleSaveResult} />

          <div className="toolbar">
            <SearchBar query={query} onChange={setQuery} />
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} aria-label="Sort">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title</option>
            </select>
            {query.trim() && (
              <button onClick={async () => {
                const name = prompt('Save this search as:');
                if (name) { await api.saveSearch(name, query); setBanner(`Saved search "${name}".`); }
              }}>Save search</button>
            )}
          </div>

          {saved.length > 0 && (
            <div className="saved-searches">
              <span className="muted">Saved:</span>
              {saved.map((s) => (
                <span key={s.id} className="saved-chip">
                  <button onClick={() => { setView('all'); setQuery(s.query); }}>{s.name}</button>
                  <button className="chip-x" onClick={async () => { await api.deleteSavedSearch(s.id); setBanner(' '); }} aria-label="Remove saved search">×</button>
                </span>
              ))}
            </div>
          )}

          {selected.size > 0 && (
            <BulkActionBar
              count={selected.size}
              archived={archived}
              onAction={runBulk}
              onSelectAll={selectAllMatching}
              onClear={clearSelection}
            />
          )}

          {bookmarks.length === 0 ? (
            <EmptyState searching={!!query.trim()} view={view} />
          ) : (
            <div className="list">
              {bookmarks.map((b) => (
                <BookmarkCard
                  key={b.id}
                  bookmark={b}
                  selected={selected.has(b.id)}
                  onToggleSelect={toggleSelect}
                  onEdit={setEditing}
                  onDelete={deleteOne}
                  onArchiveToggle={async (bm) => { await api.update(bm.id, { archived: !bm.archived }); refresh(); }}
                  onReadToggle={async (bm) => { await api.update(bm.id, { read_state: bm.read_state === 'to_read' ? 'read' : 'to_read' }); refresh(); }}
                  onTagClick={(tag) => { setView('all'); setQuery(`tag:${tag}`); }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <EditModal bookmark={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
    </div>
  );
}

function AddBookmark({ onResult }: { onResult: (res: { bookmark: Bookmark; deduped: boolean }) => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!url.trim()) return;
    setBusy(true); setErr('');
    try {
      const res = await api.create({ url });
      onResult(res);
      setUrl('');
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="add-box">
      <input
        className="add-url"
        placeholder="Paste a link to save…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />
      <button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      {err && <div className="field-error">{err}</div>}
    </div>
  );
}

function SearchBar({ query, onChange }: { query: string; onChange: (q: string) => void }) {
  return (
    <input
      className="search"
      placeholder='Search — words, "exact phrase", tag:name, OR, -exclude, ( )'
      value={query}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function BulkActionBar({ count, archived, onAction, onSelectAll, onClear }: {
  count: number; archived: boolean;
  onAction: (a: BulkAction, tag?: string) => void; onSelectAll: () => void; onClear: () => void;
}) {
  return (
    <div className="bulk-bar">
      <span>{count} selected</span>
      <button onClick={onSelectAll}>Select all matching</button>
      <button onClick={() => { const t = prompt('Tag to add:'); if (t) onAction('add-tag', t); }}>Add tag</button>
      <button onClick={() => { const t = prompt('Tag to remove:'); if (t) onAction('remove-tag', t); }}>Remove tag</button>
      <button onClick={() => onAction('mark-read')}>Mark read</button>
      <button onClick={() => onAction('mark-to-read')}>Mark to-read</button>
      {archived
        ? <button onClick={() => onAction('unarchive')}>Unarchive</button>
        : <button onClick={() => onAction('archive')}>Archive</button>}
      <button className="danger" onClick={() => onAction('delete')}>Delete</button>
      <button onClick={onClear}>Clear</button>
    </div>
  );
}

function EmptyState({ searching, view }: { searching: boolean; view: View }) {
  if (searching) return <div className="empty">No matching bookmarks.</div>;
  if (view === 'to_read') return <div className="empty">Nothing in your read-later pile. Mark a bookmark “Read later”.</div>;
  if (view === 'archive') return <div className="empty">Your archive is empty.</div>;
  return <div className="empty">No bookmarks yet. Paste a link above to save your first one.</div>;
}

function EditModal({ bookmark, onClose, onSaved }: { bookmark: Bookmark; onClose: () => void; onSaved: () => void }) {
  const [b, setB] = useState<Bookmark>(bookmark);
  const [err, setErr] = useState('');
  const save = async () => {
    try {
      await api.update(b.id, { title: b.title, url: b.url, description: b.description, notes: b.notes, tags: b.tags });
      onSaved();
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit bookmark</h2>
        <label>Title<input value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} /></label>
        <label>Address<input value={b.url} onChange={(e) => setB({ ...b, url: e.target.value })} /></label>
        <label>Description<input value={b.description} onChange={(e) => setB({ ...b, description: e.target.value })} /></label>
        <label>Tags</label>
        <TagInput tags={b.tags} onChange={(tags) => setB({ ...b, tags })} />
        <label>Notes</label>
        <NotesEditor value={b.notes} onChange={(notes) => setB({ ...b, notes })} />
        {err && <div className="field-error">{err}</div>}
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

function ImportExport({ onDone }: { onDone: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);
  const onImport = async (file: File) => {
    setBusy(true);
    try {
      const content = await file.text();
      const isJson = file.name.endsWith('.json');
      if (isJson) {
        const r = await api.restore(JSON.parse(content));
        onDone(`Restored ${r.restored} bookmark(s) (${r.skipped} skipped).`);
      } else {
        const r = await api.importContent(content);
        onDone(`Imported ${r.added} bookmark(s), ${r.duplicates} already present.`);
      }
    } catch (e) { onDone((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="panel">
      <h2>Import & Export</h2>
      <section>
        <h3>Import from your browser</h3>
        <p className="muted">Choose a bookmarks file your browser exported (HTML).</p>
        <input type="file" accept=".html,.htm" disabled={busy} onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
      </section>
      <section>
        <h3>Export</h3>
        <p className="muted">Download all your bookmarks as a browser-compatible file.</p>
        <a className="btn" href={api.exportUrl}>Download bookmarks.html</a>
      </section>
      <section>
        <h3>Backup & restore (everything)</h3>
        <p className="muted">A complete backup — links, notes, tags, and settings — to move to another computer.</p>
        <a className="btn" href={api.backupUrl}>Download full backup</a>
        <p className="muted">Restore a backup file:</p>
        <input type="file" accept=".json" disabled={busy} onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
      </section>
    </div>
  );
}

function Settings({ prefs, onSaved }: { prefs: Preferences | null; onSaved: (p: Preferences) => void }) {
  if (!prefs) return <div className="panel">Loading…</div>;
  const update = async (fields: Partial<Preferences>) => {
    const r = await api.updatePreferences(fields);
    onSaved(r.preferences);
  };
  return (
    <div className="panel">
      <h2>Settings</h2>
      <label>Default sort order
        <select value={prefs.default_sort} onChange={(e) => update({ default_sort: e.target.value as any })}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">By title</option>
        </select>
      </label>
      <label>Text size
        <select value={prefs.text_size} onChange={(e) => update({ text_size: e.target.value as any })}>
          <option value="normal">Normal</option>
          <option value="large">Large</option>
        </select>
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={prefs.archive_optin} onChange={(e) => update({ archive_optin: e.target.checked })} />
        Also save a copy to a public web archive when I save a bookmark (optional safety net)
      </label>
    </div>
  );
}
