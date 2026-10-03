import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive, ArrowUpRight, Bookmark, BookOpen, Check, ChevronDown, Clock3,
  Feather, Folder, Grid2X2, Heart, Inbox, LayoutList, Link2, Menu, MoreHorizontal,
  Plus, Search, SlidersHorizontal, Sparkles, Star, Tag, Trash2, X
} from 'lucide-react';
import './styles.css';

const seed = [
  { id: 1, title: 'The art of doing less', url: 'https://nesslabs.com/the-art-of-doing-less', domain: 'nesslabs.com', description: 'A thoughtful guide to protecting your attention and making space for what matters.', tags: ['mindset', 'productivity'], collection: 'Read later', favorite: true, read: false, created: 'Today', hue: '#e5a44d' },
  { id: 2, title: 'Designing with type', url: 'https://practicaltypography.com', domain: 'practicaltypography.com', description: 'A practical, opinionated introduction to typography for people who make things.', tags: ['design', 'reference'], collection: 'Design', favorite: false, read: false, created: 'Yesterday', hue: '#5f8068' },
  { id: 3, title: 'A visual guide to the future', url: 'https://pudding.cool/process/visual-essays', domain: 'pudding.cool', description: 'Beautiful examples of storytelling where data, design, and curiosity meet.', tags: ['inspiration', 'data'], collection: 'Inspiration', favorite: true, read: true, created: 'Sep 14', hue: '#c26e55' },
  { id: 4, title: 'How to build a second brain', url: 'https://fortelabs.com/blog/basboverview', domain: 'fortelabs.com', description: 'A system for saving and using the ideas and insights you encounter every day.', tags: ['knowledge', 'systems'], collection: 'Read later', favorite: false, read: false, created: 'Sep 12', hue: '#637690' },
  { id: 5, title: 'Shape Up', url: 'https://basecamp.com/shapeup', domain: 'basecamp.com', description: 'Stop running in circles and ship work that matters with a better product process.', tags: ['product', 'books'], collection: 'Work', favorite: true, read: true, created: 'Sep 09', hue: '#7b6a8d' },
  { id: 6, title: 'The marginalian', url: 'https://www.themarginalian.org', domain: 'themarginalian.org', description: 'A record of reckoning with our search for meaning through science, philosophy, and art.', tags: ['essays', 'culture'], collection: 'Inspiration', favorite: false, read: false, created: 'Sep 03', hue: '#867c58' },
];

const nav = [
  { name: 'All bookmarks', icon: Bookmark },
  { name: 'Favorites', icon: Star },
  { name: 'Read later', icon: Clock3 },
  { name: 'Archive', icon: Archive },
];
const collections = ['Design', 'Inspiration', 'Work'];

function favicon(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function BookmarkModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item || { title: '', url: '', description: '', tags: '', collection: 'Read later' });
  const [lookup, setLookup] = useState('idle');
  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));
  useEffect(() => {
    if (item || !/^https?:\/\/\S+/.test(form.url)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLookup('loading');
      try {
        const response = await fetch(`/api/metadata?url=${encodeURIComponent(form.url)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setForm(current => ({ ...current, title: current.title || data.title, description: current.description || data.description }));
        setLookup(data.title || data.description ? 'success' : 'empty');
      } catch (error) { if (error.name !== 'AbortError') setLookup('error'); }
    }, 550);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [form.url, item]);
  const submit = e => {
    e.preventDefault();
    if (!form.url.trim()) return;
    let domain = form.url.replace(/^https?:\/\//, '').split('/')[0] || 'website';
    onSave({
      ...form,
      title: form.title.trim() || domain,
      domain,
      tags: Array.isArray(form.tags) ? form.tags : form.tags.split(',').map(t => t.trim()).filter(Boolean),
      collection: form.collection || 'Read later'
    });
  };
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="modal" onSubmit={submit}>
      <div className="modal-head">
        <div><span className="eyebrow">{item ? 'MAKE A CHANGE' : 'SAVE SOMETHING GOOD'}</span><h2>{item ? 'Edit bookmark' : 'New bookmark'}</h2></div>
        <button type="button" className="icon-button" onClick={onClose}><X size={19}/></button>
      </div>
      <label>Web address<div className="url-field"><input autoFocus type="url" required placeholder="https://example.com/article" value={form.url} onChange={e => update('url', e.target.value)} />{lookup === 'loading' && <span className="spinner"/>}{lookup === 'success' && <Check size={17}/>}</div>{lookup === 'loading' && <small>Fetching the page details…</small>}{lookup === 'success' && <small className="lookup-good">Page details added automatically</small>}{lookup === 'error' && <small>We couldn’t read this page, but you can still add the details yourself.</small>}</label>
      <label>Title<input placeholder="What should we call it?" value={form.title} onChange={e => update('title', e.target.value)} /></label>
      <label>Note<textarea rows="3" placeholder="A quick note for your future self…" value={form.description} onChange={e => update('description', e.target.value)} /></label>
      <div className="form-row">
        <label>Collection<select value={form.collection} onChange={e => update('collection', e.target.value)}><option>Read later</option>{collections.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Tags<input placeholder="design, ideas" value={Array.isArray(form.tags) ? form.tags.join(', ') : form.tags} onChange={e => update('tags', e.target.value)} /></label>
      </div>
      <div className="modal-actions"><button type="button" className="text-button" onClick={onClose}>Cancel</button><button className="primary"><Bookmark size={17}/> {item ? 'Save changes' : 'Save bookmark'}</button></div>
    </form>
  </div>;
}

function Card({ item, view, onFavorite, onRead, onEdit, onArchive, onDelete, onTag }) {
  const [menu, setMenu] = useState(false);
  return <article className={`bookmark-card ${view}`}>
    <div className="card-top">
      <div className="site-icon" style={{'--hue': item.hue || '#66786b'}}><img src={favicon(item.domain)} onError={e => e.currentTarget.style.display='none'} /></div>
      <div className="card-actions">
        <button aria-label="Favorite" className={`mini ${item.favorite ? 'active' : ''}`} onClick={() => onFavorite(item.id)}><Heart size={17} fill={item.favorite ? 'currentColor' : 'none'}/></button>
        <div className="menu-wrap"><button aria-label="More actions" className="mini" onClick={() => setMenu(v => !v)}><MoreHorizontal size={19}/></button>{menu && <div className="pop-menu"><button onClick={() => {onEdit(item);setMenu(false)}}>Edit</button><button onClick={() => {onArchive(item.id);setMenu(false)}}>{item.archived ? 'Restore bookmark' : 'Move to archive'}</button><button className="danger" onClick={() => {onDelete(item);setMenu(false)}}><Trash2 size={13}/> Delete permanently</button></div>}</div>
      </div>
    </div>
    <div className="card-main">
      <span className="domain">{item.domain}</span>
      <a href={item.url} target="_blank" rel="noreferrer" className="title-link"><h3>{item.title}</h3><ArrowUpRight size={16}/></a>
      <p>{item.description || 'Saved for later.'}</p>
      <div className="tags">{item.tags.map(t => <button key={t} onClick={() => onTag(t)}>{t}</button>)}</div>
    </div>
    <div className="card-foot"><span><Folder size={14}/>{item.collection}</span><button className={item.read ? 'is-read' : ''} onClick={() => onRead(item.id)}>{item.read ? <Check size={14}/> : <BookOpen size={14}/>} {item.read ? 'Read' : 'Mark read'}</button></div>
  </article>;
}

function App() {
  const [items, setItems] = useState(() => { try { return JSON.parse(localStorage.getItem('kept-bookmarks')) || seed; } catch { return seed; } });
  const [active, setActive] = useState('All bookmarks');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('Newest');
  const [modal, setModal] = useState(null);
  const [sidebar, setSidebar] = useState(false);
  const [notice, setNotice] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [deleteItem, setDeleteItem] = useState(null);
  useEffect(() => localStorage.setItem('kept-bookmarks', JSON.stringify(items)), [items]);
  useEffect(() => { if (!notice) return; const t=setTimeout(()=>setNotice(''),2200); return ()=>clearTimeout(t)}, [notice]);

  const filtered = useMemo(() => {
    let list = items.filter(i => !i.archived);
    if (active === 'Favorites') list = list.filter(i => i.favorite);
    else if (active === 'Read later') list = list.filter(i => !i.read);
    else if (active === 'Archive') list = items.filter(i => i.archived);
    else if (collections.includes(active)) list = list.filter(i => i.collection === active);
    if (tagFilter) list = list.filter(i => i.tags.includes(tagFilter));
    if (query) { const q=query.toLowerCase(); list=list.filter(i => [i.title,i.domain,i.description,i.collection,...i.tags].join(' ').toLowerCase().includes(q)); }
    if (sort === 'A–Z') list = [...list].sort((a,b)=>a.title.localeCompare(b.title));
    if (sort === 'Favorites') list = [...list].sort((a,b)=>Number(b.favorite)-Number(a.favorite));
    return list;
  }, [items, active, query, sort, tagFilter]);

  const save = data => {
    if (data.id) setItems(xs => xs.map(x => x.id === data.id ? {...x,...data} : x));
    else setItems(xs => [{...data,id:Date.now(),favorite:false,read:false,archived:false,created:'Just now',hue:['#c26e55','#5f8068','#7b6a8d','#e5a44d'][xs.length%4]},...xs]);
    setModal(null); setNotice(data.id ? 'Bookmark updated' : 'Bookmark saved');
  };
  const choose = n => { setActive(n); setTagFilter(''); setSidebar(false); };
  return <div className="app-shell" data-harness-ready="true">
    <aside className={sidebar ? 'open' : ''}>
      <div className="brand"><div className="brand-mark"><Feather size={21}/></div><span>kept.</span></div>
      <nav>{nav.map(({name,icon:Icon}) => <button key={name} className={active===name?'active':''} onClick={()=>choose(name)}><Icon size={18}/><span>{name}</span>{name==='All bookmarks'&&<em>{items.filter(i=>!i.archived).length}</em>}</button>)}</nav>
      <div className="nav-label"><span>COLLECTIONS</span><button title="Add collection"><Plus size={15}/></button></div>
      <nav className="collections">{collections.map((name,i)=><button key={name} className={active===name?'active':''} onClick={()=>choose(name)}><i className={`dot d${i}`}/><span>{name}</span><em>{items.filter(x=>x.collection===name&&!x.archived).length}</em></button>)}</nav>
      <div className="sidebar-quote"><Sparkles size={17}/><p>Keep what sparks something. Find it when it matters.</p></div>
      <div className="user"><div className="avatar">AL</div><div><strong>Alex Morgan</strong><span>alex@example.com</span></div><ChevronDown size={15}/></div>
    </aside>
    {sidebar && <div className="mobile-shade" onClick={()=>setSidebar(false)}/>} 
    <main>
      <header><button className="mobile-menu" onClick={()=>setSidebar(true)}><Menu/></button><div className="search"><Search size={18}/><input aria-label="Search bookmarks" placeholder="Search your collection…" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><button className="primary" onClick={()=>setModal({type:'new'})}><Plus size={18}/> Add bookmark</button></header>
      <section className="content">
        <div className="page-title"><div><span className="eyebrow">YOUR LIBRARY</span><h1>{tagFilter ? `Tagged “${tagFilter}”` : active}</h1><p>{filtered.length} {filtered.length===1?'bookmark':'bookmarks'} · thoughtfully collected</p></div><div className="view-actions"><div className="segmented"><button className={view==='grid'?'active':''} onClick={()=>setView('grid')}><Grid2X2 size={17}/></button><button className={view==='list'?'active':''} onClick={()=>setView('list')}><LayoutList size={18}/></button></div></div></div>
        <div className="toolbar"><div className="quick-filters">{tagFilter ? <button className="tag-filter" onClick={()=>setTagFilter('')}><Tag size={14}/> {tagFilter}<X size={13}/></button> : <button className="filter-active"><SlidersHorizontal size={15}/> All</button>}<button onClick={()=>choose('Favorites')}><Heart size={15}/> Favorites</button><button onClick={()=>choose('Read later')}><Clock3 size={15}/> Unread</button></div><label className="sort">Sort by <select value={sort} onChange={e=>setSort(e.target.value)}><option>Newest</option><option>A–Z</option><option>Favorites</option></select></label></div>
        {filtered.length ? <div className={`cards ${view}`}>{filtered.map(item=><Card key={item.id} item={item} view={view} onFavorite={id=>setItems(xs=>xs.map(x=>x.id===id?{...x,favorite:!x.favorite}:x))} onRead={id=>setItems(xs=>xs.map(x=>x.id===id?{...x,read:!x.read}:x))} onEdit={item=>setModal({type:'edit',item})} onArchive={id=>{setItems(xs=>xs.map(x=>x.id===id?{...x,archived:!x.archived}:x));setNotice(active==='Archive'?'Restored':'Moved to archive')}} onDelete={setDeleteItem} onTag={tag=>{setTagFilter(tag);setActive('All bookmarks');window.scrollTo({top:0,behavior:'smooth'})}} />)}</div> : <div className="empty"><div><Inbox size={30}/></div><h2>Nothing tucked away here</h2><p>{query ? `No bookmarks match “${query}”.` : 'Save a link now and your future self will thank you.'}</p><button className="primary" onClick={()=>setModal({type:'new'})}><Plus size={17}/> Add a bookmark</button></div>}
      </section>
    </main>
    {modal && <BookmarkModal item={modal.item} onClose={()=>setModal(null)} onSave={save}/>} 
    {deleteItem && <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setDeleteItem(null)}><div className="confirm-dialog"><div className="delete-icon"><Trash2 size={20}/></div><h2>Delete this bookmark?</h2><p><strong>{deleteItem.title}</strong> will be permanently removed. This can’t be undone.</p><div className="modal-actions"><button className="text-button" onClick={()=>setDeleteItem(null)}>Cancel</button><button className="delete-button" onClick={()=>{setItems(xs=>xs.filter(x=>x.id!==deleteItem.id));setDeleteItem(null);setNotice('Bookmark deleted')}}>Delete permanently</button></div></div></div>}
    {notice && <div className="toast"><Check size={16}/>{notice}</div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
