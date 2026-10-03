import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive, Bookmark, ChevronDown, Clock3, ExternalLink, Folder,
  Heart, LayoutGrid, List, MoreHorizontal, Plus, Search, Download,
  Sparkles, Tag, X, Pencil, Trash2, Check, Link as LinkIcon, LoaderCircle, WandSparkles
} from 'lucide-react';
import './styles.css';

const seed = [
  { id: 1, title: 'Designing interfaces that feel inevitable', url: 'https://linear.app/method', domain: 'linear.app', description: 'The practices and principles behind Linear’s product design.', tags: ['Design', 'Product'], collection: 'Inspiration', favorite: true, read: false, color: '#5e6ad2', initials: 'L', saved: '2h ago' },
  { id: 2, title: 'The Complete Guide to CSS Grid', url: 'https://css-tricks.com/snippets/css/complete-guide-grid/', domain: 'css-tricks.com', description: 'A complete visual guide to CSS grid layout, including all properties.', tags: ['Development', 'CSS'], collection: 'Resources', favorite: false, read: false, color: '#ef5b2a', initials: 'C', saved: 'Yesterday' },
  { id: 3, title: 'How to build a digital garden', url: 'https://nesslabs.com/digital-garden-set-up', domain: 'nesslabs.com', description: 'A practical guide to cultivating ideas and knowledge in public.', tags: ['Writing', 'Ideas'], collection: 'Reading list', favorite: true, read: true, color: '#7d9b76', initials: 'N', saved: 'Sep 18' },
  { id: 4, title: 'The art of product strategy', url: 'https://www.lennysnewsletter.com/p/product-strategy', domain: 'lennysnewsletter.com', description: 'A framework for making the hard choices that shape great products.', tags: ['Product', 'Strategy'], collection: 'Reading list', favorite: false, read: false, color: '#171717', initials: 'L', saved: 'Sep 16' },
  { id: 5, title: 'Mobbin — Mobile & web design library', url: 'https://mobbin.com', domain: 'mobbin.com', description: 'A library of real-world interface patterns from the best products.', tags: ['Design', 'Inspiration'], collection: 'Inspiration', favorite: false, read: true, color: '#e8d53d', initials: 'M', saved: 'Sep 12' },
  { id: 6, title: 'Thinking in systems', url: 'https://fs.blog/thinking-in-systems/', domain: 'fs.blog', description: 'Why understanding systems is a superpower for solving complex problems.', tags: ['Ideas', 'Strategy'], collection: 'Reading list', favorite: false, read: false, color: '#bd5f4d', initials: 'FS', saved: 'Sep 08' },
];

const defaultCollections = ['Inspiration', 'Resources', 'Reading list'];

function favicon(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function App() {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stash-bookmarks')) || seed; } catch { return seed; }
  });
  const [collections, setCollections] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stash-collections')) || defaultCollections; } catch { return defaultCollections; }
  });
  const [filter, setFilter] = useState('All bookmarks');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');
  const [modal, setModal] = useState(null);
  const [menu, setMenu] = useState(null);
  const [sort, setSort] = useState('Recently added');
  const [toast, setToast] = useState('');
  const [addingCollection, setAddingCollection] = useState(false);
  const [newCollection, setNewCollection] = useState('');
  const searchRef = useRef(null);

  useEffect(() => localStorage.setItem('stash-bookmarks', JSON.stringify(items)), [items]);
  useEffect(() => localStorage.setItem('stash-collections', JSON.stringify(collections)), [collections]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2200); return () => clearTimeout(id); }, [toast]);
  useEffect(() => {
    const shortcut = e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==='k') { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, []);

  const filtered = useMemo(() => {
    let result = items.filter(item => {
      if (filter === 'Favorites' && !item.favorite) return false;
      if (filter === 'Read later' && item.read) return false;
      if (collections.includes(filter) && item.collection !== filter) return false;
      const haystack = `${item.title} ${item.description} ${item.domain} ${item.tags.join(' ')}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
    if (sort === 'A–Z') result = [...result].sort((a,b) => a.title.localeCompare(b.title));
    if (sort === 'Favorites first') result = [...result].sort((a,b) => Number(b.favorite) - Number(a.favorite));
    return result;
  }, [items, filter, query, sort]);

  const saveItem = data => {
    if (data.id) setItems(items.map(x => x.id === data.id ? data : x));
    else setItems([{ ...data, id: Date.now(), saved: 'Just now' }, ...items]);
    setModal(null); setToast(data.id ? 'Bookmark updated' : 'Bookmark saved');
  };
  const removeItem = id => { setItems(items.filter(x => x.id !== id)); setMenu(null); setToast('Bookmark removed'); };
  const createCollection = () => {
    const name = newCollection.trim();
    if (name && !collections.some(c=>c.toLowerCase()===name.toLowerCase())) { setCollections([...collections, name]); setFilter(name); setToast('Collection created'); }
    setNewCollection(''); setAddingCollection(false);
  };
  const exportLibrary = () => {
    const file = new Blob([JSON.stringify({exportedAt:new Date().toISOString(),bookmarks:items,collections}, null, 2)], {type:'application/json'});
    const link = document.createElement('a'); link.href=URL.createObjectURL(file); link.download='stash-bookmarks.json'; link.click(); URL.revokeObjectURL(link.href); setToast('Library exported');
  };

  return <div className="app" data-harness-ready="true">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Bookmark size={18} fill="currentColor" /></span><span>Stash</span></div>
      <nav>
        <NavItem icon={Bookmark} label="All bookmarks" active={filter === 'All bookmarks'} count={items.length} onClick={() => setFilter('All bookmarks')} />
        <NavItem icon={Heart} label="Favorites" active={filter === 'Favorites'} count={items.filter(x=>x.favorite).length} onClick={() => setFilter('Favorites')} />
        <NavItem icon={Clock3} label="Read later" active={filter === 'Read later'} count={items.filter(x=>!x.read).length} onClick={() => setFilter('Read later')} />
      </nav>
      <div className="nav-label"><span>COLLECTIONS</span><button aria-label="Add collection" onClick={()=>setAddingCollection(true)}><Plus size={15}/></button></div>
      <nav className="collections">
        {collections.map((c, i) => <NavItem key={c} icon={Folder} label={c} active={filter === c} count={items.filter(x=>x.collection===c).length} color={['#e6a94e','#7c71d8','#5e9376'][i]} onClick={() => setFilter(c)} />)}
        {addingCollection && <div className="new-collection"><Folder size={15}/><input autoFocus aria-label="Collection name" value={newCollection} onChange={e=>setNewCollection(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')createCollection();if(e.key==='Escape')setAddingCollection(false)}} onBlur={createCollection} placeholder="Collection name"/></div>}
      </nav>
      <div className="sidebar-foot">
        <div className="library-total"><Bookmark size={15}/><span><strong>{items.length} links</strong><small>Saved in this browser</small></span></div>
        <button className="settings" onClick={exportLibrary}><Download size={17}/> Export library</button>
        <div className="profile"><div className="avatar">AM</div><div><strong>Alex Morgan</strong><span>alex@example.com</span></div><MoreHorizontal size={18}/></div>
      </div>
    </aside>

    <main>
      <header>
        <div className="mobile-brand"><span className="brand-mark"><Bookmark size={17} fill="currentColor" /></span>Stash</div>
        <div className="search"><Search size={18}/><input ref={searchRef} aria-label="Search bookmarks" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your bookmarks..."/><kbd>⌘ K</kbd></div>
        <button className="add" onClick={()=>setModal({})}><Plus size={18}/> Add bookmark</button>
      </header>

      <section className="content">
        <div className="page-head">
          <div><p className="eyebrow">YOUR LIBRARY</p><h1>{filter}</h1><p>{filtered.length} {filtered.length === 1 ? 'bookmark' : 'bookmarks'} saved</p></div>
          <div className="controls">
            <button className="sort" onClick={() => setSort(sort === 'Recently added' ? 'A–Z' : sort === 'A–Z' ? 'Favorites first' : 'Recently added')}>{sort}<ChevronDown size={15}/></button>
            <div className="view-toggle"><button className={view==='grid'?'active':''} onClick={()=>setView('grid')} aria-label="Grid view"><LayoutGrid size={17}/></button><button className={view==='list'?'active':''} onClick={()=>setView('list')} aria-label="List view"><List size={18}/></button></div>
          </div>
        </div>

        {filtered.length ? <div className={`bookmarks ${view}`}>
          {filtered.map(item => <BookmarkCard key={item.id} item={item} view={view} menu={menu} setMenu={setMenu} setItems={setItems} items={items} edit={()=>{setModal(item);setMenu(null)}} remove={()=>removeItem(item.id)} />)}
        </div> : <div className="empty"><div><Search size={25}/></div><h2>No bookmarks found</h2><p>Try a different search or add something new to your library.</p><button className="add" onClick={()=>setModal({})}><Plus size={18}/> Add bookmark</button></div>}
      </section>
    </main>
    {modal && <BookmarkModal initial={modal} collections={collections} onClose={()=>setModal(null)} onSave={saveItem}/>} 
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

function NavItem({ icon: Icon, label, active, count, color, onClick }) {
  return <button className={`nav-item ${active?'active':''}`} onClick={onClick}><Icon size={17} style={color?{color}:null}/><span>{label}</span><em>{count}</em></button>
}

function BookmarkCard({ item, menu, setMenu, setItems, items, edit, remove }) {
  const toggleFav = () => setItems(items.map(x => x.id===item.id ? {...x, favorite: !x.favorite} : x));
  const toggleRead = () => setItems(items.map(x => x.id===item.id ? {...x, read: !x.read} : x));
  return <article className="card">
    <div className="card-top" style={{background:`linear-gradient(135deg, ${item.color}16, ${item.color}32)`}}>
      <div className="site-mark" style={{color:item.color}}><img src={favicon(item.domain)} onError={e=>e.currentTarget.style.display='none'} /> <span>{item.initials}</span></div>
      <button className={`heart ${item.favorite?'on':''}`} onClick={toggleFav} aria-label="Favorite"><Heart size={18} fill={item.favorite?'currentColor':'none'}/></button>
    </div>
    <div className="card-body">
      <div className="domain"><span>{item.domain}</span><a href={item.url} target="_blank" rel="noreferrer" aria-label="Open bookmark"><ExternalLink size={14}/></a></div>
      <h2>{item.title}</h2>
      <p>{item.description}</p>
      <div className="tags">{item.tags.map(tag=><span key={tag}>{tag}</span>)}</div>
      <footer><span>{item.saved}</span><button onClick={()=>setMenu(menu===item.id?null:item.id)} aria-label="Bookmark actions"><MoreHorizontal size={19}/></button>
        {menu === item.id && <div className="menu"><button onClick={edit}><Pencil size={15}/>Edit</button><button onClick={toggleRead}><Clock3 size={15}/>{item.read?'Mark unread':'Mark as read'}</button><button className="danger" onClick={remove}><Trash2 size={15}/>Delete</button></div>}
      </footer>
    </div>
  </article>
}

function BookmarkModal({ initial, collections, onClose, onSave }) {
  const editing = Boolean(initial.id);
  const [form, setForm] = useState(editing ? initial : { title:'', url:'', domain:'', description:'', tags:[], collection:collections.includes('Resources')?'Resources':collections[0]||'', favorite:false, read:false, color:'#6f725f', initials:'N' });
  const [tagText, setTagText] = useState(editing ? initial.tags.join(', ') : '');
  const [fetchState, setFetchState] = useState(editing ? 'ready' : 'idle');
  const [fetchMessage, setFetchMessage] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const requestRef = useRef(0);
  const change = (key, value) => setForm({...form, [key]: value});
  const readLink = async raw => {
    let url = raw.trim();
    if (!url || editing) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try { new URL(url); } catch { return; }
    const request = ++requestRef.current;
    setFetchState('loading'); setFetchMessage('Reading the page…');
    try {
      const response = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (request !== requestRef.current) return;
      if (!response.ok) throw new Error(data.error);
      const palette = ['#64766a','#786b91','#a76b58','#557487','#8b704e'];
      const color = palette[data.domain.split('').reduce((n,c)=>n+c.charCodeAt(0),0) % palette.length];
      setForm(current => ({...current, url:data.finalUrl||url, title:data.title||current.title, description:data.description||current.description, domain:data.domain, color, initials:(data.title||data.domain).slice(0,1).toUpperCase()}));
      if (data.keywords?.length) setTagText(data.keywords.join(', '));
      setPreviewImage(data.image || ''); setFetchState('ready'); setFetchMessage('Page details added automatically');
    } catch {
      if (request !== requestRef.current) return;
      let domain=''; try { domain=new URL(url).hostname.replace('www.',''); } catch {}
      setForm(current=>({...current,url,domain}));
      setFetchState('error'); setFetchMessage('We couldn’t read this page, but you can still save it.');
    }
  };
  useEffect(() => {
    if (editing || !form.url || fetchState === 'ready' || fetchState === 'loading') return;
    const timer = setTimeout(() => readLink(form.url), 550);
    return () => clearTimeout(timer);
  }, [form.url, editing, fetchState]);
  const submit = e => {
    e.preventDefault();
    let url = form.url.trim(); if (url && !/^https?:\/\//.test(url)) url = `https://${url}`;
    let domain = form.domain;
    try { domain = new URL(url).hostname.replace('www.',''); } catch {}
    onSave({...form, url, domain: domain || 'website.com', title: form.title || domain, initials: (form.title || domain || 'N').slice(0,1).toUpperCase(), tags: tagText.split(',').map(x=>x.trim()).filter(Boolean).slice(0,4)});
  };
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <form className="modal" onSubmit={submit}>
      <div className="modal-head"><div><span className="modal-icon"><LinkIcon size={19}/></span><div><h2>{editing?'Edit bookmark':'Save a bookmark'}</h2><p>{editing?'Update the details for this link.':'Keep something worth coming back to.'}</p></div></div><button type="button" onClick={onClose}><X size={20}/></button></div>
      <label>URL<div className={`url-field ${fetchState}`}><LinkIcon size={16}/><input autoFocus={!editing} required value={form.url} onChange={e=>{change('url',e.target.value);setFetchState('idle')}} placeholder="Paste any link here…" />{fetchState==='loading'&&<LoaderCircle className="spinner" size={17}/>}</div></label>
      {!editing && fetchState !== 'idle' && <div className={`fetch-note ${fetchState}`}>{fetchState==='ready'?<WandSparkles size={15}/>:fetchState==='loading'?<LoaderCircle className="spinner" size={15}/>:<span>!</span>}<span>{fetchMessage}</span></div>}
      {!editing && fetchState==='ready' && <div className="capture-preview">{previewImage?<img src={previewImage} alt=""/>:<div className="preview-favicon"><img src={favicon(form.domain)} alt=""/></div>}<div><small>{form.domain}</small><strong>{form.title}</strong><p>{form.description || 'Ready to save to your library.'}</p></div><span><Sparkles size={13}/> AUTO</span></div>}
      <label>Title<input autoFocus={editing} required value={form.title} onChange={e=>change('title',e.target.value)} placeholder="A memorable title" /></label>
      <label>Notes<textarea value={form.description} onChange={e=>change('description',e.target.value)} placeholder="Why is this worth saving?" rows="3" /></label>
      <div className="field-row"><label>Collection<select value={form.collection} onChange={e=>change('collection',e.target.value)}>{collections.map(c=><option key={c}>{c}</option>)}</select></label><label>Tags<input value={tagText} onChange={e=>setTagText(e.target.value)} placeholder="Design, Ideas" /></label></div>
      <label className="check"><input type="checkbox" checked={form.favorite} onChange={e=>change('favorite',e.target.checked)}/><span><Heart size={16}/> Add to favorites</span></label>
      <div className="modal-actions"><button type="button" className="cancel" onClick={onClose}>Cancel</button><button className="add" type="submit" disabled={fetchState==='loading'}>{editing?'Save changes':fetchState==='ready'?'Save to Stash':'Save bookmark'}</button></div>
    </form>
  </div>
}

createRoot(document.getElementById('root')).render(<App />);
