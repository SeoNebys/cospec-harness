const $ = selector => document.querySelector(selector);
const state={ bookmarks:[], tags:[], chosenTags:[], editTags:[], view:'all', query:'', tag:'', pendingUrl:'', metadataTimer:null };
const escapeHtml=value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

async function request(url, options={}) {
  const response=await fetch(url,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});
  const data=await response.json().catch(()=>({error:'Something went wrong.'}));
  if (!response.ok) { const error=new Error(data.error || 'Something went wrong.'); error.status=response.status; error.code=data.code; throw error; }
  return data;
}
function message(text,type='ok') { const element=$('#global-message'); element.textContent=text; element.className=`global-message ${type==='error'?'error':''}`; element.hidden=!text; if(text) setTimeout(()=>{ if(element.textContent===text) element.hidden=true; },4500); }
function normalizeTag(value){ return value.trim().replace(/\s+/g,' ').toLocaleLowerCase(); }

function tagEditor({input,chosen,suggestions,getTags,setTags}) {
  const draw=()=>{ chosen.innerHTML=getTags().map(tag=>`<span class="tag-chip">${escapeHtml(tag)}<button type="button" data-remove="${escapeHtml(tag)}" aria-label="Remove ${escapeHtml(tag)}">×</button></span>`).join(''); };
  const add=value=>{ const tag=normalizeTag(value); if(tag && !getTags().includes(tag)) setTags([...getTags(),tag]); input.value=''; suggestions.hidden=true; draw(); };
  input.addEventListener('input',()=>{ const typed=normalizeTag(input.value); const matches=state.tags.filter(tag=>typed && tag.startsWith(typed) && !getTags().includes(tag)).slice(0,5); suggestions.innerHTML=matches.map(tag=>`<button type="button" data-suggestion="${escapeHtml(tag)}"><span>${escapeHtml(tag)}</span><small>Existing tag · Enter ↵</small></button>`).join(''); suggestions.hidden=!matches.length; });
  input.addEventListener('keydown',event=>{ if(event.key==='Enter' && input.value.trim()){ event.preventDefault(); const first=suggestions.querySelector('[data-suggestion]'); add(first?.dataset.suggestion || input.value); } });
  suggestions.addEventListener('click',event=>{ const button=event.target.closest('[data-suggestion]'); if(button) add(button.dataset.suggestion); });
  chosen.addEventListener('click',event=>{ const button=event.target.closest('[data-remove]'); if(button){ setTags(getTags().filter(tag=>tag!==button.dataset.remove)); draw(); } });
  return {draw};
}
const saveTagEditor=tagEditor({ input:$('#tag-input'),chosen:$('#chosen-tags'),suggestions:$('#tag-suggestions'),getTags:()=>state.chosenTags,setTags:tags=>state.chosenTags=tags });
const editTagEditor=tagEditor({ input:$('#edit-tag-input'),chosen:$('#edit-chosen-tags'),suggestions:$('#edit-tag-suggestions'),getTags:()=>state.editTags,setTags:tags=>state.editTags=tags });

async function load() {
  const params=new URLSearchParams(); if(state.query) params.set('query',state.query); if(state.tag) params.set('tag',state.tag); if(state.view==='later') params.set('readLater','true');
  try {
    const [bookmarks,tags]=await Promise.all([request(`/api/bookmarks?${params}`),request('/api/tags')]);
    state.bookmarks=bookmarks; state.tags=tags; render();
    const all=await request('/api/bookmarks'); $('#later-count').textContent=all.filter(item=>item.readLater).length || '';
    $('#app').setAttribute('data-harness-ready','true'); $('#app').setAttribute('aria-busy','false');
  } catch(error) { $('#bookmark-list').innerHTML=`<div class="empty-state"><h2>We couldn’t load your bookmarks</h2><p>${escapeHtml(error.message)}</p><button data-retry>Try again</button></div>`; }
}
function render() {
  $('#page-title').textContent=state.view==='later'?'Read later':'All bookmarks';
  $('#eyebrow').textContent=state.view==='later'?'SET ASIDE':'LIBRARY';
  $('#bookmark-count').textContent=`${state.bookmarks.length} bookmark${state.bookmarks.length===1?'':'s'}`;
  $('#capture').hidden=state.view==='later';
  document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.view===state.view));
  const filter=$('#active-filter'); filter.hidden=!state.tag; filter.querySelector('strong').textContent=state.tag;
  if(!state.bookmarks.length) {
    let title='No bookmarks yet',copy='Paste a web address above to save your first one.',action='';
    if(state.query||state.tag){ title='No bookmarks match your search'; copy='Try changing or clearing your search.'; }
    else if(state.view==='later'){ title='Nothing saved for later yet'; copy='Use the star on any bookmark to add it here.'; action='<button data-view-all>Browse all bookmarks</button>'; }
    $('#bookmark-list').innerHTML=`<div class="empty-state"><div class="empty-icon">${state.view==='later'?'☆':'⌕'}</div><h2>${title}</h2><p>${copy}</p>${action}</div>`; return;
  }
  $('#bookmark-list').innerHTML=state.bookmarks.map(item=>`<article class="bookmark-card" data-id="${item.id}"><button class="star ${item.readLater?'marked':''}" data-star aria-label="${item.readLater?'Remove from':'Add to'} read later">${item.readLater?'★':'☆'}</button><div class="bookmark-main"><a class="bookmark-title" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>${item.description?`<p class="bookmark-description">${escapeHtml(item.description)}</p>`:''}<span class="site">${escapeHtml(new URL(item.url).hostname.replace(/^www\./,''))}</span><div class="card-tags">${item.tags.map(tag=>`<button class="filter-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div></div><div class="card-actions"><button data-edit>Edit</button><button class="delete" data-delete>Delete</button></div></article>`).join('');
}

function resetCapture(){ clearTimeout(state.metadataTimer); state.pendingUrl=''; state.chosenTags=[]; $('#url-input').value=''; $('#url-message').textContent=''; $('#url-message').className='field-message'; $('#save-form').hidden=true; $('#fetch-button').disabled=true; $('#fetch-button').textContent='Get details'; saveTagEditor.draw(); }
async function getDetails(){
  const input=$('#url-input').value.trim(); if(!input)return;
  $('#url-message').className='field-message'; $('#url-message').textContent='Getting page details…'; $('#fetch-button').disabled=true;
  try {
    const result=await request('/api/metadata',{method:'POST',body:JSON.stringify({url:input})});
    if(result.duplicate){ $('#url-message').textContent='This address is already saved. Editing the existing bookmark.'; openEdit(result.bookmark); return; }
    state.pendingUrl=result.url; $('#title-input').value=result.title; $('#description-input').value=result.description; $('#fetch-notice').hidden=result.fetched; $('#fetch-notice').textContent=result.fetched?'':'We couldn’t get this page’s details. You can edit them below and still save the link.'; $('#save-form').hidden=false; $('#url-message').textContent=result.fetched?'Page details found. Review them before saving.':'Page details weren’t available, but this link can still be saved.';
  } catch(error){ $('#url-message').textContent=error.message; $('#url-message').className='field-message error'; $('#save-form').hidden=true; }
  finally { $('#fetch-button').disabled=false; }
}
$('#url-input').addEventListener('input',()=>{ clearTimeout(state.metadataTimer); $('#save-form').hidden=true; const value=$('#url-input').value.trim(); try { const parsed=new URL(value); if(!['http:','https:'].includes(parsed.protocol)) throw new Error(); $('#url-message').textContent=''; $('#url-message').className='field-message'; $('#fetch-button').disabled=false; state.metadataTimer=setTimeout(getDetails,550); } catch { $('#fetch-button').disabled=true; $('#url-message').textContent=value?'That doesn’t look like a complete web address.':''; $('#url-message').className=`field-message ${value?'error':''}`; } });
$('#fetch-button').addEventListener('click',getDetails); $('#cancel-save').addEventListener('click',resetCapture);
$('#save-form').addEventListener('submit',async event=>{ event.preventDefault(); const button=$('#save-button'); button.disabled=true; button.textContent='Saving…'; try { await request('/api/bookmarks',{method:'POST',body:JSON.stringify({url:state.pendingUrl,title:$('#title-input').value,description:$('#description-input').value,tags:state.chosenTags})}); resetCapture(); message('Bookmark saved.'); await load(); } catch(error){ $('#url-message').textContent=`We couldn’t save this bookmark. Your details are still here — ${error.message}`; $('#url-message').className='field-message error'; button.textContent='Try again'; } finally { button.disabled=false; if(button.textContent==='Saving…')button.textContent='Save bookmark'; } });

function openEdit(item){ state.editTags=[...item.tags]; $('#edit-id').value=item.id; $('#edit-url').value=item.url; $('#edit-title').value=item.title; $('#edit-description').value=item.description; $('#edit-error').hidden=true; editTagEditor.draw(); $('#edit-dialog').showModal(); }
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
$('#edit-form').addEventListener('submit',async event=>{ event.preventDefault(); const id=$('#edit-id').value; try { await request(`/api/bookmarks/${id}`,{method:'PUT',body:JSON.stringify({url:$('#edit-url').value,title:$('#edit-title').value,description:$('#edit-description').value,tags:state.editTags})}); $('#edit-dialog').close(); resetCapture(); message('Bookmark updated.'); await load(); } catch(error){ $('#edit-error').textContent=error.message; $('#edit-error').hidden=false; } });
$('#delete-form').addEventListener('submit',async event=>{ event.preventDefault(); const id=$('#delete-id').value; try { await request(`/api/bookmarks/${id}`,{method:'DELETE'}); $('#delete-dialog').close(); message('Bookmark deleted.'); await load(); } catch(error){ message(error.message,'error'); } });

document.addEventListener('click',async event=>{
  const nav=event.target.closest('[data-view]'); if(nav){ state.view=nav.dataset.view; state.query=''; state.tag=''; $('#search-input').value=''; await load(); return; }
  if(event.target.closest('[data-view-all]')){ state.view='all'; await load(); return; }
  if(event.target.closest('[data-retry]')){ await load(); return; }
  const card=event.target.closest('.bookmark-card'); if(!card)return; const item=state.bookmarks.find(entry=>entry.id===card.dataset.id); if(!item)return;
  if(event.target.closest('[data-star]')){ try { const changed=await request(`/api/bookmarks/${item.id}/read-later`,{method:'PATCH'}); message(changed.readLater?'Added to Read later.':'Removed from Read later.'); await load(); } catch(error){message(error.message,'error');} }
  else if(event.target.closest('[data-tag]')){ state.tag=event.target.closest('[data-tag]').dataset.tag; state.query=''; $('#search-input').value=''; await load(); }
  else if(event.target.closest('[data-edit]')) openEdit(item);
  else if(event.target.closest('[data-delete]')){ $('#delete-id').value=item.id; $('#delete-copy').textContent=`This will permanently remove “${item.title}” from your bookmarks.`; $('#delete-dialog').showModal(); }
});
$('#active-filter button').addEventListener('click',async()=>{state.tag='';await load();});
let searchTimer; $('#search-input').addEventListener('input',()=>{ clearTimeout(searchTimer); searchTimer=setTimeout(async()=>{state.query=$('#search-input').value;state.tag='';await load();},180); });

await load();
