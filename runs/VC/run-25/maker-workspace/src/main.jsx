import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight,
  Bookmark,
  BookMarked,
  BookOpen,
  Check,
  ChevronDown,
  CircleUserRound,
  Clock3,
  Folder,
  Grid2X2,
  Heart,
  LayoutList,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import './styles.css';

const SEED_BOOKMARKS = [
  {
    id: 1,
    title: 'The Shape of Design',
    url: 'https://shapeofdesignbook.com',
    domain: 'shapeofdesignbook.com',
    description: 'A short, thoughtful book about the creative process and the purpose behind design.',
    tags: ['design', 'reading'],
    collection: 'Inspiration',
    favorite: true,
    readLater: true,
    createdAt: '2026-09-25T09:20:00.000Z',
    color: '#db6b4f',
    monogram: 'SD',
  },
  {
    id: 2,
    title: 'The Marginalian',
    url: 'https://www.themarginalian.org',
    domain: 'themarginalian.org',
    description: 'Exploring what it means to live a meaningful life through science, philosophy, and art.',
    tags: ['essays', 'culture'],
    collection: 'Reading list',
    favorite: true,
    readLater: true,
    createdAt: '2026-09-23T12:00:00.000Z',
    color: '#1e8580',
    monogram: 'M',
  },
  {
    id: 3,
    title: 'Typewolf',
    url: 'https://www.typewolf.com',
    domain: 'typewolf.com',
    description: 'Independent typography resources and typeface recommendations for designers.',
    tags: ['typography', 'design'],
    collection: 'Inspiration',
    favorite: false,
    readLater: false,
    createdAt: '2026-09-21T15:45:00.000Z',
    color: '#c99a3d',
    monogram: 'TW',
  },
  {
    id: 4,
    title: 'Dense Discovery',
    url: 'https://www.densediscovery.com',
    domain: 'densediscovery.com',
    description: 'A weekly newsletter featuring tools, ideas, and inspiration for thoughtful people.',
    tags: ['newsletter', 'design'],
    collection: 'Newsletters',
    favorite: true,
    readLater: false,
    createdAt: '2026-09-19T08:10:00.000Z',
    color: '#4f6e8a',
    monogram: 'DD',
  },
  {
    id: 5,
    title: 'Are.na',
    url: 'https://www.are.na',
    domain: 'are.na',
    description: 'A platform for creative thinking, research, and building collections of ideas.',
    tags: ['research', 'inspiration'],
    collection: 'Tools',
    favorite: false,
    readLater: false,
    createdAt: '2026-09-17T17:20:00.000Z',
    color: '#383838',
    monogram: 'A',
  },
  {
    id: 6,
    title: 'Fonts In Use',
    url: 'https://fontsinuse.com',
    domain: 'fontsinuse.com',
    description: 'An independent archive of typography indexed by typeface, format, industry, and period.',
    tags: ['typography', 'archive'],
    collection: 'Reference',
    favorite: false,
    readLater: false,
    createdAt: '2026-09-12T11:00:00.000Z',
    color: '#934d4d',
    monogram: 'FU',
  },
];

const DEFAULT_COLLECTIONS = ['Inspiration', 'Reading list', 'Newsletters', 'Tools', 'Reference'];
const COLORS = ['#1e8580', '#db6b4f', '#c99a3d', '#4f6e8a', '#934d4d', '#6b5b95'];

function loadBookmarks() {
  try {
    const saved = localStorage.getItem('kept-bookmarks');
    return saved ? JSON.parse(saved).map((item) => ({ readLater: false, ...item })) : SEED_BOOKMARKS;
  } catch {
    return SEED_BOOKMARKS;
  }
}

function normalizeUrl(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function getDomain(url) {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function timeAgo(date) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(date));
}

function Logo() {
  return (
    <div className="brand" aria-label="Kept home">
      <div className="brand-mark"><Bookmark size={18} fill="currentColor" /></div>
      <span>kept.</span>
    </div>
  );
}

function Sidebar({ bookmarks, currentView, setCurrentView, collections, isOpen, onClose, onNewCollection }) {
  const itemCount = (view) => {
    if (view === 'All bookmarks') return bookmarks.length;
    if (view === 'Favorites') return bookmarks.filter((item) => item.favorite).length;
    if (view === 'Read later') return bookmarks.filter((item) => item.readLater).length;
    return bookmarks.filter((item) => item.collection === view).length;
  };

  const select = (view) => {
    setCurrentView(view);
    onClose();
  };

  return (
    <>
      <div className={`sidebar-scrim ${isOpen ? 'visible' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-top">
          <Logo />
          <button className="icon-button mobile-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={currentView === 'All bookmarks' ? 'active' : ''} onClick={() => select('All bookmarks')}>
            <span><BookOpen size={18} />All bookmarks</span><small>{itemCount('All bookmarks')}</small>
          </button>
          <button className={currentView === 'Favorites' ? 'active' : ''} onClick={() => select('Favorites')}>
            <span><Star size={18} />Favorites</span><small>{itemCount('Favorites')}</small>
          </button>
          <button className={currentView === 'Read later' ? 'active' : ''} onClick={() => select('Read later')}>
            <span><BookMarked size={18} />Read later</span><small>{itemCount('Read later')}</small>
          </button>
        </nav>
        <div className="nav-section">
          <div className="nav-heading"><span>Collections</span><button onClick={onNewCollection} aria-label="Add collection"><Plus size={16} /></button></div>
          <nav className="collection-nav" aria-label="Collections">
            {collections.map((collection) => (
              <button key={collection} className={currentView === collection ? 'active' : ''} onClick={() => select(collection)}>
                <span><Folder size={17} />{collection}</span><small>{itemCount(collection)}</small>
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-note">
          <Sparkles size={18} />
          <div><strong>A home for good finds</strong><p>Your bookmarks stay saved in this browser.</p></div>
        </div>
        <div className="profile">
          <div className="avatar">AR</div>
          <div><strong>Alex Rivera</strong><span>Personal library</span></div>
          <MoreHorizontal size={18} />
        </div>
      </aside>
    </>
  );
}

function BookmarkCard({ item, onFavorite, onReadLater, onEdit, onDelete, onTagClick, listView, inReadingQueue }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <article className={`bookmark-card ${listView ? 'list' : ''}`}>
      <div className="card-top">
        <a className="site-icon" style={{ '--site-color': item.color }} href={item.url} target="_blank" rel="noreferrer" aria-label={`Open ${item.title}`}>
          {item.favicon && <img src={item.favicon} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
          <span>{item.monogram}</span>
        </a>
        <div className="card-actions">
          <button className={`read-later-button ${item.readLater ? 'selected' : ''}`} onClick={() => onReadLater(item.id)} aria-label={item.readLater ? 'Mark as read' : 'Read later'} title={item.readLater ? 'Mark as read' : 'Read later'}>
            {inReadingQueue ? <Check size={17} /> : <BookMarked size={17} fill={item.readLater ? 'currentColor' : 'none'} />}
          </button>
          <button className={`favorite-button ${item.favorite ? 'selected' : ''}`} onClick={() => onFavorite(item.id)} aria-label={item.favorite ? 'Remove favorite' : 'Add favorite'}>
            <Heart size={17} fill={item.favorite ? 'currentColor' : 'none'} />
          </button>
          <div className="menu-wrap">
            <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Bookmark actions"><MoreHorizontal size={19} /></button>
            {menuOpen && (
              <div className="context-menu">
                <button onClick={() => { onReadLater(item.id); setMenuOpen(false); }}>{item.readLater ? <><Check size={15} />Mark as read</> : <><BookMarked size={15} />Read later</>}</button>
                <button onClick={() => { onEdit(item); setMenuOpen(false); }}><Pencil size={15} />Edit</button>
                <button className="danger" onClick={() => onDelete(item.id)}><Trash2 size={15} />Delete</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="card-copy">
        <a href={item.url} target="_blank" rel="noreferrer" className="title-link"><h3>{item.title}</h3><ArrowUpRight size={15} /></a>
        <span className="domain">{item.domain}</span>
        <p>{item.description || 'No description added yet.'}</p>
      </div>
      <div className="card-bottom">
        <div className="tags">
          {item.tags.map((tag) => <button key={tag} onClick={() => onTagClick(tag)}>#{tag}</button>)}
        </div>
        <span className="date"><Clock3 size={13} />{timeAgo(item.createdAt)}</span>
      </div>
    </article>
  );
}

function BookmarkModal({ item, collections, onSave, onClose }) {
  const [form, setForm] = useState(item || { title: '', url: '', description: '', tags: '', collection: collections[0] || 'Unsorted', readLater: false, favicon: '' });
  const [error, setError] = useState('');
  const [fetchState, setFetchState] = useState({ status: 'idle', message: '' });
  const lastRequested = useRef('');

  const change = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const fetchDetails = async (rawUrl = form.url) => {
    const url = normalizeUrl(rawUrl.trim());
    if (!url || !url.includes('.')) return;
    if (lastRequested.current === url && fetchState.status !== 'error') return;
    lastRequested.current = url;
    setFetchState({ status: 'loading', message: 'Finding the page details…' });
    try {
      const response = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not read that page.');
      setForm((previous) => ({
        ...previous,
        url,
        title: previous.title || data.title || getDomain(url),
        description: previous.description || data.description || '',
        favicon: data.favicon || previous.favicon || '',
      }));
      setFetchState({ status: 'success', message: 'Page details added' });
    } catch (fetchError) {
      setFetchState({ status: 'error', message: fetchError.message || 'Could not read that page. You can still add the details yourself.' });
    }
  };

  useEffect(() => {
    if (item || !form.url.trim()) return;
    const timeout = setTimeout(() => fetchDetails(form.url), 700);
    return () => clearTimeout(timeout);
  }, [form.url]);

  const submit = (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.url.trim()) {
      setError('Add a title and URL to save this bookmark.');
      return;
    }
    onSave({
      ...form,
      title: form.title.trim(),
      url: normalizeUrl(form.url.trim()),
      description: form.description?.trim() || '',
      tags: Array.isArray(form.tags) ? form.tags : form.tags.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean),
      collection: form.collection || 'Unsorted',
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div><span className="eyebrow">{item ? 'Update your library' : 'Save something good'}</span><h2 id="modal-title">{item ? 'Edit bookmark' : 'New bookmark'}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <form onSubmit={submit}>
          <label>Web address<div className={`url-field ${fetchState.status}`}><input autoFocus value={form.url} onChange={(e) => { change('url', e.target.value); lastRequested.current = ''; setFetchState({ status: 'idle', message: '' }); }} placeholder="Paste a link and we’ll fill in the rest" inputMode="url" />{fetchState.status === 'loading' ? <LoaderCircle className="spin" size={18} /> : fetchState.status === 'success' ? <Check size={18} /> : <button type="button" onClick={() => fetchDetails()} aria-label="Fetch page details"><Sparkles size={17} /></button>}</div></label>
          {fetchState.message && <div className={`fetch-status ${fetchState.status}`}>{fetchState.status === 'loading' && <LoaderCircle className="spin" size={14} />}{fetchState.message}{fetchState.status === 'error' && <button type="button" onClick={() => { lastRequested.current = ''; fetchDetails(); }}>Try again</button>}</div>}
          <label>Title<input value={form.title} onChange={(e) => change('title', e.target.value)} placeholder="Filled automatically from the page" /></label>
          <label>Description<textarea value={form.description} onChange={(e) => change('description', e.target.value)} placeholder="Why is this worth keeping?" rows="3" /></label>
          <div className="form-row">
            <label>Collection<select value={form.collection} onChange={(e) => change('collection', e.target.value)}>{collections.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Tags<input value={Array.isArray(form.tags) ? form.tags.join(', ') : form.tags} onChange={(e) => change('tags', e.target.value)} placeholder="design, reading" /></label>
          </div>
          <label className="read-later-toggle"><input type="checkbox" checked={Boolean(form.readLater)} onChange={(e) => change('readLater', e.target.checked)} /><span className="toggle-track"><span /></span><span><strong>Add to Read later</strong><small>Keep this in your reading queue until you’re done.</small></span></label>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Bookmark size={17} />{item ? 'Save changes' : 'Save bookmark'}</button></div>
        </form>
      </section>
    </div>
  );
}

function EmptyState({ isSearch, onAdd, onClear, isReadingQueue }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Bookmark size={27} /></div>
      <h2>{isSearch ? 'No matching bookmarks' : isReadingQueue ? 'You’re all caught up' : 'This shelf is waiting'}</h2>
      <p>{isSearch ? 'Try a different word or clear the current filters.' : isReadingQueue ? 'Your reading queue is clear. Add any bookmark when you find something for later.' : 'Save your first link here and start building something worth returning to.'}</p>
      <button className="primary-button" onClick={isSearch ? onClear : onAdd}>{isSearch ? 'Clear search' : <><Plus size={17} />{isReadingQueue ? 'Find something to read' : 'Add a bookmark'}</>}</button>
    </div>
  );
}

function App() {
  const [bookmarks, setBookmarks] = useState(loadBookmarks);
  const [collections, setCollections] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kept-collections')) || DEFAULT_COLLECTIONS; } catch { return DEFAULT_COLLECTIONS; }
  });
  const [currentView, setCurrentView] = useState('All bookmarks');
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [sort, setSort] = useState('Newest first');
  const [listView, setListView] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => localStorage.setItem('kept-bookmarks', JSON.stringify(bookmarks)), [bookmarks]);
  useEffect(() => localStorage.setItem('kept-collections', JSON.stringify(collections)), [collections]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    const handleKeys = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector('[aria-label="Search bookmarks"]')?.focus();
      }
      if (event.key === 'Escape') {
        setModal(null);
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, []);

  const filtered = useMemo(() => {
    let result = bookmarks.filter((item) => {
      const viewMatch = currentView === 'All bookmarks' || (currentView === 'Favorites' ? item.favorite : currentView === 'Read later' ? item.readLater : item.collection === currentView);
      const haystack = `${item.title} ${item.domain} ${item.description} ${item.tags.join(' ')}`.toLowerCase();
      return viewMatch && haystack.includes(query.toLowerCase()) && (!activeTag || item.tags.includes(activeTag));
    });
    return [...result].sort((a, b) => {
      if (sort === 'A–Z') return a.title.localeCompare(b.title);
      if (sort === 'Oldest first') return new Date(a.createdAt) - new Date(b.createdAt);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [bookmarks, currentView, query, activeTag, sort]);

  const allTags = useMemo(() => [...new Set(bookmarks.flatMap((item) => item.tags))].slice(0, 6), [bookmarks]);

  const saveBookmark = (form) => {
    if (form.id) {
      setBookmarks((items) => items.map((item) => item.id === form.id ? { ...item, ...form, domain: getDomain(form.url) } : item));
      setToast('Bookmark updated');
    } else {
      const domain = getDomain(form.url);
      const monogram = form.title.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
      setBookmarks((items) => [{ ...form, id: Date.now(), domain, favorite: false, readLater: Boolean(form.readLater), createdAt: new Date().toISOString(), color: COLORS[items.length % COLORS.length], monogram }, ...items]);
      setToast('Bookmark saved');
    }
    setModal(null);
  };

  const deleteBookmark = (id) => {
    setBookmarks((items) => items.filter((item) => item.id !== id));
    setToast('Bookmark removed');
  };

  const newCollection = () => {
    const name = window.prompt('Name your new collection');
    if (name?.trim() && !collections.includes(name.trim())) {
      setCollections((items) => [...items, name.trim()]);
      setCurrentView(name.trim());
      setToast('Collection created');
    }
  };

  const viewDescription = currentView === 'All bookmarks' ? 'Everything you saved, ready when you need it.' : currentView === 'Favorites' ? 'The links you never want to lose.' : currentView === 'Read later' ? 'Your reading queue—mark a link as read when you’re done.' : `Bookmarks filed in ${currentView}.`;

  return (
    <div className="app-shell" data-harness-ready="true">
      <Sidebar bookmarks={bookmarks} currentView={currentView} setCurrentView={(view) => { setCurrentView(view); setActiveTag(''); }} collections={collections} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onNewCollection={newCollection} />
      <main className="content">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={21} /></button>
          <div className="search-wrap"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your library…" aria-label="Search bookmarks" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}<kbd>⌘ K</kbd></div>
          <button className="primary-button add-top" onClick={() => setModal({ type: 'new' })}><Plus size={18} />Add bookmark</button>
          <button className="profile-mobile" aria-label="Profile"><CircleUserRound size={22} /></button>
        </header>

        <div className="content-inner">
          <div className="page-intro">
            <div><span className="eyebrow">Your personal library</span><h1>{currentView}</h1><p>{viewDescription}</p></div>
            <div className="stats"><strong>{filtered.length}</strong><span>{filtered.length === 1 ? 'bookmark' : 'bookmarks'}</span></div>
          </div>

          <div className="filter-row">
            <div className="tag-filters">
              <button className={!activeTag ? 'active' : ''} onClick={() => setActiveTag('')}>All</button>
              {allTags.map((tag) => <button key={tag} className={activeTag === tag ? 'active' : ''} onClick={() => setActiveTag(tag)}>#{tag}</button>)}
            </div>
            <div className="view-controls">
              <label className="sort-control">Sort: <select value={sort} onChange={(e) => setSort(e.target.value)}><option>Newest first</option><option>Oldest first</option><option>A–Z</option></select><ChevronDown size={14} /></label>
              <div className="view-toggle"><button className={!listView ? 'active' : ''} onClick={() => setListView(false)} aria-label="Grid view"><Grid2X2 size={17} /></button><button className={listView ? 'active' : ''} onClick={() => setListView(true)} aria-label="List view"><LayoutList size={18} /></button></div>
            </div>
          </div>

          {filtered.length ? (
            <div className={`bookmark-grid ${listView ? 'list-view' : ''}`}>
              {filtered.map((item) => <BookmarkCard key={item.id} item={item} listView={listView} inReadingQueue={currentView === 'Read later'} onFavorite={(id) => setBookmarks((items) => items.map((bookmark) => bookmark.id === id ? { ...bookmark, favorite: !bookmark.favorite } : bookmark))} onReadLater={(id) => { setBookmarks((items) => items.map((bookmark) => bookmark.id === id ? { ...bookmark, readLater: !bookmark.readLater } : bookmark)); setToast(currentView === 'Read later' ? 'Marked as read' : item.readLater ? 'Removed from Read later' : 'Added to Read later'); }} onEdit={(bookmark) => setModal({ type: 'edit', item: bookmark })} onDelete={deleteBookmark} onTagClick={(tag) => setActiveTag(tag)} />)}
            </div>
          ) : <EmptyState isSearch={Boolean(query || activeTag)} isReadingQueue={currentView === 'Read later'} onAdd={() => setModal({ type: 'new' })} onClear={() => { setQuery(''); setActiveTag(''); }} />}
        </div>
        <button className="floating-add" onClick={() => setModal({ type: 'new' })} aria-label="Add bookmark"><Plus size={23} /></button>
      </main>
      {modal && <BookmarkModal item={modal.item} collections={collections.length ? collections : ['Unsorted']} onSave={saveBookmark} onClose={() => setModal(null)} />}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
