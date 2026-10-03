const defaults = [
  {id:1,title:'A guide to choosing colors that work',url:'https://www.realtimecolors.com/blog/colors-that-work',note:'A practical walkthrough for building balanced color systems with confidence.',collection:'Design',tags:['color','design'],favorite:true,unread:true,archived:false,created:'2026-09-25',tone:['#f2e4d9','#a84d2d']},
  {id:2,title:'The quiet craft of good software',url:'https://www.robinsloan.com/notes/home-cooked-app',note:'On making software that feels personal, durable, and human-sized.',collection:'Reading',tags:['essay','craft'],favorite:false,unread:true,archived:false,created:'2026-09-23',tone:['#e4e8df','#49614d']},
  {id:3,title:'Shape Up: Stop Running in Circles',url:'https://basecamp.com/shapeup',note:'How small teams can shape, bet on, and build meaningful product work.',collection:'Work',tags:['product','teams'],favorite:true,archived:false,created:'2026-09-20',tone:['#e4e8ee','#385276']},
  {id:4,title:'An interactive guide to CSS Grid',url:'https://www.joshwcomeau.com/css/interactive-guide-to-grid',note:'The clearest visual explanation of grid layout I have found.',collection:'Design',tags:['css','reference'],favorite:false,archived:false,created:'2026-09-14',tone:['#eee6d7','#8b682c']},
  {id:5,title:'The value of a good notebook',url:'https://nesslabs.com/notebook',note:'Notes on external memory, creative work, and building a thinking practice.',collection:'Ideas',tags:['notes','thinking'],favorite:false,archived:false,created:'2026-09-10',tone:['#e7dfe8','#705077']},
  {id:6,title:'Designing for the web in 2026',url:'https://web.dev/learn/design',note:'Patterns and principles for fast, accessible, resilient interfaces.',collection:'Work',tags:['web','design'],favorite:false,archived:false,created:'2026-08-28',tone:['#dce9e5','#2f6c5c']}
];
const collections = [{name:'Design',color:'#cc7044'},{name:'Reading',color:'#6a866b'},{name:'Work',color:'#577895'},{name:'Ideas',color:'#8b678d'}];
let items = JSON.parse(localStorage.getItem('shelf-items') || 'null') || defaults;
let state = {view:'all',collection:'All',query:'',sort:'newest',layout:'grid',editId:null};
const $ = s => document.querySelector(s);
const grid = $('#bookmarkGrid'), dialog = $('#bookmarkDialog');
function save(){localStorage.setItem('shelf-items',JSON.stringify(items))}
function esc(s=''){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function host(url){try{return new URL(url).hostname.replace('www.','')}catch{return url}}
function initials(url){return host(url).split('.')[0].slice(0,2).toUpperCase()}
function renderNav(){
  $('#allCount').textContent=items.filter(x=>!x.archived).length; $('#favCount').textContent=items.filter(x=>x.favorite&&!x.archived).length; $('#unreadCount').textContent=items.filter(x=>x.unread&&!x.archived).length; $('#archiveCount').textContent=items.filter(x=>x.archived).length;
  $('#collectionNav').innerHTML=collections.map(c=>`<button class="collection-item ${state.collection===c.name?'active':''}" style="--dot:${c.color}" data-collection="${c.name}">${c.name}<span class="count">${items.filter(x=>x.collection===c.name&&!x.archived).length}</span></button>`).join('');
  $('#collectionInput').innerHTML=collections.map(c=>`<option>${c.name}</option>`).join('');
}
function visibleItems(){
  let out=items.filter(x=>state.view==='archive'?x.archived:!x.archived);
  if(state.view==='favorites')out=out.filter(x=>x.favorite);
  if(state.view==='unread')out=out.filter(x=>x.unread);
  if(state.collection!=='All')out=out.filter(x=>x.collection===state.collection);
  const q=state.query.toLowerCase(); if(q)out=out.filter(x=>[x.title,x.url,x.note,x.collection,...x.tags].join(' ').toLowerCase().includes(q));
  return out.sort((a,b)=>state.sort==='title'?a.title.localeCompare(b.title):state.sort==='oldest'?a.created.localeCompare(b.created):b.created.localeCompare(a.created));
}
function render(){
  renderNav();
  const title=state.collection!=='All'?state.collection:state.view==='favorites'?'Favorites':state.view==='unread'?'Unread':state.view==='archive'?'Archive':'All bookmarks';
  $('#pageTitle').textContent=title; $('#eyebrow').textContent=state.view==='archive'?'PUT AWAY':state.view==='favorites'?'THE KEEPERS':state.view==='unread'?'READ LATER':'YOUR LIBRARY';
  const tags=['All',...new Set(items.filter(x=>!x.archived).flatMap(x=>x.tags))].slice(0,7);
  $('#filterRow').innerHTML=tags.map(t=>`<button class="filter ${state.tag===t||(!state.tag&&t==='All')?'active':''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
  let shown=visibleItems(); if(state.tag&&state.tag!=='All')shown=shown.filter(x=>x.tags.includes(state.tag));
  grid.className='bookmark-grid '+(state.layout==='list'?'list-mode':'');
  grid.innerHTML=shown.map(x=>`<article class="bookmark-card" data-id="${x.id}">
    <div class="card-top"><div class="favicon" style="--accent:${x.tone?.[0]||'#e3e6df'};--accentInk:${x.tone?.[1]||'#456'}">${initials(x.url)}</div><span class="domain">${esc(host(x.url))}</span><button class="star ${x.favorite?'on':''}" data-action="star" aria-label="Favorite">${x.favorite?'★':'☆'}</button><button class="menu" data-action="menu" aria-label="More">···</button></div>
    <h3><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></h3><p class="note">${esc(x.note)}</p>
    <div class="card-bottom"><button class="read-toggle ${x.unread?'':'read'}" data-action="read">${x.unread?'◔ UNREAD':'✓ READ'}</button>${x.tags.slice(0,2).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}<span class="date">${new Date(x.created+'T12:00:00').toLocaleDateString('en',{month:'short',day:'numeric'})}</span></div>
    <div class="card-menu"><button data-action="edit">Edit</button><button data-action="archive">${x.archived?'Restore':'Archive'}</button><button data-action="delete">Delete</button></div></article>`).join('');
  $('#emptyState').hidden=shown.length>0; grid.hidden=shown.length===0;
}
function openModal(item){
  state.editId=item?.id||null; $('#modalTitle').textContent=item?'Edit bookmark':'Add a bookmark';
  $('#urlInput').value=item?.url||''; $('#titleInput').value=item?.title||''; $('#noteInput').value=item?.note||''; $('#collectionInput').value=item?.collection||'Design'; $('#tagsInput').value=item?.tags.join(', ')||''; $('#unreadInput').checked=item?.unread??true; $('#fetchStatus').textContent=''; dialog.showModal(); setTimeout(()=>$('#urlInput').focus(),50);
}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-view]'); if(nav){state.view=nav.dataset.view;state.collection='All';document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n===nav));render()}
  const col=e.target.closest('[data-collection]');if(col){state.collection=col.dataset.collection;state.view='all';document.querySelectorAll('.nav-item').forEach((n,i)=>n.classList.toggle('active',i===0));render()}
  const filter=e.target.closest('[data-tag]');if(filter){state.tag=filter.dataset.tag;render()}
  const action=e.target.closest('[data-action]');if(action){const card=action.closest('.bookmark-card'),item=items.find(x=>x.id===+card.dataset.id),a=action.dataset.action;
    if(a==='menu'){document.querySelectorAll('.card-menu').forEach(m=>m!==card.querySelector('.card-menu')&&m.classList.remove('open'));card.querySelector('.card-menu').classList.toggle('open');return}
    if(a==='star'){item.favorite=!item.favorite;save();render();toast(item.favorite?'Added to favorites':'Removed from favorites')}
    if(a==='read'){item.unread=!item.unread;save();render();toast(item.unread?'Marked as unread':'Marked as read')}
    if(a==='edit')openModal(item);
    if(a==='archive'){item.archived=!item.archived;save();render();toast(item.archived?'Moved to archive':'Restored to library')}
    if(a==='delete'&&confirm(`Delete “${item.title}”?`)){items=items.filter(x=>x.id!==item.id);save();render();toast('Bookmark deleted')}
  }
});
$('#addBookmark').onclick=()=>openModal(); $('#emptyAdd').onclick=()=>openModal();
$('#bookmarkForm').addEventListener('submit',e=>{e.preventDefault();if(!e.submitter||e.submitter.value==='cancel'){dialog.close();return}if(!e.target.reportValidity())return;
  const data={url:$('#urlInput').value,title:$('#titleInput').value.trim()||host($('#urlInput').value),note:$('#noteInput').value,collection:$('#collectionInput').value,tags:$('#tagsInput').value.split(',').map(x=>x.trim()).filter(Boolean),unread:$('#unreadInput').checked,tone:['#e3e8df','#48604c']};
  if(state.editId){Object.assign(items.find(x=>x.id===state.editId),data);toast('Bookmark updated')}else{items.unshift({...data,id:Date.now(),favorite:false,archived:false,created:new Date().toISOString().slice(0,10)});toast('Saved to your shelf')}
  save();dialog.close();render();
});
$('#search').oninput=e=>{state.query=e.target.value;render()}; $('#sortSelect').onchange=e=>{state.sort=e.target.value;render()};
let fetchTimer, fetchedUrl='';
async function fetchMetadata(){
  const url=$('#urlInput').value.trim(),status=$('#fetchStatus');if(!url||url===fetchedUrl)return;try{new URL(url)}catch{return}status.className='';status.textContent='FETCHING…';
  try{const res=await fetch('/api/metadata?url='+encodeURIComponent(url)),data=await res.json();if(!res.ok)throw new Error(data.error);if($('#urlInput').value.trim()!==url)return;if(data.title&&!$('#titleInput').value.trim())$('#titleInput').value=data.title;if(data.description&&!$('#noteInput').value.trim())$('#noteInput').value=data.description;fetchedUrl=url;status.textContent='✓ DETAILS ADDED'}catch(err){status.className='error';status.textContent='COULDN’T FETCH';status.title=err.message}
}
$('#urlInput').addEventListener('input',()=>{clearTimeout(fetchTimer);fetchTimer=setTimeout(fetchMetadata,650)});$('#urlInput').addEventListener('blur',fetchMetadata);
$('#gridView').onclick=()=>{state.layout='grid';$('#gridView').classList.add('active');$('#listView').classList.remove('active');render()};
$('#listView').onclick=()=>{state.layout='list';$('#listView').classList.add('active');$('#gridView').classList.remove('active');render()};
$('#newCollection').onclick=()=>{const name=prompt('Collection name');if(name&& !collections.some(c=>c.name===name)){collections.push({name,color:'#777'});render();toast('Collection created')}};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();$('#search').focus()}if(e.key.toLowerCase()==='n'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();openModal()}});
render();
