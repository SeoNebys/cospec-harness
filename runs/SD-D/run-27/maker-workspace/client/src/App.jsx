import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api.js';
import BookmarkCard from './components/BookmarkCard.jsx';
import EmptyState from './components/EmptyState.jsx';
import TagInput from './components/TagInput.jsx';
import DetailView from './views/DetailView.jsx';
import ImportExport from './views/ImportExport.jsx';
import Preferences from './views/Preferences.jsx';
import SavedSearches from './views/SavedSearches.jsx';

const TABS = [
  { key: 'main', label: 'Bookmarks' },
  { key: 'read_later', label: 'Read later' },
  { key: 'archive', label: 'Archive' },
  { key: 'saved', label: 'Saved searches' },
  { key: 'io', label: 'Import / Export' },
  { key: 'prefs', label: 'Preferences' }
];

export default function App() {
  const [tab, setTab] = useState('main');
  const [prefs, setPrefs] = useState(null);
  const [ready, setReady] = useState(false);

  // list state
  const [q, setQ] = useState('');
  const [includeTags, setIncludeTags] = useState([]);
  const [excludeTags, setExcludeTags] = useState([]);
  const [sort, setSort] = useState('date_added');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 25 });
  const [queryError, setQueryError] = useState('');
  const [loading, setLoading] = useState(false);

  // add form (two-step: fetch metadata -> review/edit -> save)
  const [newUrl, setNewUrl] = useState('');
  const [addMsg, setAddMsg] = useState('');
  const [fetching, setFetching] = useState(false);
  const [draft, setDraft] = useState(null); // { url, title, description, tags, icon_url, preview_image_url, metadata_status }

  // selection
  const [selected, setSelected] = useState(new Set());
  const [detailId, setDetailId] = useState(null);

  const listView = tab === 'main' || tab === 'read_later' || tab === 'archive';

  useEffect(() => {
    api.getPreferences().then(r => {
      setPrefs(r.preferences);
      setSort(r.preferences.default_sort);
    }).catch(() => setPrefs({ default_sort: 'date_added', items_per_page: 25, text_size: 'medium' }));
  }, []);

  const load = useCallback(async () => {
    if (!listView || !prefs) return;
    setLoading(true); setQueryError('');
    try {
      const r = await api.listBookmarks({
        view: tab, q, sort, page,
        page_size: prefs.items_per_page,
        include_tags: includeTags.join(','),
        exclude_tags: excludeTags.join(',')
      });
      setData(r);
    } catch (e) {
      if (e.status === 400) { setQueryError(e.message); setData({ items: [], total: 0, page: 1, page_size: prefs.items_per_page }); }
      else setQueryError(e.message);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [tab, q, sort, page, prefs, includeTags, excludeTags, listView]);

  // debounce search
  const debRef = useRef(null);
  useEffect(() => {
    if (!listView || !prefs) { if (prefs) setReady(true); return; }
    clearTimeout(debRef.current);
    debRef.current = setTimeout(load, 250);
    return () => clearTimeout(debRef.current);
  }, [load, listView, prefs]);

  useEffect(() => { setPage(1); }, [q, includeTags, excludeTags, tab, sort]);
  useEffect(() => { setSelected(new Set()); }, [tab, q, includeTags, excludeTags, page]);

  // Step 1: fetch the automatically collected details for review (no save yet).
  async function fetchDetails() {
    if (!newUrl.trim()) return;
    setAddMsg(''); setFetching(true);
    try {
      const r = await api.previewBookmark(newUrl.trim());
      if (r.duplicate) {
        setAddMsg('Already saved — opening the existing bookmark to edit.');
        setDetailId(r.bookmark.id);
        setNewUrl('');
      } else {
        setDraft({
          url: newUrl.trim(),
          title: r.metadata.title || '',
          description: r.metadata.description || '',
          tags: [],
          icon_url: r.metadata.icon_url,
          preview_image_url: r.metadata.preview_image_url,
          metadata_status: r.metadata.metadata_status
        });
      }
    } catch (e) {
      setAddMsg(e.message);
    } finally {
      setFetching(false);
    }
  }

  // Step 2: save with the reviewed/edited title & description.
  async function saveDraft() {
    if (!draft) return;
    setAddMsg('');
    try {
      const r = await api.createBookmark(draft);
      setDraft(null);
      setNewUrl('');
      if (r.duplicate) { setAddMsg('Already saved — opening the existing bookmark.'); setDetailId(r.bookmark.id); }
      else setAddMsg('Saved.');
      load();
    } catch (e) {
      setAddMsg(e.message);
    }
  }

  function cancelDraft() { setDraft(null); setNewUrl(''); setAddMsg(''); }

  function selectOne(id, on) {
    const next = new Set(selected);
    if (on) next.add(id); else next.delete(id);
    setSelected(next);
  }
  function selectAllVisible(on) {
    setSelected(on ? new Set(data.items.map(i => i.id)) : new Set());
  }

  async function runBulk(action, params) {
    if (action === 'delete' && !confirm(`Delete ${selectionCount()} bookmark(s)? This cannot be undone.`)) return;
    const body = { action, params };
    if (selectAllMatching) {
      body.selection = { view: tab, q, include_tags: includeTags, exclude_tags: excludeTags };
    } else {
      body.ids = [...selected];
    }
    const r = await api.bulk(body);
    setAddMsg(`${r.affected} bookmark(s) updated.`);
    setSelected(new Set());
    setSelectAllMatching(false);
    load();
  }

  const [selectAllMatching, setSelectAllMatching] = useState(false);
  function selectionCount() { return selectAllMatching ? data.total : selected.size; }

  // quick per-item actions
  const act = {
    onOpenDetail: setDetailId,
    onToggleReadLater: async b => { await api.updateBookmark(b.id, { read_later: !b.read_later }); load(); },
    onToggleRead: async b => { await api.updateBookmark(b.id, { is_read: !b.is_read }); load(); },
    onArchive: async b => { await api.updateBookmark(b.id, { is_archived: true }); load(); },
    onUnarchive: async b => { await api.updateBookmark(b.id, { is_archived: false }); load(); },
    onDelete: async b => { if (confirm('Delete this bookmark?')) { await api.deleteBookmark(b.id); load(); } }
  };

  if (!prefs) return <div className="app">Loading…</div>;

  const totalPages = Math.max(1, Math.ceil(data.total / prefs.items_per_page));
  const bulkActive = selected.size > 0 || selectAllMatching;

  return (
    <div className="app" data-size={prefs.text_size} data-harness-ready={ready ? 'true' : undefined}>
      <header className="top">
        <h1>🔖 Bookmark Manager</h1>
      </header>

      <div className="card">
        <div className="row wrap">
          <input
            placeholder="Paste a URL…"
            value={newUrl}
            disabled={!!draft}
            onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !draft) fetchDetails(); }}
          />
          {!draft && (
            <button className="primary" onClick={fetchDetails} disabled={fetching}>
              {fetching ? 'Fetching…' : 'Fetch details'}
            </button>
          )}
        </div>
        {addMsg && <div className="muted" style={{ marginTop: 6 }}>{addMsg}</div>}

        {draft && (
          <div className="card" style={{ background: '#fafbff', marginTop: 10, marginBottom: 0 }}>
            <div className="muted" style={{ marginBottom: 8 }}>
              Review the automatically collected details, edit if needed, then save.
              {draft.metadata_status === 'failed' && <span className="status-failed"> Metadata could not be fetched — you can enter details manually.</span>}
            </div>
            {draft.preview_image_url && (
              <img src={draft.preview_image_url} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 8 }} onError={e => e.target.remove()} />
            )}
            <div className="field"><label>Title</label>
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className="field"><label>Description</label>
              <textarea rows={2} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></div>
            <div className="field"><label>Tags (optional)</label>
              <TagInput tags={draft.tags} onChange={t => setDraft({ ...draft, tags: t })} /></div>
            <div className="row">
              <span className="muted" style={{ flex: 1, fontSize: '.85em', wordBreak: 'break-all' }}>{draft.url}</span>
              <button onClick={cancelDraft}>Cancel</button>
              <button className="primary" onClick={saveDraft}>Save bookmark</button>
            </div>
          </div>
        )}
      </div>

      <nav className="tabs">
        {TABS.map(t => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </nav>

      {listView && (
        <>
          <div className="card">
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Search (supports #tag, "phrases", AND / OR / NOT, parentheses)</label>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder='e.g. #work AND (report OR "quarterly review") NOT draft' />
              {queryError && <div className="status-failed">{queryError}</div>}
            </div>
            <div className="row wrap" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label className="muted">Include tags</label>
                <TagInput tags={includeTags} onChange={setIncludeTags} />
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label className="muted">Exclude tags</label>
                <TagInput tags={excludeTags} onChange={setExcludeTags} />
              </div>
              <div>
                <label className="muted">Sort</label>
                <select value={sort} onChange={e => setSort(e.target.value)}>
                  <option value="date_added">Date added</option>
                  <option value="title">Title</option>
                  <option value="last_updated">Last updated</option>
                </select>
              </div>
            </div>
          </div>

          {bulkActive && (
            <div className="bulkbar row wrap">
              <span>{selectionCount()} selected</span>
              {!selectAllMatching && data.total > data.items.length && (
                <button onClick={() => setSelectAllMatching(true)}>Select all {data.total} matching</button>
              )}
              <div className="spacer" />
              <button onClick={() => { const t = prompt('Add tag(s), comma-separated'); if (t) runBulk('add_tags', { tags: t.split(',').map(x => x.trim()).filter(Boolean) }); }}>Add tags</button>
              <button onClick={() => { const t = prompt('Remove tag(s), comma-separated'); if (t) runBulk('remove_tags', { tags: t.split(',').map(x => x.trim()).filter(Boolean) }); }}>Remove tags</button>
              <button onClick={() => runBulk('archive')}>Archive</button>
              <button onClick={() => runBulk('unarchive')}>Restore</button>
              <button onClick={() => runBulk('mark_read')}>Mark read</button>
              <button onClick={() => runBulk('mark_unread')}>Mark unread</button>
              <button className="danger" onClick={() => runBulk('delete')}>Delete</button>
              <button onClick={() => { setSelected(new Set()); setSelectAllMatching(false); }}>Clear</button>
            </div>
          )}

          {data.items.length > 0 && (
            <div className="row" style={{ margin: '4px 2px' }}>
              <label className="muted"><input type="checkbox" className="checkbox" onChange={e => selectAllVisible(e.target.checked)} /> Select page</label>
              <div className="spacer" />
              <span className="muted">{data.total} total</span>
            </div>
          )}

          {loading && data.items.length === 0 && <div className="muted" style={{ padding: 16 }}>Loading…</div>}

          {!loading && data.items.length === 0 && !queryError && (
            <EmptyState
              title={
                tab === 'read_later' ? 'Your read-later list is empty'
                : tab === 'archive' ? 'Nothing archived'
                : (q || includeTags.length || excludeTags.length) ? 'No bookmarks match your search'
                : 'No bookmarks yet'}
              hint={tab === 'main' && !q ? 'Paste a URL above to save your first bookmark.' : 'Try adjusting your search or filters.'}
            />
          )}

          {data.items.map(bm => (
            <BookmarkCard key={bm.id} bm={bm} selected={selected.has(bm.id)} onSelect={selectOne} {...act} />
          ))}

          {totalPages > 1 && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
              <span className="muted">Page {page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      {tab === 'saved' && (
        <SavedSearches
          current={{ q, include_tags: includeTags, exclude_tags: excludeTags }}
          onApply={s => { setQ(s.query || ''); setIncludeTags(s.include_tags || []); setExcludeTags(s.exclude_tags || []); setTab('main'); }}
        />
      )}
      {tab === 'io' && <ImportExport onImported={() => setTab('main')} />}
      {tab === 'prefs' && <Preferences prefs={prefs} onChange={setPrefs} />}

      {detailId && (
        <DetailView id={detailId} onClose={() => setDetailId(null)} onSaved={load} />
      )}
    </div>
  );
}
