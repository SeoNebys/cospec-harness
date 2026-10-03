import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive, Bookmark, BookOpen, Check, ChevronDown, Clock3, Code2,
  Folder, Grid2X2, Heart, LayoutGrid, Link2, List, MoreHorizontal,
  Pencil, Plus, Search, Settings, Sparkles, Star, Tag, Trash2, X
} from 'lucide-react';
import './styles.css';

const seed = [
  { id: 1, title: 'The Design of Everyday Things', url: 'jnd.org/the-design-of-everyday-things', description: 'A timeless exploration of how thoughtful design makes objects understandable and delightful to use.', collection: 'Inspiration', tags: ['Design', 'Books'], domain: 'jnd.org', color: '#e96343', icon: 'D', added: 'Today', favorite: true },
  { id: 2, title: 'A guide to color and contrast', url: 'stripe.com/blog/accessibility', description: 'Practical ways to build accessible color systems that work beautifully across a product.', collection: 'Design', tags: ['Accessibility', 'UI'], domain: 'stripe.com', color: '#6256dd', icon: 'S', added: 'Today', favorite: false },
  { id: 3, title: 'The Architecture of Open Source Applications', url: 'aosabook.org', description: 'Experienced developers explain how the software you use every day is structured and built.', collection: 'Development', tags: ['Engineering', 'Books'], domain: 'aosabook.org', color: '#263238', icon: 'A', added: 'Yesterday', favorite: true },
  { id: 4, title: 'How Linear builds product', url: 'linear.app/method', description: 'Principles and practices for building high-quality software with focus, momentum, and craft.', collection: 'Inspiration', tags: ['Product', 'Teams'], domain: 'linear.app', color: '#5e6ad2', icon: 'L', added: 'Yesterday', favorite: false },
  { id: 5, title: 'The Creative Independent', url: 'thecreativeindependent.com', description: 'Practical and emotional guidance for navigating life as a creative person.', collection: 'Reading', tags: ['Creativity', 'Interviews'], domain: 'thecreativeindependent.com', color: '#f45b3e', icon: 'C', added: 'Sep 14', favorite: false },
  { id: 6, title: 'Refactoring UI', url: 'refactoringui.com', description: 'Design tactics from a developer’s perspective—without relying on a designer.', collection: 'Design', tags: ['UI', 'Reference'], domain: 'refactoringui.com', color: '#4c73d9', icon: 'R', added: 'Sep 12', favorite: true },
  { id: 7, title: 'Patterns.dev', url: 'patterns.dev', description: 'A free book on design patterns and component patterns for building powerful web apps.', collection: 'Development', tags: ['JavaScript', 'Patterns'], domain: 'patterns.dev', color: '#1d2330', icon: 'P', added: 'Sep 10', favorite: false },
];

const collectionMeta = [
  { name: 'Design', color: '#e96343' },
  { name: 'Development', color: '#7357d7' },
  { name: 'Inspiration', color: '#dfaa38' },
  { name: 'Reading', color: '#3b8f72' },
];

function App() {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lumen-bookmarks')) || seed; } catch { return seed; }
  });
  const [active, setActive] = useState('All bookmarks');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('list');
  const [sort, setSort] = useState('Recently added');
  const [modal, setModal] = useState(null);
  const [menu, setMenu] = useState(null);

  useEffect(() => localStorage.setItem('lumen-bookmarks', JSON.stringify(items)), [items]);

  const filtered = useMemo(() => {
    let result = items.filter(item => {
      if (active === 'Favorites' && !item.favorite) return false;
      if (active === 'Archive') return false;
      if (collectionMeta.some(c => c.name === active) && item.collection !== active) return false;
      const haystack = `${item.title} ${item.description} ${item.url} ${item.tags.join(' ')}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
    if (sort === 'Title A–Z') result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'Favorites first') result = [...result].sort((a, b) => Number(b.favorite) - Number(a.favorite));
    return result;
  }, [items, active, query, sort]);

  const toggleFavorite = id => setItems(v => v.map(i => i.id === id ? { ...i, favorite: !i.favorite } : i));
  const remove = id => { setItems(v => v.filter(i => i.id !== id)); setMenu(null); };

  return (
    <div className="app" data-harness-ready="true">
      <Sidebar active={active} setActive={setActive} counts={items} />
      <main>
        <header>
          <div className="searchbox">
            <Search size={18} strokeWidth={1.8} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your bookmarks..." aria-label="Search bookmarks" />
            <kbd>⌘ K</kbd>
          </div>
          <button className="add-button" onClick={() => setModal({ mode: 'add' })}><Plus size={18} /> Add bookmark</button>
          <button className="avatar" aria-label="User menu">AM</button>
        </header>

        <section className="content">
          <div className="title-row">
            <div>
              <p className="eyebrow">YOUR LIBRARY</p>
              <h1>{active}</h1>
              <p className="subcopy">{filtered.length} {filtered.length === 1 ? 'bookmark' : 'bookmarks'} saved for later</p>
            </div>
            <div className="tools">
              <div className="sort-wrap">
                <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort bookmarks">
                  <option>Recently added</option><option>Title A–Z</option><option>Favorites first</option>
                </select>
                <ChevronDown size={15}/>
              </div>
              <div className="view-toggle">
                <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={17}/></button>
                <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={16}/></button>
              </div>
            </div>
          </div>

          {filtered.length ? (
            <div className={`bookmarks ${view}`}>
              {filtered.map(item => <BookmarkCard key={item.id} item={item} onFavorite={toggleFavorite} onRemove={remove} onEdit={() => { setModal({ mode: 'edit', item }); setMenu(null); }} menu={menu} setMenu={setMenu} />)}
            </div>
          ) : (
            <div className="empty"><Bookmark size={26}/><h2>No bookmarks here</h2><p>Try another filter or save something new.</p><button onClick={() => setModal({ mode: 'add' })}>Add a bookmark</button></div>
          )}
        </section>
      </main>
      {modal && <BookmarkModal mode={modal.mode} item={modal.item} onClose={() => setModal(null)} onSave={savedItem => {
        if (modal.mode === 'edit') setItems(v => v.map(existing => existing.id === modal.item.id ? { ...existing, ...savedItem } : existing));
        else setItems(v => [{ ...savedItem, id: Date.now(), added: 'Just now', favorite: false }, ...v]);
        setModal(null);
        setActive('All bookmarks');
      }} />}
    </div>
  );
}

function Sidebar({ active, setActive, counts }) {
  const nav = [
    ['All bookmarks', Bookmark, counts.length],
    ['Favorites', Star, counts.filter(i => i.favorite).length],
    ['Archive', Archive, 0],
  ];
  return <aside>
    <div className="brand"><span className="brandmark"><Bookmark size={17} fill="currentColor" /></span><span>Lumen</span></div>
    <nav>
      <p className="nav-label">LIBRARY</p>
      {nav.map(([name, Icon, count]) => <button key={name} onClick={() => setActive(name)} className={active === name ? 'selected' : ''}><Icon size={17}/><span>{name}</span><em>{count}</em></button>)}
      <div className="collections-head"><p className="nav-label">COLLECTIONS</p><button aria-label="Add collection"><Plus size={15}/></button></div>
      {collectionMeta.map(c => <button key={c.name} onClick={() => setActive(c.name)} className={active === c.name ? 'selected' : ''}><i style={{background:c.color}}/><span>{c.name}</span><em>{counts.filter(x => x.collection === c.name).length}</em></button>)}
    </nav>
    <div className="sidebar-bottom">
      <button><Settings size={17}/><span>Settings</span></button>
      <div className="profile"><span>AM</span><div><strong>Alex Morgan</strong><small>Personal space</small></div><MoreHorizontal size={17}/></div>
    </div>
  </aside>
}

function BookmarkCard({ item, onFavorite, onRemove, onEdit, menu, setMenu }) {
  return <article className="bookmark-card">
    <div className="site-icon" style={{'--icon-color': item.color}}>{item.icon}</div>
    <div className="bookmark-body">
      <div className="bookmark-title"><a href={`https://${item.url}`} target="_blank" rel="noreferrer">{item.title}</a><Link2 size={13}/></div>
      <p>{item.description}</p>
      <div className="meta"><span>{item.domain}</span><b>·</b><span>{item.added}</span>{item.tags.map(t => <small key={t}>{t}</small>)}</div>
    </div>
    <div className="actions">
      <button onClick={() => onFavorite(item.id)} className={item.favorite ? 'is-favorite' : ''} aria-label="Favorite"><Star size={17} fill={item.favorite ? 'currentColor' : 'none'}/></button>
      <button onClick={() => setMenu(menu === item.id ? null : item.id)} aria-label="More options"><MoreHorizontal size={18}/></button>
      {menu === item.id && <div className="item-menu">
        <button className="edit-item" onClick={onEdit}><Pencil size={14}/>Edit bookmark</button>
        <button onClick={() => onRemove(item.id)}><Trash2 size={14}/>Delete bookmark</button>
      </div>}
    </div>
  </article>
}

const metadataLibrary = {
  'figma.com': { title: 'Figma: The Collaborative Interface Design Tool', description: 'A collaborative platform for designing, prototyping, and building products with your team.', tags: ['Design', 'Tools'] },
  'github.com': { title: 'GitHub · Build and ship software', description: 'The developer platform for creating, storing, managing, and sharing code.', tags: ['Development', 'Tools'] },
  'notion.so': { title: 'Notion — Your connected workspace', description: 'A connected workspace for notes, documents, projects, and team knowledge.', tags: ['Productivity', 'Tools'] },
  'linear.app': { title: 'Linear — Plan and build products', description: 'A purpose-built tool for planning and building better software products.', tags: ['Product', 'Teams'] },
  'medium.com': { title: 'Medium — Read, write, and deepen your understanding', description: 'Ideas, perspectives, and useful knowledge from writers around the world.', tags: ['Reading', 'Ideas'] },
  'youtube.com': { title: 'YouTube', description: 'Videos, creators, and stories from around the world.', tags: ['Video', 'Media'] },
};

function simulatedMetadata(rawUrl) {
  const clean = rawUrl.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  const domain = clean.split('/')[0].toLowerCase();
  const known = metadataLibrary[domain];
  if (known) return { ...known, domain, url: clean };
  const path = clean.split('/').filter(Boolean).slice(1);
  const pathTitle = path.at(-1)?.split(/[?#]/)[0].replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const siteName = domain.split('.')[0].replace(/\b\w/g, c => c.toUpperCase());
  return {
    title: pathTitle || siteName,
    description: `An interesting page from ${domain}, saved for quick access later.`,
    tags: path.length ? ['Article', siteName] : ['Website', siteName], domain, url: clean
  };
}

function BookmarkModal({ mode, item, onClose, onSave }) {
  const isEdit = mode === 'edit';
  const [url, setUrl] = useState(item?.url || '');
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [collection, setCollection] = useState(item?.collection || 'Inspiration');
  const [tags, setTags] = useState(item?.tags?.join(', ') || '');
  const [fetching, setFetching] = useState(false);
  const [enriched, setEnriched] = useState(false);

  const enrich = () => {
    if (isEdit || !url.trim() || enriched) return;
    setFetching(true);
    window.setTimeout(() => {
      const data = simulatedMetadata(url);
      setTitle(current => current || data.title);
      setDescription(current => current || data.description);
      setTags(current => current || data.tags.join(', '));
      setFetching(false);
      setEnriched(true);
    }, 650);
  };

  const submit = e => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const submittedUrl = String(form.get('url') || '');
    const submittedTitle = String(form.get('title') || '');
    const submittedDescription = String(form.get('description') || '');
    const submittedCollection = String(form.get('collection') || 'Inspiration');
    const submittedTags = String(form.get('tags') || '');
    if (!submittedUrl.trim()) return;
    let clean = submittedUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const domain = clean.split('/')[0];
    const parsedTags = submittedTags.split(',').map(t => t.trim()).filter(Boolean);
    onSave({ ...(item || {}), title: submittedTitle.trim() || domain, url: clean, domain, description: submittedDescription.trim() || `Saved from ${domain}.`, collection: submittedCollection, tags: parsedTags, color: item?.color || '#315f55', icon: (submittedTitle || domain)[0].toUpperCase() });
  };
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="modal" onSubmit={submit}>
      <div className="modal-head"><div><p className="eyebrow">{isEdit ? 'UPDATE YOUR LIBRARY' : 'NEW TO YOUR LIBRARY'}</p><h2>{isEdit ? 'Edit bookmark' : 'Add bookmark'}</h2></div><button type="button" onClick={onClose}><X size={19}/></button></div>
      <label>URL<input name="url" autoFocus value={url} onChange={e => { setUrl(e.target.value); setEnriched(false); }} onBlur={enrich} placeholder="https://example.com" type="text" inputMode="url" required /></label>
      {!isEdit && <div className={`metadata-status ${fetching ? 'loading' : enriched ? 'done' : ''}`}>
        <Sparkles size={14}/><span>{fetching ? 'Reading page details…' : enriched ? 'Page details added — you can still change them.' : 'Title, description, and tags will be filled in automatically.'}</span>{enriched && <Check size={14}/>} 
      </div>}
      <label>Title <span>Optional</span><input name="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="A memorable title" /></label>
      <label>Description <span>Optional</span><textarea name="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this page about?" /></label>
      <label>Collection<div className="select-field"><select name="collection" value={collection} onChange={e => setCollection(e.target.value)}>{collectionMeta.map(c => <option key={c.name}>{c.name}</option>)}</select><ChevronDown size={16}/></div></label>
      <label>Tags <span>Separate with commas</span><input name="tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="Design, Reference" /></label>
      <div className="modal-actions"><button type="button" className="cancel" onClick={onClose}>Cancel</button><button className="save" disabled={fetching}>{isEdit ? <Check size={16}/> : <Bookmark size={16}/>} {isEdit ? 'Save changes' : 'Save bookmark'}</button></div>
    </form>
  </div>
}

createRoot(document.getElementById('root')).render(<App />);
