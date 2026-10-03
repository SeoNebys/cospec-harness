import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive, Bookmark, BookmarkPlus, BookOpen, Check, CheckCircle2, ChevronDown,
  Clock3, ExternalLink, Heart, LayoutGrid, Link2, List, LoaderCircle, Menu,
  MoreHorizontal, Pencil, Plus, Search, Settings, Sparkles, Trash2, X
} from 'lucide-react';
import './styles.css';

const seedBookmarks = [
  { id: 1, title: 'The Psychology of Design', url: 'https://growth.design/psychology', domain: 'growth.design', description: 'A practical guide to cognitive biases and how they shape the products we use.', collection: 'Design', tags: ['design', 'psychology'], color: '#ff6c59', initials: 'GD', icon: 'https://growth.design/favicon.ico', favorite: true, toRead: true, createdAt: '2026-09-20' },
  { id: 2, title: 'A Guide to Modern CSS', url: 'https://web.dev/learn/css', domain: 'web.dev', description: 'Learn CSS fundamentals and the latest features with practical examples.', collection: 'Development', tags: ['css', 'frontend'], color: '#4f76e8', initials: 'W', icon: 'https://web.dev/favicon.ico', favorite: false, toRead: true, createdAt: '2026-09-19' },
  { id: 3, title: 'How to Build a Second Brain', url: 'https://fortelabs.com/blog/basboverview', domain: 'fortelabs.com', description: 'A proven method to organize your digital life and unlock your creative potential.', collection: 'Reading', tags: ['productivity', 'notes'], color: '#f3ab34', initials: 'F', icon: 'https://fortelabs.com/favicon.ico', favorite: true, toRead: true, createdAt: '2026-09-18' },
  { id: 4, title: 'Mobbin — UI & UX Inspiration', url: 'https://mobbin.com', domain: 'mobbin.com', description: 'A hand-picked collection of the latest mobile and web design patterns.', collection: 'Inspiration', tags: ['ui', 'patterns'], color: '#8355df', initials: 'M', icon: 'https://mobbin.com/favicon.ico', favorite: false, toRead: false, createdAt: '2026-09-17' },
  { id: 5, title: 'Designing for Calm Technology', url: 'https://calmtech.com', domain: 'calmtech.com', description: 'Principles for designing technology that informs without demanding attention.', collection: 'Design', tags: ['design', 'thinking'], color: '#55a47c', initials: 'CT', icon: 'https://calmtech.com/favicon.ico', favorite: false, toRead: false, createdAt: '2026-09-15' },
  { id: 6, title: 'The 2026 State of JavaScript', url: 'https://stateofjs.com', domain: 'stateofjs.com', description: 'Discover the latest trends, tools, and opinions shaping the JavaScript ecosystem.', collection: 'Development', tags: ['javascript', 'report'], color: '#262e46', initials: 'JS', icon: 'https://stateofjs.com/favicon.ico', favorite: true, toRead: false, createdAt: '2026-09-12' },
];

const collections = [
  { name: 'Design', color: '#ff6c59' },
  { name: 'Development', color: '#5277e8' },
  { name: 'Inspiration', color: '#8c62db' },
  { name: 'Reading', color: '#e6a432' },
];

const emptyForm = { url: '', title: '', description: '', collection: 'Design', tags: '', icon: '', toRead: true };

function getDomain(url) {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', ''); }
  catch { return url.replace(/^https?:\/\//, '').split('/')[0] || 'website'; }
}

function normalizeUrl(url) {
  return url.startsWith('http') ? url : `https://${url}`;
}

function fallbackIcon(url) {
  try { return `${new URL(url).origin}/favicon.ico`; }
  catch { return ''; }
}

function App() {
  const [bookmarks, setBookmarks] = useState(() => {
    const saved = localStorage.getItem('nest-bookmarks');
    return saved ? JSON.parse(saved).map(item => ({
      ...item,
      toRead: item.toRead ?? false,
      icon: item.icon || fallbackIcon(item.url)
    })) : seedBookmarks;
  });
  const [active, setActive] = useState('All bookmarks');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('Newest first');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [menu, setMenu] = useState(null);
  const [sidebar, setSidebar] = useState(false);
  const [toast, setToast] = useState('');
  const searchRef = useRef(null);

  useEffect(() => localStorage.setItem('nest-bookmarks', JSON.stringify(bookmarks)), [bookmarks]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') { setModal(false); setMenu(null); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const visible = useMemo(() => {
    let items = bookmarks.filter(b => {
      const matchesView = active === 'All bookmarks' || active === 'Recently added' || (active === 'Favorites' && b.favorite) || (active === 'To read' && b.toRead) || b.collection === active;
      const haystack = `${b.title} ${b.description} ${b.domain} ${b.tags.join(' ')}`.toLowerCase();
      return matchesView && haystack.includes(query.toLowerCase());
    });
    if (sort === 'A–Z') items = [...items].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'Oldest first') items = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (sort === 'Newest first') items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (active === 'Recently added') items = items.slice(0, 4);
    return items;
  }, [bookmarks, active, query, sort]);

  function openAdd() { setEditing(null); setForm(emptyForm); setModal(true); }
  function openEdit(item) {
    setEditing(item.id);
    setForm({ url: item.url, title: item.title, description: item.description, collection: item.collection, tags: item.tags.join(', '), icon: item.icon || '', toRead: item.toRead });
    setMenu(null); setModal(true);
  }
  function saveBookmark(e) {
    e.preventDefault();
    const domain = getDomain(form.url);
    const data = {
      ...form, url: normalizeUrl(form.url), domain,
      title: form.title.trim() || domain,
      description: form.description.trim(),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    if (editing) {
      setBookmarks(items => items.map(item => item.id === editing ? { ...item, ...data } : item));
      setToast('Bookmark updated');
    } else {
      const color = collections.find(c => c.name === form.collection)?.color || '#2e796d';
      setBookmarks(items => [{ ...data, id: Date.now(), color, initials: domain.slice(0, 2).toUpperCase(), favorite: false, createdAt: new Date().toISOString().slice(0, 10) }, ...items]);
      setToast('Bookmark saved to your nest');
    }
    setModal(false);
  }
  function toggleFavorite(id) { setBookmarks(items => items.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item)); }
  function toggleToRead(id) {
    const item = bookmarks.find(bookmark => bookmark.id === id);
    setBookmarks(items => items.map(bookmark => bookmark.id === id ? { ...bookmark, toRead: !bookmark.toRead } : bookmark));
    setToast(item?.toRead ? 'Marked as read' : 'Added to your reading list');
  }
  function removeBookmark(id) { setBookmarks(items => items.filter(item => item.id !== id)); setMenu(null); setToast('Bookmark deleted'); }
  function setNavigation(name) { setActive(name); setSidebar(false); }

  return (
    <div className="app-shell" data-harness-ready="true" onClick={() => menu && setMenu(null)}>
      <header className="topbar">
        <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setSidebar(true)}><Menu size={20}/></button>
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); setNavigation('All bookmarks'); }}>
          <span className="brand-mark"><Bookmark size={20} fill="currentColor"/></span>
          <span>Nest</span>
        </a>
        <div className="top-search">
          <Search size={18}/>
          <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your bookmarks..." aria-label="Search bookmarks"/>
          <kbd>⌘ K</kbd>
        </div>
        <div className="top-actions">
          <button className="btn btn-primary" onClick={openAdd}><Plus size={18}/> <span>Add bookmark</span></button>
          <button className="avatar" aria-label="Profile">AM</button>
        </div>
      </header>

      {sidebar && <div className="scrim" onClick={() => setSidebar(false)}/>} 
      <aside className={`sidebar ${sidebar ? 'sidebar-open' : ''}`}>
        <div className="sidebar-mobile-head"><span>Menu</span><button className="icon-button" onClick={() => setSidebar(false)}><X size={20}/></button></div>
        <nav>
          <button className={active === 'All bookmarks' ? 'nav-item active' : 'nav-item'} onClick={() => setNavigation('All bookmarks')}><Bookmark size={18}/>All bookmarks<span className="count">{bookmarks.length}</span></button>
          <button className={active === 'Favorites' ? 'nav-item active' : 'nav-item'} onClick={() => setNavigation('Favorites')}><Heart size={18}/>Favorites<span className="count">{bookmarks.filter(b => b.favorite).length}</span></button>
          <button className={active === 'To read' ? 'nav-item active' : 'nav-item'} onClick={() => setNavigation('To read')}><BookOpen size={18}/>To read<span className="count">{bookmarks.filter(b => b.toRead).length}</span></button>
          <button className={active === 'Recently added' ? 'nav-item active' : 'nav-item'} onClick={() => setNavigation('Recently added')}><Clock3 size={18}/>Recently added</button>
        </nav>
        <div className="sidebar-section">
          <div className="sidebar-label"><span>Collections</span><button aria-label="Add collection"><Plus size={16}/></button></div>
          {collections.map(c => <button key={c.name} className={active === c.name ? 'nav-item active' : 'nav-item'} onClick={() => setNavigation(c.name)}><span className="color-dot" style={{background:c.color}}/>{c.name}<span className="count">{bookmarks.filter(b => b.collection === c.name).length}</span></button>)}
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item"><Archive size={18}/>Archive</button>
          <button className="nav-item"><Settings size={18}/>Settings</button>
          <div className="storage"><div><span>Storage</span><span>{bookmarks.length} / 100</span></div><div className="storage-track"><span style={{width:`${Math.min(bookmarks.length,100)}%`}}/></div><small>You have plenty of room.</small></div>
        </div>
      </aside>

      <main className="main">
        <section className="hero">
          <div>
            <p className="eyebrow"><Sparkles size={14}/> Your personal library</p>
            <h1>{active}</h1>
            <p>{active === 'All bookmarks' ? 'Everything worth keeping, all in one calm place.' : active === 'Favorites' ? 'The links you come back to most.' : active === 'To read' ? 'A quiet queue for everything you want to read next.' : active === 'Recently added' ? 'The latest additions to your growing library.' : `Bookmarks saved in your ${active.toLowerCase()} collection.`}</p>
          </div>
          <button className="btn btn-primary hero-add" onClick={openAdd}><Plus size={18}/> Add bookmark</button>
        </section>

        <section className="toolbar">
          <div className="result-count"><strong>{visible.length}</strong> {visible.length === 1 ? 'bookmark' : 'bookmarks'}</div>
          <div className="toolbar-actions">
            <label className="sort-control"><span>Sort by</span><select value={sort} onChange={e => setSort(e.target.value)}><option>Newest first</option><option>Oldest first</option><option>A–Z</option></select><ChevronDown size={15}/></label>
            <div className="view-toggle"><button className={view === 'grid' ? 'selected' : ''} onClick={() => setView('grid')} aria-label="Grid view"><LayoutGrid size={18}/></button><button className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')} aria-label="List view"><List size={19}/></button></div>
          </div>
        </section>

        {visible.length ? (
          <section className={`bookmark-layout ${view}`}>
            {visible.map(item => <BookmarkCard key={item.id} item={item} view={view} menu={menu} setMenu={setMenu} onFavorite={toggleFavorite} onToRead={toggleToRead} onEdit={openEdit} onDelete={removeBookmark}/>) }
          </section>
        ) : (
          <section className="empty-state"><div className="empty-icon"><BookmarkPlus size={30}/></div><h2>No bookmarks found</h2><p>{query ? 'Try another search, or add something new.' : 'Save your first link and start building your library.'}</p><button className="btn btn-primary" onClick={openAdd}><Plus size={18}/> Add bookmark</button></section>
        )}
      </main>

      {modal && <BookmarkModal form={form} setForm={setForm} onClose={() => setModal(false)} onSave={saveBookmark} editing={editing}/>} 
      {toast && <div className="toast"><Check size={17}/>{toast}</div>}
    </div>
  );
}

function BookmarkCard({ item, view, menu, setMenu, onFavorite, onToRead, onEdit, onDelete }) {
  return <article className="bookmark-card">
    <div className="card-top">
      <SiteIcon item={item}/>
      <div className="card-actions">
        <button className={`favorite ${item.favorite ? 'is-favorite' : ''}`} onClick={() => onFavorite(item.id)} aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}><Heart size={18} fill={item.favorite ? 'currentColor' : 'none'}/></button>
        <div className="menu-wrap"><button aria-label="More options" onClick={(e) => { e.stopPropagation(); setMenu(menu === item.id ? null : item.id); }}><MoreHorizontal size={20}/></button>{menu === item.id && <div className="card-menu" onClick={e => e.stopPropagation()}><button onClick={() => onEdit(item)}><Pencil size={15}/>Edit</button><button className="danger" onClick={() => onDelete(item.id)}><Trash2 size={15}/>Delete</button></div>}</div>
      </div>
    </div>
    <div className="card-copy">
      <a href={item.url} target="_blank" rel="noreferrer" className="card-title">{item.title}<ExternalLink size={14}/></a>
      <a href={item.url} target="_blank" rel="noreferrer" className="domain"><Link2 size={13}/>{item.domain}</a>
      <p>{item.description || 'No description added yet.'}</p>
    </div>
    <div className="card-footer">
      <span className="collection-pill"><span style={{background:item.color}}/>{item.collection}</span>
      <div className="tags">{item.tags.slice(0, view === 'list' ? 3 : 2).map(tag => <span key={tag}>#{tag}</span>)}</div>
      <button className={`read-control ${item.toRead ? '' : 'is-read'}`} onClick={() => onToRead(item.id)} title={item.toRead ? 'Mark as read' : 'Add to reading list'}>{item.toRead ? <><CheckCircle2 size={14}/> Mark read</> : <><BookOpen size={14}/> To read</>}</button>
    </div>
  </article>
}

function SiteIcon({ item, preview = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [item.icon]);
  return <div className={`site-icon ${item.icon && !failed ? 'has-image' : ''} ${preview ? 'site-icon-preview' : ''}`} style={{background:item.color}}>
    {item.icon && !failed ? <img src={item.icon} alt="" onError={() => setFailed(true)}/> : item.initials}
  </div>;
}

function BookmarkModal({ form, setForm, onClose, onSave, editing }) {
  const [metadataState, setMetadataState] = useState('idle');
  const [metadataMessage, setMetadataMessage] = useState('');
  const lastFetched = useRef('');

  useEffect(() => {
    const raw = form.url.trim();
    if (!raw || raw.length < 4 || raw === lastFetched.current) return;
    let parsed;
    try { parsed = new URL(normalizeUrl(raw)); } catch { return; }
    if (!parsed.hostname.includes('.')) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setMetadataState('loading');
      setMetadataMessage('Finding the page details…');
      try {
        const response = await fetch(`/api/metadata?url=${encodeURIComponent(parsed.href)}`, { signal: controller.signal });
        const metadata = await response.json();
        if (!response.ok) throw new Error(metadata.error || 'Could not read that page.');
        lastFetched.current = metadata.url || raw;
        setForm(current => ({
          ...current,
          title: current.title.trim() || metadata.title || '',
          description: current.description.trim() || metadata.description || '',
          icon: metadata.icon || current.icon,
          url: metadata.url || current.url
        }));
        setMetadataState('success');
        setMetadataMessage(metadata.title || metadata.description ? 'Page details added automatically.' : 'Link checked. You can add any missing details below.');
      } catch (error) {
        if (error.name === 'AbortError') return;
        setMetadataState('error');
        setMetadataMessage(error.message);
      }
    }, 650);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [form.url, setForm]);

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-head"><div><span className="modal-icon"><BookmarkPlus size={20}/></span><div><h2 id="modal-title">{editing ? 'Edit bookmark' : 'Add a bookmark'}</h2><p>Keep something worth coming back to.</p></div></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <form onSubmit={onSave}>
        <label className="url-field">Website URL<div className="url-input-wrap"><Link2 size={17}/><input autoFocus required type="text" placeholder="Paste a link and we'll do the rest" value={form.url} onChange={e => setForm({...form, url:e.target.value})}/>{metadataState === 'loading' && <LoaderCircle className="spin" size={17}/>}</div></label>
        {metadataState !== 'idle' && <div className={`metadata-status ${metadataState}`}>
          {metadataState === 'success' && (form.icon ? <SiteIcon preview item={{ icon: form.icon, initials: '↗', color: '#e4eeeb' }}/> : <Check size={15}/>)}
          {metadataState === 'loading' && <Sparkles size={15}/>}<span>{metadataMessage}</span>
        </div>}
        <label>Title <span className="optional">Optional</span><input type="text" placeholder="A memorable title" value={form.title} onChange={e => setForm({...form, title:e.target.value})}/></label>
        <label>Description <span className="optional">Optional</span><textarea rows="3" placeholder="Why is this worth saving?" value={form.description} onChange={e => setForm({...form, description:e.target.value})}/></label>
        <div className="form-row">
          <label>Collection<select value={form.collection} onChange={e => setForm({...form, collection:e.target.value})}>{collections.map(c => <option key={c.name}>{c.name}</option>)}</select></label>
          <label>Tags <span className="optional">Optional</span><input type="text" placeholder="design, reading" value={form.tags} onChange={e => setForm({...form, tags:e.target.value})}/></label>
        </div>
        <label className="read-later-toggle"><input type="checkbox" checked={form.toRead} onChange={e => setForm({...form, toRead:e.target.checked})}/><span className="custom-check"><Check size={13}/></span><span><strong>Add to “To read”</strong><small>Keep it in your reading queue until you’re done.</small></span></label>
        <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit"><Bookmark size={17}/>{editing ? 'Save changes' : 'Save bookmark'}</button></div>
      </form>
    </div>
  </div>
}

createRoot(document.getElementById('root')).render(<App/>);
