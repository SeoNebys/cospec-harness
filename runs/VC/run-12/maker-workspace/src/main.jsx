import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive, Bookmark, Check, ChevronDown, ExternalLink,
  Grid2X2, Heart, Inbox, LayoutList, Link2, LoaderCircle, Menu, MoreHorizontal,
  Pencil, Plus, Search, Settings, SlidersHorizontal, Sparkles, Trash2, X
} from 'lucide-react';
import './styles.css';

const seedBookmarks = [
  { id: 1, title: 'How to build a great design system', url: 'https://www.figma.com/blog/design-systems/', domain: 'figma.com', description: 'A practical guide to building design systems that scale across teams, products, and platforms.', tags: ['Design', 'Inspiration'], favorite: true, archived: false, added: '2 hours ago', color: '#f15c4f', letter: 'F' },
  { id: 2, title: 'The ultimate guide to React performance', url: 'https://vercel.com/blog/react-performance', domain: 'vercel.com', description: 'Patterns and techniques for making React applications feel fast and responsive.', tags: ['Development'], favorite: false, archived: false, added: 'Yesterday', color: '#161616', letter: 'V' },
  { id: 3, title: 'Designing for focus', url: 'https://linear.app/method/designing-for-focus', domain: 'linear.app', description: 'How thoughtful product design can help teams stay focused and do their best work.', tags: ['Design', 'Reading'], favorite: true, archived: false, added: 'Sep 15, 2026', color: '#5f5adc', letter: 'L' },
  { id: 4, title: '2026 State of CSS', url: 'https://stateofcss.com', domain: 'stateofcss.com', description: 'The annual survey exploring the latest trends, features, and tools in the CSS ecosystem.', tags: ['Development', 'Reading'], favorite: false, archived: false, added: 'Sep 12, 2026', color: '#2176d2', letter: 'C' },
  { id: 5, title: 'A field guide to color', url: 'https://stripe.com/blog/color', domain: 'stripe.com', description: 'A closer look at color systems, accessibility, and crafting expressive product palettes.', tags: ['Design', 'Inspiration'], favorite: false, archived: false, added: 'Sep 9, 2026', color: '#625bf6', letter: 'S' },
  { id: 6, title: 'The craft of writing software', url: 'https://every.to/p/craft-of-software', domain: 'every.to', description: 'Notes on taste, quality, and building software that people love to use.', tags: ['Reading'], favorite: true, archived: false, added: 'Sep 4, 2026', color: '#f1a52b', letter: 'E' },
  { id: 7, title: 'CSS layout patterns', url: 'https://web.dev/patterns/layout', domain: 'web.dev', description: 'Common responsive layouts with modern, robust CSS.', tags: ['Development'], favorite: false, archived: true, added: 'Aug 30, 2026', color: '#4285f4', letter: 'W' }
];

const tagColors = { Design: 'coral', Development: 'blue', Inspiration: 'violet', Reading: 'amber' };
const sections = [
  { id: 'all', label: 'All bookmarks', icon: Bookmark },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'uncategorized', label: 'Uncategorized', icon: Inbox },
  { id: 'archived', label: 'Archive', icon: Archive }
];

function getDomain(url) {
  try { return new URL(url.includes('://') ? url : `https://${url}`).hostname.replace(/^www\./, ''); }
  catch { return 'website.com'; }
}

function App() {
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('markly-bookmarks')) || seedBookmarks; }
    catch { return seedBookmarks; }
  });
  const [active, setActive] = useState('all');
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('Newest');
  const [modal, setModal] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState('');
  const searchRef = useRef(null);

  useEffect(() => localStorage.setItem('markly-bookmarks', JSON.stringify(bookmarks)), [bookmarks]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { setModal(null); setOpenMenu(null); setSidebarOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const tags = useMemo(() => ['Design', 'Development', 'Inspiration', 'Reading'], []);
  const counts = useMemo(() => ({
    all: bookmarks.filter(b => !b.archived).length,
    favorites: bookmarks.filter(b => b.favorite && !b.archived).length,
    uncategorized: bookmarks.filter(b => !b.tags.length && !b.archived).length,
    archived: bookmarks.filter(b => b.archived).length,
    tags: Object.fromEntries(['Design', 'Development', 'Inspiration', 'Reading'].map(tag => [tag, bookmarks.filter(b => b.tags.includes(tag) && !b.archived).length]))
  }), [bookmarks]);

  const filtered = useMemo(() => {
    let result = bookmarks.filter(b => {
      if (active === 'all') return !b.archived;
      if (active === 'favorites') return b.favorite && !b.archived;
      if (active === 'uncategorized') return !b.tags.length && !b.archived;
      if (active === 'archived') return b.archived;
      return true;
    });
    if (tagFilter) result = result.filter(b => b.tags.includes(tagFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(b => [b.title, b.domain, b.description, ...b.tags].join(' ').toLowerCase().includes(q));
    }
    if (sort === 'A–Z') result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'Favorites') result = [...result].sort((a, b) => Number(b.favorite) - Number(a.favorite));
    return result;
  }, [bookmarks, active, tagFilter, search, sort]);

  const pageTitle = tagFilter || sections.find(s => s.id === active)?.label || 'All bookmarks';

  const flash = (message) => setToast(message);
  const toggleFavorite = (id) => {
    setBookmarks(items => items.map(b => b.id === id ? { ...b, favorite: !b.favorite } : b));
  };
  const archiveBookmark = (id) => {
    const item = bookmarks.find(b => b.id === id);
    setBookmarks(items => items.map(b => b.id === id ? { ...b, archived: !b.archived } : b));
    setOpenMenu(null);
    flash(item?.archived ? 'Bookmark restored' : 'Bookmark archived');
  };
  const deleteBookmark = (id) => {
    setBookmarks(items => items.filter(b => b.id !== id));
    setOpenMenu(null);
    flash('Bookmark deleted');
  };
  const saveBookmark = (data) => {
    if (data.id) {
      setBookmarks(items => items.map(b => b.id === data.id ? { ...b, ...data, domain: getDomain(data.url) } : b));
      flash('Bookmark updated');
    } else {
      const domain = getDomain(data.url);
      setBookmarks(items => [{ ...data, id: Date.now(), domain, favorite: false, archived: false, added: 'Just now', color: colorFor(domain), letter: domain[0].toUpperCase() }, ...items]);
      flash('Bookmark saved');
    }
    setModal(null);
  };

  return (
    <div className="app-shell" data-harness-ready="true" onClick={() => openMenu && setOpenMenu(null)}>
      <Sidebar active={active} setActive={(id) => { setActive(id); setTagFilter(''); setSidebarOpen(false); }} tags={tags} tagFilter={tagFilter} setTagFilter={(t) => { setTagFilter(t); setActive('all'); setSidebarOpen(false); }} counts={counts} open={sidebarOpen} />
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20}/></button>
          <div className="search-wrap">
            <Search size={18} />
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your bookmarks..." aria-label="Search bookmarks" />
            {search ? <button onClick={() => setSearch('')} aria-label="Clear search"><X size={15}/></button> : <kbd>⌘ K</kbd>}
          </div>
          <button className="avatar" aria-label="Account menu">AM</button>
        </header>

        <section className="content">
          <div className="title-row">
            <div>
              <p className="eyebrow">YOUR LIBRARY</p>
              <h1>{pageTitle}</h1>
              <p className="subtitle">{filtered.length} {filtered.length === 1 ? 'bookmark' : 'bookmarks'} {search && `matching “${search}”`}</p>
            </div>
            <button className="primary" onClick={() => setModal({ type: 'add' })}><Plus size={18}/><span>Add bookmark</span></button>
          </div>

          <div className="toolbar">
            <div className="filter-pills">
              <button className={!tagFilter ? 'pill active' : 'pill'} onClick={() => setTagFilter('')}>All</button>
              {tags.map(t => <button key={t} className={tagFilter === t ? 'pill active' : 'pill'} onClick={() => setTagFilter(t)}>{t}</button>)}
            </div>
            <div className="toolbar-actions">
              <label className="sort-select"><SlidersHorizontal size={15}/><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort bookmarks"><option>Newest</option><option>A–Z</option><option>Favorites</option></select><ChevronDown size={14}/></label>
              <div className="view-toggle" aria-label="Change view">
                <button className={view === 'grid' ? 'selected' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={17}/></button>
                <button className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')} aria-label="List view"><LayoutList size={18}/></button>
              </div>
            </div>
          </div>

          {filtered.length ? (
            <div className={view === 'grid' ? 'bookmark-grid' : 'bookmark-list'}>
              {filtered.map(item => <BookmarkCard key={item.id} item={item} view={view} toggleFavorite={toggleFavorite} openMenu={openMenu} setOpenMenu={setOpenMenu} onEdit={() => setModal({ type: 'edit', item })} onArchive={() => archiveBookmark(item.id)} onDelete={() => deleteBookmark(item.id)} />)}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><Bookmark size={28}/></div>
              <h2>No bookmarks found</h2>
              <p>{search ? 'Try a different search or clear your filters.' : 'Save something interesting and it will appear here.'}</p>
              <button className="primary" onClick={() => search ? setSearch('') : setModal({ type: 'add' })}>{search ? 'Clear search' : 'Add your first bookmark'}</button>
            </div>
          )}
        </section>
      </main>

      {modal && <BookmarkModal mode={modal.type} item={modal.item} tags={tags} onClose={() => setModal(null)} onSave={saveBookmark} />}
      {toast && <div className="toast"><Check size={17}/>{toast}</div>}
    </div>
  );
}

function Sidebar({ active, setActive, tags, tagFilter, setTagFilter, counts, open }) {
  return <aside className={`sidebar ${open ? 'open' : ''}`}>
    <div className="brand"><div className="brand-mark"><Bookmark size={18} fill="currentColor"/></div><span>markly</span></div>
    <nav>
      <p className="nav-label">LIBRARY</p>
      {sections.map(({ id, label, icon: Icon }) => <button key={id} className={active === id && !tagFilter ? 'nav-item active' : 'nav-item'} onClick={() => setActive(id)}><Icon size={18}/><span>{label}</span><em>{counts[id]}</em></button>)}
      <div className="nav-section">
        <div className="nav-label-row"><p className="nav-label">TAGS</p><button aria-label="Add tag"><Plus size={15}/></button></div>
        {tags.map(t => <button key={t} className={tagFilter === t ? 'nav-item active' : 'nav-item'} onClick={() => setTagFilter(t)}><span className={`tag-dot ${tagColors[t]}`}/><span>{t}</span><em>{counts.tags[t]}</em></button>)}
      </div>
    </nav>
    <div className="sidebar-bottom">
      <div className="upgrade-card"><Sparkles size={18}/><div><strong>Make it yours</strong><p>Your bookmarks stay saved on this device.</p></div></div>
      <button className="nav-item"><Settings size={18}/><span>Settings</span></button>
      <div className="profile"><div className="profile-avatar">AM</div><div><strong>Alex Morgan</strong><span>alex@example.com</span></div><MoreHorizontal size={18}/></div>
    </div>
  </aside>;

}

function BookmarkCard({ item, view, toggleFavorite, openMenu, setOpenMenu, onEdit, onArchive, onDelete }) {
  return <article className="bookmark-card">
    <div className="card-top">
      <SiteIcon item={item} />
      <div className="card-actions">
        <button className={item.favorite ? 'favorite active' : 'favorite'} onClick={() => toggleFavorite(item.id)} aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}><Heart size={18} fill={item.favorite ? 'currentColor' : 'none'}/></button>
        <div className="menu-wrap">
          <button onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === item.id ? null : item.id); }} aria-label="Bookmark options"><MoreHorizontal size={19}/></button>
          {openMenu === item.id && <div className="context-menu" onClick={e => e.stopPropagation()}>
            <button onClick={onEdit}><Pencil size={15}/>Edit bookmark</button>
            <button onClick={onArchive}><Archive size={15}/>{item.archived ? 'Restore' : 'Archive'}</button>
            <button className="danger" onClick={onDelete}><Trash2 size={15}/>Delete</button>
          </div>}
        </div>
      </div>
    </div>
    <div className="card-body">
      <a href={item.url} target="_blank" rel="noreferrer" className="card-title">{item.title}<ExternalLink size={15}/></a>
      <p className="domain">{item.domain}</p>
      <p className="description">{item.description}</p>
    </div>
    <div className="card-bottom">
      <div className="tags">{item.tags.length ? item.tags.map(t => <span className={`mini-tag ${tagColors[t] || 'gray'}`} key={t}>{t}</span>) : <span className="mini-tag gray">Uncategorized</span>}</div>
      <span className="date">{item.added}</span>
    </div>
  </article>;
}

function BookmarkModal({ mode, item, tags, onClose, onSave }) {
  const [form, setForm] = useState(item || { title: '', url: '', description: '', tags: [] });
  const [error, setError] = useState('');
  const [fetchState, setFetchState] = useState({ status: 'idle', message: '' });
  const autoValues = useRef({ title: '', description: '' });
  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const toggleTag = (tag) => update('tags', form.tags.includes(tag) ? form.tags.filter(t => t !== tag) : [...form.tags, tag]);

  useEffect(() => {
    if (mode !== 'add') return;
    const raw = form.url.trim();
    if (!raw || !raw.includes('.') || /\s/.test(raw)) { setFetchState({ status: 'idle', message: '' }); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setFetchState({ status: 'loading', message: 'Fetching page details…' });
      try {
        const response = await fetch(`/api/metadata?url=${encodeURIComponent(raw)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not read that page.');
        setForm(current => ({
          ...current,
          title: !current.title.trim() || current.title === autoValues.current.title ? data.title || current.title : current.title,
          description: !current.description.trim() || current.description === autoValues.current.description ? data.description || current.description : current.description,
          icon: data.icon || current.icon,
          url: data.url || current.url
        }));
        autoValues.current = { title: data.title || '', description: data.description || '' };
        setFetchState({ status: 'success', message: data.title ? 'Page details added — you can edit them below.' : 'Website found. Add any details you want.' });
      } catch (err) {
        if (err.name !== 'AbortError') setFetchState({ status: 'error', message: err.message || 'Could not fetch page details.' });
      }
    }, 650);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [form.url, mode]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) { setError('Add a title and URL to continue.'); return; }
    let url = form.url.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    onSave({ ...form, title: form.title.trim(), url, description: form.description.trim() });
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-head"><div><p className="eyebrow">{mode === 'edit' ? 'UPDATE LINK' : 'NEW LINK'}</p><h2 id="modal-title">{mode === 'edit' ? 'Edit bookmark' : 'Save a bookmark'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <form onSubmit={submit}>
        <label>Website URL<div className="input-with-icon url-input"><Link2 size={17}/><input autoFocus value={form.url} onChange={e => update('url', e.target.value)} placeholder="Paste a link to fetch its details" />{fetchState.status === 'loading' && <LoaderCircle className="fetch-spinner" size={17}/>}</div>{fetchState.message && <span className={`fetch-note ${fetchState.status}`}>{fetchState.status === 'success' && <Check size={12}/>} {fetchState.message}</span>}</label>
        <label>Title<input value={form.title} onChange={e => update('title', e.target.value)} placeholder={fetchState.status === 'loading' ? 'Finding the page title…' : 'Filled automatically from the page'} /></label>
        <label>Notes <span>Optional</span><textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Why are you saving this?" rows="3" /></label>
        <fieldset><legend>Tags <span>Optional</span></legend><div className="tag-options">{tags.map(t => <button type="button" key={t} className={form.tags.includes(t) ? `tag-option active ${tagColors[t]}` : 'tag-option'} onClick={() => toggleTag(t)}>{form.tags.includes(t) && <Check size={13}/>} {t}</button>)}</div></fieldset>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" type="submit"><Bookmark size={17}/>{mode === 'edit' ? 'Save changes' : 'Save bookmark'}</button></div>
      </form>
    </div>
  </div>;
}

function SiteIcon({ item }) {
  const [failed, setFailed] = useState(false);
  if (item.icon && !failed) return <div className="site-icon image"><img src={item.icon} alt="" onError={() => setFailed(true)} /></div>;
  return <div className="site-icon" style={{ background: item.color }}>{item.letter}</div>;
}

function colorFor(text) {
  const colors = ['#5f5adc', '#df654e', '#1d6fcc', '#d59424', '#208566'];
  return colors[text.split('').reduce((n, c) => n + c.charCodeAt(0), 0) % colors.length];
}

createRoot(document.getElementById('root')).render(<App />);
