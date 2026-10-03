import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { api } from './api.js';
import { BookmarkCard, TagInput, SearchBar, ConfirmDialog, MarkdownNote, StatusBadges } from './components.jsx';

export function markReady() {
  document.documentElement.setAttribute('data-harness-ready', 'true');
}

const SORTS = [
  ['created_desc', 'Newest first'],
  ['created_asc', 'Oldest first'],
  ['title_asc', 'Title A–Z'],
  ['title_desc', 'Title Z–A'],
];

function useListing(fetcher, deps) {
  const [data, setData] = useState({ items: [], total: 0 });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    fetcher()
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => { setLoading(false); markReady(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload };
}

// Shared list view used for main list, unread, and archive.
function ListView({ mode }) {
  const location = useLocation();
  const initial = new URLSearchParams(location.search);
  const splitParam = (k) => (initial.get(k) ? initial.get(k).split(',').filter(Boolean) : []);
  const [q, setQ] = useState(initial.get('q') || '');
  const [sort, setSort] = useState(initial.get('sort') || 'created_desc');

  // Initialize the sort control from the user's default-sort preference (FR-042),
  // unless the URL explicitly specifies a sort.
  useEffect(() => {
    if (!initial.get('sort')) {
      api.getPreferences().then((p) => setSort(p.defaultSort)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [includeTags, setIncludeTags] = useState(splitParam('includeTags'));
  const [excludeTags, setExcludeTags] = useState(splitParam('excludeTags'));
  const [selected, setSelected] = useState(new Set());
  const [toDelete, setToDelete] = useState(null);
  const [bulkTag, setBulkTag] = useState('');
  const [viewName, setViewName] = useState('');

  const params = {
    q,
    sort,
    includeTags: includeTags.join(','),
    excludeTags: excludeTags.join(','),
    unread: mode === 'unread' ? 'true' : undefined,
  };
  const fetcher = () =>
    mode === 'archive' ? api.listArchived(params) : api.listBookmarks(params);
  const { data, error, reload } = useListing(fetcher, [q, sort, includeTags.join(','), excludeTags.join(','), mode]);

  const toggle = (id, on) => {
    const next = new Set(selected);
    if (on) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const runBulk = async (action, extra = {}) => {
    const target = selected.size ? { ids: [...selected] } : { filter: params };
    await api.bulk({ target, action, ...extra });
    setSelected(new Set());
    reload();
  };

  const title = mode === 'unread' ? 'Unread' : mode === 'archive' ? 'Archive' : 'All bookmarks';

  return (
    <div>
      <h2>{title}</h2>
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <SearchBar value={q} onSearch={setQ} />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="sort">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="toolbar">
        <span className="muted">Include tags:</span>
        <TagInput tags={includeTags} onChange={setIncludeTags} />
        <span className="muted">Exclude tags:</span>
        <TagInput tags={excludeTags} onChange={setExcludeTags} />
        {(includeTags.length || excludeTags.length || q) ? (
          <button onClick={() => { setIncludeTags([]); setExcludeTags([]); setQ(''); }}>Clear filters</button>
        ) : null}
      </div>

      {mode === 'all' && (
        <div className="toolbar">
          <input type="text" placeholder="save current view as…" value={viewName}
            onChange={(e) => setViewName(e.target.value)} aria-label="save view name" />
          <button disabled={!viewName.trim()} onClick={async () => {
            await api.createView({ name: viewName.trim(), query: q, includeTags, excludeTags, sort });
            setViewName('');
            alert('View saved.');
          }}>Save view</button>
        </div>
      )}

      <div className="bulkbar">
        <span>{selected.size ? `${selected.size} selected` : `Act on all ${data.total} in view`}</span>
        <button onClick={() => runBulk('markUnread')}>Read later</button>
        <button onClick={() => runBulk('markRead')}>Mark read</button>
        {mode === 'archive'
          ? <button onClick={() => runBulk('restore').catch(() => {})} disabled>Restore (per item)</button>
          : <button onClick={() => runBulk('archive')}>Archive</button>}
        <input type="text" placeholder="tag" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} aria-label="bulk tag" />
        <button disabled={!bulkTag.trim()} onClick={() => { runBulk('addTags', { tags: [bulkTag.trim()] }); setBulkTag(''); }}>Add tag</button>
        <button disabled={!bulkTag.trim()} onClick={() => { runBulk('removeTags', { tags: [bulkTag.trim()] }); setBulkTag(''); }}>Remove tag</button>
        <button className="danger" onClick={() => setToDelete({ bulk: true })}>Delete</button>
      </div>

      {data.items.length === 0 ? (
        <div className="empty">{q ? 'No bookmarks match your search.' : 'No bookmarks yet.'}</div>
      ) : (
        data.items.map((bm) => (
          <BookmarkCard key={bm.id} bm={bm} selectable selected={selected.has(bm.id)}
            onSelect={toggle} onChanged={reload} onDelete={(b) => setToDelete(b)} />
        ))
      )}

      {toDelete && (
        <ConfirmDialog
          message={toDelete.bulk
            ? `Permanently delete ${selected.size ? selected.size : data.total} bookmark(s)? This cannot be undone.`
            : `Permanently delete "${toDelete.title || toDelete.url}"? This cannot be undone.`}
          onCancel={() => setToDelete(null)}
          onConfirm={async () => {
            if (toDelete.bulk) await runBulk('delete');
            else { await api.deleteBookmark(toDelete.id); reload(); }
            setToDelete(null);
          }}
        />
      )}
    </div>
  );
}

export const AllBookmarks = () => <ListView mode="all" />;
export const UnreadView = () => <ListView mode="unread" />;
export const ArchiveView = () => <ListView mode="archive" />;

export function AddBookmark() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { markReady(); }, []);

  const save = async () => {
    setError(null);
    try {
      const bm = await api.createBookmark({ url });
      navigate(`/bookmark/${bm.id}`);
    } catch (e) {
      if (e.code === 'duplicate' && e.existingId) {
        navigate(`/bookmark/${e.existingId}?dup=1`);
      } else {
        setError(e.message);
      }
    }
  };

  return (
    <div>
      <h2>Add a bookmark</h2>
      {error && <div className="error">{error}</div>}
      <div className="toolbar">
        <input className="search" type="text" placeholder="https://example.com/article"
          value={url} aria-label="url" onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
        <button className="primary" onClick={save} disabled={!url.trim()}>Save</button>
      </div>
      <p className="muted">Title, description, favicon, preview, and a self-contained snapshot are collected automatically.</p>
    </div>
  );
}

export function BookmarkDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bm, setBm] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ url: '', title: '', description: '', tags: [] });
  const [toDelete, setToDelete] = useState(false);
  const dup = new URLSearchParams(window.location.hash.split('?')[1] || '').get('dup');

  const load = useCallback(() => {
    api.getBookmark(id).then((b) => {
      setBm(b);
      setForm({ url: b.url, title: b.title, description: b.description, tags: b.tags });
      markReady();
    }).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Poll a few times while enrichment/snapshot are pending.
  useEffect(() => {
    if (!bm) return undefined;
    if (bm.snapshot.status === 'pending' || bm.archiveOrg.status === 'pending') {
      const t = setTimeout(load, 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [bm, load]);

  if (error) return <div className="error">{error}</div>;
  if (!bm) return <div className="empty">Loading…</div>;

  const saveFields = async () => {
    setError(null);
    try {
      const updated = await api.updateBookmark(id, {
        url: form.url, title: form.title, description: form.description, tags: form.tags,
      });
      setBm(updated);
      alert('Saved.');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <Link to="/">← Back</Link>
      <h2>Edit bookmark</h2>
      {dup && <div className="error">This address was already bookmarked — showing the existing entry.</div>}
      {error && <div className="error">{error}</div>}
      <div className="row" style={{ marginBottom: 10 }}><StatusBadges bm={bm} /></div>

      <div className="field"><label>Address</label>
        <input className="search" type="text" value={form.url} aria-label="edit url"
          onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
      <div className="field"><label>Title</label>
        <input className="search" type="text" value={form.title} aria-label="edit title"
          onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="field"><label>Description</label>
        <input className="search" type="text" value={form.description} aria-label="edit description"
          onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="field"><label>Tags</label>
        <TagInput tags={form.tags} onChange={(t) => setForm({ ...form, tags: t })} /></div>
      <button className="primary" onClick={saveFields}>Save changes</button>

      <h3>Note (Markdown)</h3>
      <MarkdownNote value={bm.note} html={bm.noteHtml}
        onSave={async (md) => { const u = await api.updateBookmark(id, { note: md }); setBm(u); }} />

      <h3>Preservation</h3>
      <div className="row">
        {bm.snapshot.url && <a href={bm.snapshot.url} target="_blank" rel="noreferrer">View snapshot ({bm.snapshot.kind})</a>}
        {bm.snapshot.status === 'failed' && <span className="badge failed">snapshot failed</span>}
        <button onClick={async () => { await api.archiveOrg(id); load(); }}>Save to Internet Archive</button>
        {bm.archiveOrg.status === 'failed' && <span className="badge failed">archive.org failed</span>}
        {bm.archiveOrg.url && <a href={bm.archiveOrg.url} target="_blank" rel="noreferrer">View on archive.org</a>}
      </div>

      <h3>Actions</h3>
      <div className="row">
        <button onClick={() => api.setReadState(id, !bm.isUnread).then((u) => setBm(u))}>
          {bm.isUnread ? 'Mark read' : 'Read later'}
        </button>
        {bm.isArchived
          ? <button onClick={() => api.restore(id).then((u) => setBm(u))}>Restore</button>
          : <button onClick={() => api.archive(id).then((u) => setBm(u))}>Archive</button>}
        <button className="danger" onClick={() => setToDelete(true)}>Delete</button>
      </div>

      {toDelete && (
        <ConfirmDialog message={`Permanently delete "${bm.title || bm.url}"?`}
          onCancel={() => setToDelete(false)}
          onConfirm={async () => { await api.deleteBookmark(id); navigate('/'); }} />
      )}
    </div>
  );
}

export function SavedViews() {
  const [views, setViews] = useState([]);
  const navigate = useNavigate();
  const load = () => api.listViews().then((v) => { setViews(v); markReady(); });
  useEffect(() => { load(); }, []);
  const open = (v) => {
    const p = new URLSearchParams();
    if (v.query) p.set('q', v.query);
    if (v.includeTags.length) p.set('includeTags', v.includeTags.join(','));
    if (v.excludeTags.length) p.set('excludeTags', v.excludeTags.join(','));
    navigate(`/?${p.toString()}`);
  };
  return (
    <div>
      <h2>Saved views</h2>
      {views.length === 0 && <div className="empty">No saved views yet. Create one from the bookmark list.</div>}
      {views.map((v) => (
        <div className="card" key={v.id}>
          <div className="body">
            <div className="title">{v.name}</div>
            <div className="muted">
              {v.query && <>query: <code>{v.query}</code> </>}
              {v.includeTags.length > 0 && <>+{v.includeTags.join(', ')} </>}
              {v.excludeTags.length > 0 && <>−{v.excludeTags.join(', ')}</>}
            </div>
            <div className="row">
              <button onClick={() => open(v)}>Open</button>
              <button onClick={async () => {
                const name = prompt('Rename view', v.name);
                if (name) { await api.updateView(v.id, { name }); load(); }
              }}>Rename</button>
              <button className="danger" onClick={async () => { await api.deleteView(v.id); load(); }}>Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ImportExport() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { markReady(); }, []);
  return (
    <div>
      <h2>Import / Export</h2>
      {error && <div className="error">{error}</div>}
      <h3>Import browser bookmarks</h3>
      <input type="file" accept=".html,text/html" aria-label="import file" onChange={async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try { setResult(await api.importFile(file)); setError(null); }
        catch (err) { setError(err.message); }
      }} />
      {result && <p className="badge ok">Imported {result.imported}, skipped {result.skipped} duplicate(s).</p>}
      <h3>Export</h3>
      <a href="/api/export"><button>Download bookmarks.html</button></a>
    </div>
  );
}

export function Preferences({ onApply }) {
  const [prefs, setPrefs] = useState(null);
  useEffect(() => { api.getPreferences().then((p) => { setPrefs(p); markReady(); }); }, []);
  if (!prefs) return <div className="empty">Loading…</div>;
  const save = async (next) => {
    const updated = await api.updatePreferences(next);
    setPrefs(updated);
    onApply(updated);
  };
  return (
    <div>
      <h2>Preferences</h2>
      <div className="field"><label>Default sort</label>
        <select value={prefs.defaultSort} aria-label="default sort"
          onChange={(e) => save({ ...prefs, defaultSort: e.target.value })}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select></div>
      <div className="field"><label>Items per page</label>
        <input type="number" min="1" max="500" value={prefs.itemsPerPage} aria-label="items per page"
          onChange={(e) => save({ ...prefs, itemsPerPage: Number(e.target.value) })} /></div>
      <div className="field"><label>Font size</label>
        <select value={prefs.fontSize} aria-label="font size"
          onChange={(e) => save({ ...prefs, fontSize: e.target.value })}>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select></div>
    </div>
  );
}
