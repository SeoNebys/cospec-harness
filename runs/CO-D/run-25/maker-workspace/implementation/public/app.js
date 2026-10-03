const $ = selector => document.querySelector(selector);
const api = async (path, options = {}) => {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw Object.assign(new Error(data?.error || 'Something went wrong'), { status: response.status, data });
  return data;
};
const escapeHtml = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const safeUrl = value => { try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) ? escapeHtml(url.toString()) : ''; } catch { return ''; } };
const hostOf = value => { try { return new URL(value).hostname.replace(/^www\./,''); } catch { return value; } };

function renderNote(markdown = '') {
  const inline = text => escapeHtml(text).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  let html = '', inList = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith('- ')) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(line.slice(2))}</li>`; }
    else { if (inList) { html += '</ul>'; inList = false; } if (line) html += `<p>${inline(line)}</p>`; }
  }
  return html + (inList ? '</ul>' : '');
}

function compileSearch(query) {
  const source = query.trim(), quoteCount = (source.match(/"/g) || []).length; let depth = 0, broken = false;
  for (const char of source) { if (char === '(') depth++; if (char === ')') depth--; if (depth < 0) broken = true; }
  if (source && (quoteCount % 2 || depth !== 0 || broken || /\b(and|or|not)\s*$/i.test(source))) return { incomplete:true };
  const rawTokens = [], matcher = /"([^"]*)"|#[\p{L}\p{N}_-]+|\(|\)|\b(?:and|or|not)\b|[^\s()]+/giu; let match;
  while ((match = matcher.exec(source))) {
    const raw = match[0], lower = raw.toLocaleLowerCase();
    if (raw.startsWith('"')) rawTokens.push({type:'phrase',value:match[1].toLocaleLowerCase()});
    else if (raw === '(') rawTokens.push({type:'open'}); else if (raw === ')') rawTokens.push({type:'close'});
    else if (['and','or','not'].includes(lower)) rawTokens.push({type:lower});
    else if (raw.startsWith('#')) rawTokens.push({type:'label',value:raw.slice(1).toLocaleLowerCase()});
    else rawTokens.push({type:'term',value:lower});
  }
  const tokens=[];
  for (const current of rawTokens) { const prior=tokens.at(-1), ends=prior&&['term','phrase','label','close'].includes(prior.type), starts=['term','phrase','label','open','not'].includes(current.type); if(ends&&starts)tokens.push({type:'and'});tokens.push(current); }
  let pos=0; const text=item=>[item.title,item.description,item.note,item.url].join(' ').toLocaleLowerCase();
  const primary=()=>{const token=tokens[pos++];if(!token)return()=>true;if(token.type==='open'){const inside=orExpr();if(tokens[pos]?.type==='close')pos++;return inside}if(token.type==='label')return item=>item.labels.some(label=>label.toLocaleLowerCase()===token.value);if(token.type==='term')return item=>text(item).includes(token.value);if(token.type==='phrase'){const escaped=token.value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),pattern=new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`,'iu');return item=>pattern.test(text(item))}return()=>true};
  const unary=()=>tokens[pos]?.type==='not'?(pos++,((right)=>item=>!right(item))(unary())):primary();
  const andExpr=()=>{let left=unary();while(tokens[pos]?.type==='and'){pos++;const prior=left,right=unary();left=item=>prior(item)&&right(item)}return left};
  const orExpr=()=>{let left=andExpr();while(tokens[pos]?.type==='or'){pos++;const prior=left,right=andExpr();left=item=>prior(item)||right(item)}return left};
  return { incomplete:false, test:orExpr() };
}

const state = { bookmarks:[], preferences:{sort:'recent'}, view:'all', label:'', query:'', editing:'', expanded:new Set(), labelDrafts:new Map(), editDrafts:new Map() };
const allLabels = () => [...new Set(state.bookmarks.flatMap(item => item.labels))].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
const toast = message => { const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),1800); };
const notice = (message, kind='') => { const el=$('#notice');el.innerHTML=message;el.classList.add('visible');el.dataset.kind=kind; };
const clearNotice = () => $('#notice').classList.remove('visible');

function selectedBookmarks() {
  let items=[...state.bookmarks];
  if(state.view==='later')items=items.filter(item=>item.readLater);
  if(state.label)items=items.filter(item=>item.labels.some(label=>label.toLowerCase()===state.label.toLowerCase()));
  const compiled=compileSearch(state.query);if(!compiled.incomplete&&state.query)items=items.filter(compiled.test);
  const order=state.preferences.sort;
  if(order==='oldest')items.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));else if(order==='az')items.sort((a,b)=>a.title.localeCompare(b.title,undefined,{sensitivity:'base'}));else if(order==='za')items.sort((a,b)=>b.title.localeCompare(a.title,undefined,{sensitivity:'base'}));else items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return {items,incomplete:compiled.incomplete};
}

function cardHtml(item) {
  const host=hostOf(item.url), editing=state.editing===item.id, expanded=state.expanded.has(item.id), longNote=item.note.length>220||item.note.split('\n').length>4;
  const preview=item.image?`<div class="preview"><img src="${safeUrl(item.image)}" alt=""></div>`:`<div class="preview">${escapeHtml(host.slice(0,2).toUpperCase())}</div>`;
  const icon=item.icon?`<img src="${safeUrl(item.icon)}" alt="">`:`<span class="fallback-icon">${escapeHtml(host[0]?.toUpperCase()||'↗')}</span>`;
  if(editing)return `<article class="card" data-id="${item.id}">${preview}<div class="card-body"><div class="source">${icon}${escapeHtml(host)}</div>${editFormHtml(item)}</div></article>`;
  return `<article class="card" data-id="${item.id}">${preview}<div class="card-body">
    <div class="source">${icon}${escapeHtml(host)}</div><div class="card-title-row"><h3><a href="${safeUrl(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h3><div class="card-actions"><button class="small-button" data-action="later">${item.readLater?'✓ Mark as read':'◷ Read later'}</button><button class="small-button" data-action="edit">Edit</button><button class="small-button" data-action="remove">Remove</button></div></div>
    ${item.description?`<p class="description">${escapeHtml(item.description)}</p>`:''}
    ${item.note?`<div class="personal-note ${longNote&&!expanded?'collapsed':''}">${renderNote(item.note)}</div>${longNote?`<button class="small-button note-toggle" data-action="note">${expanded?'Show less':'Show full note'}</button>`:''}`:''}
    ${item.labels.length?`<div class="labels">${item.labels.map(label=>`<button class="label-pill" data-action="label" data-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`).join('')}</div>`:''}
    <div class="meta">${item.readLater?'<span class="status-pill">◷ Read later</span>':''}<span class="url">${escapeHtml(item.url.replace(/^https?:\/\//,''))}</span></div>
  </div></article>`;
}

function editFormHtml(item) {
  const labels=state.labelDrafts.get(item.id)||[...item.labels];state.labelDrafts.set(item.id,labels);
  const draft=state.editDrafts.get(item.id)||{url:item.url,title:item.title,description:item.description,note:item.note};state.editDrafts.set(item.id,draft);
  return `<form class="edit-form" data-edit-form>
    <label>Web address<input name="url" type="url" required value="${escapeHtml(draft.url)}"></label>
    <label>Title<input name="title" value="${escapeHtml(draft.title)}"></label>
    <label>Description<textarea name="description" rows="3">${escapeHtml(draft.description)}</textarea></label>
    <label>Personal note<textarea name="note" rows="6" placeholder="Use **bold**, - bullets, and [links](https://…)">${escapeHtml(draft.note)}</textarea></label>
    <div class="label-editor"><label>Labels</label><div class="label-box">${labels.map((label,index)=>`<span class="edit-token">${escapeHtml(label)}<button type="button" data-action="remove-label" data-index="${index}" aria-label="Remove ${escapeHtml(label)}">×</button></span>`).join('')}<input data-label-input placeholder="Type a label and press Enter"></div><div class="suggestions" data-suggestions></div></div>
    <div class="edit-actions"><button type="button" class="small-button" data-action="cancel-edit">Cancel</button><button class="primary" type="submit">Save changes</button></div>
  </form>`;
}

function render() {
  const compiled=compileSearch(state.query);$('#searchHint').classList.toggle('visible',compiled.incomplete);if(compiled.incomplete)return;
  const {items}=selectedBookmarks();$('#bookmarkList').innerHTML=items.map(cardHtml).join('');
  const count=items.length;$('#count').textContent=`${count} bookmark${count===1?'':'s'}`;
  let title=state.view==='later'?'Read later':state.label?state.label:state.query?`Search: “${state.query}”`:'Recently saved';$('#listTitle').textContent=title;
  $('#clearLabel').classList.toggle('visible',Boolean(state.label));$('#clearLabel').textContent=state.label?`× ${state.label}`:'';
  const empty=$('#emptyState');empty.hidden=count!==0;if(!count){empty.innerHTML=state.query?'<h3>No bookmarks match this search</h3><p>Try a different word or clear the search to see everything.</p><button class="primary" data-empty-action="clear-search">Clear search</button>':state.view==='later'?'<h3>Nothing waiting to be read</h3><p>Bookmarks you mark for later will appear here.</p>':'<h3>Your collection is empty</h3><p>Your first saved page will appear here.</p>';}
  $('#labelNav').innerHTML=allLabels().map(label=>`<button data-nav-label="${escapeHtml(label)}"># ${escapeHtml(label)}</button>`).join('');
  document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.view===state.view));$('#sortSelect').value=state.preferences.sort;
  document.querySelectorAll('.source img').forEach(img=>{
    const fallback=()=>{const replacement=document.createElement('span');replacement.className='fallback-icon';replacement.textContent=(img.closest('.source')?.textContent.trim()[0]||'↗').toUpperCase();img.replaceWith(replacement);};
    img.addEventListener('error',fallback,{once:true});if(img.complete&&img.naturalWidth===0)fallback();
  });
}

async function load() { const data=await api('/api/state');state.bookmarks=data.bookmarks;state.preferences=data.preferences||{sort:'recent'};render();$('#app').setAttribute('data-harness-ready','true'); }

$('#saveForm').addEventListener('submit',async event=>{event.preventDefault();clearNotice();const input=$('#urlInput'),button=event.currentTarget.querySelector('button');button.disabled=true;button.textContent='Getting page details…';try{const item=await api('/api/bookmarks',{method:'POST',body:JSON.stringify({url:input.value})});state.bookmarks.push(item);input.value='';state.view='all';state.label='';state.query='';$('#searchInput').value='';render();if(item.limited)notice('<strong>Saved with limited page details.</strong> The page did not provide complete details; you can edit the bookmark at any time.');else toast('Bookmark saved');}catch(error){if(error.status===409){notice('<strong>This bookmark is already saved.</strong> Your existing bookmark is highlighted below.');state.view='all';state.label='';state.query='';render();requestAnimationFrame(()=>{const card=document.querySelector(`[data-id="${error.data.existingId}"]`);card?.classList.add('highlight');card?.scrollIntoView({behavior:'smooth',block:'center'});});}else notice(`<strong>Could not save this address.</strong> ${escapeHtml(error.message)}`);}finally{button.disabled=false;button.textContent='Save bookmark';}});

$('#searchInput').addEventListener('input',event=>{state.query=event.target.value;$('#clearSearch').classList.toggle('visible',Boolean(state.query));state.label='';render();});
$('#clearSearch').addEventListener('click',()=>{state.query='';$('#searchInput').value='';$('#clearSearch').classList.remove('visible');render();$('#searchInput').focus();});
$('#clearLabel').addEventListener('click',()=>{state.label='';render();});
$('#sortSelect').addEventListener('change',async event=>{state.preferences.sort=event.target.value;render();await api('/api/preferences',{method:'PUT',body:JSON.stringify({sort:event.target.value})});});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();state.view=button.dataset.view;state.label='';state.query='';$('#searchInput').value='';render();}));
$('#labelNav').addEventListener('click',event=>{const button=event.target.closest('[data-nav-label]');if(!button)return;state.view='all';state.label=button.dataset.navLabel;state.query='';$('#searchInput').value='';render();});

$('#emptyState').addEventListener('click',event=>{if(event.target.dataset.emptyAction==='clear-search')$('#clearSearch').click();});
$('#bookmarkList').addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button)return;const card=button.closest('[data-id]'),item=state.bookmarks.find(entry=>entry.id===card.dataset.id);if(!item)return;
  if(button.dataset.action==='edit'){state.editing=item.id;state.labelDrafts.set(item.id,[...item.labels]);state.editDrafts.set(item.id,{url:item.url,title:item.title,description:item.description,note:item.note});render();}
  if(button.dataset.action==='cancel-edit'){state.editing='';state.labelDrafts.delete(item.id);state.editDrafts.delete(item.id);render();}
  if(button.dataset.action==='note'){state.expanded.has(item.id)?state.expanded.delete(item.id):state.expanded.add(item.id);render();}
  if(button.dataset.action==='label'){state.view='all';state.label=button.dataset.label;state.query='';$('#searchInput').value='';render();}
  if(button.dataset.action==='later'){const updated=await api(`/api/bookmarks/${item.id}`,{method:'PATCH',body:JSON.stringify({readLater:!item.readLater})});Object.assign(item,updated);render();toast(item.readLater?'Added to Read later':'Marked as read');}
  if(button.dataset.action==='remove'){const dialog=$('#deleteDialog');dialog.showModal();dialog.addEventListener('close',async function handler(){dialog.removeEventListener('close',handler);if(dialog.returnValue!=='confirm')return;await api(`/api/bookmarks/${item.id}`,{method:'DELETE'});state.bookmarks=state.bookmarks.filter(entry=>entry.id!==item.id);render();toast('Bookmark removed');});}
  if(button.dataset.action==='remove-label'){state.labelDrafts.get(item.id).splice(Number(button.dataset.index),1);render();}
});

$('#bookmarkList').addEventListener('input',event=>{const card=event.target.closest('[data-id]');if(card&&event.target.name)state.editDrafts.get(card.dataset.id)[event.target.name]=event.target.value;if(!event.target.matches('[data-label-input]'))return;const itemId=card.dataset.id,query=event.target.value.trim().toLowerCase(),used=state.labelDrafts.get(itemId);const matches=allLabels().filter(label=>query&&label.toLowerCase().startsWith(query)&&!used.some(value=>value.toLowerCase()===label.toLowerCase()));const box=event.target.closest('.label-editor').querySelector('[data-suggestions]');box.innerHTML=matches.map(label=>`<button type="button" data-suggest-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`).join('');box.classList.toggle('visible',matches.length>0);});
$('#bookmarkList').addEventListener('keydown',event=>{if(!event.target.matches('[data-label-input]')||event.key!=='Enter'||!event.target.value.trim())return;event.preventDefault();addDraftLabel(event.target.closest('[data-id]').dataset.id,event.target.value);});
$('#bookmarkList').addEventListener('click',event=>{const suggestion=event.target.closest('[data-suggest-label]');if(!suggestion)return;addDraftLabel(suggestion.closest('[data-id]').dataset.id,suggestion.dataset.suggestLabel);});
function addDraftLabel(itemId,value){const existing=allLabels().find(label=>label.toLowerCase()===value.trim().toLowerCase())||value.trim().replace(/\s+/g,' '),draft=state.labelDrafts.get(itemId);if(existing&&!draft.some(label=>label.toLowerCase()===existing.toLowerCase()))draft.push(existing);render();requestAnimationFrame(()=>document.querySelector(`[data-id="${itemId}"] [data-label-input]`)?.focus());}

const dialogChoice=dialog=>new Promise(resolve=>{dialog.showModal();dialog.addEventListener('close',function handler(){dialog.removeEventListener('close',handler);resolve(dialog.returnValue);});});
$('#bookmarkList').addEventListener('submit',async event=>{
  if(!event.target.matches('[data-edit-form]'))return;event.preventDefault();const card=event.target.closest('[data-id]'),item=state.bookmarks.find(entry=>entry.id===card.dataset.id),data=new FormData(event.target),nextUrl=data.get('url'),changedUrl=nextUrl!==item.url;let refreshDetails=changedUrl;
  if(changedUrl&&(item.titleEdited||item.descriptionEdited)){const choice=await dialogChoice($('#refreshDialog'));if(!['keep','refresh'].includes(choice))return;refreshDetails=choice==='refresh';}
  const payload={url:nextUrl,note:data.get('note'),labels:state.labelDrafts.get(item.id),refreshDetails};
  if(!changedUrl||!refreshDetails){payload.title=data.get('title');payload.description=data.get('description');}
  try{const updated=await api(`/api/bookmarks/${item.id}`,{method:'PATCH',body:JSON.stringify(payload)});Object.assign(item,updated);state.editing='';state.labelDrafts.delete(item.id);state.editDrafts.delete(item.id);render();toast('Changes saved');}catch(error){notice(`<strong>Could not save changes.</strong> ${escapeHtml(error.message)}`);}
});

load().catch(error=>{notice(`<strong>Could not load your collection.</strong> ${escapeHtml(error.message)}`);$('#app').setAttribute('data-harness-ready','true');});
