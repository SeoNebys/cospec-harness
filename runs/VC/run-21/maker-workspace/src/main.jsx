import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive, Bookmark, ChevronDown, CirclePlus, Folder, Grid2X2, Heart,
  Home, Inbox, LayoutList, Link2, MoreHorizontal, Plus, Search, Settings,
  Sparkles, Tag, X
} from 'lucide-react';
import './styles.css';

const nasaBookmark = {
  id: 7, title: 'NASA', domain: 'nasa.gov', url: 'https://www.nasa.gov/',
  description: "NASA.gov brings you the latest news, images and videos from America's space agency, pioneering the future in space exploration, scientific discovery and aeronautics research.",
  collection: 'Inspiration', tags: ['space', 'science'], accent: '#6f7bc9', glyph: 'NA', favorite: false,
  saved: 'Just now'
};

const seedBookmarks = [
  nasaBookmark,
  {
    id: 1, title: 'The Creative Independent', domain: 'thecreativeindependent.com',
    url: 'https://thecreativeindependent.com', description: 'Practical and emotional guidance for creative people.',
    collection: 'Inspiration', tags: ['creativity', 'interviews'], accent: '#f0c56b', glyph: 'TC', favorite: true,
    saved: '2h ago'
  },
  {
    id: 2, title: 'A guide to building a color system', domain: 'linear.app',
    url: 'https://linear.app/blog/designing-the-linear-app-icon', description: 'How constraints make visual systems more useful, expressive, and durable.',
    collection: 'Design', tags: ['design', 'systems'], accent: '#8175d6', glyph: 'L', favorite: false,
    saved: 'Yesterday'
  },
  {
    id: 3, title: 'Dense Discovery', domain: 'densediscovery.com',
    url: 'https://www.densediscovery.com', description: 'A thoughtful weekly newsletter about design, tech, and sustainability.',
    collection: 'Read later', tags: ['newsletter', 'culture'], accent: '#ed7c5d', glyph: 'DD', favorite: true,
    saved: 'Sep 18'
  },
  {
    id: 4, title: 'The Marginalian', domain: 'themarginalian.org',
    url: 'https://www.themarginalian.org', description: 'A record of reckoning with our search for meaning through science and art.',
    collection: 'Inspiration', tags: ['writing', 'culture'], accent: '#2f7c72', glyph: 'M', favorite: false,
    saved: 'Sep 16'
  },
  {
    id: 5, title: 'Mobbin — Mobile & Web Design', domain: 'mobbin.com',
    url: 'https://mobbin.com', description: 'A library of real-world product screens and interaction patterns.',
    collection: 'Design', tags: ['ui', 'patterns'], accent: '#4b8ac2', glyph: 'M', favorite: false,
    saved: 'Sep 12'
  },
  {
    id: 6, title: 'Are.na', domain: 'are.na',
    url: 'https://www.are.na', description: 'A quiet place to save content, create collections, and connect ideas.',
    collection: 'Tools', tags: ['research', 'tool'], accent: '#222222', glyph: 'A', favorite: true,
    saved: 'Sep 9'
  }
];

const collections = [
  { name: 'Design', color: '#e87358' },
  { name: 'Inspiration', color: '#dfa93e' },
  { name: 'Read later', color: '#6c78c5' },
  { name: 'Tools', color: '#398678' }
];

function App() {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('keepr-bookmarks');
    if (!saved) {
      localStorage.setItem('keepr-bookmarks', JSON.stringify(seedBookmarks));
      return seedBookmarks;
    }
    const stored = JSON.parse(saved);
    if (stored.some(item => item.domain === 'nasa.gov')) return stored;
    const migrated = [nasaBookmark, ...stored];
    localStorage.setItem('keepr-bookmarks', JSON.stringify(migrated));
    return migrated;
  });
  const [active, setActive] = useState('All bookmarks');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('Recently added');
  const [modal, setModal] = useState(false);
  const [menu, setMenu] = useState(null);
  const [notice, setNotice] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const persist = (next) => {
    setItems(next);
    localStorage.setItem('keepr-bookmarks', JSON.stringify(next));
  };

  const filtered = useMemo(() => {
    let result = [...items];
    if (active === 'All bookmarks') result = result.filter(x => !x.archived);
    if (active === 'Favorites') result = result.filter(x => x.favorite && !x.archived);
    if (active === 'Archive') result = result.filter(x => x.archived);
    if (collections.some(c => c.name === active)) result = result.filter(x => x.collection === active && !x.archived);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(x => `${x.title} ${x.domain} ${x.description} ${x.tags.join(' ')}`.toLowerCase().includes(q));
    }
    if (sort === 'A–Z') result.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'Favorites first') result.sort((a, b) => Number(b.favorite) - Number(a.favorite));
    return result;
  }, [items, active, query, sort]);

  const toggleFavorite = (id) => persist(items.map(x => x.id === id ? { ...x, favorite: !x.favorite } : x));
  const archive = (id) => {
    persist(items.map(x => x.id === id ? { ...x, archived: !x.archived } : x));
    setMenu(null);
    setNotice(active === 'Archive' ? 'Bookmark restored' : 'Bookmark moved to archive');
    setTimeout(() => setNotice(''), 2400);
  };
  const add = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const url = form.get('url').trim();
    const title = form.get('title').trim() || url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    let domain = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    const collection = form.get('collection');
    const tags = form.get('tags').split(',').map(x => x.trim()).filter(Boolean).slice(0, 3);
    const palette = ['#e87358', '#dfa93e', '#6c78c5', '#398678'];
    const next = [{
      id: Date.now(), title, domain, url: url.startsWith('http') ? url : `https://${url}`,
      description: form.get('description').trim() || 'Saved for later.', collection, tags,
      accent: palette[items.length % palette.length], glyph: title.slice(0, 2).toUpperCase(), favorite: false, saved: 'Just now'
    }, ...items];
    persist(next);
    setModal(false);
    setActive('All bookmarks');
    setNotice('Bookmark saved');
    setTimeout(() => setNotice(''), 2400);
  };

  const pageTitle = active === 'All bookmarks' ? 'All bookmarks' : active;

  return (
    <div className="app-shell" data-harness-ready="true">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Bookmark size={18} fill="currentColor" /></span><span>Keepr</span></div>
        <button className="add-button" onClick={() => setModal(true)}><Plus size={18} /> Add bookmark</button>
        <nav className="nav-block" aria-label="Main navigation">
          <NavItem icon={Home} label="All bookmarks" active={active} setActive={setActive} count={items.filter(x => !x.archived).length} />
          <NavItem icon={Heart} label="Favorites" active={active} setActive={setActive} count={items.filter(x => x.favorite && !x.archived).length} />
          <NavItem icon={Archive} label="Archive" active={active} setActive={setActive} />
        </nav>
        <div className="sidebar-heading"><span>Collections</span><button aria-label="Add collection"><Plus size={16}/></button></div>
        <nav className="nav-block collection-nav">
          {collections.map(c => <button key={c.name} className={active === c.name ? 'nav-item active' : 'nav-item'} onClick={() => setActive(c.name)}><span className="collection-dot" style={{background:c.color}}/><span>{c.name}</span><span className="count">{items.filter(x => x.collection === c.name && !x.archived).length}</span></button>)}
        </nav>
        <div className="sidebar-footer">
          <button><Settings size={18}/><span>Settings</span></button>
          <div className="profile"><div className="avatar">AK</div><div><strong>Alex Kim</strong><span>alex@keepr.app</span></div><MoreHorizontal size={17}/></div>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="search-wrap"><Search size={18}/><input ref={searchRef} aria-label="Search bookmarks" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your bookmarks..."/><kbd>⌘ K</kbd></div>
          <button className="mobile-add" onClick={() => setModal(true)}><Plus size={18}/><span>Add</span></button>
        </header>
        <section className="page">
          <div className="title-row">
            <div><p className="eyebrow">YOUR LIBRARY</p><h1>{pageTitle}</h1><p>{active === 'Archive' ? 'Bookmarks you archive will appear here.' : `${filtered.length} saved ${filtered.length === 1 ? 'place' : 'places'} to revisit`}</p></div>
            <div className="actions">
              <div className="segmented"><button className={view==='grid'?'active':''} onClick={()=>setView('grid')} aria-label="Grid view"><Grid2X2 size={17}/></button><button className={view==='list'?'active':''} onClick={()=>setView('list')} aria-label="List view"><LayoutList size={18}/></button></div>
              <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort bookmarks"><option>Recently added</option><option>A–Z</option><option>Favorites first</option></select>
            </div>
          </div>

          {filtered.length > 0 ? <div className={`bookmark-${view}`}>
            {filtered.map(item => <BookmarkCard key={item.id} item={item} view={view} onFavorite={toggleFavorite} menu={menu} setMenu={setMenu} onArchive={archive} />)}
          </div> : <div className="empty"><div className="empty-icon"><Inbox size={28}/></div><h2>{query ? 'No matches found' : 'Nothing here yet'}</h2><p>{query ? 'Try a different search term or browse another collection.' : 'Save a bookmark and it’ll show up here.'}</p>{!query && active !== 'Archive' && <button onClick={()=>setModal(true)}><Plus size={17}/>Add your first bookmark</button>}</div>}

          <div className="tip"><Sparkles size={17}/><span><strong>Quick tip:</strong> Press <kbd>⌘</kbd> <kbd>K</kbd> anytime to jump to search.</span></div>
        </section>
      </main>

      {modal && <AddModal onClose={()=>setModal(false)} onAdd={add}/>} 
      {notice && <div className="toast"><span className="toast-dot">✓</span>{notice}</div>}
    </div>
  );
}

function NavItem({ icon: Icon, label, active, setActive, count }) {
  return <button className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => setActive(label)}><Icon size={18}/><span>{label}</span>{count !== undefined && <span className="count">{count}</span>}</button>;
}

function BookmarkCard({ item, view, onFavorite, menu, setMenu, onArchive }) {
  return <article className="bookmark-card">
    <div className="card-accent" style={{background:item.accent}}>
      <span>{item.glyph}</span>
      <button className={item.favorite ? 'heart active' : 'heart'} onClick={() => onFavorite(item.id)} aria-label="Toggle favorite"><Heart size={17} fill={item.favorite ? 'currentColor' : 'none'}/></button>
    </div>
    <div className="card-body">
      <div className="domain"><span className="favicon" style={{color:item.accent}}>{item.glyph[0]}</span>{item.domain}</div>
      <div className="card-title-row"><a href={item.url} target="_blank" rel="noreferrer"><h2>{item.title}</h2></a><div className="more-wrap"><button className="more" onClick={()=>setMenu(menu===item.id?null:item.id)} aria-label="Bookmark actions"><MoreHorizontal size={19}/></button>{menu===item.id && <div className="context-menu"><button onClick={()=>onFavorite(item.id)}><Heart size={15}/>{item.favorite?'Remove favorite':'Add to favorites'}</button><button onClick={()=>onArchive(item.id)}><Archive size={15}/>{item.archived?'Restore bookmark':'Move to archive'}</button></div>}</div></div>
      <p className="description">{item.description}</p>
      <div className="meta"><div className="tags">{item.tags.map(t => <span key={t}>#{t}</span>)}</div><time>{item.saved}</time></div>
    </div>
  </article>;
}

function AddModal({ onClose, onAdd }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lookup, setLookup] = useState('idle');

  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://'))) {
      setLookup('idle');
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLookup('loading');
      try {
        const response = await fetch(`/api/metadata?url=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!response.ok) throw new Error('No metadata');
        const metadata = await response.json();
        if (metadata.title) setTitle(current => current || metadata.title);
        if (metadata.description) setDescription(current => current || metadata.description);
        setLookup(metadata.title ? 'found' : 'missing');
      } catch (error) {
        if (error.name !== 'AbortError') setLookup('missing');
      }
    }, 550);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [url]);

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-head"><div><span className="modal-icon"><Link2 size={19}/></span><div><h2 id="modal-title">Save a bookmark</h2><p>Keep something worth coming back to.</p></div></div><button onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <form onSubmit={onAdd}>
        <label>URL<div className="lookup-field"><input name="url" type="text" placeholder="https://example.com" required autoFocus value={url} onChange={event => setUrl(event.target.value)}/>{lookup === 'loading' && <span className="lookup-status loading">Reading page…</span>}{lookup === 'found' && <span className="lookup-status found">✓ Details found</span>}</div></label>
        <label>Title <span>(optional)</span><input name="title" placeholder="Filled from the page when available" value={title} onChange={event => setTitle(event.target.value)}/></label>
        <label>Note <span>(optional)</span><textarea name="description" placeholder="Why are you saving this?" rows="3" value={description} onChange={event => setDescription(event.target.value)}/></label>
        {lookup === 'missing' && <p className="lookup-note">We couldn’t read this page, but you can still add a title yourself and save it.</p>}
        <div className="form-row"><label>Collection<select name="collection" defaultValue="Inspiration">{collections.map(c=><option key={c.name}>{c.name}</option>)}</select></label><label>Tags <span>(comma separated)</span><input name="tags" placeholder="design, article"/></label></div>
        <div className="modal-actions"><button type="button" className="cancel" onClick={onClose}>Cancel</button><button className="save" type="submit"><Bookmark size={17}/>Save bookmark</button></div>
      </form>
    </div>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
