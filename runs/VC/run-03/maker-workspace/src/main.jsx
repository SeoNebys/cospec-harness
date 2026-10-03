import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Archive, Bookmark, BookmarkPlus, Check, ChevronDown, Clock3, Copy, ExternalLink,
  Folder, FolderPlus, Grid2X2, Heart, LayoutList, Link2, Menu, MoreHorizontal,
  Plus, Search, Settings, Sparkles, Tag, Trash2, X, Pencil
} from 'lucide-react'
import './styles.css'

const initialBookmarks = [
  { id: 1, title: 'How to design delightful products', url: 'https://linear.app/method', domain: 'linear.app', description: 'Principles and practices for building high-quality software products.', tags: ['design', 'product'], collection: 'Inspiration', favorite: true, added: '2 hours ago', hue: '#5e5ce6', letter: 'L' },
  { id: 2, title: 'The shape of a creative career', url: 'https://thecreativeindependent.com/guides', domain: 'thecreativeindependent.com', description: 'Practical guides and honest conversations about sustaining creative work.', tags: ['career', 'reading'], collection: 'Read later', favorite: false, added: 'Yesterday', hue: '#e9664c', letter: 'T' },
  { id: 3, title: 'A guide to variable fonts', url: 'https://fonts.google.com/knowledge', domain: 'fonts.google.com', description: 'Everything you need to know about choosing and using variable typefaces.', tags: ['typography', 'design'], collection: 'Design resources', favorite: true, added: 'Sep 12', hue: '#4285f4', letter: 'G' },
  { id: 4, title: 'Small teams, big outcomes', url: 'https://basecamp.com/shapeup', domain: 'basecamp.com', description: 'A methodology for shipping meaningful work without sprints or backlogs.', tags: ['product', 'teams'], collection: 'Work', favorite: false, added: 'Sep 10', hue: '#0d9f6e', letter: 'B' },
  { id: 5, title: 'The Marginalian', url: 'https://www.themarginalian.org', domain: 'themarginalian.org', description: 'Searching for meaning across literature, science, philosophy, and art.', tags: ['essays', 'inspiration'], collection: 'Read later', favorite: false, added: 'Sep 8', hue: '#bc7a34', letter: 'M' },
  { id: 6, title: 'Designing for the web', url: 'https://www.figma.com/resource-library', domain: 'figma.com', description: 'Ideas, resources, and practical tools for better digital design.', tags: ['design', 'tools'], collection: 'Design resources', favorite: true, added: 'Sep 4', hue: '#a259ff', letter: 'F' }
]

const collections = [
  { name: 'Inspiration', color: '#e86e4d' },
  { name: 'Read later', color: '#e3ad33' },
  { name: 'Design resources', color: '#6c70c9' },
  { name: 'Work', color: '#4d9c78' }
]

function App() {
  const [bookmarks, setBookmarks] = useState(() => {
    const saved = localStorage.getItem('stash-bookmarks')
    return saved ? JSON.parse(saved) : initialBookmarks
  })
  const [active, setActive] = useState('All bookmarks')
  const [query, setQuery] = useState('')
  const [view, setView] = useState('grid')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState('')

  const save = next => { setBookmarks(next); localStorage.setItem('stash-bookmarks', JSON.stringify(next)) }
  const filtered = useMemo(() => bookmarks.filter(b => {
    const scope = active === 'All bookmarks' || (active === 'Favorites' && b.favorite) || (active === 'Unsorted' && !b.collection) || b.collection === active
    const text = `${b.title} ${b.url} ${b.description} ${b.tags.join(' ')}`.toLowerCase()
    return scope && text.includes(query.toLowerCase())
  }), [bookmarks, active, query])

  const toggleFavorite = id => save(bookmarks.map(b => b.id === id ? { ...b, favorite: !b.favorite } : b))
  const remove = id => { save(bookmarks.filter(b => b.id !== id)); showToast('Bookmark moved to trash') }
  const update = bookmark => { save(bookmarks.map(b => b.id === bookmark.id ? bookmark : b)); setEditing(null); showToast('Bookmark updated') }
  const showToast = message => { setToast(message); setTimeout(() => setToast(''), 2400) }
  const select = label => { setActive(label); setMobileNav(false) }

  return <div className="app" data-harness-ready="true">
    <header>
      <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu /></button>
      <a className="brand" href="#"><span className="brand-mark"><Bookmark size={18} fill="currentColor" /></span><span>stash</span></a>
      <div className="search-wrap"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your bookmarks..."/><kbd>⌘ K</kbd></div>
      <button className="add-btn" onClick={() => setModal(true)}><Plus size={18}/><span>Add bookmark</span></button>
      <button className="avatar" aria-label="Profile">AR</button>
    </header>

    <div className="layout">
      <aside className={mobileNav ? 'open' : ''}>
        <div className="aside-head"><a className="brand"><span className="brand-mark"><Bookmark size={18} fill="currentColor" /></span><span>stash</span></a><button onClick={() => setMobileNav(false)}><X/></button></div>
        <nav>
          <div className="nav-group">
            <Nav icon={Bookmark} label="All bookmarks" count={bookmarks.length} active={active} onClick={select}/>
            <Nav icon={Heart} label="Favorites" count={bookmarks.filter(b => b.favorite).length} active={active} onClick={select}/>
            <Nav icon={Archive} label="Unsorted" count={bookmarks.filter(b => !b.collection).length} active={active} onClick={select}/>
          </div>
          <div className="nav-label"><span>COLLECTIONS</span><button title="New collection"><FolderPlus size={15}/></button></div>
          <div className="nav-group collections">
            {collections.map(c => <button key={c.name} className={active === c.name ? 'nav-item active' : 'nav-item'} onClick={() => select(c.name)}><span className="folder-dot" style={{background:c.color}}/><span>{c.name}</span><small>{bookmarks.filter(b => b.collection === c.name).length}</small></button>)}
          </div>
        </nav>
        <div className="aside-bottom"><button><Settings size={17}/>Settings</button><div className="storage"><div><span>Storage</span><small>{bookmarks.length} of 100 bookmarks</small></div><div className="meter"><i style={{width:`${Math.min(bookmarks.length,100)}%`}}/></div></div></div>
      </aside>
      {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)}/>} 

      <main>
        <section className="hero">
          <div><p className="eyebrow"><Sparkles size={14}/> YOUR PERSONAL LIBRARY</p><h1>{active}</h1><p className="subtitle">{active === 'All bookmarks' ? 'Everything worth keeping, all in one place.' : `Bookmarks saved in ${active.toLowerCase()}.`}</p></div>
          <div className="hero-actions"><div className="segmented"><button className={view==='grid'?'active':''} onClick={()=>setView('grid')} aria-label="Grid view"><Grid2X2 size={17}/></button><button className={view==='list'?'active':''} onClick={()=>setView('list')} aria-label="List view"><LayoutList size={18}/></button></div><button className="sort">Recently added <ChevronDown size={15}/></button></div>
        </section>

        <section className="content-head"><p><strong>{filtered.length}</strong> {filtered.length === 1 ? 'bookmark' : 'bookmarks'}</p>{query && <button className="clear" onClick={()=>setQuery('')}><X size={14}/> Clear search</button>}</section>
        {filtered.length > 0 ? <section className={`bookmarks ${view}`}>
          {filtered.map(b => <BookmarkCard key={b.id} bookmark={b} view={view} onEdit={() => setEditing(b)} onFavorite={toggleFavorite} onRemove={remove} onCopy={() => { navigator.clipboard?.writeText(b.url); showToast('Link copied to clipboard') }}/>) }
        </section> : <section className="empty"><div><Search size={25}/></div><h2>No bookmarks found</h2><p>Try a different search or add a new bookmark.</p><button className="add-btn" onClick={()=>setModal(true)}><Plus size={18}/>Add bookmark</button></section>}
      </main>
    </div>
    {modal && <BookmarkModal collections={collections} onClose={()=>setModal(false)} onSave={b => { save([b, ...bookmarks]); setModal(false); setActive('All bookmarks'); showToast('Bookmark saved') }}/>} 
    {editing && <BookmarkModal bookmark={editing} collections={collections} onClose={()=>setEditing(null)} onSave={update}/>} 
    {toast && <div className="toast"><Check size={17}/>{toast}</div>}
  </div>
}

function Nav({icon:Icon,label,count,active,onClick}) { return <button className={active===label?'nav-item active':'nav-item'} onClick={()=>onClick(label)}><Icon size={18}/><span>{label}</span><small>{count}</small></button> }

function BookmarkCard({bookmark:b,onFavorite,onRemove,onCopy,onEdit,view}) {
  const [menu,setMenu] = useState(false)
  return <article className="card">
    <div className="card-top"><div className="site-icon" style={{background:b.hue}}>{b.icon && <img src={b.icon} alt="" onError={e=>{e.currentTarget.style.display='none';e.currentTarget.nextElementSibling.style.display='block'}}/>}<span className={b.icon?'icon-fallback hidden':'icon-fallback'}>{b.letter}</span></div><div className="card-actions"><button className={b.favorite?'fav active':'fav'} onClick={()=>onFavorite(b.id)} aria-label="Favorite"><Heart size={17} fill={b.favorite?'currentColor':'none'}/></button><button onClick={()=>setMenu(!menu)} aria-label="More options"><MoreHorizontal size={20}/></button>{menu && <div className="context"><button onClick={()=>{setMenu(false);onEdit()}}><Pencil size={15}/>Edit</button><button onClick={onCopy}><Copy size={15}/>Copy link</button><a href={b.url} target="_blank"><ExternalLink size={15}/>Open link</a><button className="danger" onClick={()=>onRemove(b.id)}><Trash2 size={15}/>Delete</button></div>}</div></div>
    <div className="card-body"><a className="card-title" href={b.url} target="_blank">{b.title}</a><p className="domain"><Link2 size={13}/>{b.domain}</p><p className="desc">{b.description}</p></div>
    <div className="tags">{b.tags.map(t=><span key={t}>{t}</span>)}</div>
    <footer><span><Clock3 size={13}/>{b.added}</span><span className="collection"><Folder size={13}/>{b.collection || 'Unsorted'}</span></footer>
  </article>
}

function BookmarkModal({collections,onClose,onSave,bookmark}) {
  const [url,setUrl] = useState(bookmark?.url || '')
  const [title,setTitle] = useState(bookmark?.title || '')
  const [description,setDescription] = useState(bookmark?.description || '')
  const [collection,setCollection] = useState(bookmark?.collection || collections[0].name)
  const [tags,setTags] = useState(bookmark?.tags?.join(', ') || '')
  const [icon,setIcon] = useState(bookmark?.icon || '')
  const [loading,setLoading] = useState(false)
  const [metadataMessage,setMetadataMessage] = useState('')
  const valid = url.trim()
  const lookup = async value => {
    const raw=(typeof value === 'string' ? value : url).trim()
    if(!raw) return
    let normalized=raw; if(!/^https?:\/\//i.test(normalized)) normalized='https://'+normalized
    setLoading(true); setMetadataMessage('')
    try { const response=await fetch(`/api/metadata?url=${encodeURIComponent(normalized)}`); const data=await response.json(); if(!response.ok) throw new Error(data.error); setUrl(data.url || normalized); setTitle(data.title || data.domain); setDescription(data.description || ''); setIcon(data.icon || ''); setMetadataMessage('Page details found') }
    catch { setUrl(normalized); setMetadataMessage('Couldn’t read this page — you can still save it and edit the details.') }
    finally { setLoading(false) }
  }
  const submit = e => { e.preventDefault(); if(!valid)return; let normalized=url.trim(); if(!/^https?:\/\//i.test(normalized)) normalized='https://'+normalized; let domain; try{domain=new URL(normalized).hostname.replace('www.','')}catch{domain=normalized}; const finalTitle=title.trim()||domain; onSave({...(bookmark||{}),id:bookmark?.id||Date.now(),title:finalTitle,url:normalized,domain,description:description.trim()||'Saved for later.',tags:tags.split(',').map(t=>t.trim()).filter(Boolean),collection,favorite:bookmark?.favorite||false,added:bookmark?.added||'Just now',hue:bookmark?.hue||'#2f7267',letter:finalTitle[0].toUpperCase(),icon}) }
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="modal-icon">{bookmark?<Pencil size={20}/>:<BookmarkPlus size={20}/>}</span><div><h2>{bookmark?'Edit bookmark':'Save a bookmark'}</h2><p>{bookmark?'Tidy up the details for this link.':'Paste a link and we’ll fill in the details.'}</p></div></div><button onClick={onClose}><X size={20}/></button></div><form onSubmit={submit}>
    <label>URL<div className="url-field"><input autoFocus type="text" placeholder="Paste a link..." value={url} onChange={e=>{setUrl(e.target.value);setMetadataMessage('')}} onPaste={e=>{const pasted=e.clipboardData.getData('text');setTimeout(()=>lookup(pasted),0)}}/><button type="button" onClick={()=>lookup()} disabled={!url||loading}>{loading?<span className="spinner"/>:'Fetch details'}</button></div>{metadataMessage&&<span className={metadataMessage.startsWith('Page')?'metadata-ok':'metadata-note'}>{metadataMessage}</span>}</label>
    <label>Title<input type="text" placeholder="What would you like to call it?" value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Description <small>Optional</small><textarea placeholder="A quick note about this page..." value={description} onChange={e=>setDescription(e.target.value)}/></label>
    <div className="form-row"><label>Collection<select value={collection} onChange={e=>setCollection(e.target.value)}>{collections.map(c=><option key={c.name}>{c.name}</option>)}</select></label><label>Tags <small>Comma separated</small><input placeholder="design, reading" value={tags} onChange={e=>setTags(e.target.value)}/></label></div>
    <div className="modal-foot"><button type="button" className="cancel" onClick={onClose}>Cancel</button><button className="save" disabled={!valid||loading}><Bookmark size={17}/>{bookmark?'Save changes':'Save bookmark'}</button></div>
  </form></div></div>
}

createRoot(document.getElementById('root')).render(<App />)
