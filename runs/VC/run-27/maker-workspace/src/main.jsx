import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight, Bookmark, Check, ChevronDown, Clock3, Edit3,
  Grid2X2, Heart, Inbox, List, LoaderCircle, MoreHorizontal, Plus, Search,
  Sparkles, Tag, Trash2, X
} from 'lucide-react';
import { colors, starterBookmarks } from './data';
import './styles.css';

const STORAGE_KEY = 'kept-bookmarks-v1';

const host = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
};

const initials = (url) => host(url).split('.')[0].slice(0, 2).toUpperCase();

const relativeDate = (date) => {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(date));
};

function App() {
  const reviewAutofill = new URLSearchParams(window.location.search).get('review') === 'autofill';
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || starterBookmarks; }
    catch { return starterBookmarks; }
  });
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [activeTag, setActiveTag] = useState('All tags');
  const [sort, setSort] = useState('Newest first');
  const [view, setView] = useState('grid');
  const [modal, setModal] = useState(reviewAutofill ? { mode: 'add', initialUrl: 'https://react.dev/learn/thinking-in-react' } : null);
  const [reviewReady, setReviewReady] = useState(!reviewAutofill);
  const [menuId, setMenuId] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks)), [bookmarks]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); setModal({ mode: 'add' }); }
      if (e.key === 'Escape') { setModal(null); setMenuId(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tags = useMemo(() => [...new Set(bookmarks.flatMap((b) => b.tags))].sort(), [bookmarks]);
  const visible = useMemo(() => {
    let result = bookmarks.filter((b) => {
      if (section === 'favorites' && !b.favorite) return false;
      if (section === 'unread' && b.read) return false;
      if (activeTag !== 'All tags' && !b.tags.includes(activeTag)) return false;
      const haystack = `${b.title} ${b.description} ${b.url} ${b.tags.join(' ')}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
    return [...result].sort((a, b) => {
      if (sort === 'Oldest first') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === 'A–Z') return a.title.localeCompare(b.title);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [bookmarks, query, section, activeTag, sort]);

  const update = (id, changes) => setBookmarks((items) => items.map((b) => b.id === id ? { ...b, ...changes } : b));
  const remove = (id) => setBookmarks((items) => items.filter((b) => b.id !== id));
  const save = (payload) => {
    if (modal?.mode === 'edit') update(modal.bookmark.id, payload);
    else setBookmarks((items) => [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), favorite: false, read: false, color: colors[items.length % colors.length], ...payload }, ...items]);
    setModal(null);
  };

  const title = section === 'favorites' ? 'Favorites' : section === 'unread' ? 'Unread' : activeTag !== 'All tags' ? activeTag : 'All bookmarks';

  return (
    <div className="app-shell" data-harness-ready={reviewReady ? 'true' : undefined}>
      <header className="topbar">
        <button className="brand" onClick={() => { setSection('all'); setActiveTag('All tags'); }} aria-label="Kept home">
          <span className="brand-mark"><Bookmark size={18} fill="currentColor" /></span>
          <span>kept<span className="brand-dot">.</span></span>
        </button>
        <div className="search-wrap">
          <Search size={17} />
          <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your library…" aria-label="Search bookmarks" />
          <kbd>⌘ K</kbd>
        </div>
        <button className="primary-btn" onClick={() => setModal({ mode: 'add' })}><Plus size={18} /> Add bookmark</button>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <nav className="main-nav" aria-label="Bookmark views">
            <NavItem icon={Inbox} label="All bookmarks" count={bookmarks.length} active={section === 'all' && activeTag === 'All tags'} onClick={() => { setSection('all'); setActiveTag('All tags'); }} />
            <NavItem icon={Heart} label="Favorites" count={bookmarks.filter(b => b.favorite).length} active={section === 'favorites'} onClick={() => { setSection('favorites'); setActiveTag('All tags'); }} />
            <NavItem icon={Clock3} label="Unread" count={bookmarks.filter(b => !b.read).length} active={section === 'unread'} onClick={() => { setSection('unread'); setActiveTag('All tags'); }} />
          </nav>
          <div className="sidebar-heading"><span>Tags</span><button onClick={() => setModal({ mode: 'add' })} aria-label="Add tag"><Plus size={15} /></button></div>
          <div className="tag-nav">
            {tags.map((tag, i) => (
              <button key={tag} className={activeTag === tag ? 'active' : ''} onClick={() => { setActiveTag(tag); setSection('all'); }}>
                <span className="tag-dot" style={{ background: colors[i % colors.length] }} />{tag}
                <span>{bookmarks.filter(b => b.tags.includes(tag)).length}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-tip">
            <div><span>Quick capture</span><kbd>⌘ N</kbd></div>
            <p>Add something before the tab disappears.</p>
          </div>
        </aside>

        <main className="content">
          <div className="content-head">
            <div>
              <p className="eyebrow">Your library</p>
              <h1>{title}<span className="title-count">{visible.length}</span></h1>
            </div>
            <div className="view-actions">
              <label className="sort-select">Sort: <select value={sort} onChange={(e) => setSort(e.target.value)}><option>Newest first</option><option>Oldest first</option><option>A–Z</option></select><ChevronDown size={14} /></label>
              <div className="view-toggle"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={17} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={18} /></button></div>
            </div>
          </div>

          {visible.length ? (
            <div className={`bookmark-${view}`}>
              {visible.map((bookmark) => <BookmarkCard key={bookmark.id} bookmark={bookmark} view={view} onUpdate={update} onEdit={() => setModal({ mode: 'edit', bookmark })} onDelete={() => remove(bookmark.id)} menuOpen={menuId === bookmark.id} setMenuOpen={() => setMenuId(menuId === bookmark.id ? null : bookmark.id)} />)}
            </div>
          ) : (
            <div className="empty-state">
              <span><Search size={24} /></span>
              <h2>Nothing tucked away here</h2>
              <p>{query ? `No bookmarks match “${query}”.` : 'Save your first link and it’ll be waiting for you here.'}</p>
              {!query && <button className="primary-btn" onClick={() => setModal({ mode: 'add' })}><Plus size={18} /> Add bookmark</button>}
            </div>
          )}
        </main>
      </div>
      {modal && <BookmarkModal bookmark={modal.bookmark} initialUrl={modal.initialUrl} onLookupComplete={() => setReviewReady(true)} onClose={() => setModal(null)} onSave={save} />}
    </div>
  );
}

function NavItem({ icon: Icon, label, count, active, onClick }) {
  return <button className={active ? 'active' : ''} onClick={onClick}><Icon size={18} fill={label === 'Favorites' && active ? 'currentColor' : 'none'} /><span>{label}</span><em>{count}</em></button>;
}

function BookmarkCard({ bookmark, view, onUpdate, onEdit, onDelete, menuOpen, setMenuOpen }) {
  const [iconFailed, setIconFailed] = useState(false);
  return (
    <article className={`bookmark-card ${bookmark.read ? 'is-read' : ''}`}>
      <div className="card-top">
        <a className="favicon" href={bookmark.url} target="_blank" rel="noreferrer" style={{ '--accent': bookmark.color }} aria-label={`Open ${bookmark.title}`}>{bookmark.icon && !iconFailed ? <img src={bookmark.icon} alt="" onError={() => setIconFailed(true)} /> : initials(bookmark.url)}</a>
        <div className="card-actions">
          <button className={bookmark.favorite ? 'favorite active' : 'favorite'} onClick={() => onUpdate(bookmark.id, { favorite: !bookmark.favorite })} aria-label="Toggle favorite"><Heart size={17} fill={bookmark.favorite ? 'currentColor' : 'none'} /></button>
          <div className="menu-wrap">
            <button onClick={setMenuOpen} aria-label="More actions"><MoreHorizontal size={19} /></button>
            {menuOpen && <div className="card-menu">
              <button onClick={() => { onUpdate(bookmark.id, { read: !bookmark.read }); setMenuOpen(); }}><Check size={15} /> Mark {bookmark.read ? 'unread' : 'as read'}</button>
              <button onClick={() => { onEdit(); setMenuOpen(); }}><Edit3 size={15} /> Edit bookmark</button>
              <button className="danger" onClick={onDelete}><Trash2 size={15} /> Delete</button>
            </div>}
          </div>
        </div>
      </div>
      <div className="card-body">
        <a href={bookmark.url} target="_blank" rel="noreferrer" className="card-title">{bookmark.title}<ArrowUpRight size={16} /></a>
        <a href={bookmark.url} target="_blank" rel="noreferrer" className="card-domain">{host(bookmark.url)}</a>
        {view === 'grid' && <p>{bookmark.description}</p>}
      </div>
      <div className="card-footer">
        <div className="card-tags">{bookmark.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <time>{relativeDate(bookmark.createdAt)}</time>
      </div>
    </article>
  );
}

function BookmarkModal({ bookmark, initialUrl = '', onLookupComplete = () => {}, onClose, onSave }) {
  const [url, setUrl] = useState(bookmark?.url || initialUrl);
  const [title, setTitle] = useState(bookmark?.title || '');
  const [description, setDescription] = useState(bookmark?.description || '');
  const [tagText, setTagText] = useState(bookmark?.tags.join(', ') || '');
  const [icon, setIcon] = useState(bookmark?.icon || '');
  const [error, setError] = useState('');
  const [lookup, setLookup] = useState({ status: 'idle', message: '' });
  const titleTouched = useRef(Boolean(bookmark));
  const descriptionTouched = useRef(Boolean(bookmark));

  useEffect(() => {
    if (!url.trim() || (bookmark && url === bookmark.url)) { setLookup({ status: 'idle', message: '' }); return; }
    let cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = `https://${cleanUrl}`;
    try { new URL(cleanUrl); } catch { return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLookup({ status: 'loading', message: 'Fetching page details…' });
      setError('');
      try {
        const response = await fetch(`/api/metadata?url=${encodeURIComponent(cleanUrl)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not read that page.');
        if (!titleTouched.current && data.title) setTitle(data.title);
        if (!descriptionTouched.current && data.description) setDescription(data.description);
        if (data.icon) setIcon(data.icon);
        setLookup({ status: 'success', message: 'Page details added — everything stays editable.' });
        onLookupComplete();
      } catch (err) {
        if (err.name !== 'AbortError') {
          setLookup({ status: 'error', message: err.message || 'Could not fetch page details.' });
          onLookupComplete();
        }
      }
    }, 600);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [url, bookmark]);

  const submit = (e) => {
    e.preventDefault();
    let cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = `https://${cleanUrl}`;
    try { new URL(cleanUrl); } catch { setError('Please enter a valid web address.'); return; }
    if (!title.trim()) { setError('Give this bookmark a title.'); return; }
    onSave({ url: cleanUrl, title: title.trim(), description: description.trim(), icon, tags: tagText.split(',').map(t => t.trim()).filter(Boolean) });
  };
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <div className="modal-head"><div><p className="eyebrow">Keep it close</p><h2>{bookmark ? 'Edit bookmark' : 'Add a bookmark'}</h2></div><button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <label>Web address<input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a link to fill in the details" /></label>
        {lookup.status !== 'idle' && <div className={`lookup-status ${lookup.status}`}>
          <span>{lookup.status === 'loading' ? <LoaderCircle size={16} className="spin" /> : lookup.status === 'success' ? <Sparkles size={16} /> : <X size={16} />}</span>
          <p>{lookup.message}</p>
          {lookup.status === 'success' && icon && <img src={icon} alt="Website icon" />}
        </div>}
        <label>Title<input value={title} onChange={(e) => { titleTouched.current = true; setTitle(e.target.value); }} placeholder="Filled automatically from the page" /></label>
        <label>Description <span>Optional</span><textarea value={description} onChange={(e) => { descriptionTouched.current = true; setDescription(e.target.value); }} placeholder="Filled automatically when available" rows="3" /></label>
        <label>Tags <span>Comma separated</span><div className="tag-input"><Tag size={16} /><input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Design, Reading" /></div></label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button className="primary-btn" type="submit"><Bookmark size={17} /> {bookmark ? 'Save changes' : 'Save bookmark'}</button></div>
      </form>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
