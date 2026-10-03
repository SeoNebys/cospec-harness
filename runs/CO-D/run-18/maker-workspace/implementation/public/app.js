const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const state = { bookmarks:[], tags:[], view:'active', tag:'all', query:'', sort:'newest', selected:new Set(), editing:null, draftTags:[], pendingDelete:[] };

async function api(path, options={}) {
  const response=await fetch(path,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw Object.assign(new Error(data.error||'Something went wrong'),{data,status:response.status});
  return data;
}
function text(value=''){ const node=document.createElement('div'); node.textContent=value; return node.innerHTML; }
function strip(html=''){ const node=document.createElement('div'); node.innerHTML=html; return node.textContent||''; }
function cleanNote(html='') {
  const doc=new DOMParser().parseFromString(`<div>${html}</div>`,'text/html');
  const root=doc.body.firstElementChild;
  root.querySelectorAll('script,style,img,a,iframe,object').forEach(node=>node.remove());
  root.querySelectorAll('*').forEach(node=>{ [...node.attributes].forEach(attribute=>node.removeAttribute(attribute.name)); if(!['DIV','P','BR','STRONG','B','UL','OL','LI'].includes(node.tagName) && node.parentNode) node.replaceWith(...node.childNodes); });
  return root.innerHTML;
}
function normalizedTag(value){ return value.trim().toLocaleLowerCase().replace(/s$/,''); }
function showNotice(message){ const notice=$('#notice'); notice.innerHTML=message; notice.classList.add('show'); setTimeout(()=>notice.classList.remove('show'),5500); }
function openDialog(dialog){ $('#scrim').hidden=false; dialog.hidden=false; }
function closeDialogs(){ $('#scrim').hidden=true; $$('.dialog').forEach(dialog=>dialog.hidden=true); $('#tag-suggestions').classList.remove('show'); $('#bulk-tag-suggestions').classList.remove('show'); }
$$('[data-close]').forEach(button=>button.addEventListener('click',closeDialogs)); $('#scrim').addEventListener('click',closeDialogs);

async function load(){ const data=await api('/api/bookmarks'); state.bookmarks=data.bookmarks; state.tags=data.tags; render(); }
function visibleItems(){
  const query=state.query.toLocaleLowerCase();
  return state.bookmarks.filter(item=>{
    const view=state.view==='archive'?item.archived:(!item.archived&&(state.view==='active'||item.readLater));
    const tag=state.tag==='all'||item.tags.some(value=>value.toLocaleLowerCase()===state.tag);
    const haystack=[item.title,item.description,item.url,strip(item.noteHtml),...(item.tags||[])].join(' ').toLocaleLowerCase();
    return view&&tag&&haystack.includes(query);
  }).sort((a,b)=>state.sort==='title'?a.title.localeCompare(b.title):b.createdAt.localeCompare(a.createdAt));
}
function render(){
  const isBrandNew=state.bookmarks.length===0;
  $('.workspace').style.display=isBrandNew?'none':''; $('.hero .search').style.display=isBrandNew?'none':'';
  $('#first-empty').classList.toggle('show',isBrandNew);
  $('#active-count').textContent=state.bookmarks.filter(item=>!item.archived).length;
  $('#later-count').textContent=state.bookmarks.filter(item=>!item.archived&&item.readLater).length;
  $('#archive-count').textContent=state.bookmarks.filter(item=>item.archived).length;
  $$('.side-item[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===state.view));
  renderTags(); renderCards(); renderBulkBar();
}
function renderTags(){
  $('#tag-list').innerHTML=state.tags.map(tag=>`<button class="side-item tag-choice ${state.tag===tag.toLocaleLowerCase()?'active':''}" data-tag="${text(tag.toLocaleLowerCase())}">${text(tag)}</button>`).join('');
  $('.tag-choice[data-tag="all"]').classList.toggle('active',state.tag==='all');
  $$('.tag-choice').forEach(button=>button.addEventListener('click',()=>{ state.tag=button.dataset.tag; render(); }));
}
function renderCards(){
  const items=visibleItems(); $('#result-count').textContent=`${items.length} bookmark${items.length===1?'':'s'}`;
  $('#cards').innerHTML=items.map(item=>card(item)).join('');
  const empty=$('#empty');
  if(!items.length&&state.bookmarks.length){
    let title='No bookmarks match that search',copy='Clear or change the search to bring your library back.';
    if(!state.query&&state.tag==='all'&&state.view==='later'){ title='Nothing saved for later'; copy='Use “Read later” on any bookmark and it will appear here.'; }
    if(!state.query&&state.tag==='all'&&state.view==='archive'){ title='Your archive is empty'; copy='Bookmarks you archive will stay safe here until you restore or delete them.'; }
    if(!state.query&&state.tag!=='all'){ title='No bookmarks with this tag'; copy='Choose another tag or return to all tags.'; }
    empty.innerHTML=`<h2>${title}</h2><p>${copy}</p>`; empty.classList.add('show');
  } else empty.classList.remove('show');
  bindCards();
}
function card(item){
  const selected=state.selected.has(item.id); const host=new URL(item.url).hostname.replace(/^www\./,'');
  return `<article class="card ${selected?'selected':''} ${item.thumbnail?'':'no-thumb'}" data-id="${item.id}">
    <input class="pick" type="checkbox" aria-label="Select ${text(item.title)}" ${selected?'checked':''}>
    ${item.thumbnail?`<div class="thumb"><img src="${text(item.thumbnail)}" alt=""></div>`:''}
    <div class="card-body"><div class="site">${item.favicon?`<img src="${text(item.favicon)}" alt="">`:''}<span>${text(item.siteName||host)}</span></div>
    <h2><a href="${text(item.url)}" target="_blank" rel="noopener">${text(item.title)}</a></h2>
    ${item.description?`<p class="description">${text(item.description)}</p>`:''}
    <div class="tag-chips">${item.tags.map(tag=>`<span class="chip">${text(tag)}</span>`).join('')}</div>
    <span class="address">${text(item.url)}</span>${item.noteHtml?`<div class="note-preview">${cleanNote(item.noteHtml)}</div>`:''}
    <div class="card-actions"><button data-edit>Edit bookmark</button>${item.archived?`<button data-restore>Restore</button><div class="more"><button data-more>•••</button><div class="more-menu"><button data-delete>Delete permanently</button></div></div>`:`<button data-later>${item.readLater?'Saved for later':'Read later'}</button><button class="archive-action" data-archive>Archive</button>`}</div></div></article>`;
}
function bindCards(){
  $$('.card').forEach(card=>{
    const id=card.dataset.id,item=state.bookmarks.find(value=>value.id===id);
    card.querySelector('.pick').addEventListener('change',event=>{ event.target.checked?state.selected.add(id):state.selected.delete(id); render(); });
    card.querySelector('[data-edit]').addEventListener('click',()=>openEditor(item));
    card.querySelector('[data-later]')?.addEventListener('click',()=>updateItem(item,{readLater:!item.readLater},item.readLater?'Removed from Read later.':'Saved for later.'));
    card.querySelector('[data-archive]')?.addEventListener('click',()=>updateItem(item,{archived:true},'Bookmark archived.'));
    card.querySelector('[data-restore]')?.addEventListener('click',()=>updateItem(item,{archived:false},'Bookmark restored.'));
    card.querySelector('[data-more]')?.addEventListener('click',event=>event.currentTarget.nextElementSibling.classList.toggle('show'));
    card.querySelector('[data-delete]')?.addEventListener('click',()=>askDelete([item]));
  });
}
async function updateItem(item,changes,message){ const data=await api(`/api/bookmarks/${item.id}`,{method:'PUT',body:JSON.stringify(changes)}); Object.assign(item,data.bookmark); if(changes.archived) state.selected.delete(item.id); render(); showNotice(message); }

$('#search').addEventListener('input',event=>{ state.query=event.target.value; renderCards(); });
$('#sort').addEventListener('change',event=>{ state.sort=event.target.value; renderCards(); });
$$('.side-item[data-view]').forEach(button=>button.addEventListener('click',()=>{ state.view=button.dataset.view; state.selected.clear(); render(); }));
$('#new-bookmark').addEventListener('click',openSave); $('#first-save').addEventListener('click',openSave);
function resetSave(){ state.editing=null; state.draftTags=[]; $('#url-form').reset(); $('#url-form').hidden=false; $('#bookmark-form').hidden=true; $('#fetch-error').hidden=true; $('#url-error').textContent=''; $('#duplicate-note').hidden=true; $('#refresh-details').hidden=true; $('#restore-existing').hidden=true; $('#refresh-box').hidden=true; $('#save-heading').textContent='Add something useful.'; $('#save-button').textContent='Save bookmark'; }
function openSave(){ resetSave(); openDialog($('#save-dialog')); setTimeout(()=>$('#url').focus(),0); }

$('#url-form').addEventListener('submit',async event=>{
  event.preventDefault(); $('#url-error').textContent=''; const url=$('#url').value.trim();
  try { const data=await api('/api/preview',{method:'POST',body:JSON.stringify({url})}); if(data.duplicate) return openDuplicate(data.duplicate); showBookmarkForm({...data.preview,url},false); }
  catch(error){ if(error.data?.manual){ $('#fetch-error').hidden=false; showBookmarkForm({url,title:'',description:'',siteName:new URL(url).hostname,favicon:'',thumbnail:''},true); } else $('#url-error').textContent=error.message; }
});
$('#retry-fetch').addEventListener('click',()=>$('#url-form').requestSubmit());
function showBookmarkForm(item,manual){
  $('#bookmark-form').hidden=false; $('#url-form').hidden=!manual; $('#preview-site').textContent=item.siteName||new URL(item.url).hostname;
  $('#preview-icon').hidden=!item.favicon; $('#preview-icon').src=item.favicon||''; $('#media-preview').hidden=!item.thumbnail; $('#preview-image').src=item.thumbnail||'';
  $('#bookmark-title').value=item.title||''; $('#bookmark-description').value=item.description||''; $('#bookmark-note').innerHTML=cleanNote(item.noteHtml||'');
  state.draftTags=[...(item.tags||[])]; renderDraftTags(); $('#bookmark-form').dataset.url=item.url; $('#bookmark-form').dataset.site=item.siteName||''; $('#bookmark-form').dataset.favicon=item.favicon||''; $('#bookmark-form').dataset.thumbnail=item.thumbnail||'';
  if(manual) setTimeout(()=>$('#bookmark-title').focus(),0);
}
function openDuplicate(item){ state.editing=item; showBookmarkForm(item,false); $('#duplicate-note').hidden=false; $('#duplicate-note').textContent=item.archived?'Already in your Archive — no duplicate will be created.':'Already in your library — you’re editing the existing bookmark.'; $('#save-heading').textContent='Edit the bookmark you already have.'; $('#save-button').textContent=item.archived?'Update while archived':'Update bookmark'; $('#refresh-details').hidden=false; $('#restore-existing').hidden=!item.archived; }
function openEditor(item){ resetSave(); $('#url-form').hidden=true; openDialog($('#save-dialog')); openDuplicate(item); }

$$('[data-format]').forEach(button=>button.addEventListener('click',()=>{ $('#bookmark-note').focus(); document.execCommand(button.dataset.format,false); }));
function renderDraftTags(){ $('#chosen-tags').innerHTML=state.draftTags.map(tag=>`<span class="chip">${text(tag)}<button type="button" data-remove-tag="${text(tag)}">×</button></span>`).join(''); $$('[data-remove-tag]').forEach(button=>button.addEventListener('click',()=>{ state.draftTags=state.draftTags.filter(tag=>tag!==button.dataset.removeTag); renderDraftTags(); })); }
function suggestTags(input,container){ const query=input.value.trim().toLocaleLowerCase(); const matches=state.tags.filter(tag=>tag.toLocaleLowerCase().includes(query)); container.innerHTML=matches.map(tag=>`<button type="button" data-value="${text(tag)}">${text(tag)}</button>`).join(''); container.classList.toggle('show',Boolean(query&&matches.length)); container.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{ input.value=button.dataset.value; container.classList.remove('show'); if(input===$('#tag-input')) addDraftTag(input.value); })); }
$('#tag-input').addEventListener('input',()=>suggestTags($('#tag-input'),$('#tag-suggestions')));
$('#tag-input').addEventListener('keydown',event=>{ if(event.key==='Enter'&&event.target.value.trim()){ event.preventDefault(); addDraftTag(event.target.value); } });
function addDraftTag(raw){ const existing=state.tags.find(tag=>normalizedTag(tag)===normalizedTag(raw))||raw.trim(); const already=state.draftTags.find(tag=>normalizedTag(tag)===normalizedTag(existing)); $('#tag-help').textContent=already?`${already} is already added — no duplicate was created.`:`${existing} added.`; if(!already) state.draftTags.push(existing); $('#tag-input').value=''; $('#tag-suggestions').classList.remove('show'); renderDraftTags(); }

$('#bookmark-form').addEventListener('submit',async event=>{
  event.preventDefault(); const payload={url:event.currentTarget.dataset.url,title:$('#bookmark-title').value,description:$('#bookmark-description').value,noteHtml:cleanNote($('#bookmark-note').innerHTML),tags:state.draftTags,siteName:event.currentTarget.dataset.site,favicon:event.currentTarget.dataset.favicon,thumbnail:event.currentTarget.dataset.thumbnail};
  try { let data; if(state.editing) data=await api(`/api/bookmarks/${state.editing.id}`,{method:'PUT',body:JSON.stringify(payload)}); else data=await api('/api/bookmarks',{method:'POST',body:JSON.stringify(payload)}); closeDialogs(); await load(); const tags=payload.tags.length?` Tags: ${payload.tags.join(', ')}.`:''; const note=strip(payload.noteHtml); showNotice(`<strong>${state.editing?'Bookmark updated':'Bookmark saved'}:</strong> ${text(payload.title)} — ${text(payload.description)}${tags}${note?` Note: ${text(note)}`:''}`); }
  catch(error){ $('#url-error').textContent=error.message; }
});
$('#restore-existing').addEventListener('click',async()=>{ if(!state.editing) return; await updateExistingAndRestore(); });
async function updateExistingAndRestore(){ const payload={title:$('#bookmark-title').value,description:$('#bookmark-description').value,noteHtml:cleanNote($('#bookmark-note').innerHTML),tags:state.draftTags,archived:false}; await api(`/api/bookmarks/${state.editing.id}`,{method:'PUT',body:JSON.stringify(payload)}); closeDialogs(); await load(); showNotice(`<strong>Bookmark restored and updated:</strong> ${text(payload.title)}`); }
$('#refresh-details').addEventListener('click',async()=>{ try{ const data=await api('/api/refresh-preview',{method:'POST',body:JSON.stringify({url:state.editing.url})}); const fresh=data.preview; const box=$('#refresh-box'); box.hidden=false; box.innerHTML=`<strong>Page details available for review</strong><p>Title: ${text(fresh.title)}</p><p>${text(fresh.description)}</p>${fresh.thumbnail?`<img src="${text(fresh.thumbnail)}" alt="New page image">`:''}<div class="refresh-actions"><button type="button" id="keep-saved">Keep my saved details</button><button type="button" id="apply-refresh">Use these page details</button></div>`; $('#keep-saved').onclick=()=>box.hidden=true; $('#apply-refresh').onclick=()=>{ $('#bookmark-title').value=fresh.title; $('#bookmark-description').value=fresh.description; $('#bookmark-form').dataset.site=fresh.siteName; $('#bookmark-form').dataset.favicon=fresh.favicon; $('#bookmark-form').dataset.thumbnail=fresh.thumbnail; box.hidden=true; }; } catch(error){ $('#refresh-box').hidden=false; $('#refresh-box').textContent=error.message; } });

function renderBulkBar(){ const selected=state.bookmarks.filter(item=>state.selected.has(item.id)); $('#selected-count').textContent=`${selected.length} selected`; $('#bulk-bar').classList.toggle('show',selected.length>0); const archived=state.view==='archive'; $$('[data-bulk]').forEach(button=>button.style.display=''); $('[data-bulk="delete"]').style.display=archived?'':'none'; $('[data-bulk="tag"]').style.display=archived?'none':''; $('[data-bulk="later"]').style.display=archived?'none':''; $('[data-bulk="archive"]').style.display=archived?'none':''; $('[data-bulk="later"]').textContent=selected.length&&selected.every(item=>item.readLater)?'Mark done':'Save for later'; }
$$('[data-bulk]').forEach(button=>button.addEventListener('click',()=>bulkAction(button.dataset.bulk)));
async function bulkAction(action){ const selected=state.bookmarks.filter(item=>state.selected.has(item.id)); const ids=selected.map(item=>item.id); if(action==='tag'){ $('#bulk-tag-input').value=''; openDialog($('#tag-dialog')); return; } if(action==='delete') return askDelete(selected); if(action==='later'){ const value=!selected.every(item=>item.readLater); await api('/api/bulk',{method:'POST',body:JSON.stringify({ids,action:'readLater',value})}); state.selected.clear(); await load(); showNotice(`${ids.length} bookmarks ${value?'saved for later':'marked done'}.`); } if(action==='archive'){ await api('/api/bulk',{method:'POST',body:JSON.stringify({ids,action:'archive'})}); state.selected.clear(); await load(); showNotice(`${ids.length} bookmarks archived.`); } }
$('#bulk-tag-input').addEventListener('input',()=>suggestTags($('#bulk-tag-input'),$('#bulk-tag-suggestions')));
$('#apply-bulk-tag').addEventListener('click',async()=>{ const raw=$('#bulk-tag-input').value.trim(); if(!raw)return; const canonical=state.tags.find(tag=>normalizedTag(tag)===normalizedTag(raw))||raw; const ids=[...state.selected]; await api('/api/bulk',{method:'POST',body:JSON.stringify({ids,action:'addTag',value:canonical})}); state.selected.clear(); closeDialogs(); await load(); showNotice(`${text(canonical)} added to ${ids.length} bookmarks.`); });

function askDelete(items){ state.pendingDelete=items; $('#confirm-heading').textContent=items.length===1?'Delete this bookmark permanently?':`Delete ${items.length} bookmarks permanently?`; $('#confirm-copy').textContent=items.length===1?`${items[0].title} will be removed for good. This cannot be undone.`:'The selected bookmarks will be removed for good. This cannot be undone.'; openDialog($('#confirm-dialog')); }
$('#confirm-delete').addEventListener('click',async()=>{ const ids=state.pendingDelete.map(item=>item.id); if(ids.length===1) await api(`/api/bookmarks/${ids[0]}`,{method:'DELETE'}); else await api('/api/bulk-delete',{method:'POST',body:JSON.stringify({ids})}); state.pendingDelete=[]; state.selected.clear(); closeDialogs(); await load(); showNotice(`${ids.length} bookmark${ids.length===1?'':'s'} deleted permanently.`); });

load().then(()=>$('#app').dataset.harnessReady='true').catch(error=>{ $('#first-empty').classList.add('show'); $('#first-empty').innerHTML=`<h2>Could not load the library</h2><p>${text(error.message)}</p>`; });
