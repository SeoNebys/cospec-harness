import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bookmark, Search, Plus, LayoutGrid, List, Star, MoreHorizontal, X, Trash2, Pencil, Check, ArrowUpRight, LoaderCircle, Sparkles } from 'lucide-react';
import './styles.css';

const starterBookmarks = [
  { id: 1, title: 'The Psychology of Design', url: 'https://growth.design/psychology', domain: 'growth.design', description: 'A collection of cognitive biases and psychological principles, explained with everyday examples.', tags: ['design', 'psychology'], color: '#EF7B57', icon: 'G', favorite: true, read: false, date: 'Today' },
  { id: 2, title: 'A List Apart', url: 'https://alistapart.com', domain: 'alistapart.com', description: 'Exploring the design, development, and meaning of web content, with a special focus on web standards.', tags: ['development', 'reading'], color: '#C94835', icon: 'A', favorite: false, read: false, date: 'Yesterday' },
  { id: 3, title: 'Cosmos: A Personal Voyage', url: 'https://www.youtube.com/watch?v=cosmos', domain: 'youtube.com', description: 'Carl Sagan explores the universe, human history, and the search for meaning across the cosmos.', tags: ['science', 'watch'], color: '#CF3C34', icon: '▶', favorite: true, read: false, date: 'Sep 18' },
  { id: 4, title: 'The Marginalian', url: 'https://www.themarginalian.org', domain: 'themarginalian.org', description: 'A record of Maria Popova’s search for meaning across literature, science, philosophy, and art.', tags: ['essays', 'inspiration'], color: '#D98B37', icon: 'M', favorite: false, read: true, date: 'Sep 16' },
  { id: 5, title: 'Shape Up', url: 'https://basecamp.com/shapeup', domain: 'basecamp.com', description: 'A free book about how Basecamp does product development: shaping, betting, and building.', tags: ['product', 'books'], color: '#213B35', icon: 'S', favorite: false, read: false, date: 'Sep 12' },
  { id: 6, title: 'The Creative Independent', url: 'https://thecreativeindependent.com', domain: 'thecreativeindependent.com', description: 'Practical and emotional guidance for creative people, published by Kickstarter.', tags: ['creativity', 'interviews'], color: '#346D57', icon: 'C', favorite: true, read: true, date: 'Sep 8' },
];

const groups = [
  { name: 'All bookmarks', icon: Bookmark },
  { name: 'Favorites', icon: Star },
  { name: 'Unread', icon: 'dot' },
];

function App() {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bookmarked-items')) || starterBookmarks; } catch { return starterBookmarks; }
  });
  const [active, setActive] = useState('All bookmarks');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null);
  const [toast, setToast] = useState('');

  const save = (next) => { setItems(next); localStorage.setItem('bookmarked-items', JSON.stringify(next)); };
  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };
  const filtered = useMemo(() => items.filter(item => {
    const matchesTab = active === 'All bookmarks' || (active === 'Favorites' && item.favorite) || (active === 'Unread' && !item.read) || item.tags.includes(active.toLowerCase());
    const haystack = `${item.title} ${item.description} ${item.domain} ${item.tags.join(' ')}`.toLowerCase();
    return matchesTab && haystack.includes(query.toLowerCase());
  }), [items, active, query]);
  const allTags = [...new Set(items.flatMap(x => x.tags))].slice(0, 6);

  const toggleFavorite = id => save(items.map(x => x.id === id ? {...x, favorite: !x.favorite} : x));
  const remove = id => { save(items.filter(x => x.id !== id)); setMenu(null); notify('Bookmark moved to trash'); };
  const openForm = (item = null) => { setEditing(item); setModal(true); setMenu(null); };
  const submit = (form) => {
    let rawUrl = form.url.trim();
    if (!/^https?:\/\//i.test(rawUrl)) rawUrl = `https://${rawUrl}`;
    let domain = rawUrl;
    try { domain = new URL(rawUrl).hostname.replace(/^www\./, ''); } catch {}
    const data = { title: form.title.trim(), url: rawUrl, domain, description: form.description.trim(), favicon: form.favicon, tags: form.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0,3) };
    if (editing) save(items.map(x => x.id === editing.id ? {...x, ...data} : x));
    else save([{ id: Date.now(), ...data, color: ['#EF7B57','#213B35','#D98B37','#346D57'][items.length % 4], icon: data.title[0]?.toUpperCase() || 'B', favorite: false, read: false, date: 'Just now' }, ...items]);
    setModal(false); notify(editing ? 'Bookmark updated' : 'Bookmark saved');
  };

  return <div className="app" data-harness-ready="true">
    <header>
      <button className="brand" onClick={() => setActive('All bookmarks')} aria-label="Bookmarked home"><span className="brand-mark"><Bookmark size={17} fill="currentColor" /></span><span>bookmarked.</span></button>
      <div className="header-actions">
        <div className="search"><Search size={18}/><input aria-label="Search bookmarks" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your library..."/><kbd>⌘ K</kbd></div>
        <button className="add-button" onClick={()=>openForm()}><Plus size={18}/><span>Add bookmark</span></button>
        <button className="avatar" aria-label="Account menu">AR</button>
      </div>
    </header>

    <aside>
      <nav>
        <p className="nav-label">Library</p>
        {groups.map(g => <button key={g.name} className={active===g.name?'active':''} onClick={()=>setActive(g.name)}>{g.icon==='dot'?<span className="unread-dot"/>:<g.icon size={17}/>}<span>{g.name}</span><b>{g.name==='All bookmarks'?items.length:g.name==='Favorites'?items.filter(x=>x.favorite).length:items.filter(x=>!x.read).length}</b></button>)}
        <p className="nav-label space">Collections</p>
        {allTags.map((tag,i)=><button key={tag} className={active.toLowerCase()===tag?'active':''} onClick={()=>setActive(tag)}><span className={`collection-dot c${i}`}/><span>{tag[0].toUpperCase()+tag.slice(1)}</span></button>)}
      </nav>
      <div className="aside-card"><span>✦</span><p><strong>A calmer internet.</strong><br/>Save the good stuff. Come back when you’re ready.</p></div>
      <p className="aside-footer">{items.length} links · All caught up</p>
    </aside>

    <main>
      <section className="hero">
        <p className="eyebrow">Your corner of the internet</p>
        <h1>{active === 'All bookmarks' ? <>Good things, <em>kept close.</em></> : active}</h1>
        <p className="intro">A quiet place for the articles, ideas, and corners of the web worth returning to.</p>
      </section>
      <div className="toolbar">
        <p><strong>{filtered.length}</strong> {filtered.length === 1 ? 'bookmark' : 'bookmarks'} <span>·</span> Sorted by recent</p>
        <div className="view-toggle"><button className={view==='grid'?'selected':''} onClick={()=>setView('grid')} aria-label="Grid view"><LayoutGrid size={17}/></button><button className={view==='list'?'selected':''} onClick={()=>setView('list')} aria-label="List view"><List size={18}/></button></div>
      </div>

      {filtered.length ? <section className={`bookmark-list ${view}`}>
        {filtered.map((item, index)=><article className="bookmark-card" key={item.id} style={{'--delay': `${index*55}ms`}}>
          <div className="card-head">
            <span className={`site-icon ${item.favicon?'has-image':''}`} style={{background:item.color}}>{item.favicon?<><img src={item.favicon} alt="" onError={e=>{e.currentTarget.style.display='none';e.currentTarget.nextSibling.style.display='block'}}/><i style={{display:'none'}}>{item.icon}</i></>:item.icon}</span>
            <div className="site-meta"><span>{item.domain}</span><small>{item.date}</small></div>
            <button className={`star ${item.favorite?'on':''}`} onClick={()=>toggleFavorite(item.id)} aria-label="Toggle favorite"><Star size={18} fill={item.favorite?'currentColor':'none'}/></button>
            <button className="more" onClick={()=>setMenu(menu===item.id?null:item.id)} aria-label="More options"><MoreHorizontal size={19}/></button>
            {menu===item.id && <div className="card-menu"><button onClick={()=>openForm(item)}><Pencil size={14}/> Edit</button><button onClick={()=>remove(item.id)}><Trash2 size={14}/> Delete</button></div>}
          </div>
          <div className="card-body">
            <h2><a href={item.url} target="_blank" rel="noreferrer">{item.title}<ArrowUpRight className="open-icon" size={17}/></a></h2>
            <p>{item.description}</p>
          </div>
          <div className="card-foot">
            <div>{item.tags.map(tag=><button key={tag} onClick={()=>setActive(tag)}>#{tag}</button>)}</div>
            <button className={`read-status ${item.read?'done':''}`} onClick={()=>save(items.map(x=>x.id===item.id?{...x,read:!x.read}:x))}>{item.read?<><Check size={13}/> Read</>: 'Unread'}</button>
          </div>
        </article>)}
      </section> : <section className="empty"><div><Bookmark size={28}/></div><h2>No bookmarks found</h2><p>Try another search, or add something worth keeping.</p><button onClick={()=>openForm()}><Plus size={16}/> Add bookmark</button></section>}
    </main>

    {modal && <BookmarkModal editing={editing} onClose={()=>setModal(false)} onSubmit={submit}/>} 
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

function BookmarkModal({editing,onClose,onSubmit}){
  const [form,setForm]=useState({url:editing?.url||'',title:editing?.title||'',description:editing?.description||'',tags:editing?.tags.join(', ')||'',favicon:editing?.favicon||''});
  const [status,setStatus]=useState('idle'); const [message,setMessage]=useState('');
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  const validUrl=value=>{try{return new URL(/^https?:\/\//i.test(value)?value:`https://${value}`).hostname.includes('.')}catch{return false}};
  useEffect(()=>{if(editing||!validUrl(form.url))return;const timer=setTimeout(async()=>{setStatus('loading');setMessage('Finding the page details…');try{
    const normalized=/^https?:\/\//i.test(form.url)?form.url:`https://${form.url}`;const response=await fetch(`/api/metadata?url=${encodeURIComponent(normalized)}`);const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not read this page.');
    setForm(current=>({...current,url:data.url||normalized,title:data.title||current.title,description:data.description||current.description,favicon:data.icon||current.favicon}));setStatus('done');setMessage('Page details added — tweak anything you like.');
  }catch(error){setStatus('error');setMessage(`${error.message} You can still fill in the details.`)}},450);return()=>clearTimeout(timer)},[form.url,editing]);
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal" role="dialog" aria-modal="true">
    <div className="modal-head"><div><p className="eyebrow">{editing?'Make a change':'Keep something good'}</p><h2>{editing?'Edit bookmark':'Add a bookmark'}</h2></div><button onClick={onClose}><X/></button></div>
    <form onSubmit={e=>{e.preventDefault();onSubmit(form)}}>
      <label>URL<div className="url-field"><input autoFocus={!editing} name="url" type="text" required placeholder="Paste a link and we’ll do the rest" value={form.url} onChange={e=>update('url',e.target.value)}/>{status==='loading'&&<LoaderCircle className="spin" size={17}/>}</div></label>
      {!editing&&<div className={`fetch-status ${status}`}><Sparkles size={14}/><span>{status==='idle'?'Paste a link to automatically fetch its title, description, and icon.':message}</span></div>}
      <div className={`details-fields ${status==='loading'?'soften':''}`}><label>Title<input name="title" required placeholder={status==='loading'?'Fetching title…':'Something worth remembering'} value={form.title} onChange={e=>update('title',e.target.value)}/></label><label>Description<textarea name="description" rows="3" placeholder={status==='loading'?'Fetching description…':'Add a note about this page'} value={form.description} onChange={e=>update('description',e.target.value)}/></label><label>Tags <small>separate with commas</small><input name="tags" placeholder="design, reading" value={form.tags} onChange={e=>update('tags',e.target.value)}/></label></div>
      <div className="form-actions"><button type="button" onClick={onClose}>Cancel</button><button className="save-button" type="submit" disabled={status==='loading'}>{status==='loading'?<LoaderCircle className="spin" size={16}/>:<Bookmark size={16}/>} {editing?'Save changes':'Save bookmark'}</button></div>
    </form>
  </div></div>
}

createRoot(document.getElementById('root')).render(<App />);
