import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Archive, Bookmark, BookmarkPlus, Check, ChevronDown, ChevronRight, Clock3,
  ExternalLink, Folder, Grid2X2, Heart, Inbox, LayoutGrid, Link2, List,
  LoaderCircle, Menu, MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Sparkles,
  Star, Trash2, WandSparkles, X
} from 'lucide-react'
import './styles.css'

const seed = [
  { id: 1, title: 'The State of AI in 2026', url: 'https://www.benedictevans.com', domain: 'ben-evans.com', description: 'A clear-eyed view of where artificial intelligence is heading, and what is actually changing.', tags: ['AI', 'READ LATER'], collection: 'Reading list', favorite: true, date: 'Today', art: 'ai' },
  { id: 2, title: 'A guide to better product decisions', url: 'https://linear.app/method', domain: 'linear.app', description: 'Principles for building focused products and keeping teams moving in the same direction.', tags: ['PRODUCT', 'WORK'], collection: 'Product thinking', favorite: false, date: 'Today', art: 'linear' },
  { id: 3, title: 'Swiss Style: The principles that still shape design', url: 'https://www.itsnicethat.com', domain: 'itsnicethat.com', description: 'How grids, type, and restraint created one of the most enduring visual languages.', tags: ['DESIGN', 'INSPIRATION'], collection: 'Design inspiration', favorite: true, date: 'Yesterday', art: 'swiss' },
  { id: 4, title: 'The creative act is an act of attention', url: 'https://read.cv/explore', domain: 'read.cv', description: 'A conversation about noticing, making, and protecting the space for original work.', tags: ['CREATIVITY'], collection: 'Reading list', favorite: false, date: 'Yesterday', art: 'creative' },
  { id: 5, title: 'Designing for momentum', url: 'https://www.figma.com/blog', domain: 'figma.com', description: 'Small interface decisions that make digital tools feel fast, calm, and predictable.', tags: ['DESIGN', 'PRODUCT'], collection: 'Design inspiration', favorite: false, date: 'Sep 12', art: 'momentum' },
  { id: 6, title: 'How Stripe designs beautiful websites', url: 'https://stripe.com/blog', domain: 'stripe.com', description: 'A detailed walkthrough of the systems behind expressive product storytelling.', tags: ['WEB', 'INSPIRATION'], collection: 'Design inspiration', favorite: true, date: 'Sep 10', art: 'stripe' },
  { id: 7, title: 'The future of personal software', url: 'https://www.inkandswitch.com', domain: 'inkandswitch.com', description: 'Research notes on tools that adapt to people—not the other way around.', tags: ['TOOLS', 'RESEARCH'], collection: 'Product thinking', favorite: false, date: 'Sep 8', art: 'software' },
  { id: 8, title: 'A tiny guide to meaningful work', url: 'https://nesslabs.com', domain: 'nesslabs.com', description: 'Practical ideas for creating with intention and sustaining your curiosity.', tags: ['WORK', 'READ LATER'], collection: 'Reading list', favorite: false, date: 'Sep 5', art: 'work' },
]

const artLabels = { ai: 'A/26', linear: '→', swiss: 'Aa', creative: '○', momentum: 'F', stripe: 'S', software: '⌘', work: 'W' }
const artType = ['ai','linear','swiss','creative','momentum','stripe','software','work']

function App() {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gather-bookmarks')) || seed } catch { return seed }
  })
  const [active, setActive] = useState('All bookmarks')
  const [query, setQuery] = useState('')
  const [view, setView] = useState('grid')
  const [modal, setModal] = useState(null)
  const [menuId, setMenuId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sort, setSort] = useState('Newest first')

  useEffect(() => localStorage.setItem('gather-bookmarks', JSON.stringify(items)), [items])

  const collections = useMemo(() => ['Reading list', 'Design inspiration', 'Product thinking'].map(name => ({ name, count: items.filter(x => x.collection === name).length })), [items])
  const filtered = useMemo(() => items.filter(item => {
    const matchesNav = active === 'All bookmarks' || (active === 'Favorites' && item.favorite) || item.collection === active
    const q = query.toLowerCase()
    return matchesNav && (!q || `${item.title} ${item.description} ${item.domain} ${item.tags.join(' ')}`.toLowerCase().includes(q))
  }), [items, active, query])

  const display = sort === 'A–Z' ? [...filtered].sort((a,b) => a.title.localeCompare(b.title)) : filtered
  const title = active

  function toggleFavorite(id) { setItems(v => v.map(x => x.id === id ? { ...x, favorite: !x.favorite } : x)) }
  function remove(id) { setItems(v => v.filter(x => x.id !== id)); setMenuId(null) }
  function save(data) {
    if (data.id) setItems(v => v.map(x => x.id === data.id ? data : x))
    else setItems(v => [{ ...data, id: Date.now(), date: 'Just now', art: artType[Math.floor(Math.random()*artType.length)] }, ...v])
    setModal(null)
  }

  return <div className="app" data-harness-ready="true">
    <aside className={sidebarOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span className="brand-mark"><Bookmark size={18} fill="currentColor" /></span><span>gather.</span></div>
      <button className="mobile-close" onClick={() => setSidebarOpen(false)}><X size={20}/></button>
      <nav className="nav-main">
        <NavItem icon={Inbox} text="All bookmarks" count={items.length} active={active === 'All bookmarks'} onClick={() => {setActive('All bookmarks');setSidebarOpen(false)}} />
        <NavItem icon={Heart} text="Favorites" count={items.filter(x=>x.favorite).length} active={active === 'Favorites'} onClick={() => {setActive('Favorites');setSidebarOpen(false)}} />
      </nav>
      <div className="nav-section">
        <div className="section-label"><span>COLLECTIONS</span><button aria-label="Add collection"><Plus size={15}/></button></div>
        {collections.map((c, i) => <NavItem key={c.name} icon={Folder} text={c.name} count={c.count} active={active === c.name} color={['#d4e8be','#f0c4ab','#b9d9e9'][i]} onClick={() => {setActive(c.name);setSidebarOpen(false)}} />)}
      </div>
      <div className="sidebar-bottom">
        <div className="upgrade-card">
          <div className="spark"><Sparkles size={17}/></div>
          <strong>Make space for ideas</strong>
          <p>You’ve saved {items.length} little corners of the internet.</p>
        </div>
        <button className="profile"><span className="avatar">AM</span><span><strong>Alex Morgan</strong><small>alex@example.com</small></span><MoreHorizontal size={18}/></button>
      </div>
    </aside>

    <main>
      <header className="topbar">
        <button className="menu-button" onClick={() => setSidebarOpen(true)}><Menu size={21}/></button>
        <div className="search"><Search size={18}/><input aria-label="Search bookmarks" placeholder="Search your library..." value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></div>
        <button className="add-button" onClick={() => setModal({})}><Plus size={18}/> Add bookmark</button>
      </header>

      <section className="content">
        <div className="hero">
          <div><p className="eyebrow">YOUR LIBRARY</p><h1>{title}<sup>{filtered.length}</sup></h1><p className="subtitle">Things worth keeping, all in one place.</p></div>
          <div className="toolbar">
            <div className="view-toggle"><button className={view==='grid'?'active':''} onClick={()=>setView('grid')} aria-label="Grid view"><LayoutGrid size={17}/></button><button className={view==='list'?'active':''} onClick={()=>setView('list')} aria-label="List view"><List size={18}/></button></div>
            <button className="sort" onClick={()=>setSort(v=>v==='Newest first'?'A–Z':'Newest first')}><SlidersHorizontal size={16}/>{sort}</button>
          </div>
        </div>

        {display.length ? <div className={`bookmarks ${view}`}>
          {display.map(item => <BookmarkCard key={item.id} item={item} view={view} onFavorite={()=>toggleFavorite(item.id)} menuOpen={menuId===item.id} onMenu={()=>setMenuId(menuId===item.id?null:item.id)} onEdit={()=>{setModal(item);setMenuId(null)}} onDelete={()=>remove(item.id)} />)}
        </div> : <div className="empty"><div><BookmarkPlus size={32}/></div><h2>No bookmarks here yet</h2><p>{query ? 'Try a different search or clear your query.' : 'Save something wonderful to start this collection.'}</p>{!query&&<button onClick={()=>setModal({})}><Plus size={17}/> Add a bookmark</button>}</div>}
      </section>
    </main>
    {modal && <BookmarkModal item={modal} onClose={()=>setModal(null)} onSave={save} />}
    {sidebarOpen && <div className="scrim" onClick={()=>setSidebarOpen(false)}/>} 
  </div>
}

function NavItem({icon: Icon, text, count, active, color, onClick}) {
  return <button className={`nav-item ${active?'active':''}`} onClick={onClick}><span className="nav-icon" style={color?{color}:null}><Icon size={17} fill={text==='Favorites'&&active?'currentColor':'none'}/></span><span>{text}</span><em>{count}</em></button>
}

function BookmarkCard({item, view, onFavorite, menuOpen, onMenu, onEdit, onDelete}) {
  return <article className="bookmark-card">
    <a href={item.url} target="_blank" rel="noreferrer" className={`card-art art-${item.art}`}><span>{artLabels[item.art] || '↗'}</span><div className="art-grain"/><ExternalLink className="external" size={17}/></a>
    <div className="card-body">
      <div className="card-meta"><span className="favicon">{item.domain[0].toUpperCase()}</span><span>{item.domain}</span><span className="dot">•</span><span>{item.date}</span></div>
      <div className="card-title-row"><a href={item.url} target="_blank" rel="noreferrer"><h2>{item.title}</h2></a><button className={item.favorite?'fav active':'fav'} onClick={onFavorite} aria-label="Favorite"><Star size={18} fill={item.favorite?'currentColor':'none'}/></button></div>
      <p>{item.description}</p>
      <div className="card-footer"><div className="tags">{item.tags.map(t=><span key={t}>{t}</span>)}</div><div className="more-wrap"><button className="more" onClick={onMenu}><MoreHorizontal size={19}/></button>{menuOpen&&<div className="context-menu"><button onClick={onEdit}><Pencil size={15}/>Edit</button><button className="danger" onClick={onDelete}><Trash2 size={15}/>Delete</button></div>}</div></div>
    </div>
  </article>
}

function BookmarkModal({item,onClose,onSave}) {
  const [form,setForm] = useState({ id:item.id, title:item.title||'', url:item.url||'', description:item.description||'', collection:item.collection||'Reading list', tags:(item.tags||[]).join(', '), favorite:item.favorite||false, domain:item.domain||'', date:item.date, art:item.art })
  const [error,setError] = useState('')
  const [metadataStatus,setMetadataStatus] = useState('idle')
  const touched = useRef({ title: Boolean(item.title), description: Boolean(item.description) })
  const initialUrl = useRef(item.url || '')

  useEffect(() => {
    const raw = form.url.trim()
    if (!raw || raw === initialUrl.current) { setMetadataStatus('idle'); return }
    let url = raw
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    try { new URL(url) } catch { setMetadataStatus('idle'); return }
    const controller = new AbortController()
    setMetadataStatus('loading')
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setForm(current => current.url.trim() === raw ? {
          ...current,
          url: data.url || url,
          domain: data.domain || current.domain,
          title: touched.current.title ? current.title : (data.title || current.title),
          description: touched.current.description ? current.description : (data.description || current.description),
        } : current)
        setMetadataStatus(data.title || data.description ? 'success' : 'empty')
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') setMetadataStatus('error')
      }
    }, 500)
    return () => { clearTimeout(timer); controller.abort() }
  }, [form.url])

  function submit(e){ e.preventDefault(); if(!form.title.trim()||!form.url.trim()){setError('Add a title and URL to continue.');return} let url=form.url.trim(); if(!/^https?:\/\//.test(url)) url='https://'+url; let domain=form.domain; try{domain=new URL(url).hostname.replace('www.','')}catch{} onSave({...form,url,domain:domain||'website.com',tags:form.tags.split(',').map(x=>x.trim().toUpperCase()).filter(Boolean)}) }
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="modal" onSubmit={submit}>
    <div className="modal-head"><div><p className="eyebrow">{item.id?'EDIT ITEM':'NEW BOOKMARK'}</p><h2>{item.id?'Make a change':'Save something good'}</h2></div><button type="button" onClick={onClose}><X size={21}/></button></div>
    <label>URL<div className="url-field"><input autoFocus={!item.id} placeholder="Paste a link and we’ll fill in the details" value={form.url} onChange={e=>setForm({...form,url:e.target.value})}/>{metadataStatus==='loading'&&<LoaderCircle className="spin" size={17}/>}</div></label>
    {metadataStatus!=='idle' && <div className={`metadata-status ${metadataStatus}`}>
      {metadataStatus==='loading'&&<><LoaderCircle className="spin" size={14}/>Reading the page…</>}
      {metadataStatus==='success'&&<><WandSparkles size={14}/>Details added — you can tweak anything below.</>}
      {metadataStatus==='empty'&&<>We reached the page, but it didn’t share any details.</>}
      {metadataStatus==='error'&&<>We couldn’t read that page. You can still add the details yourself.</>}
    </div>}
    <label>Title<input autoFocus={!!item.id} placeholder={metadataStatus==='loading'?'Finding the page title…':'A memorable title'} value={form.title} onChange={e=>{touched.current.title=true;setForm({...form,title:e.target.value})}}/></label>
    <label>Note<textarea placeholder={metadataStatus==='loading'?'Looking for a description…':'Why is this worth keeping?'} rows="3" value={form.description} onChange={e=>{touched.current.description=true;setForm({...form,description:e.target.value})}}/></label>
    <div className="form-row"><label>Collection<select value={form.collection} onChange={e=>setForm({...form,collection:e.target.value})}><option>Reading list</option><option>Design inspiration</option><option>Product thinking</option></select></label><label>Tags<input placeholder="Design, Ideas" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})}/></label></div>
    <label className="check"><input type="checkbox" checked={form.favorite} onChange={e=>setForm({...form,favorite:e.target.checked})}/><span><Check size={14}/></span>Add to favorites</label>
    {error&&<p className="error">{error}</p>}
    <div className="modal-actions"><button type="button" className="cancel" onClick={onClose}>Cancel</button><button type="submit" className="save"><Bookmark size={17}/> {item.id?'Save changes':'Save bookmark'}</button></div>
  </form></div>
}

createRoot(document.getElementById('root')).render(<App />)
