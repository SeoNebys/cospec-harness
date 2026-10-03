import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive, BookOpen, Bookmark, ChevronDown, Clock3, ExternalLink,
  Folder, FolderPlus, Grid2X2, Heart, List, MoreHorizontal, Plus,
  Search, Settings, Sparkles, Tag, Trash2, X, Globe2, LoaderCircle, Check,
  ArrowUpDown, Upload, Download, FileText
} from 'lucide-react';
import './styles.css';
import './metadata.css';

const starterBookmarks = [
  { id: 1, title: 'The craft of writing software', domain: 'increment.com', url: 'https://increment.com', description: 'A thoughtful guide to making software that lasts, from naming things to knowing when you’re done.', tags: ['Design', 'Engineering'], collection: 'Inspiration', color: '#FF6B4A', favicon: 'I', favorite: true, read: false, date: 'Today' },
  { id: 2, title: 'Linear method', domain: 'linear.app', url: 'https://linear.app/method', description: 'Principles and practices for building high-quality products with clarity and momentum.', tags: ['Product', 'Process'], collection: 'Work', color: '#5E6AD2', favicon: 'L', favorite: true, read: true, date: 'Yesterday' },
  { id: 3, title: 'The museum of websites', domain: 'museumofwebsites.com', url: 'https://www.museumofwebsites.com', description: 'A curated collection of beautiful and influential websites from across the internet.', tags: ['Design', 'Inspiration'], collection: 'Inspiration', color: '#15A087', favicon: 'M', favorite: false, read: false, date: 'Sep 22' },
  { id: 4, title: 'How to take smart notes', domain: 'fortelabs.com', url: 'https://fortelabs.com', description: 'A practical approach to creating a reliable system for ideas, insights, and everything you learn.', tags: ['Learning', 'Notes'], collection: 'Reading list', color: '#E0A02B', favicon: 'F', favorite: false, read: false, date: 'Sep 20' },
  { id: 5, title: 'Mobbin — UI & UX patterns', domain: 'mobbin.com', url: 'https://mobbin.com', description: 'A reference library of real-world interface patterns from the world’s best products.', tags: ['Design', 'Reference'], collection: 'Resources', color: '#111827', favicon: 'M', favorite: true, read: false, date: 'Sep 18' },
  { id: 6, title: 'A visual guide to the world’s best typefaces', domain: 'typewolf.com', url: 'https://www.typewolf.com', description: 'Independent typography resources, recommendations, and inspiration for designers.', tags: ['Typography', 'Design'], collection: 'Resources', color: '#B15438', favicon: 'T', favorite: false, read: true, date: 'Sep 15' },
  { id: 7, title: 'The marginalian', domain: 'themarginalian.org', url: 'https://www.themarginalian.org', description: 'A record of our search for meaning through literature, science, philosophy, and art.', tags: ['Reading', 'Ideas'], collection: 'Reading list', color: '#24492D', favicon: 'M', favorite: false, read: false, date: 'Sep 12' },
  { id: 8, title: 'Shape Up', domain: 'basecamp.com', url: 'https://basecamp.com/shapeup', description: 'Stop running in circles and ship work that matters with a different approach to product development.', tags: ['Product', 'Books'], collection: 'Work', color: '#2C6E49', favicon: 'B', favorite: true, read: true, date: 'Sep 8' },
];

const collections = [
  { name: 'Inspiration', color: '#E76F51' },
  { name: 'Work', color: '#5E6AD2' },
  { name: 'Reading list', color: '#D9A441' },
  { name: 'Resources', color: '#479C82' },
];

function canonicalUrl(value) {
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','fbclid','gclid','ref'].forEach(key => url.searchParams.delete(key));
    url.searchParams.sort();
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return `${url.hostname}${url.port ? `:${url.port}` : ''}${path}${url.search}`;
  } catch { return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/#]+$/, ''); }
}

const escapeHtml = (value = '') => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function App() {
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('markwell-bookmarks')) || starterBookmarks; }
    catch { return starterBookmarks; }
  });
  const [active, setActive] = useState('All bookmarks');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('Recently added');
  const [modalOpen, setModalOpen] = useState(false);
  const [editBookmark, setEditBookmark] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [activeTag, setActiveTag] = useState('');
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => localStorage.setItem('markwell-bookmarks', JSON.stringify(bookmarks)), [bookmarks]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const visible = useMemo(() => {
    let result = bookmarks.filter(b => {
      if (active === 'Favorites' && !b.favorite) return false;
      if (active === 'Read later' && b.read) return false;
      if (collections.some(c => c.name === active) && b.collection !== active) return false;
      if (activeTag && !b.tags.includes(activeTag)) return false;
      const haystack = `${b.title} ${b.domain} ${b.description} ${b.tags.join(' ')}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
    if (sort === 'A–Z') result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'Favorites first') result = [...result].sort((a, b) => Number(b.favorite) - Number(a.favorite));
    return result;
  }, [bookmarks, active, activeTag, query, sort]);

  const tagCounts = useMemo(() => bookmarks.reduce((counts, bookmark) => {
    bookmark.tags.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; });
    return counts;
  }, {}), [bookmarks]);
  const allTags = useMemo(() => Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a] || a.localeCompare(b)), [tagCounts]);

  const counts = useMemo(() => Object.fromEntries(collections.map(c => [c.name, bookmarks.filter(b => b.collection === c.name).length])), [bookmarks]);
  const toggleFavorite = id => setBookmarks(items => items.map(b => b.id === id ? { ...b, favorite: !b.favorite } : b));
  const removeBookmark = id => {
    setBookmarks(items => items.filter(b => b.id !== id));
    setMenuId(null); setToast('Bookmark moved to trash');
  };
  const markRead = id => {
    setBookmarks(items => items.map(b => b.id === id ? { ...b, read: !b.read } : b));
    setMenuId(null); setToast('Bookmark updated');
  };
  const addBookmark = data => {
    const duplicate = bookmarks.find(bookmark => canonicalUrl(bookmark.url) === canonicalUrl(data.url));
    if (duplicate) {
      setModalOpen(false); setEditBookmark(duplicate); setToast('Already saved — opened the existing bookmark');
      return;
    }
    const host = (() => { try { return new URL(data.url).hostname.replace('www.', ''); } catch { return data.url; } })();
    setBookmarks(items => [{
      id: Date.now(), title: data.title || host, domain: host, url: data.url.startsWith('http') ? data.url : `https://${data.url}`,
      description: data.description || 'Saved for later.', tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : ['Unsorted'],
      collection: data.collection, color: '#315C4B', favicon: (data.title || host).charAt(0).toUpperCase(), favorite: false, read: false, date: 'Just now'
    }, ...items]);
    setModalOpen(false); setActive('All bookmarks'); setToast('Bookmark saved');
  };
  const openDuplicate = bookmark => {
    setModalOpen(false);
    setEditBookmark(bookmark);
    setToast('Already saved — opened the existing bookmark');
  };
  const saveEdit = data => {
    setBookmarks(items => items.map(bookmark => bookmark.id === data.id ? {
      ...bookmark,
      title: data.title.trim() || bookmark.domain,
      description: data.description.trim() || 'Saved for later.',
      collection: data.collection,
      tags: data.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    } : bookmark));
    setEditBookmark(null); setToast('Bookmark updated');
  };
  const chooseTag = tag => { setActiveTag(tag); setTagMenuOpen(false); };
  const importBookmarks = imported => {
    let added = 0, skipped = 0;
    const known = new Set(bookmarks.map(bookmark => canonicalUrl(bookmark.url)));
    const fresh = imported.flatMap((item, index) => {
      const canonical = canonicalUrl(item.url);
      if (!canonical || known.has(canonical)) { skipped++; return []; }
      known.add(canonical); added++;
      let domain = item.url;
      try { domain = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}
      return [{
        id: Date.now() + index, title: item.title || domain, domain, url: item.url,
        description: item.description || 'Imported from your browser bookmarks.',
        tags: item.tags.length ? item.tags : ['Imported'], collection: item.collection || 'Imported',
        color: ['#315C4B','#5E6AD2','#B15438','#15A087'][index % 4],
        favicon: (item.title || domain).charAt(0).toUpperCase(), favorite: false, read: false, date: 'Imported'
      }];
    });
    if (fresh.length) setBookmarks(current => [...fresh, ...current]);
    if (added) setActive('All bookmarks');
    return { added, skipped };
  };
  const exportBookmarks = () => {
    const groups = bookmarks.reduce((result, bookmark) => {
      (result[bookmark.collection] ||= []).push(bookmark); return result;
    }, {});
    const folders = Object.entries(groups).map(([name, items]) => `    <DT><H3>${escapeHtml(name)}</H3>\n    <DL><p>\n${items.map(bookmark => `        <DT><A HREF="${escapeHtml(bookmark.url)}" ADD_DATE="${Math.floor(Date.now()/1000)}" TAGS="${escapeHtml(bookmark.tags.join(','))}">${escapeHtml(bookmark.title)}</A>\n        <DD>${escapeHtml(bookmark.description)}`).join('\n')}\n    </DL><p>`).join('\n');
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Markwell Bookmarks</TITLE>\n<H1>Markwell Bookmarks</H1>\n<DL><p>\n${folders}\n</DL><p>`;
    const href = URL.createObjectURL(new Blob([html], {type:'text/html'}));
    const link = document.createElement('a'); link.href = href; link.download = `markwell-bookmarks-${new Date().toISOString().slice(0,10)}.html`; link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    setToast(`${bookmarks.length} bookmarks exported`);
  };

  return (
    <div className="app" data-harness-ready="true">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Bookmark size={18} fill="currentColor" /></span><span>markwell</span></div>
        <button className="add-button" onClick={() => setModalOpen(true)}><Plus size={18} /> Add bookmark</button>

        <nav className="nav-section">
          <p className="section-label">LIBRARY</p>
          <NavItem icon={<BookOpen />} label="All bookmarks" count={bookmarks.length} active={active} onClick={setActive} />
          <NavItem icon={<Heart />} label="Favorites" count={bookmarks.filter(b => b.favorite).length} active={active} onClick={setActive} />
          <NavItem icon={<Clock3 />} label="Read later" count={bookmarks.filter(b => !b.read).length} active={active} onClick={setActive} />
        </nav>
        <nav className="nav-section collections">
          <div className="section-heading"><p className="section-label">COLLECTIONS</p><button aria-label="New collection"><Plus size={15}/></button></div>
          {collections.map(c => <NavItem key={c.name} dot={c.color} label={c.name} count={counts[c.name]} active={active} onClick={setActive} />)}
        </nav>
        <div className="sidebar-bottom">
          <button><Archive size={18}/> Archive <span>2</span></button>
          <button><Trash2 size={18}/> Trash</button>
          <button onClick={() => setDataModalOpen(true)}><ArrowUpDown size={18}/> Import & export</button>
          <button><Settings size={18}/> Settings</button>
          <div className="storage"><div><span>Storage</span><span>{bookmarks.length} of 500</span></div><div className="storage-track"><i style={{width: `${Math.max(4, bookmarks.length / 5)}%`}}/></div></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="search"><Search size={19}/><input aria-label="Search bookmarks" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your bookmarks..." /><kbd>⌘ K</kbd></div>
          <div className="profile"><button className="sparkle" aria-label="What's new"><Sparkles size={18}/></button><div className="avatar">AM</div><div><strong>Alex Morgan</strong><span>Personal space</span></div><ChevronDown size={16}/></div>
        </header>

        <section className="content">
          <div className="page-heading">
            <div><p className="eyebrow">YOUR LIBRARY</p><h1>{active}</h1><p>{activeTag ? `${visible.length} tagged “${activeTag}”` : `${visible.length} ${visible.length === 1 ? 'bookmark' : 'bookmarks'} collected`}</p></div>
            <button className="mobile-add" onClick={() => setModalOpen(true)}><Plus size={18}/> Add bookmark</button>
          </div>
          <div className="toolbar">
            <div className="chips-wrap"><span className="tag-label">TAGS</span><div className="chips">
              <button className={`chip ${!activeTag ? 'active' : ''}`} onClick={() => chooseTag('')}>All</button>
              {allTags.slice(0, 4).map(tag => <button key={tag} className={`chip ${activeTag === tag ? 'active' : ''}`} onClick={() => chooseTag(tag)}>{tag}<em>{tagCounts[tag]}</em></button>)}
              {allTags.length > 4 && <div className="tag-menu-wrap"><button className={`chip more ${allTags.slice(4).includes(activeTag) ? 'active' : ''}`} onClick={() => setTagMenuOpen(open => !open)} aria-label="More tags"><MoreHorizontal size={17}/></button>
                {tagMenuOpen && <div className="tag-menu">{allTags.slice(4).map(tag => <button key={tag} onClick={() => chooseTag(tag)}><span>{tag}</span><em>{tagCounts[tag]}</em></button>)}</div>}
              </div>}
            </div></div>
            <div className="view-controls">
              <label className="sort">{sort}<select aria-label="Sort bookmarks" value={sort} onChange={e => setSort(e.target.value)}><option>Recently added</option><option>A–Z</option><option>Favorites first</option></select><ChevronDown size={15}/></label>
              <div className="view-toggle"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={17}/></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={18}/></button></div>
            </div>
          </div>

          {visible.length ? <div className={`bookmark-grid ${view}`}>
            {visible.map(bookmark => <BookmarkCard key={bookmark.id} bookmark={bookmark} view={view} onFavorite={toggleFavorite} menuId={menuId} setMenuId={setMenuId} onRemove={removeBookmark} onRead={markRead} onTag={chooseTag} onEdit={setEditBookmark}/>) }
          </div> : <div className="empty"><div><Search size={28}/></div><h2>No bookmarks found</h2><p>Try a different search, or save something new.</p><button onClick={() => {setQuery(''); setActive('All bookmarks')}}>Clear filters</button></div>}
        </section>
        <footer><span>Made for the curious.</span><span>Press <kbd>⌘ K</kbd> to search anytime</span></footer>
      </main>

      {modalOpen && <AddModal bookmarks={bookmarks} onClose={() => setModalOpen(false)} onAdd={addBookmark} onDuplicate={openDuplicate}/>} 
      {editBookmark && <EditModal bookmark={editBookmark} onClose={() => setEditBookmark(null)} onSave={saveEdit}/>} 
      {dataModalOpen && <DataModal onClose={() => setDataModalOpen(false)} onImport={importBookmarks} onExport={exportBookmarks} count={bookmarks.length}/>} 
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </div>
  );
}

function NavItem({ icon, dot, label, count, active, onClick }) {
  return <button className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => onClick(label)}>{dot ? <i className="nav-dot" style={{background: dot}}/> : React.cloneElement(icon, {size:18})}<span>{label}</span><em>{count}</em></button>;
}

function BookmarkCard({ bookmark, view, onFavorite, menuId, setMenuId, onRemove, onRead, onTag, onEdit }) {
  return <article className="bookmark-card">
    <div className="card-top">
      <a className="site-icon" href={bookmark.url} target="_blank" rel="noreferrer" style={{backgroundColor: bookmark.color}}>{bookmark.favicon}</a>
      <div className="card-actions"><button onClick={() => onFavorite(bookmark.id)} aria-label="Favorite"><Heart size={18} className={bookmark.favorite ? 'hearted' : ''} fill={bookmark.favorite ? 'currentColor' : 'none'}/></button><button onClick={() => setMenuId(menuId === bookmark.id ? null : bookmark.id)} aria-label="More actions"><MoreHorizontal size={19}/></button></div>
      {menuId === bookmark.id && <div className="card-menu"><button onClick={() => { onEdit(bookmark); setMenuId(null); }}><Tag/> Edit details & tags</button><button onClick={() => onRead(bookmark.id)}><Clock3/> {bookmark.read ? 'Mark unread' : 'Mark as read'}</button><button className="danger" onClick={() => onRemove(bookmark.id)}><Trash2/> Move to trash</button></div>}
    </div>
    <div className="card-body">
      <a href={bookmark.url} target="_blank" rel="noreferrer" className="title-link"><h2>{bookmark.title}</h2><ExternalLink size={15}/></a>
      <p className="domain">{bookmark.domain}</p>
      <p className="description">{bookmark.description}</p>
    </div>
    <div className="card-bottom"><div className="tags">{bookmark.tags.slice(0, view === 'list' ? 3 : 2).map(tag => <button key={tag} onClick={() => onTag(tag)}>{tag}</button>)}</div><time>{bookmark.date}</time></div>
  </article>;
}

function DataModal({ onClose, onImport, onExport, count }) {
  const [status, setStatus] = useState({type:'idle', message:''});
  const readFile = async file => {
    if (!file) return;
    setStatus({type:'loading', message:`Reading ${file.name}…`});
    try {
      const html = await file.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const headings = [...doc.querySelectorAll('h3')];
      const imported = [...doc.querySelectorAll('a[href]')].map(anchor => {
        const nearestHeading = headings.filter(heading => heading.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING).at(-1);
        const folder = nearestHeading?.textContent?.trim();
        const attributeTags = (anchor.getAttribute('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean);
        const tags = [...new Set([...attributeTags, ...(folder && !/bookmark(s| bar| menu)?$/i.test(folder) ? [folder] : [])])];
        return { url: anchor.href, title: anchor.textContent.trim(), description: '', tags, collection: folder || 'Imported' };
      }).filter(item => /^https?:\/\//i.test(item.url));
      if (!imported.length) throw new Error('No web bookmarks were found in this file.');
      const result = onImport(imported);
      setStatus({type:'success', message:`Imported ${result.added} bookmark${result.added === 1 ? '' : 's'}${result.skipped ? ` · skipped ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'}` : ''}.`});
    } catch (error) {
      setStatus({type:'error', message:error.message || 'This file could not be imported.'});
    }
  };
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="modal data-modal">
      <div className="modal-head"><div className="modal-icon"><ArrowUpDown size={20}/></div><div><h2>Import & export</h2><p>Move bookmarks between Markwell and your browser.</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <section className="transfer-section">
        <div className="transfer-heading"><Upload size={18}/><div><h3>Import bookmarks</h3><p>Choose the HTML file exported by your browser. Existing links will be skipped.</p></div></div>
        <label className="file-drop">
          <FileText size={22}/><span><strong>Choose bookmark file</strong><small>Chrome, Edge, Firefox, or Safari HTML</small></span>
          <input type="file" accept=".html,.htm,text/html" onChange={event => readFile(event.target.files?.[0])}/>
        </label>
        {status.type !== 'idle' && <div className={`import-result ${status.type}`}>{status.type === 'loading' ? <LoaderCircle className="spin"/> : status.type === 'success' ? <Check/> : <X/>}<span>{status.message}</span></div>}
      </section>
      <section className="transfer-section export-section">
        <div className="transfer-heading"><Download size={18}/><div><h3>Export bookmarks</h3><p>Download all {count} bookmarks as a browser-compatible HTML file.</p></div></div>
        <button className="export-button" onClick={onExport}><Download size={16}/> Export {count} bookmarks</button>
      </section>
      <div className="data-footer"><p>Your files stay on this device. Importing only reads the file you select.</p><button onClick={onClose}>Done</button></div>
    </div>
  </div>;
}

function EditModal({ bookmark, onClose, onSave }) {
  const [form, setForm] = useState({ ...bookmark, tags: bookmark.tags.join(', ') });
  const update = (key, value) => setForm(current => ({...current, [key]: value}));
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="modal edit-modal" onSubmit={e => { e.preventDefault(); onSave(form); }}>
      <div className="modal-head"><div className="modal-icon"><Tag size={20}/></div><div><h2>Edit bookmark</h2><p>Keep the details and tags useful to you.</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <div className="locked-url"><Globe2 size={15}/><span>{bookmark.url}</span></div>
      <label>Title<input autoFocus value={form.title} onChange={e => update('title', e.target.value)}/></label>
      <label>Description<textarea value={form.description} onChange={e => update('description', e.target.value)}/></label>
      <div className="form-row"><label><Folder size={14}/> Collection<select value={form.collection} onChange={e => update('collection', e.target.value)}>{collections.map(c => <option key={c.name}>{c.name}</option>)}</select></label><label><Tag size={14}/> Tags<input placeholder="Design, Ideas" value={form.tags} onChange={e => update('tags', e.target.value)}/></label></div>
      <p className="tag-hint">Separate tags with commas. New tags become filters automatically.</p>
      <div className="modal-actions"><button type="button" className="cancel" onClick={onClose}>Cancel</button><button type="submit" className="save"><Check size={17}/> Save changes</button></div>
    </form>
  </div>;
}

function AddModal({ bookmarks, onClose, onAdd, onDuplicate }) {
  const [form, setForm] = useState({url:'', title:'', description:'', tags:'', collection:'Inspiration'});
  const [lookup, setLookup] = useState({ status: 'idle', message: '' });
  const lastFetched = useRef('');
  const update = (key, value) => setForm(f => ({...f, [key]: value}));
  useEffect(() => {
    const raw = form.url.trim();
    if (!raw || raw.length < 5) { setLookup({status:'idle', message:''}); return; }
    const duplicate = bookmarks.find(bookmark => canonicalUrl(bookmark.url) === canonicalUrl(raw));
    if (duplicate) {
      setLookup({status:'duplicate', message:'This bookmark is already in your library.'});
      const timer = setTimeout(() => onDuplicate(duplicate), 350);
      return () => clearTimeout(timer);
    }
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (normalized === lastFetched.current) return;
    const timer = setTimeout(async () => {
      const target = normalized;
      lastFetched.current = target;
      setLookup({status:'loading', message:'Fetching page details…'});
      try {
        const response = await fetch(`/api/metadata?url=${encodeURIComponent(target)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setForm(current => ({ ...current, url: data.url, title: data.title || current.title, description: data.description || current.description }));
        setLookup({status:'success', message:'Page details added automatically'});
      } catch (error) {
        setLookup({status:'error', message:error.message || 'Could not fetch details — you can still save this link.'});
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [form.url, bookmarks, onDuplicate]);
  const submit = e => { e.preventDefault(); if (form.url.trim()) onAdd(form); };
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="modal" onSubmit={submit}>
      <div className="modal-head"><div className="modal-icon"><Bookmark size={20}/></div><div><h2>Save a bookmark</h2><p>Keep something worth coming back to.</p></div><button type="button" onClick={onClose} aria-label="Close"><X size={20}/></button></div>
      <label>URL<input autoFocus required type="text" placeholder="Paste a link to any page" value={form.url} onChange={e => update('url', e.target.value)}/></label>
      <div className={`lookup-status ${lookup.status}`} aria-live="polite">
        {lookup.status === 'loading' && <LoaderCircle className="spin" size={15}/>} 
        {lookup.status === 'success' && <Check size={15}/>} 
        {lookup.status === 'duplicate' && <Bookmark size={15}/>} 
        {lookup.status === 'error' && <Globe2 size={15}/>} 
        <span>{lookup.message || 'Title and description will be filled in automatically'}</span>
      </div>
      {lookup.status === 'success' && <div className="link-preview"><div><Globe2 size={18}/></div><section><strong>{form.title}</strong><span>{form.description || 'No description was provided by this page.'}</span></section></div>}
      <label>Title <span>Optional</span><input type="text" placeholder="A memorable title" value={form.title} onChange={e => update('title', e.target.value)}/></label>
      <label>Description <span>Optional</span><textarea placeholder="Why is this worth saving?" value={form.description} onChange={e => update('description', e.target.value)}/></label>
      <div className="form-row"><label><Folder size={14}/> Collection<select value={form.collection} onChange={e => update('collection', e.target.value)}>{collections.map(c => <option key={c.name}>{c.name}</option>)}</select></label><label><Tag size={14}/> Tags<input placeholder="Design, Ideas" value={form.tags} onChange={e => update('tags', e.target.value)}/></label></div>
      <div className="modal-actions"><button type="button" className="cancel" onClick={onClose}>Cancel</button><button type="submit" className="save"><Bookmark size={17}/> Save bookmark</button></div>
    </form>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
