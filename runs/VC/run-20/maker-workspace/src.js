import './style.css';

const icons = {
  logo: '<svg viewBox="0 0 24 24"><path d="M7 4.8c0-1 .8-1.8 1.8-1.8h6.4c1 0 1.8.8 1.8 1.8v15.1l-5-3.1-5 3.1V4.8Z" fill="currentColor"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
  archive: '<svg viewBox="0 0 24 24"><path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6"/></svg>',
  tag: '<svg viewBox="0 0 24 24"><path d="M20 13 12 21 3 12V4h8l9 9Z"/><circle cx="8" cy="9" r="1.4" fill="currentColor"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
};

const seed = [
  {id:1,title:'The art of doing less, better',url:'https://every.to/p/the-art-of-doing-less-better',domain:'every.to',desc:'A thoughtful essay on protecting your attention and making space for work that matters.',tags:['Thinking','Essays'],favorite:true,archived:false,added:'Today',color:'#ec816c',letter:'E'},
  {id:2,title:'A field guide to color',url:'https://stripe.com/sessions/design',domain:'stripe.com',desc:'Practical notes on building color systems that feel coherent, accessible, and alive.',tags:['Design','Reference'],favorite:false,archived:false,added:'Yesterday',color:'#7659dc',letter:'S'},
  {id:3,title:'Designing for the long now',url:'https://craigmod.com/essays/long_now',domain:'craigmod.com',desc:'What changes when we design digital products with care, patience, and a longer horizon?',tags:['Design','Essays'],favorite:true,archived:false,added:'Sep 18',color:'#242424',letter:'C'},
  {id:4,title:'The perfect reading list',url:'https://read.cv/discover',domain:'read.cv',desc:'A beautifully curated collection of books and essays for curious creative people.',tags:['Reading'],favorite:false,archived:false,added:'Sep 16',color:'#f4bf45',letter:'R'},
  {id:5,title:'Tiny tools for a calmer web',url:'https://tinytools.directory',domain:'tinytools.directory',desc:'Small, focused software that respects your time and stays out of the way.',tags:['Tools','Inspiration'],favorite:false,archived:false,added:'Sep 12',color:'#69a98c',letter:'T'},
  {id:6,title:'Notes on taste',url:'https://taste.work',domain:'taste.work',desc:'Taste is not innate. It is a muscle built slowly through attention and practice.',tags:['Thinking','Design'],favorite:true,archived:false,added:'Sep 08',color:'#e36e93',letter:'N'}
];

let bookmarks = JSON.parse(localStorage.getItem('keepmark-bookmarks') || 'null') || seed;
let active = 'all', query = '', sort = 'newest', menuFor = null;
const save = () => localStorage.setItem('keepmark-bookmarks', JSON.stringify(bookmarks));
const esc = s => String(s || '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const allTags = () => [...new Set(bookmarks.flatMap(b => b.tags))];

function shell(){
  document.querySelector('#app').innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="brand"><span class="brandmark">${icons.logo}</span><span>keepmark</span></div>
      <button class="new-btn" id="newBookmark">${icons.plus}<span>New bookmark</span><kbd>N</kbd></button>
      <nav>
        <p class="nav-label">Library</p>
        <button data-filter="all">${icons.grid}<span>All bookmarks</span><b>${bookmarks.filter(b=>!b.archived).length}</b></button>
        <button data-filter="favorites">${icons.star}<span>Favorites</span><b>${bookmarks.filter(b=>b.favorite&&!b.archived).length}</b></button>
        <button data-filter="archive">${icons.archive}<span>Archive</span><b>${bookmarks.filter(b=>b.archived).length}</b></button>
        <p class="nav-label tag-heading">Tags <button id="addTag">${icons.plus}</button></p>
        <div id="tagNav">${tagNav()}</div>
      </nav>
      <div class="sidebar-bottom"><div class="storage"><span>Personal library</span><b>${bookmarks.length} saved</b></div><div class="user"><div class="avatar">AM</div><div><strong>Alex Morgan</strong><span>Free plan</span></div><button>${icons.more}</button></div></div>
    </aside>
    <main>
      <header><button class="mobile-menu" id="mobileMenu">${icons.menu}</button><div class="search">${icons.search}<input id="search" placeholder="Search your library..." value="${esc(query)}"><kbd>⌘ K</kbd></div><button class="header-add" id="headerAdd">${icons.plus}<span>Add bookmark</span></button></header>
      <section class="content" data-harness-ready="true">
        <div class="title-row"><div><p class="eyebrow">YOUR LIBRARY</p><h1>${titleFor()}</h1><p class="subtitle">${subtitleFor()}</p></div><div class="controls"><button class="view active">${icons.grid}</button><select id="sort"><option value="newest" ${sort==='newest'?'selected':''}>Newest first</option><option value="oldest" ${sort==='oldest'?'selected':''}>Oldest first</option><option value="az" ${sort==='az'?'selected':''}>A–Z</option></select></div></div>
        <div class="quick-tags">${quickTags()}</div>
        <div class="grid" id="grid"></div>
      </section>
    </main>
    <div id="modalRoot"></div><div id="toastRoot"></div>`;
  bindShell(); renderCards(); setActiveNav();
}

function tagNav(){ return allTags().slice(0,5).map((t,i)=>`<button data-filter="tag:${esc(t)}"><i style="--dot:${['#e47f6d','#7056cb','#5da381','#e3ae43','#5e8ecb'][i%5]}"></i><span>${esc(t)}</span><b>${bookmarks.filter(b=>b.tags.includes(t)&&!b.archived).length}</b></button>`).join(''); }
function titleFor(){ if(active==='favorites')return 'Favorites'; if(active==='archive')return 'Archive'; if(active.startsWith('tag:'))return active.slice(4); return 'All bookmarks'; }
function subtitleFor(){ if(active==='archive')return 'Bookmarks you’ve tucked away for later.'; if(active==='favorites')return 'The links you come back to most.'; return 'Everything worth keeping, all in one calm place.'; }
function quickTags(){ return ['All',...allTags().slice(0,6)].map(t=>`<button class="${(t==='All'&&!active.startsWith('tag:'))||active===`tag:${t}`?'active':''}" data-quick="${esc(t)}">${esc(t)}</button>`).join(''); }

function filtered(){
  let list=bookmarks.filter(b => active==='archive'?b.archived:!b.archived);
  if(active==='favorites') list=list.filter(b=>b.favorite);
  if(active.startsWith('tag:')) list=list.filter(b=>b.tags.includes(active.slice(4)));
  if(query) {const q=query.toLowerCase();list=list.filter(b=>[b.title,b.url,b.desc,...b.tags].join(' ').toLowerCase().includes(q));}
  if(sort==='az') list.sort((a,b)=>a.title.localeCompare(b.title));
  if(sort==='oldest') list.reverse();
  return list;
}

function renderCards(){
  const list=filtered(), grid=document.querySelector('#grid'); if(!grid)return;
  grid.innerHTML=list.length?list.map(b=>`<article class="card" data-id="${b.id}">
    <div class="card-top"><div class="site-icon" style="--brand:${b.color}">${esc(b.letter)}</div><div class="card-actions"><button class="star ${b.favorite?'on':''}" data-action="favorite" aria-label="Favorite">${icons.star}</button><button data-action="menu" aria-label="More">${icons.more}</button>${menuFor===b.id?`<div class="menu"><button data-action="edit">Edit bookmark</button><button data-action="archive">${b.archived?'Restore':'Move to archive'}</button><button class="danger" data-action="delete">Delete</button></div>`:''}</div></div>
    <a class="card-main" href="${esc(b.url)}" target="_blank" rel="noopener"><h2>${esc(b.title)}</h2><p class="domain">${esc(b.domain)} ${icons.arrow}</p><p class="desc">${esc(b.desc)}</p></a>
    <div class="tags">${b.tags.map(t=>`<button data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div class="card-foot"><span>Saved ${esc(b.added)}</span><span class="open-label">Open link ${icons.arrow}</span></div>
  </article>`).join(''):`<div class="empty"><div>${icons.search}</div><h2>No bookmarks found</h2><p>Try a different search or save something new.</p><button id="emptyAdd">${icons.plus} Add bookmark</button></div>`;
  bindCards();
}

function setActiveNav(){ document.querySelectorAll('[data-filter]').forEach(el=>el.classList.toggle('active',el.dataset.filter===active)); }
function bindShell(){
  document.querySelectorAll('[data-filter]').forEach(el=>el.onclick=()=>{active=el.dataset.filter;query='';shell();});
  document.querySelectorAll('[data-quick]').forEach(el=>el.onclick=()=>{active=el.dataset.quick==='All'?'all':`tag:${el.dataset.quick}`;shell();});
  document.querySelector('#search').oninput=e=>{query=e.target.value;renderCards();};
  document.querySelector('#sort').onchange=e=>{sort=e.target.value;renderCards();};
  document.querySelector('#newBookmark').onclick=()=>openModal(); document.querySelector('#headerAdd').onclick=()=>openModal();
  document.querySelector('#mobileMenu').onclick=()=>document.querySelector('#sidebar').classList.toggle('open');
  document.addEventListener('keydown', shortcut, {once:true});
}
function shortcut(e){ if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();document.querySelector('#search')?.focus();} if(e.key.toLowerCase()==='n'&&!['INPUT','TEXTAREA'].includes(e.target.tagName))openModal(); document.addEventListener('keydown',shortcut,{once:true}); }
function bindCards(){
  document.querySelector('#emptyAdd')?.addEventListener('click',()=>openModal());
  document.querySelectorAll('.card').forEach(card=>card.addEventListener('click',e=>{
    const id=+card.dataset.id, action=e.target.closest('[data-action]')?.dataset.action, tag=e.target.closest('[data-tag]')?.dataset.tag;
    if(tag){active=`tag:${tag}`;shell();return;} if(!action)return; e.preventDefault();e.stopPropagation();
    if(action==='favorite'){const b=bookmarks.find(x=>x.id===id);b.favorite=!b.favorite;save();renderCards();toast(b.favorite?'Added to favorites':'Removed from favorites');}
    if(action==='menu'){menuFor=menuFor===id?null:id;renderCards();}
    if(action==='edit')openModal(bookmarks.find(x=>x.id===id));
    if(action==='archive'){const b=bookmarks.find(x=>x.id===id);b.archived=!b.archived;save();menuFor=null;shell();toast(b.archived?'Moved to archive':'Restored to library');}
    if(action==='delete'&&confirm('Delete this bookmark?')){bookmarks=bookmarks.filter(x=>x.id!==id);save();menuFor=null;shell();toast('Bookmark deleted');}
  }));
}

function openModal(item){
  document.querySelector('#modalRoot').innerHTML=`<div class="modal-backdrop"><form class="modal"><div class="modal-head"><div><p>${item?'UPDATE LINK':'SAVE SOMETHING GOOD'}</p><h2>${item?'Edit bookmark':'New bookmark'}</h2></div><button type="button" class="close">${icons.close}</button></div>
    <label>URL <span class="fetch-status" aria-live="polite">${item?'':'Paste a link to fill in the details'}</span><div class="url-field"><input name="url" type="url" required placeholder="https://example.com/article" value="${esc(item?.url||'')}"><i class="fetch-spinner" aria-hidden="true"></i></div></label>
    <label>Title <span>Editable</span><input name="title" placeholder="Filled automatically from the page" value="${esc(item?.title||'')}"></label>
    <label>Note <span>Optional</span><textarea name="desc" placeholder="Why is this worth keeping?">${esc(item?.desc||'')}</textarea></label>
    <label>Tags <span>Separate with commas</span><input name="tags" placeholder="Design, Reading" value="${esc(item?.tags.join(', ')||'')}"></label>
    <div class="modal-foot"><button type="button" class="cancel">Cancel</button><button class="save-btn">${icons.logo} ${item?'Save changes':'Save bookmark'}</button></div></form></div>`;
  const close=()=>document.querySelector('#modalRoot').innerHTML='';
  document.querySelector('.close').onclick=close; document.querySelector('.cancel').onclick=close;
  document.querySelector('.modal-backdrop').onclick=e=>{if(e.target===e.currentTarget)close();};
  const form=document.querySelector('.modal'), urlInput=form.querySelector('[name="url"]'), titleInput=form.querySelector('[name="title"]'), descInput=form.querySelector('[name="desc"]'), status=form.querySelector('.fetch-status');
  urlInput.focus(); let fetchTimer, fetchNumber=0, titleTouched=!!item, descTouched=!!item;
  titleInput.addEventListener('input',()=>titleTouched=true); descInput.addEventListener('input',()=>descTouched=true);
  async function fetchDetails(){
    const url=urlInput.value.trim(); if(!/^https?:\/\//i.test(url)){status.textContent='Enter a complete web address';return;}
    const request=++fetchNumber; form.classList.add('fetching'); status.textContent='Getting page details…';
    try{const response=await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);const data=await response.json();if(request!==fetchNumber)return;if(!response.ok)throw new Error(data.error||'Could not read this page');
      if(data.title&&!titleTouched)titleInput.value=data.title;if(data.description&&!descTouched)descInput.value=data.description;
      status.textContent=data.title||data.description?'Details added — you can edit them':'No details found — you can still save';
    }catch(error){if(request===fetchNumber)status.textContent='Couldn’t fetch details — you can still save';}
    finally{if(request===fetchNumber)form.classList.remove('fetching');}
  }
  urlInput.addEventListener('input',()=>{clearTimeout(fetchTimer);status.textContent='Waiting for the link…';fetchTimer=setTimeout(fetchDetails,550);});
  urlInput.addEventListener('blur',()=>{clearTimeout(fetchTimer);if(urlInput.value&&!item)fetchDetails();});
  form.onsubmit=e=>{e.preventDefault();const d=new FormData(form),url=d.get('url').trim();let domain;try{domain=new URL(url).hostname.replace(/^www\./,'');}catch{domain=url;}
    const data={title:d.get('title').trim()||domain,url,domain,desc:d.get('desc').trim()||'Saved for later.',tags:d.get('tags').split(',').map(x=>x.trim()).filter(Boolean),letter:domain[0]?.toUpperCase()||'K'};
    if(item)Object.assign(item,data);else bookmarks.unshift({id:Date.now(),...data,favorite:false,archived:false,added:'just now',color:['#ec816c','#7659dc','#69a98c','#e3ae43'][bookmarks.length%4]}); save();close();shell();toast(item?'Bookmark updated':'Bookmark saved'); };
}
function toast(msg){const el=document.createElement('div');el.className='toast';el.innerHTML=`${icons.check}<span>${msg}</span>`;document.querySelector('#toastRoot').append(el);setTimeout(()=>el.remove(),2600);}

shell();
