import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive,
  Bookmark,
  BookmarkPlus,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Grid2X2,
  Heart,
  Inbox,
  Link2,
  List,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import './styles.css';

const SEED_BOOKMARKS = [
  {
    id: 'linear',
    title: 'Linear — Plan and build products',
    url: 'https://linear.app',
    description: 'The issue tracking tool you’ll enjoy using. Streamline issues, projects, and product roadmaps.',
    tags: ['design', 'tools'],
    color: '#5e6ad2',
    monogram: 'L',
    favorite: true,
    archived: false,
    createdAt: '2026-09-16T09:15:00.000Z',
  },
  {
    id: 'cosmos',
    title: 'Cosmos — A discovery engine',
    url: 'https://www.cosmos.so',
    description: 'A new way to collect inspiration, curate your world, and discover ideas through people you trust.',
    tags: ['inspiration', 'design'],
    color: '#101010',
    monogram: 'C',
    favorite: true,
    archived: false,
    createdAt: '2026-09-15T16:30:00.000Z',
  },
  {
    id: 'readwise',
    title: 'Readwise Reader',
    url: 'https://readwise.io/read',
    description: 'Your reading inbox for articles, newsletters, PDFs, and everything you want to return to later.',
    tags: ['reading', 'productivity'],
    color: '#e7592b',
    monogram: 'R',
    favorite: false,
    archived: false,
    createdAt: '2026-09-14T12:10:00.000Z',
  },
  {
    id: 'are-na',
    title: 'Are.na — Channels for ideas',
    url: 'https://www.are.na',
    description: 'A platform for connecting ideas and building knowledge over time, without ads or algorithms.',
    tags: ['inspiration', 'research'],
    color: '#2b71ff',
    monogram: 'A',
    favorite: false,
    archived: false,
    createdAt: '2026-09-11T08:45:00.000Z',
  },
  {
    id: 'stripe',
    title: 'Stripe Press',
    url: 'https://press.stripe.com',
    description: 'Ideas for progress from books about economic and technological advancement.',
    tags: ['reading', 'business'],
    color: '#635bff',
    monogram: 'S',
    favorite: false,
    archived: false,
    createdAt: '2026-09-07T14:20:00.000Z',
  },
  {
    id: 'landbook',
    title: 'Land-book — Website design inspiration',
    url: 'https://land-book.com',
    description: 'A curated gallery of the finest website designs to keep your next project moving.',
    tags: ['design', 'inspiration'],
    color: '#e8ad35',
    monogram: 'Lb',
    favorite: false,
    archived: false,
    createdAt: '2026-09-04T10:00:00.000Z',
  },
];

const STORAGE_KEY = 'nestmark-bookmarks-v1';

function getInitialBookmarks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : SEED_BOOKMARKS;
  } catch {
    return SEED_BOOKMARKS;
  }
}

function getDomain(url) {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function normalizeUrl(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function timeLabel(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(iso));
}

function Logo() {
  return (
    <div className="brand">
      <div className="brand-mark"><Bookmark fill="currentColor" size={17} /></div>
      <span>Nestmark</span>
    </div>
  );
}

function Sidebar({ view, setView, tags, bookmarks, onAdd, open, onClose }) {
  const counts = {
    all: bookmarks.filter((b) => !b.archived).length,
    favorites: bookmarks.filter((b) => b.favorite && !b.archived).length,
    archive: bookmarks.filter((b) => b.archived).length,
  };
  const items = [
    ['all', Inbox, 'All bookmarks'],
    ['favorites', Star, 'Favorites'],
    ['recent', Clock3, 'Recently added'],
    ['archive', Archive, 'Archive'],
  ];

  return (
    <>
      <div className={`mobile-scrim ${open ? 'visible' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-top">
          <Logo />
          <button className="icon-button close-nav" onClick={onClose} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <button className="add-button" onClick={onAdd}><Plus size={18} strokeWidth={2.4} /> Add bookmark</button>
        <nav className="nav-list" aria-label="Bookmark views">
          {items.map(([id, Icon, label]) => (
            <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => { setView(id); onClose(); }}>
              <Icon size={18} />
              <span>{label}</span>
              {(id === 'all' || id === 'favorites' || id === 'archive') && <span className="nav-count">{counts[id]}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-section">
          <div className="section-label">Tags <button aria-label="Add tag"><Plus size={15} /></button></div>
          <div className="tag-nav">
            {tags.slice(0, 6).map(({ name, count }, index) => (
              <button key={name} onClick={() => { setView(`tag:${name}`); onClose(); }} className={view === `tag:${name}` ? 'active' : ''}>
                <span className={`tag-dot dot-${index % 6}`} />
                <span>{name}</span>
                <span className="nav-count">{count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <button><Settings size={17} /> Settings</button>
          <div className="user-card">
            <div className="avatar">AB</div>
            <div><strong>Alex Bennett</strong><span>Personal space</span></div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>
    </>
  );
}

function BookmarkCard({ bookmark, onFavorite, onEdit, onDelete, onArchive, viewMode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  const domain = getDomain(bookmark.url);

  useEffect(() => setIconFailed(false), [bookmark.icon]);

  return (
    <article className={`bookmark-card ${viewMode === 'list' ? 'list-card' : ''}`}>
      <div className="card-main">
        <div className="card-heading">
          <div className={`site-icon ${bookmark.icon && !iconFailed ? 'has-image' : ''}`} style={{ background: bookmark.color }}>
            {bookmark.icon && !iconFailed
              ? <img src={bookmark.icon} alt="" onError={() => setIconFailed(true)} />
              : bookmark.monogram}
          </div>
          <div className="card-title-wrap">
            <h3>{bookmark.title}</h3>
            <a href={normalizeUrl(bookmark.url)} target="_blank" rel="noreferrer">{domain}<ExternalLink size={12} /></a>
          </div>
          <div className="card-actions">
            <button className={`favorite-button ${bookmark.favorite ? 'on' : ''}`} onClick={() => onFavorite(bookmark.id)} aria-label={bookmark.favorite ? 'Remove from favorites' : 'Add to favorites'}>
              <Heart size={17} fill={bookmark.favorite ? 'currentColor' : 'none'} />
            </button>
            <div className="menu-wrap">
              <button className="more-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Bookmark options"><MoreHorizontal size={19} /></button>
              {menuOpen && (
                <div className="context-menu">
                  <button onClick={() => { onEdit(bookmark); setMenuOpen(false); }}><Pencil size={15} /> Edit</button>
                  <button onClick={() => { onArchive(bookmark.id); setMenuOpen(false); }}><Archive size={15} /> {bookmark.archived ? 'Restore' : 'Archive'}</button>
                  <button className="danger" onClick={() => onDelete(bookmark.id)}><Trash2 size={15} /> Delete</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="description">{bookmark.description || 'No description added yet.'}</p>
      </div>
      <div className="card-footer">
        <div className="card-tags">
          {bookmark.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <span className="saved-time">{timeLabel(bookmark.createdAt)}</span>
      </div>
    </article>
  );
}

function BookmarkModal({ bookmark, onClose, onSave }) {
  const [form, setForm] = useState(bookmark || { title: '', url: '', description: '', tags: '' });
  const [lookup, setLookup] = useState({ status: 'idle', message: '' });
  const [previewIconFailed, setPreviewIconFailed] = useState(false);
  const urlRef = useRef(null);
  const initialUrl = useRef(bookmark?.url || '');
  useEffect(() => { setTimeout(() => urlRef.current?.focus(), 50); }, []);

  useEffect(() => {
    const rawUrl = form.url?.trim();
    if (!rawUrl || (bookmark && rawUrl === initialUrl.current)) {
      setLookup({ status: 'idle', message: '' });
      return;
    }
    let parsed;
    try { parsed = new URL(normalizeUrl(rawUrl)); } catch { return; }
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLookup({ status: 'loading', message: 'Fetching page details…' });
      try {
        const response = await fetch(`/api/metadata?url=${encodeURIComponent(rawUrl)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not read this page.');
        setPreviewIconFailed(false);
        setForm((current) => ({
          ...current,
          url: data.url || normalizeUrl(rawUrl),
          title: data.title || current.title,
          description: data.description || current.description,
          icon: data.icon || current.icon,
        }));
        setLookup({ status: 'success', message: `Details found from ${data.domain}` });
      } catch (error) {
        if (error.name !== 'AbortError') setLookup({ status: 'error', message: error.message });
      }
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [form.url, bookmark]);

  function submit(e) {
    e.preventDefault();
    const url = form.url.trim();
    if (!url) return;
    const domain = getDomain(url);
    onSave({
      ...bookmark,
      ...form,
      title: form.title.trim() || domain,
      url: normalizeUrl(url),
      description: form.description.trim(),
      tags: (Array.isArray(form.tags) ? form.tags.join(',') : form.tags).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 5),
    });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div><span className="eyebrow">{bookmark ? 'Update your library' : 'Grow your library'}</span><h2 id="modal-title">{bookmark ? 'Edit bookmark' : 'Add a bookmark'}</h2>{!bookmark && <p>Paste a link and we’ll fill in the details.</p>}</div>
          <button className="icon-button" onClick={onClose}><X size={21} /></button>
        </div>
        <form onSubmit={submit}>
          <label>Website URL<div className="url-input-wrap"><Link2 size={16} /><input ref={urlRef} type="text" placeholder="Paste a URL here" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required />{lookup.status === 'loading' && <LoaderCircle className="lookup-spinner" size={17} />}</div></label>
          {lookup.status !== 'idle' && <div className={`lookup-status ${lookup.status}`}>
            {lookup.status === 'success' && form.icon && !previewIconFailed ? <img src={form.icon} alt="" onError={() => setPreviewIconFailed(true)} /> : <span>{lookup.status === 'loading' ? <LoaderCircle size={14} /> : lookup.status === 'success' ? <Check size={14} /> : <X size={14} />}</span>}
            <div><strong>{lookup.status === 'loading' ? 'Reading the page' : lookup.status === 'success' ? 'Page details added' : 'Couldn’t fetch details'}</strong><small>{lookup.message}</small></div>
          </div>}
          <label>Title <span>Optional</span><input type="text" placeholder="A memorable title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>Description <span>Optional</span><textarea placeholder="Why is this worth saving?" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label>Tags <span>Separate with commas</span><input type="text" placeholder="design, reading, ideas" value={Array.isArray(form.tags) ? form.tags.join(', ') : form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></label>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={lookup.status === 'loading'}>{lookup.status === 'loading' ? <LoaderCircle className="lookup-spinner" size={17} /> : <BookmarkPlus size={17} />} {lookup.status === 'loading' ? 'Getting details…' : bookmark ? 'Save changes' : 'Save bookmark'}</button></div>
        </form>
      </div>
    </div>
  );
}

function Toast({ message }) {
  return <div className="toast"><span><Check size={15} /></span>{message}</div>;
}

function App() {
  const [bookmarks, setBookmarks] = useState(getInitialBookmarks);
  const [view, setView] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');
  const [modal, setModal] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks)); }, [bookmarks]);
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.querySelector('.search-input')?.focus(); }
      if (e.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function notify(message) {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
  }

  const tags = useMemo(() => {
    const counts = {};
    bookmarks.filter((b) => !b.archived).forEach((b) => b.tags.forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1; }));
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [bookmarks]);

  const visible = useMemo(() => {
    let result = bookmarks.filter((b) => {
      if (view === 'archive') return b.archived;
      if (b.archived) return false;
      if (view === 'favorites') return b.favorite;
      if (view === 'recent') return Date.now() - new Date(b.createdAt).getTime() < 7 * 86400000;
      if (view.startsWith('tag:')) return b.tags.includes(view.slice(4));
      return true;
    });
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((b) => [b.title, b.url, b.description, ...b.tags].join(' ').toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      if (sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === 'az') return a.title.localeCompare(b.title);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [bookmarks, view, query, sort]);

  const viewTitle = view === 'all' ? 'All bookmarks' : view === 'favorites' ? 'Favorites' : view === 'recent' ? 'Recently added' : view === 'archive' ? 'Archive' : `#${view.slice(4)}`;
  const subtitle = view === 'archive' ? 'Bookmarks you’ve tucked away.' : view === 'favorites' ? 'The links you love most.' : view.startsWith('tag:') ? `Everything tagged ${view.slice(4)}.` : 'Everything you’ve saved, all in one place.';

  function saveBookmark(data) {
    if (data.id) {
      setBookmarks((prev) => prev.map((b) => b.id === data.id ? { ...b, ...data } : b));
      notify('Bookmark updated');
    } else {
      const palette = ['#5e6ad2', '#e7592b', '#14866d', '#cf475c', '#4776e6', '#9a63c7'];
      const newBookmark = {
        ...data,
        id: crypto.randomUUID(),
        favorite: false,
        archived: false,
        createdAt: new Date().toISOString(),
        color: palette[Math.floor(Math.random() * palette.length)],
        monogram: (data.title || getDomain(data.url)).slice(0, 2).trim().toUpperCase(),
      };
      setBookmarks((prev) => [newBookmark, ...prev]);
      setView('all');
      notify('Bookmark saved');
    }
    setModal(null);
  }

  return (
    <div className="app-shell" data-harness-ready="true">
      <Sidebar view={view} setView={setView} tags={tags} bookmarks={bookmarks} onAdd={() => setModal({ type: 'add' })} open={navOpen} onClose={() => setNavOpen(false)} />
      <main className="main-content">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setNavOpen(true)}><Menu size={21} /></button>
          <div className="mobile-logo"><Logo /></div>
          <div className="search-wrap">
            <Search size={18} />
            <input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search bookmarks..." aria-label="Search bookmarks" />
            <kbd>⌘ K</kbd>
          </div>
          <button className="quick-add" onClick={() => setModal({ type: 'add' })}><Plus size={18} /><span>New bookmark</span></button>
        </header>

        <div className="content-wrap">
          <section className="page-heading">
            <div><span className="eyebrow"><Sparkles size={13} /> Your library</span><h1>{viewTitle}</h1><p>{subtitle}</p></div>
            <div className="bookmark-total"><strong>{visible.length}</strong><span>{visible.length === 1 ? 'bookmark' : 'bookmarks'}</span></div>
          </section>

          <section className="toolbar">
            <div className="results-label">{query ? <><strong>{visible.length}</strong> results for “{query}”</> : <><strong>{visible.length}</strong> items</>}</div>
            <div className="toolbar-actions">
              <label className="sort-control">Sort by<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="az">A–Z</option></select><ChevronDown size={14} /></label>
              <div className="view-toggle" aria-label="View style">
                <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} aria-label="Grid view"><Grid2X2 size={17} /></button>
                <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} aria-label="List view"><List size={18} /></button>
              </div>
            </div>
          </section>

          {visible.length ? (
            <section className={`bookmarks-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
              {visible.map((bookmark) => (
                <BookmarkCard key={bookmark.id} bookmark={bookmark} viewMode={viewMode}
                  onFavorite={(id) => setBookmarks((prev) => prev.map((b) => b.id === id ? { ...b, favorite: !b.favorite } : b))}
                  onEdit={(b) => setModal({ type: 'edit', bookmark: b })}
                  onArchive={(id) => { setBookmarks((prev) => prev.map((b) => b.id === id ? { ...b, archived: !b.archived } : b)); notify(view === 'archive' ? 'Bookmark restored' : 'Bookmark archived'); }}
                  onDelete={(id) => { setBookmarks((prev) => prev.filter((b) => b.id !== id)); notify('Bookmark deleted'); }} />
              ))}
            </section>
          ) : (
            <section className="empty-state">
              <div className="empty-icon"><Link2 size={25} /></div>
              <h2>{query ? 'No bookmarks found' : 'Nothing here yet'}</h2>
              <p>{query ? 'Try another search or check a different collection.' : 'Save something worth returning to.'}</p>
              {!query && <button className="primary-button" onClick={() => setModal({ type: 'add' })}><Plus size={17} /> Add a bookmark</button>}
            </section>
          )}
        </div>
      </main>

      {modal && <BookmarkModal bookmark={modal.bookmark} onClose={() => setModal(null)} onSave={saveBookmark} />}
      {toast && <Toast message={toast} />}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
