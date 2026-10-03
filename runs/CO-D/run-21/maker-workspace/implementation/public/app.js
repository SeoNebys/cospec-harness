'use strict';
// Bookmarks SPA. Talks to the REST API; persistence and preservation live on the
// server. Search/sort/paging/selection are computed here over the fetched state.

const $ = s => document.querySelector(s);

// ---------- small helpers ----------
function escHtml(s){ return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function escAttr(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function hashHue(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))%360; } return h; }
function hostOf(url){ try{ return new URL(url).hostname.replace(/^www\./,''); }catch(e){ return url||'?'; } }
function isPdf(url){ return /\.pdf($|\?|#)/i.test(url||''); }
function normalizeUrl(url){ try{ const u=new URL(url); return u.hostname.replace(/^www\./i,'').toLowerCase()+u.pathname.replace(/\/+$/,'')+u.search; }catch(e){ return String(url||'').trim().replace(/\/+$/,''); } }
// offline-safe generated icon/preview (og:image would need network)
function faviconFor(url){ const host=hostOf(url); const letter=(host[0]||'?').toUpperCase(); const hue=hashHue(host);
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="6" fill="hsl('+hue+',60%,50%)"/><text x="16" y="22" font-size="18" font-family="Arial" fill="#fff" text-anchor="middle">'+letter+'</text></svg>';
  return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg); }
function previewFor(url,title){ const host=hostOf(url); const hue=hashHue(host); const t=(title||host).slice(0,28);
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl('+hue+',55%,55%)"/><stop offset="1" stop-color="hsl('+((hue+40)%360)+',55%,40%)"/></linearGradient></defs><rect width="240" height="160" fill="url(#g)"/><text x="16" y="150" font-size="13" font-family="Arial" fill="rgba(255,255,255,.85)">'+escHtml(host)+'</text><text x="16" y="80" font-size="17" font-family="Arial" fill="#fff">'+escHtml(t)+'</text></svg>';
  return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg); }

function formatNote(txt){
  const lines=String(txt||'').split('\n'); let html=''; let inList=false;
  const inline=s=>{ let o=escHtml(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
    o=o.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(m,tx,u)=>'<a href="'+escAttr(u)+'" target="_blank" rel="noopener noreferrer">'+tx+'</a>'); return o; };
  for(const raw of lines){ const l=raw.trim();
    if(l.startsWith('- ')){ if(!inList){html+='<ul>';inList=true;} html+='<li>'+inline(l.slice(2))+'</li>'; }
    else { if(inList){html+='</ul>';inList=false;} if(l) html+='<p>'+inline(l)+'</p>'; } }
  if(inList) html+='</ul>'; return html;
}
function noteNeedsClamp(note){ return String(note||'').includes('\n') || String(note||'').length>140; }

// ---------- search query language ----------
function tokenize(q){
  const toks=[]; let i=0;
  while(i<q.length){ const c=q[i];
    if(/\s/.test(c)){ i++; continue; }
    if(c==='('){ toks.push({t:'('}); i++; continue; }
    if(c===')'){ toks.push({t:')'}); i++; continue; }
    if(c==='"'){ let j=i+1,s=''; while(j<q.length&&q[j]!=='"'){ s+=q[j]; j++; } toks.push({t:'op',kind:'phrase',v:s}); i=(j<q.length)?j+1:j; continue; }
    let j=i,s=''; while(j<q.length && !/[\s()]/.test(q[j])){ s+=q[j]; j++; } i=j;
    if(/^(and|or|not)$/i.test(s)){ toks.push({t:s.toLowerCase()}); continue; }
    if(s[0]==='#'){ toks.push({t:'op',kind:'tag',v:s.slice(1)}); continue; }
    toks.push({t:'op',kind:'word',v:s});
  }
  return toks;
}
function parseQuery(q){
  const toks=tokenize(q); let p=0; const peek=()=>toks[p]; const next=()=>toks[p++];
  function parseOr(){ let l=parseAnd(); while(peek()&&peek().t==='or'){ next(); const r=parseAnd(); const a=l,b=r; l=x=>a(x)||b(x); } return l; }
  function parseAnd(){ let l=parseNot(); for(;;){ const tk=peek(); if(!tk) break;
      if(tk.t==='and'){ next(); const r=parseNot(); const a=l,b=r; l=x=>a(x)&&b(x); continue; }
      if(tk.t==='op'||tk.t==='('||tk.t==='not'){ const r=parseNot(); const a=l,b=r; l=x=>a(x)&&b(x); continue; }
      break; } return l; }
  function parseNot(){ if(peek()&&peek().t==='not'){ next(); const r=parseNot(); return x=>!r(x); } return parsePrimary(); }
  function parsePrimary(){ const tk=peek(); if(!tk) return ()=>true;
    if(tk.t==='('){ next(); const e=parseOr(); if(peek()&&peek().t===')') next(); return e; }
    if(tk.t==='op'){ next(); return operand(tk); } next(); return ()=>true; }
  function operand(tk){ const v=(tk.v||'').toLowerCase();
    if(tk.kind==='tag') return b=> (b.tags||[]).some(t=>t.toLowerCase()===v);
    return b=> [b.title,b.description,b.note,b.url,(b.tags||[]).join(' ')].some(f=>String(f||'').toLowerCase().includes(v)); }
  return parseOr();
}
function matches(b,q){ if(!q||!q.trim()) return true;
  try{ return parseQuery(q)(b); }
  catch(e){ const s=q.toLowerCase(); return [b.title,b.description,b.note,b.url,(b.tags||[]).join(' ')].some(f=>String(f||'').toLowerCase().includes(s)); } }

// ---------- state ----------
let state = { bookmarks:[], savedSearches:[], prefs:{ sort:'new', pageSize:20, textSize:'normal' } };
let sortBy='new', statusFilter='all', locationFilter='active';
let pageSize=20, shownN=20;
const selected=new Set(); const expanded=new Set();
let draft=null, dupOf=null, editingId=null;

function allTags(){ const s=new Set(); state.bookmarks.forEach(b=>(b.tags||[]).forEach(t=>s.add(t))); return [...s].sort((a,b)=>a.localeCompare(b)); }
function canonTag(t){ const hit=allTags().find(e=>e.toLowerCase()===String(t).toLowerCase()); return hit||String(t).trim(); }

// ---------- api ----------
async function api(method,url,body){
  const opt={ method, headers:{} };
  if(body!==undefined){ opt.headers['Content-Type']='application/json'; opt.body=JSON.stringify(body); }
  const r=await fetch(url,opt); let data=null; try{ data=await r.json(); }catch(e){}
  return { ok:r.ok, status:r.status, data };
}
async function refresh(){ const r=await api('GET','/api/state'); if(r.ok){ state=r.data; } }

function flash(msg,isErr){ $("#flash").innerHTML='<div class="flash'+(isErr?' err':'')+'">'+escHtml(msg)+'</div>';
  clearTimeout(flash._t); flash._t=setTimeout(()=>{ $("#flash").innerHTML=''; },4500); }

// ---------- preferences ----------
function applyPrefs(){ sortBy=state.prefs.sort||'new'; pageSize=state.prefs.pageSize||20; shownN=pageSize;
  const se=$("#sort"); if(se) se.value=sortBy;
  const zoom=state.prefs.textSize==='small'?0.9:state.prefs.textSize==='large'?1.15:1;
  document.querySelector('main').style.zoom=zoom; }

// ---------- save flow ----------
function wireTagSuggest(field, box){
  function draw(){ const val=field.value; const tokens=val.split(','); const cur=tokens[tokens.length-1].trim().toLowerCase();
    const already=tokens.slice(0,-1).map(t=>t.trim().toLowerCase());
    const cand=allTags().filter(t=> !already.includes(t.toLowerCase()) && (cur===''?true:t.toLowerCase().includes(cur)) && t.toLowerCase()!==cur);
    if(!cand.length){ box.innerHTML=''; return; }
    box.innerHTML='<span class="lbl">Tags you already use:</span>'+cand.slice(0,8).map(t=>'<button type="button" class="stag" data-t="'+escAttr(t)+'">'+escHtml(t)+'</button>').join('');
    box.querySelectorAll('.stag').forEach(btn=>btn.onclick=()=>{ tokens[tokens.length-1]=' '+btn.dataset.t; field.value=tokens.join(',').replace(/^ /,'')+', '; field.focus(); draw(); }); }
  field.addEventListener('input',draw); field.addEventListener('focus',draw); draw();
}
function renderSaveArea(){
  const area=$("#saveArea");
  if(dupOf){ area.innerHTML='<div class="warn">You already saved this address as <b>'+escHtml(dupOf.title)+'</b>. Saving again would create a duplicate.'
      +'<div class="row" style="margin-top:10px"><button class="secondary" id="viewDup">Show the one I already have</button><button class="secondary" id="cancelDup">Cancel</button></div></div>';
    $("#viewDup").onclick=()=>{ const t=dupOf; dupOf=null; $("#url").value=''; renderSaveArea(); flash('Opening the bookmark you already had, so you can update it.'); openEdit(t.id); };
    $("#cancelDup").onclick=()=>{ dupOf=null; $("#url").value=''; renderSaveArea(); }; return; }
  if(!draft){ area.innerHTML=''; return; }
  const banner=(draft.readable===false)
    ? '<div class="warn" style="margin-top:12px">We couldn\'t read this page (it may be unavailable, private, or blocked). You can still save it — fill in the details yourself. The page was <b>not preserved</b>; you can retry later.</div>'
    : '<div class="hint" style="margin-top:12px">We filled in the title and description for you — edit anything that\'s off. A copy of the page is kept automatically.</div>';
  area.innerHTML=banner
    +'<div class="metaprev"><img class="fav" src="'+faviconFor(draft.url)+'"><div class="pv"><img src="'+previewFor(draft.url,draft.title)+'"></div><span class="hint">Icon &amp; preview</span></div>'
    +'<label>Title</label><input type="text" id="dTitle" value="'+escAttr(draft.title)+'">'
    +'<label>Description</label><textarea id="dDesc">'+escHtml(draft.description)+'</textarea>'
    +'<label>Tags (comma separated)</label><input type="text" id="dTags" placeholder="e.g. javascript, reading">'
    +'<div class="suggest" id="tagSuggest"></div>'
    +'<label>Your note (why you saved it)</label><textarea id="dNote" placeholder="A note to your future self… **bold**, - bullets, [links](https://…)"></textarea>'
    +'<label style="display:flex;align-items:center;gap:8px;margin-top:12px;color:#111;font-size:14px"><input type="checkbox" id="dReadLater" checked style="width:auto"> Read later (leave unread)</label>'
    +'<div class="hint">Uncheck to save it as already read.</div>'
    +(draft.readable===false?'':'<label style="display:flex;align-items:center;gap:8px;margin-top:10px;color:#111;font-size:14px"><input type="checkbox" id="dArchiveOrg" style="width:auto"> Also save a copy to the Internet Archive</label>')
    +'<div class="row" style="margin-top:12px"><button id="confirmSave">Add to my bookmarks</button><button class="secondary" id="cancelSave">Cancel</button></div>';
  $("#confirmSave").onclick=confirmSave;
  $("#cancelSave").onclick=()=>{ draft=null; $("#url").value=''; renderSaveArea(); };
  wireTagSuggest($("#dTags"), $("#tagSuggest"));
}
async function startSave(){
  const url=$("#url").value.trim(); if(!url) return; dupOf=null; draft=null;
  const existing=state.bookmarks.find(b=>normalizeUrl(b.url)===normalizeUrl(url));
  if(existing){ dupOf=existing; renderSaveArea(); return; }
  $("#saveArea").innerHTML='<div class="spinner" style="margin-top:12px">Looking up the page…</div>';
  const r=await api('POST','/api/preview',{url});
  const meta=r.ok?r.data:{readable:false,title:'',description:''};
  draft={ url, title:meta.title||'', description:meta.description||'', readable:meta.readable };
  renderSaveArea();
}
async function confirmSave(){
  const tags=$("#dTags").value.split(',').map(t=>t.trim()).filter(Boolean);
  const body={ url:draft.url, title:$("#dTitle").value.trim(), description:$("#dDesc").value.trim(),
    tags, note:$("#dNote").value.trim(), read: !$("#dReadLater").checked,
    archiveOrg: $("#dArchiveOrg")? $("#dArchiveOrg").checked : false };
  $("#confirmSave").disabled=true;
  const r=await api('POST','/api/bookmarks',body);
  if(r.status===409){ dupOf=r.data.existing; renderSaveArea(); return; }
  draft=null; $("#url").value=''; renderSaveArea();
  await refresh();
  if(r.data && r.data.archiveError) flash('Saved. (Couldn\'t reach the Internet Archive: '+r.data.archiveError+')', true);
  else flash('Saved. It\'s in your list below.');
  const id=r.data && r.data.bookmark && r.data.bookmark.id; render(); if(id) jumpTo(id);
}

// ---------- edit ----------
function editFormHtml(b){
  return '<div class="bm" id="bm-'+b.id+'" style="display:block">'
    +'<div class="hint">Editing this bookmark — change anything, then save.</div>'
    +'<label>Address</label><input type="url" id="eUrl" value="'+escAttr(b.url)+'"><div id="eDupWarn"></div>'
    +'<label>Title</label><input type="text" id="eTitle" value="'+escAttr(b.title)+'">'
    +'<label>Description</label><textarea id="eDesc">'+escHtml(b.description||'')+'</textarea>'
    +'<label>Tags (comma separated)</label><input type="text" id="eTags" value="'+escAttr((b.tags||[]).join(', '))+'"><div class="suggest" id="eTagSuggest"></div>'
    +'<label>Your note</label><textarea id="eNote" style="min-height:110px">'+escHtml(b.note||'')+'</textarea>'
    +'<div class="hint">Supports **bold**, - bullets, and [links](https://…).</div>'
    +'<div class="row" style="margin-top:12px"><button id="eSave">Save changes</button><button class="secondary" id="eCancel">Cancel</button></div></div>';
}
function wireEditForm(){ if(editingId==null) return; const f=$("#eTags"); if(!f) return;
  wireTagSuggest(f,$("#eTagSuggest")); $("#eCancel").onclick=()=>{ editingId=null; render(); }; $("#eSave").onclick=saveEdit; }
function openEdit(id){ editingId=id; render(); setTimeout(()=>{ const el=document.getElementById('bm-'+id); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); const t=$("#eTitle"); if(t) t.focus(); } },60); }
async function saveEdit(){
  const id=editingId; const patch={ url:$("#eUrl").value.trim(), title:$("#eTitle").value.trim(), description:$("#eDesc").value.trim(),
    tags:$("#eTags").value.split(',').map(t=>t.trim()).filter(Boolean), note:$("#eNote").value.trim() };
  const r=await api('PATCH','/api/bookmarks/'+id,patch);
  if(r.status===409){ $("#eDupWarn").innerHTML='<div class="warn">That address is already saved as <b>'+escHtml(r.data.existing.title)+'</b>. Two bookmarks can\'t share the same address.</div>'; return; }
  editingId=null; await refresh(); flash('Changes saved.'); render(); jumpTo(id);
}

// ---------- actions ----------
async function toggleRead(id){ const b=state.bookmarks.find(x=>x.id===id); if(!b) return; await api('PATCH','/api/bookmarks/'+id,{read:!b.read}); await refresh(); render(); }
async function setArchived(id,val){ await api('PATCH','/api/bookmarks/'+id,{archived:val}); await refresh(); flash(val?'Archived. Find it under View → Archived.':'Restored to your active bookmarks.'); render(); }
async function del(id){ const b=state.bookmarks.find(x=>x.id===id); if(!b) return;
  if(!confirm('Permanently delete "'+b.title+'"?\nThis cannot be undone (and removes its saved copy).')) return;
  await api('DELETE','/api/bookmarks/'+id); await refresh(); flash('Permanently deleted.'); render(); }
async function retry(id){ flash('Trying to read the page again…'); const r=await api('POST','/api/bookmarks/'+id+'/retry');
  await refresh(); if(r.data && r.data.readable===false) flash('Still couldn\'t read the page — try again later.',true); else flash('Read the page, collected details, and saved a copy.'); render(); jumpTo(id); }
async function sendArchive(id){ flash('Submitting to the Internet Archive…'); const r=await api('POST','/api/bookmarks/'+id+'/archiveorg');
  if(!r.ok){ flash('Couldn\'t reach the Internet Archive right now.',true); return; } await refresh(); flash('Also saved to the Internet Archive.'); render(); }
function openCopy(id){ window.open('/api/bookmarks/'+id+'/copy','_blank','noopener'); }

function jumpTo(id){ setTimeout(()=>{ const el=document.getElementById('bm-'+id); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.classList.add('highlight'); setTimeout(()=>el.classList.remove('highlight'),1500);} },60); }

// ---------- preservation line ----------
function preservedLineHtml(b){ const p=b.preserved; if(!p) return '';
  if(p.status==='saved'){ const when=p.savedAt?new Date(p.savedAt).toLocaleDateString():''; const label=p.kind==='pdf'?'Saved PDF':'Saved copy';
    return '<div class="preserved"><span class="okdot"></span><button class="linklike savedCopyBtn" data-id="'+b.id+'">'+label+(when?' · '+when:'')+'</button>'
      +(p.archiveUrl?' · <a href="'+escAttr(p.archiveUrl)+'" target="_blank" rel="noopener">Internet Archive copy</a>':' · <button class="linklike toArchiveBtn" data-id="'+b.id+'">Send to Internet Archive</button>')+'</div>'; }
  return '<div class="preserved"><span class="faildot"></span>No saved copy yet</div>'; }

// ---------- render ----------
function computeMatched(){
  const q=$("#search").value.trim();
  let m=state.bookmarks.filter(b=>matches(b,q))
    .filter(b=> locationFilter==='archived'? !!b.archived : !b.archived)
    .filter(b=> statusFilter==='all'?true:(statusFilter==='unread'? !b.read : !!b.read));
  const cmp={ new:(a,b)=>b.createdAt-a.createdAt, old:(a,b)=>a.createdAt-b.createdAt, az:(a,b)=>String(a.title).localeCompare(b.title), za:(a,b)=>String(b.title).localeCompare(a.title) }[sortBy];
  return m.slice().sort(cmp);
}
function render(){
  const q=$("#search").value.trim();
  const matched=computeMatched();
  $("#count").textContent = matched.length+(matched.length===1?' bookmark':' bookmarks')+(q?' matching "'+q+'"':'');
  $("#clearSearch").style.display = q?'':'none';
  const list=$("#list");
  if(!matched.length){ list.innerHTML='<div class="empty">'+(q?'No bookmarks match "'+escHtml(q)+'".':'No bookmarks yet — save your first link above.<br><button class="linklike" id="emptyImport" style="font-size:13px;margin-top:6px">Or import your existing browser bookmarks</button>')+'</div>';
    const ei=document.getElementById('emptyImport'); if(ei) ei.onclick=openImport; renderBulkBar(matched); return; }
  const page=matched.slice(0,shownN);
  list.innerHTML=page.map(b=> b.id===editingId? editFormHtml(b) :
    '<div class="bm'+(b.archived?' archived-card':'')+(selected.has(b.id)?' selected-card':'')+'" id="bm-'+b.id+'">'
    +'<input type="checkbox" class="selBox" data-id="'+b.id+'"'+(selected.has(b.id)?' checked':'')+' title="Select">'
    +'<div class="preview"><img src="'+previewFor(b.url,b.title)+'" alt=""></div>'
    +'<div class="body">'
    +'<div class="titleline"><img class="favicon" src="'+faviconFor(b.url)+'" alt="">'
    +(b.read?'':'<span class="unreadDot" title="Unread"></span>')
    +'<span class="title">'+escHtml(b.title)+'</span>'+(b.archived?'<span class="archBadge">Archived</span>':'')
    +'<span class="cardActions">'
    +(b.archived?'<button class="secondary restoreBtn" data-id="'+b.id+'">Restore</button>'
      :'<button class="secondary readBtn" data-id="'+b.id+'">'+(b.read?'Mark unread':'Mark read')+'</button>'
       +'<button class="secondary editBtn" data-id="'+b.id+'">Edit</button>'
       +'<button class="secondary archiveBtn" data-id="'+b.id+'">Archive</button>')
    +'<button class="secondary deleteBtn" data-id="'+b.id+'" style="color:#b91c1c">Delete</button>'
    +'</span></div>'
    +'<a class="url" href="'+escAttr(b.url)+'" target="_blank" rel="noopener">'+escHtml(b.url)+'</a>'
    +(b.description?'<div class="desc">'+escHtml(b.description)+'</div>':'')
    +(b.contentCollected===false?'<div class="warn" style="margin-top:8px">Page couldn\'t be read — details entered by you, and <b>the page was not preserved</b> (the image is a placeholder). <button class="secondary retryBtn" data-id="'+b.id+'" style="padding:3px 9px;font-size:12px;margin-left:4px">Retry now</button></div>':'')
    +preservedLineHtml(b)
    +(b.note?'<div class="note'+((noteNeedsClamp(b.note)&&!expanded.has(b.id))?' clamped':'')+'">'+formatNote(b.note)+'</div>'+(noteNeedsClamp(b.note)?'<button class="showmore" data-id="'+b.id+'">'+(expanded.has(b.id)?'Show less':'Show more')+'</button>':''):'')
    +((b.tags&&b.tags.length)?'<div class="tags">'+b.tags.map(t=>'<span class="tag" data-tag="'+escAttr(t)+'" title="Filter to this tag">'+escHtml(t)+'</span>').join('')+'</div>':'')
    +'</div></div>'
  ).join('');
  if(matched.length>page.length){ list.innerHTML+='<div class="showing">Showing '+page.length+' of '+matched.length+'</div><button class="loadmore" id="loadMore">Load more</button>'; }
  else if(matched.length>pageSize){ list.innerHTML+='<div class="showing">Showing all '+matched.length+'</div>'; }
  const lm=document.getElementById('loadMore'); if(lm) lm.onclick=()=>{ shownN+=pageSize; render(); };

  list.querySelectorAll('.selBox').forEach(el=>el.onclick=(e)=>{ e.stopPropagation(); const id=+el.dataset.id;
    if(el.checked) selected.add(id); else selected.delete(id); renderBulkBar(matched);
    const card=document.getElementById('bm-'+id); if(card) card.classList.toggle('selected-card',el.checked); });
  renderBulkBar(matched);
  list.querySelectorAll('.showmore').forEach(el=>el.onclick=(e)=>{ e.stopPropagation(); const id=+el.dataset.id; if(expanded.has(id)) expanded.delete(id); else expanded.add(id); render(); });
  list.querySelectorAll('.savedCopyBtn').forEach(el=>el.onclick=(e)=>{ e.stopPropagation(); openCopy(+el.dataset.id); });
  list.querySelectorAll('.toArchiveBtn').forEach(el=>el.onclick=(e)=>{ e.stopPropagation(); sendArchive(+el.dataset.id); });
  list.querySelectorAll('.readBtn').forEach(el=>el.onclick=(e)=>{ e.stopPropagation(); toggleRead(+el.dataset.id); });
  list.querySelectorAll('.editBtn').forEach(el=>el.onclick=(e)=>{ e.stopPropagation(); openEdit(+el.dataset.id); });
  list.querySelectorAll('.archiveBtn').forEach(el=>el.onclick=(e)=>{ e.stopPropagation(); setArchived(+el.dataset.id,true); });
  list.querySelectorAll('.restoreBtn').forEach(el=>el.onclick=(e)=>{ e.stopPropagation(); setArchived(+el.dataset.id,false); });
  list.querySelectorAll('.deleteBtn').forEach(el=>el.onclick=(e)=>{ e.stopPropagation(); del(+el.dataset.id); });
  list.querySelectorAll('.retryBtn').forEach(el=>el.onclick=(e)=>{ e.stopPropagation(); retry(+el.dataset.id); });
  list.querySelectorAll('.tag[data-tag]').forEach(el=>el.onclick=(e)=>{ e.stopPropagation(); $("#search").value='#'+el.dataset.tag; shownN=pageSize; render(); window.scrollTo({top:0,behavior:'smooth'}); });
  list.querySelectorAll('.bm').forEach(card=>{ if(card.querySelector('#eUrl')) return;
    card.onclick=(e)=>{ if(e.target.closest('.cardActions,.tag,.selBox,.showmore,.preserved,a,button,input')) return;
      const b=state.bookmarks.find(x=>'bm-'+x.id===card.id); if(b) window.open(b.url,'_blank','noopener'); }; });
  wireEditForm();
}

// ---------- bulk ----------
function renderBulkBar(matched){
  const bar=$("#bulkBar");
  if(selected.size===0){ bar.style.display='none'; bar.innerHTML=''; return; }
  bar.style.display=''; const inArch=locationFilter==='archived';
  bar.innerHTML='<span class="bulkcount">'+selected.size+' selected</span>'
    +(selected.size<matched.length?'<button class="secondary" id="selAll">Select all '+matched.length+' matching</button>':'')
    +'<button class="secondary" id="bAddTag">Add tag…</button><button class="secondary" id="bDelTag">Remove tag…</button>'
    +'<button class="secondary" id="bRead">Mark read</button><button class="secondary" id="bUnread">Mark unread</button>'
    +(inArch?'<button class="secondary" id="bRestore">Restore</button>':'<button class="secondary" id="bArchive">Archive</button>')
    +'<button class="secondary" id="bDelete" style="color:#b91c1c">Delete</button>'
    +'<button class="secondary" id="bClear" style="margin-left:auto">Clear selection</button>';
  const ids=()=>[...selected];
  async function run(action,payload){ const n=selected.size; await api('POST','/api/bulk',{action,ids:ids(),payload}); selected.clear(); await refresh(); render(); return n; }
  const s=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  s('selAll',()=>{ matched.forEach(b=>selected.add(b.id)); render(); });
  s('bClear',()=>{ selected.clear(); render(); });
  s('bRead',async()=>{ const n=await run('read'); flash('Marked '+n+' as read.'); });
  s('bUnread',async()=>{ const n=await run('unread'); flash('Marked '+n+' as unread.'); });
  s('bArchive',async()=>{ const n=await run('archive'); flash('Archived '+n+' bookmarks.'); });
  s('bRestore',async()=>{ const n=await run('restore'); flash('Restored '+n+' bookmarks.'); });
  s('bAddTag',()=>openTagPicker('add'));
  s('bDelTag',()=>openTagPicker('remove'));
  s('bDelete',async()=>{ const n=selected.size; if(!confirm('Permanently delete '+n+' bookmarks?\nThis cannot be undone (and removes their saved copies).')) return; await run('delete'); flash('Permanently deleted '+n+' bookmarks.'); });
}
function openTagPicker(mode){
  const count=selected.size; if(!count) return;
  const selB=()=>state.bookmarks.filter(b=>selected.has(b.id));
  const candidates= mode==='add'? allTags() : [...new Set(selB().flatMap(b=>b.tags||[]))].sort();
  const ov=document.createElement('div'); ov.className='overlay';
  ov.innerHTML='<div class="modal"><h3>'+(mode==='add'?'Add tag to ':'Remove tag from ')+count+' bookmark'+(count>1?'s':'')+'</h3>'
    +'<input type="text" id="tpSearch" placeholder="'+(mode==='add'?'Search or type a new tag…':'Search tags on selected…')+'"><div id="tpList" class="tplist"></div>'
    +'<div class="row" style="justify-content:flex-end;margin-top:10px"><button class="secondary" id="tpCancel">Cancel</button></div></div>';
  document.body.appendChild(ov); const close=()=>ov.remove(); ov.addEventListener('click',e=>{ if(e.target===ov) close(); });
  $("#tpCancel").onclick=close; const search=$("#tpSearch"), listEl=$("#tpList");
  async function apply(tag){ await api('POST','/api/bulk',{action:mode==='add'?'addTag':'removeTag',ids:[...selected],payload:{tag}});
    const c=count; selected.clear(); close(); await refresh(); flash((mode==='add'?'Added tag "':'Removed tag "')+tag+'" '+(mode==='add'?'to ':'from ')+c+' bookmarks.'); render(); }
  function draw(){ const qq=search.value.trim().toLowerCase(); let cs=candidates.filter(t=> qq===''||t.toLowerCase().includes(qq));
    let html=cs.map(t=>'<button type="button" class="tpItem" data-t="'+escAttr(t)+'">'+escHtml(t)+'</button>').join('');
    if(mode==='add'&&qq&&!candidates.some(t=>t.toLowerCase()===qq)) html+='<button type="button" class="tpItem tpnew" data-t="'+escAttr(search.value.trim())+'">+ Create new tag: “'+escHtml(search.value.trim())+'”</button>';
    if(!html) html='<div class="hint" style="padding:8px">'+(mode==='add'?'No existing tags yet. Type to create one.':'The selected bookmarks have no tags to remove.')+'</div>';
    listEl.innerHTML=html; listEl.querySelectorAll('.tpItem').forEach(el=>el.onclick=()=>apply(el.dataset.t)); }
  search.addEventListener('input',draw); draw(); search.focus();
}

// ---------- saved searches ----------
function renderSavedSearches(){
  const row=$("#savedRow"); if(!row) return;
  if(!state.savedSearches.length){ row.innerHTML=''; return; }
  row.innerHTML='<span class="hint" style="margin-right:4px">Saved:</span>'+state.savedSearches.map(ss=>'<span class="savedchip"><button class="applySaved" data-id="'+ss.id+'" title="'+escAttr((ss.query||'(no text)')+' · '+ss.status+' · '+ss.location)+'">'+escHtml(ss.name)+'</button><button class="delSaved" data-id="'+ss.id+'" title="Delete saved search">×</button></span>').join('');
  row.querySelectorAll('.applySaved').forEach(el=>el.onclick=()=>{ const ss=state.savedSearches.find(x=>x.id===+el.dataset.id); if(!ss) return;
    $("#search").value=ss.query||''; statusFilter=ss.status; locationFilter=ss.location; $("#statusFilter").value=ss.status; $("#locationFilter").value=ss.location; selected.clear(); shownN=pageSize; render(); flash('Applied saved search "'+ss.name+'".'); });
  row.querySelectorAll('.delSaved').forEach(el=>el.onclick=async()=>{ const ss=state.savedSearches.find(x=>x.id===+el.dataset.id); if(!ss) return;
    if(!confirm('Delete saved search "'+ss.name+'"? (Your bookmarks are not affected.)')) return; await api('DELETE','/api/saved-searches/'+ss.id); await refresh(); renderSavedSearches(); }); }
function makeMultiTag(wrap, chosen){
  function draw(){ wrap.innerHTML=[...chosen].map(t=>'<span class="mtchip">'+escHtml(t)+'<button type="button" data-t="'+escAttr(t)+'">×</button></span>').join('')+'<input type="text" class="mtinput" placeholder="type to search tags…">';
    const inp=wrap.querySelector('.mtinput'); const drop=document.createElement('div'); drop.className='mtdrop'; wrap.appendChild(drop);
    function suggest(){ const qq=inp.value.trim().toLowerCase(); let cs=allTags().filter(t=>![...chosen].some(c=>c.toLowerCase()===t.toLowerCase()) && (qq===''||t.toLowerCase().includes(qq)));
      drop.innerHTML=cs.slice(0,8).map(t=>'<button type="button" class="mtopt" data-t="'+escAttr(t)+'">'+escHtml(t)+'</button>').join('');
      drop.querySelectorAll('.mtopt').forEach(o=>o.onclick=()=>{ chosen.add(o.dataset.t); draw(); }); }
    inp.addEventListener('input',suggest); inp.addEventListener('focus',suggest); inp.addEventListener('blur',()=>setTimeout(()=>{ drop.innerHTML=''; },150));
    wrap.querySelectorAll('.mtchip button').forEach(x=>x.onclick=()=>{ chosen.delete(x.dataset.t); draw(); }); }
  draw();
}
function saveCurrentSearch(){
  const include=new Set(), exclude=new Set();
  const ov=document.createElement('div'); ov.className='overlay';
  const opt=(v,l)=>'<option value="'+v+'">'+l+'</option>';
  ov.innerHTML='<div class="modal"><h3>Create a saved search</h3>'
    +'<label>Name</label><input type="text" id="ssName" placeholder="e.g. To-read travel">'
    +'<label>Search terms (optional)</label><input type="text" id="ssWords" placeholder="e.g. rome AND (&quot;walking guide&quot; OR history)">'
    +'<div class="hint">Supports exact phrases, AND/OR/NOT, and parentheses — same as the main search box.</div>'
    +'<label>Include tags</label><div id="ssInc" class="multitag"></div>'
    +'<label>Exclude tags</label><div id="ssExc" class="multitag"></div>'
    +'<div class="row" style="gap:12px;margin-top:8px"><div style="flex:1"><label>Show</label><select id="ssStatus">'+opt('all','All')+opt('unread','Unread only')+opt('read','Read only')+'</select></div>'
    +'<div style="flex:1"><label>View</label><select id="ssLoc">'+opt('active','Active')+opt('archived','Archived')+'</select></div></div>'
    +'<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="secondary" id="ssCancel">Cancel</button><button id="ssSave">Save</button></div></div>';
  document.body.appendChild(ov); const close=()=>ov.remove(); ov.addEventListener('click',e=>{ if(e.target===ov) close(); });
  $("#ssWords").value=$("#search").value.trim(); $("#ssStatus").value=statusFilter; $("#ssLoc").value=locationFilter;
  makeMultiTag($("#ssInc"),include); makeMultiTag($("#ssExc"),exclude); $("#ssCancel").onclick=close;
  $("#ssSave").onclick=async()=>{ const name=$("#ssName").value.trim(); if(!name){ $("#ssName").focus(); return; }
    const parts=[]; const words=$("#ssWords").value.trim(); if(words) parts.push('('+words+')');
    [...include].forEach(t=>parts.push('#'+t)); [...exclude].forEach(t=>parts.push('NOT #'+t));
    await api('POST','/api/saved-searches',{ name, query:parts.join(' AND '), status:$("#ssStatus").value, location:$("#ssLoc").value });
    close(); await refresh(); renderSavedSearches(); flash('Saved search "'+name+'".'); };
}

// ---------- import / export / prefs ----------
const IMPORT_SAMPLE='<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n  <DT><H3>Reading</H3>\n  <DL><p>\n    <DT><A HREF="https://example.org/rust-book" ADD_DATE="1609459200" TAGS="rust,reading">The Rust Programming Language</A>\n    <DT><A HREF="https://example.org/hooks" ADD_DATE="1610000000" TAGS="javascript">Intro to Hooks</A>\n  </DL><p>\n  <DT><H3>Design</H3>\n  <DL><p>\n    <DT><A HREF="https://example.org/design-patterns" ADD_DATE="1612137600">Design Patterns Catalogue</A>\n  </DL><p>\n</DL><p>\n';
function openImport(){
  const ov=document.createElement('div'); ov.className='overlay';
  ov.innerHTML='<div class="modal"><h3>Import bookmarks</h3><p class="small muted">Choose a bookmarks HTML file exported from your browser (Chrome, Firefox, Safari, Edge). Titles, tags, and original dates are kept; folders become tags; addresses you already have are skipped.</p>'
    +'<input type="file" id="impFile" accept=".html,.htm"><div class="hint" style="margin-top:8px">No file handy? <button class="linklike" id="impSample">Use a sample file</button>.</div><div id="impResult"></div>'
    +'<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="secondary" id="impClose">Close</button></div></div>';
  document.body.appendChild(ov); const close=()=>ov.remove(); ov.addEventListener('click',e=>{ if(e.target===ov) close(); });
  $("#impClose").onclick=close;
  async function doImport(html){ const r=await api('POST','/api/import',{html}); await refresh();
    const d=r.data||{added:0,skipped:0}; $("#impResult").innerHTML='<div class="flash" style="margin:10px 0 0">Imported '+d.added+' bookmark'+(d.added===1?'':'s')+(d.skipped?', skipped '+d.skipped+' already present':'')+'. Titles, tags, and original dates were kept; folders became tags.</div>'; render(); renderSavedSearches(); }
  $("#impSample").onclick=()=>doImport(IMPORT_SAMPLE);
  $("#impFile").onchange=(e)=>{ const f=e.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>doImport(String(rd.result)); rd.readAsText(f); };
}
function openPrefs(){
  const ov=document.createElement('div'); ov.className='overlay';
  const opt=(v,l,cur)=>'<option value="'+v+'"'+(cur===v?' selected':'')+'>'+l+'</option>';
  const pr=state.prefs;
  ov.innerHTML='<div class="modal"><h3>Preferences</h3>'
    +'<label>Default sort</label><select id="pfSort">'+opt('new','Newest first',pr.sort)+opt('old','Oldest first',pr.sort)+opt('az','Title A–Z',pr.sort)+opt('za','Title Z–A',pr.sort)+'</select>'
    +'<label>Number displayed per page</label><select id="pfPage">'+opt('10','10',String(pr.pageSize))+opt('20','20',String(pr.pageSize))+opt('50','50',String(pr.pageSize))+opt('100','100',String(pr.pageSize))+'</select>'
    +'<label>Text size</label><select id="pfText">'+opt('small','Small',pr.textSize)+opt('normal','Normal',pr.textSize)+opt('large','Large',pr.textSize)+'</select>'
    +'<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="secondary" id="pfCancel">Cancel</button><button id="pfSave">Save</button></div></div>';
  document.body.appendChild(ov); const close=()=>ov.remove(); ov.addEventListener('click',e=>{ if(e.target===ov) close(); });
  $("#pfCancel").onclick=close;
  $("#pfSave").onclick=async()=>{ const body={ sort:$("#pfSort").value, pageSize:parseInt($("#pfPage").value,10), textSize:$("#pfText").value };
    const r=await api('PUT','/api/prefs',body); if(r.ok) state.prefs=r.data; applyPrefs(); close(); render(); flash('Preferences saved.'); };
}

// ---------- init ----------
$("#saveBtn").onclick=startSave;
$("#url").addEventListener('keydown',e=>{ if(e.key==='Enter') startSave(); });
$("#search").addEventListener('input',()=>{ shownN=pageSize; render(); });
$("#clearSearch").onclick=()=>{ $("#search").value=''; shownN=pageSize; render(); $("#search").focus(); };
$("#saveSearch").onclick=saveCurrentSearch;
$("#sort").addEventListener('change',e=>{ sortBy=e.target.value; shownN=pageSize; render(); });
$("#statusFilter").addEventListener('change',e=>{ statusFilter=e.target.value; shownN=pageSize; render(); });
$("#locationFilter").addEventListener('change',e=>{ locationFilter=e.target.value; shownN=pageSize; render(); });
$("#importBtn").onclick=openImport;
$("#exportBtn").onclick=()=>{ window.location='/api/export'; };
$("#prefsBtn").onclick=openPrefs;

(async function init(){ await refresh(); applyPrefs(); render(); renderSavedSearches(); document.body.setAttribute('data-harness-ready','true'); })();
