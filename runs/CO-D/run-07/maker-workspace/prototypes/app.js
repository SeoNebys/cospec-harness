(function () {
  // Consolidated prototype: save->preview->confirm, duplicate handling,
  // shared edit screen with title/description/tags(Option B)/formatted note.

  const ACTION_LAYOUT = window.ACTION_LAYOUT || "menu"; // buttons | menu
  const SELECT_UI = window.SELECT_UI || "mode"; // mode | always
  const PRESERVE_MODE = window.PRESERVE_MODE || "auto"; // auto | ondemand
  let idCounter=0;
  const todayStr=()=>new Date().toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
  function isPdf(u){ return /\.pdf($|\?|#)/i.test(u||""); }
  function makeCopy(m){ m.copy={ at: todayStr(), kind: isPdf(m.url)?"pdf":"html" }; }
  function makeIA(m){ m.ia={ url:"https://web.archive.org/web/"+new Date().getFullYear()+"/"+m.url, at: todayStr() }; }
  function snapshotDataUrl(m){
    const e=s=>String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
    const html='<!doctype html><meta charset="utf-8"><title>Preserved copy — '+e(m.title)+'</title>'+
      '<div style="font-family:system-ui,sans-serif;max-width:720px;margin:36px auto;padding:0 20px">'+
      '<div style="background:#fff7e6;border:1px solid #f0d48a;padding:10px 14px;border-radius:8px;color:#7a5b12">🗂 Preserved copy captured '+e(m.copy&&m.copy.at)+' — a saved snapshot, not the live page.</div>'+
      '<h1>'+e(m.title)+'</h1><p style="color:#667">'+e(m.site)+'</p><p>'+e(m.desc)+'</p>'+
      '<p style="color:#999;font-size:13px">Original address: '+e(m.url)+'</p></div>';
    return "data:text/html;charset=utf-8,"+encodeURIComponent(html);
  }
  const selected=new Set(); // ids of selected bookmarks

  const KNOWN = {
    "nasa.gov/webb": { title: "NASA's James Webb Space Telescope | Home — NASA", site: "nasa.gov",
      desc: "The largest, most powerful space telescope ever built, revealing the universe in infrared light.",
      c1: "#0b3d91", c2: "#2f6df6", letter: "N" },
    "developer.mozilla.org/css-grid": { title: "CSS Grid Layout — MDN Web Docs", site: "developer.mozilla.org",
      desc: "A complete guide to CSS Grid: rows, columns, areas, and alignment, with examples.",
      c1: "#111827", c2: "#4b5563", letter: "M" },
    "recipes.example.com/ramen": { title: "Rich Tonkotsu Ramen from Scratch — Recipes", site: "recipes.example.com",
      desc: "A weekend project: 12-hour pork bone broth, homemade tare, and springy noodles.",
      c1: "#b45309", c2: "#f59e0b", letter: "R" },
    "guide.example.com/rome": { title: "Rome in 3 Days — City Guide", site: "guide.example.com",
      desc: "Walking routes through Rome: the Forum, the Pantheon, Trastevere, and the best gelato stops.",
      c1: "#7c2d12", c2: "#d97706", letter: "G" },
    "books.example.com/spqr": { title: "SPQR: A History of Ancient Rome", site: "books.example.com",
      desc: "Mary Beard's sweeping history of Rome, from myth to empire.",
      c1: "#3730a3", c2: "#6366f1", letter: "B" }
  };
  function hashColor(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))&0xffffff;return "#"+((h|0x404040)&0x9f9f9f).toString(16).padStart(6,"0");}
  function thumbSVG(site,c1,c2){const s="<svg xmlns='http://www.w3.org/2000/svg' width='320' height='224'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='"+c1+"'/><stop offset='1' stop-color='"+c2+"'/></linearGradient></defs><rect width='320' height='224' fill='url(#g)'/><rect x='0' y='168' width='320' height='56' fill='rgba(0,0,0,0.18)'/><text x='22' y='104' font-family='sans-serif' font-size='34' font-weight='700' fill='rgba(255,255,255,0.96)'>"+site+"</text></svg>";return "data:image/svg+xml;utf8,"+encodeURIComponent(s);}
  function favSVG(l,c1){const s="<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' rx='7' fill='"+c1+"'/><text x='16' y='22' text-anchor='middle' font-family='sans-serif' font-size='18' font-weight='700' fill='#fff'>"+l+"</text></svg>";return "data:image/svg+xml;utf8,"+encodeURIComponent(s);}
  function normalize(url){return url.trim().toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/\/+$/,"");}
  function lookup(url){
    const clean=normalize(url);
    for(const key in KNOWN){if(clean.startsWith(key.toLowerCase())){const k=KNOWN[key];return{url,norm:clean,title:k.title,site:k.site,desc:k.desc,thumb:thumbSVG(k.site,k.c1,k.c2),fav:favSVG(k.letter,k.c1),tags:[],note:"",autofilled:true};}}
    const host=clean.split("/")[0];const path=clean.split("/").slice(1).join("/");
    let t=path?decodeURIComponent(path.split(/[/?#]/)[0]).replace(/[-_]+/g," ").replace(/\.\w+$/,"").trim():host;
    t=t?t.replace(/\b\w/g,c=>c.toUpperCase()):host;const col=hashColor(host);
    return{url,norm:clean,title:t||host,site:host,desc:"",thumb:thumbSVG(host,col,"#8894a8"),fav:favSVG((host[0]||"?").toUpperCase(),col),tags:[],note:"",autofilled:false};
  }
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  // --- minimal, safe note formatting: links, **bold**, *italic*, - lists ---
  function inlineMd(s){
    s=s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(m,t,u)=>'<a href="'+u.replace(/&amp;/g,"&")+'" target="_blank" rel="noopener">'+t+'</a>');
    s=s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g,(m,pre,u)=>pre+'<a href="'+u.replace(/&amp;/g,"&")+'" target="_blank" rel="noopener">'+u+'</a>');
    s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    s=s.replace(/(^|[^*])\*([^*]+)\*/g,'$1<em>$2</em>');
    return s;
  }
  function renderNote(src){
    const lines=esc(src).split(/\r?\n/);
    let html=""; let para=[]; let listType=null;
    const flushPara=()=>{ if(para.length){ html+="<p>"+para.map(inlineMd).join("<br>")+"</p>"; para=[]; } };
    const flushList=()=>{ if(listType){ html+="</"+listType+">"; listType=null; } };
    for(const line of lines){
      const h=line.match(/^(#{1,6})\s+(.*)$/);
      const ol=line.match(/^\s*\d+[.)]\s+(.*)$/);
      const ul=line.match(/^\s*[-*]\s+(.*)$/);
      if(h){ flushPara(); flushList(); const lvl=Math.min(h[1].length,3); html+='<div class="note-h note-h'+lvl+'">'+inlineMd(h[2])+'</div>'; }
      else if(ol){ flushPara(); if(listType&&listType!=="ol")flushList(); if(!listType){html+="<ol>";listType="ol";} html+="<li>"+inlineMd(ol[1])+"</li>"; }
      else if(ul){ flushPara(); if(listType&&listType!=="ul")flushList(); if(!listType){html+="<ul>";listType="ul";} html+="<li>"+inlineMd(ul[1])+"</li>"; }
      else if(line.trim()===""){ flushPara(); flushList(); }
      else { flushList(); para.push(line); }
    }
    flushPara(); flushList();
    return html;
  }

  const listEl=document.getElementById("list");
  const emptyEl=document.getElementById("empty");
  const input=document.getElementById("url");
  const btn=document.getElementById("saveBtn");
  const stage=document.getElementById("stage");

  function refreshEmpty(){emptyEl.style.display=listEl.children.length?"none":"block";}
  function savedLabel(){const d=new Date();return "Saved · "+d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
  function findExisting(norm){return Array.from(listEl.children).find(c=>c._data&&c._data.norm===norm);}
  function allTags(){const set=new Set();Array.from(listEl.children).forEach(c=>(c._data.tags||[]).forEach(t=>set.add(t)));return Array.from(set).sort();}
  function flash(card){card.classList.remove("flash");void card.offsetWidth;card.classList.add("flash");card.scrollIntoView({behavior:"smooth",block:"center"});}

  function fillCard(card,m){
    if(!m.status) m.status="toread";
    card._data=m;
    const tagsHTML=(m.tags&&m.tags.length)?'<div class="tags">'+m.tags.map(t=>'<span class="tag clickable" data-tag="'+esc(t)+'" title="Show everything tagged #'+esc(t)+'">#'+esc(t)+'</span>').join("")+'</div>':"";
    const noteHTML=m.note?'<div class="note-line"><span class="note-label">Note</span>'+renderNote(m.note)+'</div>':"";
    const badge='<span class="status-badge '+m.status+'">'+(m.status==="toread"?"To read":"Finished")+'</span>';
    const toggleLabel=m.status==="toread"?"Mark as finished":"Move to To-read";
    if(m.id==null) m.id=++idCounter;
    // Opening: the title and thumbnail are links to the original page (new tab).
    card.innerHTML=
      '<label class="selwrap"><input type="checkbox" class="selbox"></label>'+
      '<a class="thumb" href="'+esc(m.url)+'" target="_blank" rel="noopener"><img alt="" src="'+m.thumb+'"></a>'+
      '<div class="card-body">'+
        badge+
        '<a class="card-title" href="'+esc(m.url)+'" target="_blank" rel="noopener">'+esc(m.title)+'</a>'+
        '<div class="card-site"><img alt="" src="'+m.fav+'"><span>'+esc(m.site)+'</span></div>'+
        '<p class="card-desc">'+esc(m.desc||"No description found on the page.")+'</p>'+
        tagsHTML+noteHTML+
        '<div class="card-url">'+esc(m.url)+'</div>'+
        '<div class="card-meta">'+esc(m.saved||savedLabel())+(m.archived?' · <span class="arch-tag">Archived</span>':'')+'</div>'+
        copyLineHTML(m)+
        actionsMarkup(m)+
      '</div>';
    wireActions(card,m);
    card.querySelectorAll('[data-tag]').forEach(el=>el.addEventListener("click",()=>addTagFilter(el.getAttribute("data-tag"))));
  }

  function copyLineHTML(m){
    if(m.copy){
      let s='<div class="copy-line">🗂 Saved copy'+(m.copy.kind==="pdf"?" (PDF)":"")+' · captured '+esc(m.copy.at)+' · <a href="#" data-act="viewcopy">View copy</a>';
      if(m.ia) s+=' · <a href="'+esc(m.ia.url)+'" target="_blank" rel="noopener">Internet Archive</a>';
      s+='</div>';
      return s;
    }
    return '<div class="copy-line muted">No preserved copy yet'+(m.ia?' · <a href="'+esc(m.ia.url)+'" target="_blank" rel="noopener">Internet Archive</a>':'')+'</div>';
  }
  function actionsMarkup(m){
    if(m.archived){
      return '<div class="card-actions">'+
        '<button class="btn small secondary" data-act="restore">Restore</button>'+
        '<div class="menu"><button class="btn small secondary" data-act="more">More ▾</button>'+
          '<div class="menu-list" hidden><button data-act="delete" class="danger">Delete…</button></div></div></div>';
    }
    const toggleLabel=m.status==="toread"?"Mark as finished":"Move to To-read";
    if(ACTION_LAYOUT==="buttons"){
      return '<div class="card-actions">'+
        '<button class="btn small secondary" data-act="edit">Edit</button>'+
        '<button class="btn small secondary" data-act="toggle">'+toggleLabel+'</button>'+
        '<button class="btn small secondary" data-act="archive">Archive</button>'+
        '<button class="btn small danger" data-act="delete">Delete</button></div>';
    }
    // menu layout: Edit + frequently-used status toggle visible; rest under More
    return '<div class="card-actions">'+
      '<button class="btn small secondary" data-act="edit">Edit</button>'+
      '<button class="btn small secondary" data-act="toggle">'+toggleLabel+'</button>'+
      '<div class="menu"><button class="btn small secondary" data-act="more">More ▾</button>'+
        '<div class="menu-list" hidden>'+
          '<button data-act="savecopy">'+(m.copy?"Refresh saved copy":"Save a copy")+'</button>'+
          '<button data-act="saveia">'+(m.ia?"Re-save to Internet Archive":"Save to Internet Archive")+'</button>'+
          '<button data-act="archive">Archive</button>'+
          '<button data-act="delete" class="danger">Delete…</button>'+
        '</div></div></div>';
  }
  function wireActions(card,m){
    const cb=card.querySelector('.selbox');
    if(cb){ cb.checked=selected.has(m.id); cb.addEventListener("change",()=>{ if(cb.checked)selected.add(m.id); else selected.delete(m.id); updateBulkBar(); }); }
    const on=(sel,fn)=>{ const el=card.querySelector(sel); if(el) el.addEventListener("click",fn); };
    on('[data-act="edit"]',()=>openEditScreen({...m, tags:(m.tags||[]).slice()}, false, card, m.saved));
    on('[data-act="toggle"]',()=>{ m.status=m.status==="toread"?"finished":"toread"; fillCard(card,m); applyFilter(); });
    on('[data-act="archive"]',()=>{ m.archived=true; fillCard(card,m); applyFilter(); flash(card); });
    on('[data-act="restore"]',()=>{ m.archived=false; fillCard(card,m); applyFilter(); flash(card); });
    on('[data-act="savecopy"]',()=>{ makeCopy(m); fillCard(card,m); flash(card); });
    on('[data-act="saveia"]',()=>{ makeIA(m); fillCard(card,m); flash(card); });
    on('[data-act="viewcopy"]',e=>{ e.preventDefault(); const u=(m.copy&&m.copy.kind==="pdf")?m.url:snapshotDataUrl(m); window.open(u,"_blank","noopener"); });
    on('[data-act="delete"]',()=>confirmDelete(card,m));
    const more=card.querySelector('[data-act="more"]');
    if(more){ const list=card.querySelector(".menu-list");
      more.addEventListener("click",e=>{ e.stopPropagation(); const open=!list.hidden; document.querySelectorAll(".menu-list").forEach(l=>l.hidden=true); list.hidden=open; });
    }
  }
  function confirmDelete(card,m){
    const actions=card.querySelector(".card-actions");
    actions.innerHTML='<span class="confirm-text">Delete permanently? This can\'t be undone.</span>'+
      '<button class="btn small danger" data-c="yes">Delete</button>'+
      '<button class="btn small secondary" data-c="no">Cancel</button>';
    actions.querySelector('[data-c="yes"]').addEventListener("click",()=>{ card.remove(); refreshEmpty(); applyFilter(); });
    actions.querySelector('[data-c="no"]').addEventListener("click",()=>fillCard(card,m));
  }
  document.addEventListener("click",()=>document.querySelectorAll(".menu-list").forEach(l=>l.hidden=true));
  function addCard(m){const card=document.createElement("div");card.className="card";fillCard(card,m);listEl.append(card);refreshEmpty();applySort();applyFilter();return card;}

  // ---- finding: search + tag filters ----
  const searchEl=document.getElementById("search");
  const searchHintEl=document.getElementById("searchhint");
  const filtersEl=document.getElementById("filters");
  const countEl=document.getElementById("count");
  const noResEl=document.getElementById("noresults");
  const segmentEl=document.getElementById("segment");
  const sortEl=document.getElementById("sort");
  const archToggleEl=document.getElementById("archToggle"); // variant A (link)
  const scopeEl=document.getElementById("scope");           // variant B (scope switch)
  const activeTags=[];
  let statusFilter="all"; // all | toread | finished
  let viewScope="active"; // active | archived

  function archivedCount(){ return Array.from(listEl.children).filter(c=>c._data&&c._data.archived).length; }
  function updateArchUI(){
    const inArch=viewScope==="archived";
    if(archToggleEl) archToggleEl.textContent = inArch ? "← Back to collection" : ("🗄 Archived ("+archivedCount()+")");
    if(scopeEl) scopeEl.querySelectorAll("button").forEach(b=>b.classList.toggle("active", b.getAttribute("data-scope")===viewScope));
    if(segmentEl) segmentEl.style.display = inArch ? "none" : "";
    const toolbar=document.querySelector(".toolbar"); if(toolbar) toolbar.style.display = inArch ? "none" : "";
  }
  function setScope(s){ viewScope=s; currentPage=1; updateArchUI(); applySort(); applyFilter(); }
  if(archToggleEl) archToggleEl.addEventListener("click",()=>setScope(viewScope==="archived"?"active":"archived"));
  if(scopeEl) scopeEl.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>setScope(btn.getAttribute("data-scope"))));

  // ---- bulk selection & actions ----
  if(SELECT_UI==="always") document.body.classList.add("sel-always");
  let selectMode=(SELECT_UI==="always");
  const bulkBar=document.createElement("div"); bulkBar.className="bulkbar"; bulkBar.hidden=true;
  listEl.parentNode.insertBefore(bulkBar, listEl);
  if(SELECT_UI==="mode"){
    const controls=document.querySelector(".controls");
    const selectToggle=document.createElement("button"); selectToggle.className="btn small secondary"; selectToggle.textContent="Select";
    if(controls) controls.appendChild(selectToggle);
    selectToggle.addEventListener("click",()=>{ selectMode=!selectMode; document.body.classList.toggle("sel-on",selectMode); selectToggle.textContent=selectMode?"Done selecting":"Select"; if(!selectMode)clearSelection(); updateBulkBar(); });
  }
  function visibleCards(){ return Array.from(listEl.children).filter(c=>c.style.display!=="none"); }
  function selectedCards(){ return Array.from(listEl.children).filter(c=>selected.has(c._data.id)); }
  function clearSelection(){ selected.clear(); listEl.querySelectorAll('.selbox').forEach(cb=>cb.checked=false); updateBulkBar(); }
  function updateBulkBar(){
    const n=selectedCards().length;
    const showBar = n>0 && (SELECT_UI==="always" || selectMode);
    bulkBar.hidden=!showBar; if(!showBar) return;
    bulkBar.innerHTML=
      '<span class="bulk-n">'+n+' selected</span>'+
      '<button class="btn small secondary" data-bulk="selall">Select all matching ('+visibleCards().length+')</button>'+
      '<button class="btn small secondary" data-bulk="addtags">Add tags</button>'+
      '<button class="btn small secondary" data-bulk="rmtags">Remove tags</button>'+
      '<button class="btn small secondary" data-bulk="toread">Mark To read</button>'+
      '<button class="btn small secondary" data-bulk="finished">Mark Finished</button>'+
      '<button class="btn small secondary" data-bulk="archive">Archive</button>'+
      '<button class="btn small danger" data-bulk="delete">Delete…</button>'+
      '<button class="btn small secondary" data-bulk="clear">Clear</button>';
    const B=s=>bulkBar.querySelector('[data-bulk="'+s+'"]');
    B("selall").onclick=()=>{ visibleCards().forEach(c=>{selected.add(c._data.id); const cb=c.querySelector('.selbox'); if(cb)cb.checked=true;}); updateBulkBar(); };
    B("clear").onclick=clearSelection;
    B("toread").onclick=()=>bulkStatus("toread");
    B("finished").onclick=()=>bulkStatus("finished");
    B("archive").onclick=()=>{ selectedCards().forEach(c=>{c._data.archived=true;fillCard(c,c._data);}); clearSelection(); applyFilter(); };
    B("delete").onclick=bulkDelete;
    B("addtags").onclick=()=>bulkTags("add");
    B("rmtags").onclick=()=>bulkTags("remove");
  }
  function bulkStatus(s){ selectedCards().forEach(c=>{c._data.status=s;fillCard(c,c._data);}); applyFilter(); updateBulkBar(); }
  function bulkDelete(){
    const n=selectedCards().length;
    stage.innerHTML='<div class="preview"><div class="plabel">Delete '+n+' bookmark'+(n===1?"":"s")+'?</div><div class="hint">This can\'t be undone.</div><div class="card-actions" style="margin-top:10px"><button class="btn danger" data-d="yes">Delete '+n+'</button><button class="btn secondary" data-d="no">Cancel</button></div></div>';
    stage.querySelector('[data-d="yes"]').onclick=()=>{ selectedCards().forEach(c=>c.remove()); selected.clear(); stage.innerHTML=""; refreshEmpty(); applyFilter(); updateBulkBar(); };
    stage.querySelector('[data-d="no"]').onclick=()=>{ stage.innerHTML=""; };
    stage.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  function bulkTags(kind){
    const cards=selectedCards();
    const title=(kind==="add"?"Add tags to ":"Remove tags from ")+cards.length+" bookmark"+(cards.length===1?"":"s");
    let html='<div class="preview"><div class="plabel">'+title+'</div>';
    if(kind==="add"){
      html+='<div class="tagbox" data-t="box"><input data-t="entry" placeholder="Type a tag, press Enter"></div>'+
            '<div class="field-label">Your existing tags — click to add</div><div class="suggest" data-t="suggest"></div>';
    } else {
      const union=Array.from(new Set(cards.flatMap(c=>c._data.tags||[]))).sort();
      html+= union.length ? '<div class="suggest" data-t="rm">'+union.map(t=>'<span class="chip" data-tg="'+esc(t)+'">#'+esc(t)+' ✕</span>').join("")+'</div><div class="hint">Click a tag to remove it from all selected.</div>' : '<div class="hint">The selected bookmarks have no tags.</div>';
    }
    html+='<div class="card-actions" style="margin-top:12px"><button class="btn" data-t="done">Done</button></div></div>';
    stage.innerHTML=html;
    if(kind==="add"){
      let working=[];
      const box=stage.querySelector('[data-t="box"]'),entry=stage.querySelector('[data-t="entry"]'),sug=stage.querySelector('[data-t="suggest"]');
      function chips(){ box.querySelectorAll('.tag').forEach(n=>n.remove()); working.forEach((t,i)=>{const e=document.createElement('span');e.className='tag';e.innerHTML='#'+esc(t)+' <span class="x">×</span>';e.querySelector('.x').onclick=()=>{working.splice(i,1);chips();};box.insertBefore(e,entry);}); }
      function add(v){v=v.trim().replace(/^#/,'');if(v&&!working.includes(v))working.push(v);entry.value='';chips();}
      entry.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();add(entry.value);}});
      const all=Array.from(new Set(Array.from(listEl.children).flatMap(c=>c._data.tags||[]))).sort();
      sug.innerHTML=all.map(t=>'<span class="chip">#'+esc(t)+'</span>').join('');
      sug.querySelectorAll('.chip').forEach(ch=>ch.onclick=()=>add(ch.textContent.replace(/^#/,'')));
      stage.querySelector('[data-t="done"]').onclick=()=>{ if(entry.value.trim())add(entry.value); cards.forEach(c=>{const s=new Set(c._data.tags||[]);working.forEach(t=>s.add(t));c._data.tags=Array.from(s);fillCard(c,c._data);}); stage.innerHTML=''; applyFilter(); updateBulkBar(); };
    } else {
      stage.querySelectorAll('[data-t="rm"] .chip').forEach(ch=>ch.onclick=()=>{ const tag=ch.getAttribute('data-tg'); cards.forEach(c=>{c._data.tags=(c._data.tags||[]).filter(t=>t!==tag);fillCard(c,c._data);}); ch.remove(); applyFilter(); updateBulkBar(); });
      stage.querySelector('[data-t="done"]').onclick=()=>{ stage.innerHTML=''; };
    }
    stage.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  let sortMode="new";     // new | old | az | za

  function applySort(){
    const cards=Array.from(listEl.children);
    cards.sort((a,b)=>{ const A=a._data,B=b._data;
      if(sortMode==="old") return (A.ts||0)-(B.ts||0);
      if(sortMode==="az") return A.title.localeCompare(B.title,undefined,{sensitivity:"base"});
      if(sortMode==="za") return B.title.localeCompare(A.title,undefined,{sensitivity:"base"});
      return (B.ts||0)-(A.ts||0); // newest
    });
    cards.forEach(c=>listEl.appendChild(c));
  }
  // Persist the chosen order between visits (prototype uses the browser's local
  // storage to stand in for "remembered for me").
  const SORT_KEY="bm.sortPref";
  function loadSortPref(){ try{ const v=localStorage.getItem(SORT_KEY); if(v&&["new","old","az","za"].includes(v)) return v; }catch(e){} return "new"; }
  function saveSortPref(v){ try{ localStorage.setItem(SORT_KEY,v); }catch(e){} }
  const AUTOCOPY_KEY="bm.autocopy";
  function loadAutoCopy(){ try{ const v=localStorage.getItem(AUTOCOPY_KEY); if(v==="on")return true; if(v==="off")return false; }catch(e){} return PRESERVE_MODE!=="ondemand"; }
  function saveAutoCopy(v){ try{ localStorage.setItem(AUTOCOPY_KEY, v?"on":"off"); }catch(e){} }
  let autoCopy=loadAutoCopy();
  const PAGE_KEY="bm.pagesize", TEXT_KEY="bm.textsize";
  function loadPref(k,def,ok){ try{ const v=localStorage.getItem(k); if(v&&(!ok||ok(v)))return v; }catch(e){} return def; }
  let pageSize=loadPref(PAGE_KEY,"25",v=>["10","25","50","100","all"].includes(v));
  let textSize=loadPref(TEXT_KEY,"md",v=>["sm","md","lg"].includes(v));
  let currentPage=1;
  function applyTextSize(){ document.body.classList.remove("text-sm","text-md","text-lg"); document.body.classList.add("text-"+textSize); }
  applyTextSize();
  const pagerEl=document.createElement("div"); pagerEl.className="pager"; pagerEl.hidden=true;
  if(noResEl&&noResEl.parentNode) noResEl.parentNode.insertBefore(pagerEl,noResEl.nextSibling); else if(listEl.parentNode) listEl.parentNode.appendChild(pagerEl);
  function renderPager(shown){
    if(pageSize==="all"){ pagerEl.hidden=true; return; }
    const ps=parseInt(pageSize,10); const pages=Math.ceil(shown/ps);
    if(pages<=1){ pagerEl.hidden=true; return; }
    pagerEl.hidden=false;
    pagerEl.innerHTML='<button class="btn small secondary" data-p="prev" '+(currentPage<=1?"disabled":"")+'>‹ Prev</button>'+
      '<span class="pageinfo">Page '+currentPage+' of '+pages+'</span>'+
      '<button class="btn small secondary" data-p="next" '+(currentPage>=pages?"disabled":"")+'>Next ›</button>';
    pagerEl.querySelector('[data-p="prev"]').onclick=()=>{ if(currentPage>1){currentPage--;applyFilter();window.scrollTo({top:0,behavior:"smooth"});} };
    pagerEl.querySelector('[data-p="next"]').onclick=()=>{ if(currentPage<pages){currentPage++;applyFilter();window.scrollTo({top:0,behavior:"smooth"});} };
  }
  sortMode=loadSortPref();
  if(sortEl){ sortEl.value=sortMode; sortEl.addEventListener("change",()=>{ sortMode=sortEl.value; saveSortPref(sortMode); applySort(); }); }

  const settingsBtn=document.getElementById("settingsBtn");
  if(settingsBtn) settingsBtn.addEventListener("click",()=>{
    stage.innerHTML=
      '<div class="preview"><div class="plabel">Settings</div>'+
      '<div class="field-label">My default order (remembered between visits)</div>'+
      '<select id="defsort" class="edit-field">'+
        '<option value="new">Newest saved</option><option value="old">Oldest saved</option>'+
        '<option value="az">Title A–Z</option><option value="za">Title Z–A</option></select>'+
      '<div class="hint">This becomes the order you see whenever you return.</div>'+
      '<div class="field-label" style="margin-top:14px">Preserved copies</div>'+
      '<label class="setting-check"><input type="checkbox" id="autocopy"> Automatically save a self-contained copy of each new bookmark</label>'+
      '<div class="hint">Turn off to save copies only when you choose "Save a copy". Saving to the Internet Archive stays a separate, manual action.</div>'+
      '<div class="field-label" style="margin-top:14px">Display</div>'+
      '<label class="setting-row">Items per page <select id="pagesize"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option><option value="all">All</option></select></label>'+
      '<label class="setting-row">Text size <select id="textsize"><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select></label>'+
      '<div class="field-label" style="margin-top:14px">Your data</div>'+
      '<div class="card-actions"><button class="btn secondary" data-s="import">Import browser bookmarks…</button>'+
      '<button class="btn secondary" data-s="export">Export collection…</button></div>'+
      '<div class="card-actions" style="margin-top:12px"><button class="btn" data-s="ok">Save</button>'+
      '<button class="btn secondary" data-s="cancel">Cancel</button></div></div>';
    stage.querySelector('[data-s="import"]').addEventListener("click",openImport);
    stage.querySelector('[data-s="export"]').addEventListener("click",openExport);
    const sel=stage.querySelector('#defsort'); sel.value=sortMode;
    const ac=stage.querySelector('#autocopy'); ac.checked=autoCopy;
    const psz=stage.querySelector('#pagesize'); psz.value=pageSize;
    const tsz=stage.querySelector('#textsize'); tsz.value=textSize;
    stage.querySelector('[data-s="ok"]').addEventListener("click",()=>{
      sortMode=sel.value; saveSortPref(sortMode); if(sortEl)sortEl.value=sortMode;
      autoCopy=ac.checked; saveAutoCopy(autoCopy);
      pageSize=psz.value; try{localStorage.setItem(PAGE_KEY,pageSize);}catch(e){}
      textSize=tsz.value; try{localStorage.setItem(TEXT_KEY,textSize);}catch(e){} applyTextSize();
      currentPage=1;
      stage.innerHTML=""; applySort(); applyFilter();
    });
    stage.querySelector('[data-s="cancel"]').addEventListener("click",()=>{ stage.innerHTML=""; });
    stage.scrollIntoView({behavior:"smooth",block:"nearest"});
  });

  // ---- import / export ----
  const SAMPLE_BM='<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n'+
    '  <DT><H3>Reading</H3>\n  <DL><p>\n'+
    '    <DT><A HREF="https://example.com/great-article" ADD_DATE="1717200000">A Great Article</A>\n'+
    '    <DT><A HREF="https://www.nasa.gov/webb/" ADD_DATE="1716000000">NASA Webb Telescope</A>\n'+
    '  </DL><p>\n'+
    '  <DT><H3>Recipes</H3>\n  <DL><p>\n'+
    '    <DT><A HREF="https://recipes.example.com/tacos" ADD_DATE="1715000000">Best Weeknight Tacos</A>\n'+
    '  </DL><p>\n</DL><p>\n';
  function parseBookmarks(html){
    const doc=new DOMParser().parseFromString(html,"text/html");
    const out=[]; let folder="";
    const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_ELEMENT);
    let node;
    while((node=walker.nextNode())){
      const tag=node.tagName.toLowerCase();
      if(tag==="h3"){ folder=(node.textContent||"").trim().toLowerCase(); }
      else if(tag==="a" && node.getAttribute("href")){
        const add=parseInt(node.getAttribute("ADD_DATE")||node.getAttribute("add_date")||"0",10);
        const tagsAttr=(node.getAttribute("TAGS")||node.getAttribute("tags")||"").split(",").map(s=>s.trim()).filter(Boolean);
        out.push({ url:node.getAttribute("href"), title:(node.textContent||"").trim(), add,
                   tags: tagsAttr.length?tagsAttr:(folder?[folder]:[]) });
      }
    }
    return out;
  }
  function fmtDate(ts){ return "Saved · "+new Date(ts).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}); }
  function openImport(){
    stage.innerHTML='<div class="preview"><div class="plabel">Import browser bookmarks</div>'+
      '<div class="hint">Choose the .html bookmarks file exported from your browser, or load a sample to see how it works. Folders become tags; saved dates are kept; links you already have are skipped.</div>'+
      '<input type="file" id="impfile" accept=".html,text/html" class="edit-field">'+
      '<div class="card-actions"><button class="btn secondary" data-i="sample">Load a sample file</button></div>'+
      '<div id="imppreview"></div>'+
      '<div class="card-actions" style="margin-top:12px"><button class="btn secondary" data-i="close">Close</button></div></div>';
    stage.querySelector('[data-i="close"]').onclick=()=>{ stage.innerHTML=""; };
    stage.querySelector('[data-i="sample"]').onclick=()=>preview(SAMPLE_BM);
    stage.querySelector('#impfile').onchange=ev=>{ const f=ev.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>preview(String(r.result)); r.readAsText(f); };
    function preview(text){
      const items=parseBookmarks(text);
      const dups=items.filter(x=>findExisting(normalize(x.url)));
      const fresh=items.filter(x=>!findExisting(normalize(x.url)));
      const box=stage.querySelector('#imppreview');
      box.innerHTML='<div class="banner">Found '+items.length+' bookmark'+(items.length===1?"":"s")+'. '+
        fresh.length+' new, '+dups.length+' already saved (will be skipped).</div>'+
        '<div class="hint">Folders become tags and original saved dates are kept. To keep the import quick, preserved copies are <b>not</b> made now — you can "Save a copy" on any bookmark afterward.</div>'+
        '<div class="hint">'+fresh.slice(0,4).map(x=>esc(x.title||x.url)+(x.tags.length?(" — #"+x.tags.join(" #")):"")).join("<br>")+(fresh.length>4?"<br>…":"")+'</div>'+
        '<div class="card-actions"><button class="btn" data-i="do" '+(fresh.length?"":"disabled")+'>Import '+fresh.length+'</button></div>';
      const dob=box.querySelector('[data-i="do"]'); if(dob) dob.onclick=()=>{
        fresh.forEach(x=>{ const ts=x.add?x.add*1000:Date.now();
          addCard({ ...lookup(x.url), title:x.title||undefined, tags:x.tags.slice(), status:"toread", saved:fmtDate(ts), ts,
                    autofilled:true }); });
        stage.innerHTML=""; applySort(); applyFilter();
      };
    }
    stage.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  function buildExport(){
    const items=Array.from(listEl.children).map(c=>c._data);
    const rows=items.map(m=>'  <DT><A HREF="'+esc(m.url)+'" ADD_DATE="'+Math.floor((m.ts||Date.now())/1000)+'" TAGS="'+esc((m.tags||[]).join(","))+'" STATUS="'+esc(m.status||"toread")+'"'+(m.archived?' ARCHIVED="1"':'')+'>'+esc(m.title)+'</A>'+(m.note?'\n  <DD>'+esc(m.note):'')).join("\n");
    return '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<!-- Exported from My Bookmarks — titles, tags, saved dates, status and notes preserved -->\n<DL><p>\n'+rows+'\n</DL><p>\n';
  }
  function openExport(){
    const content=buildExport();
    const n=listEl.children.length;
    stage.innerHTML='<div class="preview"><div class="plabel">Export collection</div>'+
      '<div class="hint">Downloads all '+n+' bookmark'+(n===1?"":"s")+' as a file that keeps titles, tags, saved dates, status and notes — and can be re-imported.</div>'+
      '<textarea class="edit-field" readonly style="min-height:120px">'+esc(content)+'</textarea>'+
      '<div class="card-actions" style="margin-top:10px"><button class="btn" data-e="dl">Download file</button>'+
      '<button class="btn secondary" data-e="close">Close</button></div></div>';
    stage.querySelector('[data-e="close"]').onclick=()=>{ stage.innerHTML=""; };
    stage.querySelector('[data-e="dl"]').onclick=()=>{
      const blob=new Blob([content],{type:"text/html"}); const url=URL.createObjectURL(blob);
      const a=document.createElement("a"); a.href=url; a.download="my-bookmarks.html"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    stage.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  if(segmentEl){
    segmentEl.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      statusFilter=btn.getAttribute("data-v"); currentPage=1;
      segmentEl.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===btn));
      applyFilter();
    }));
  }

  // activeTags: array of { tag, mode:"include"|"exclude" }
  function findTagFilter(t){ return activeTags.find(f=>f.tag===t); }
  function addTagFilter(t){ if(!findTagFilter(t)){activeTags.push({tag:t,mode:"include"});currentPage=1;renderFilters();applyFilter();} }
  function removeTagFilter(t){ const i=activeTags.findIndex(f=>f.tag===t); if(i>=0){activeTags.splice(i,1);currentPage=1;renderFilters();applyFilter();} }
  function toggleTagMode(t){ const f=findTagFilter(t); if(f){ f.mode=f.mode==="include"?"exclude":"include"; currentPage=1; renderFilters(); applyFilter(); } }
  function clearFilters(){ activeTags.length=0; if(searchEl)searchEl.value=""; currentPage=1; renderFilters(); applyFilter(); }
  function includeTags(){ return activeTags.filter(f=>f.mode==="include").map(f=>f.tag); }
  function excludeTags(){ return activeTags.filter(f=>f.mode==="exclude").map(f=>f.tag); }
  function renderFilters(){
    const hasFilters=activeTags.length>0 || (searchEl&&searchEl.value.trim());
    if(!activeTags.length){ filtersEl.innerHTML = hasFilters ? saveViewButtonHTML() : ""; wireFilterButtons(); return; }
    filtersEl.innerHTML='<span class="flabel">Showing:</span>'+
      activeTags.map(f=>'<span class="fchip '+f.mode+'" title="Click to switch include/exclude"><button class="ftoggle" data-tg="'+esc(f.tag)+'">'+(f.mode==="exclude"?"−":"")+'#'+esc(f.tag)+'</button> <span class="x" data-rm="'+esc(f.tag)+'">×</span></span>').join("")+
      '<button class="clear">Clear all</button>'+saveViewButtonHTML();
    wireFilterButtons();
  }
  function wireFilterButtons(){
    filtersEl.querySelectorAll('[data-rm]').forEach(x=>x.addEventListener("click",()=>removeTagFilter(x.getAttribute("data-rm"))));
    filtersEl.querySelectorAll('[data-tg]').forEach(x=>x.addEventListener("click",()=>toggleTagMode(x.getAttribute("data-tg"))));
    const cl=filtersEl.querySelector(".clear"); if(cl) cl.addEventListener("click",clearFilters);
    const sv=filtersEl.querySelector(".saveview"); if(sv) sv.addEventListener("click",openSaveView);
  }
  function saveViewButtonHTML(){ return '<button class="saveview">★ Save this view</button>'; }
  function cardText(m){ return [m.title,m.desc,m.note,m.site,m.url,(m.tags||[]).join(" ")].join(" ").toLowerCase(); }
  function tset_has(tset,t){ return tset.includes(t); }

  // ---- search query language: #tag, "phrase", AND/OR/NOT, parentheses ----
  function tokenize(s){
    const toks=[]; let i=0;
    const wordChar=c=>c && !/\s/.test(c) && c!=="(" && c!==")" && c!=='"';
    while(i<s.length){
      const c=s[i];
      if(/\s/.test(c)){i++;continue;}
      if(c==="("){toks.push({t:"("});i++;continue;}
      if(c===")"){toks.push({t:")"});i++;continue;}
      if(c==='"'){ let j=i+1,v=""; while(j<s.length&&s[j]!=='"'){v+=s[j];j++;} i=j<s.length?j+1:j; toks.push({t:"term",kind:"phrase",v}); continue; }
      if(c==="#"){ let j=i+1,v=""; while(j<s.length&&wordChar(s[j])&&s[j]!=="#"){v+=s[j];j++;} i=j; toks.push({t:"term",kind:"tag",v}); continue; }
      let j=i,v=""; while(j<s.length&&wordChar(s[j])){v+=s[j];j++;} i=j;
      const up=v.toUpperCase();
      if(up==="AND"||up==="OR"||up==="NOT") toks.push({t:up}); else toks.push({t:"term",kind:"word",v});
    }
    return toks;
  }
  function compileStrict(s){
    const toks=tokenize(s); let p=0;
    const peek=()=>toks[p], eat=()=>toks[p++];
    const termNode=tk=>{ const v=tk.v.toLowerCase();
      return tk.kind==="tag" ? ctx=>ctx.tags.includes(v) : ctx=>v===""||ctx.text.includes(v); };
    function atom(){ const tk=peek();
      if(!tk) throw new Error("expected a term");
      if(tk.t==="("){eat(); const n=orExpr(); if(!peek()||peek().t!==")") throw new Error("missing )"); eat(); return n;}
      if(tk.t==="term"){eat(); return termNode(tk);}
      throw new Error("unexpected "+tk.t); }
    function notExpr(){ if(peek()&&peek().t==="NOT"){eat(); const n=notExpr(); return ctx=>!n(ctx);} return atom(); }
    function andExpr(){ let n=notExpr();
      while(peek()&&(peek().t==="AND"||peek().t==="term"||peek().t==="NOT"||peek().t==="(")){ if(peek().t==="AND")eat(); const r=notExpr(); const a=n,bb=r; n=ctx=>a(ctx)&&bb(ctx);} return n; }
    function orExpr(){ let n=andExpr(); while(peek()&&peek().t==="OR"){eat(); const r=andExpr(); const a=n,bb=r; n=ctx=>a(ctx)||bb(ctx);} return n; }
    const pred=orExpr();
    if(p!==toks.length) throw new Error("unexpected trailing input");
    return m=>pred({text:cardText(m),tags:(m.tags||[]).map(x=>x.toLowerCase())});
  }
  // Returns { pred, fallback }. fallback=true when an advanced expression could
  // not be understood and we fell back to a plain text search.
  function buildQuery(q){
    if(!q.trim()) return { pred:()=>true, fallback:false };
    try{ return { pred:compileStrict(q), fallback:false }; }
    catch(e){ const l=q.toLowerCase(); return { pred:m=>cardText(m).includes(l), fallback:true }; }
  }

  function applyFilter(){
    const inArch=viewScope==="archived";
    const q=(searchEl?searchEl.value.trim():"");
    const { pred, fallback }=buildQuery(q);
    if(searchHintEl) searchHintEl.style.display = (!inArch&&fallback) ? "block" : "none";
    const total=listEl.children.length; let activeTotal=0;
    const matching=[];
    Array.from(listEl.children).forEach(card=>{
      const m=card._data;
      if(!m.archived) activeTotal++;
      let ok;
      if(inArch){ ok=!!m.archived; }
      else {
        const okText=pred(m);
        const tset=m.tags||[];
        const okTags=includeTags().every(t=>tset_has(tset,t)) && !excludeTags().some(t=>tset_has(tset,t));
        const okStatus=statusFilter==="all"||m.status===statusFilter;
        ok=!m.archived&&okText&&okTags&&okStatus;
      }
      if(ok) matching.push(card); else card.style.display="none";
    });
    const shown=matching.length;
    // pagination over the matching set
    let pageStart=0, pageEnd=shown;
    if(pageSize!=="all"){
      const ps=parseInt(pageSize,10);
      const pages=Math.max(1,Math.ceil(shown/ps));
      if(currentPage>pages) currentPage=pages;
      pageStart=(currentPage-1)*ps; pageEnd=Math.min(shown,pageStart+ps);
    }
    matching.forEach((card,i)=>{ card.style.display=(i>=pageStart&&i<pageEnd)?"":"none"; });
    renderPager(shown);
    updateArchUI();
    const narrowing=!inArch&&!!(q||activeTags.length||statusFilter!=="all");
    if(countEl){
      if(inArch) countEl.textContent="· "+shown+" archived";
      else countEl.textContent = activeTotal? (narrowing? "· "+shown+" of "+activeTotal : "· "+activeTotal) : "";
    }
    if(noResEl){
      const showNo=(shown===0 && (inArch? true : activeTotal>0));
      noResEl.style.display=showNo?"block":"none";
      if(showNo){
        if(inArch) noResEl.textContent="Nothing archived. Archived bookmarks are kept here, out of your main collection.";
        else if(q||activeTags.length) noResEl.textContent="No bookmarks match your search or filters.";
        else if(statusFilter==="toread") noResEl.textContent="Nothing left to read — you're all caught up.";
        else if(statusFilter==="finished") noResEl.textContent="Nothing marked as finished yet.";
        else noResEl.textContent="No bookmarks match.";
      }
    }
    if(emptyEl) emptyEl.style.display=(!inArch&&total===0)?"block":"none";
  }
  if(searchEl) searchEl.addEventListener("input",()=>{ currentPage=1; renderFilters(); applyFilter(); });

  // ---- saved views (search + included/excluded tags) ----
  const VIEWS_KEY="bm.views";
  function loadViews(){ try{ return JSON.parse(localStorage.getItem(VIEWS_KEY)||"[]"); }catch(e){ return []; } }
  function persistViews(v){ try{ localStorage.setItem(VIEWS_KEY, JSON.stringify(v)); }catch(e){} }
  let savedViews=loadViews();
  function viewDesc(q,inc,exc){ return [ q?('search "'+q+'"'):"", inc.length?("with "+inc.map(t=>"#"+t).join(", ")):"", exc.length?("without "+exc.map(t=>"#"+t).join(", ")):"" ].filter(Boolean).join("; ")||"everything"; }
  function openSaveView(){
    const inc=includeTags(), exc=excludeTags(), q=searchEl?searchEl.value.trim():"";
    const desc=viewDesc(q,inc,exc);
    stage.innerHTML='<div class="preview"><div class="plabel">Save this view</div>'+
      '<div class="hint">Saving: '+esc(desc)+'</div>'+
      '<div class="field-label">Name</div><input class="edit-field" id="viewname" placeholder="e.g. Unread research">'+
      '<div class="card-actions" style="margin-top:12px"><button class="btn" data-v="ok">Save view</button><button class="btn secondary" data-v="cancel">Cancel</button></div></div>';
    const nameEl=stage.querySelector('#viewname'); nameEl.focus();
    stage.querySelector('[data-v="ok"]').onclick=()=>{ savedViews.push({name:(nameEl.value.trim()||desc), search:q, include:inc, exclude:exc}); persistViews(savedViews); stage.innerHTML=""; renderViewsMenu(); };
    stage.querySelector('[data-v="cancel"]').onclick=()=>{ stage.innerHTML=""; };
    stage.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  function applyView(v){
    if(searchEl) searchEl.value=v.search||"";
    activeTags.length=0;
    (v.include||[]).forEach(t=>activeTags.push({tag:t,mode:"include"}));
    (v.exclude||[]).forEach(t=>activeTags.push({tag:t,mode:"exclude"}));
    currentPage=1;
    if(viewScope==="archived") setScope("active");
    renderFilters(); applyFilter();
  }
  const viewsMenuWrap=document.createElement("div"); viewsMenuWrap.className="menu";
  (function(){
    const controls=document.querySelector(".controls"); if(!controls) return;
    viewsMenuWrap.innerHTML='<button class="btn small secondary" id="viewsBtn">☆ Views ▾</button><div class="menu-list" hidden></div>';
    controls.appendChild(viewsMenuWrap);
    const vbtn=viewsMenuWrap.querySelector("#viewsBtn"), list=viewsMenuWrap.querySelector(".menu-list");
    vbtn.addEventListener("click",e=>{ e.stopPropagation(); const open=!list.hidden; document.querySelectorAll(".menu-list").forEach(l=>l.hidden=true); list.hidden=open; if(!list.hidden) renderViewsMenu(); });
  })();
  function renderViewsMenu(){
    const list=viewsMenuWrap.querySelector(".menu-list"); if(!list) return;
    if(!savedViews.length){ list.innerHTML='<div class="menu-empty">No saved views yet. Filter, then "★ Save this view".</div>'; return; }
    list.innerHTML=savedViews.map((v,i)=>'<div class="view-row"><button class="view-apply" data-i="'+i+'" title="'+esc(viewDesc(v.search||"",v.include||[],v.exclude||[]))+'">'+esc(v.name)+'</button><button class="view-del danger" data-d="'+i+'" title="Delete view">×</button></div>').join("");
    list.querySelectorAll('.view-apply').forEach(bb=>bb.addEventListener("click",()=>{ applyView(savedViews[+bb.getAttribute("data-i")]); list.hidden=true; }));
    list.querySelectorAll('.view-del').forEach(bb=>bb.addEventListener("click",e=>{ e.stopPropagation(); savedViews.splice(+bb.getAttribute("data-d"),1); persistViews(savedViews); renderViewsMenu(); }));
  }

  function openEditScreen(m, isNew, existingCard, savedText, labelText){
    btn.disabled=true;
    let workingTags=(m.tags||[]).slice();
    const autofillWarn=(isNew&&m.autofilled===false)
      ? '<div class="banner">🔎 We couldn\'t read this page\'s details automatically. Add a title, description, tags or a note yourself, then Save.</div>' : '';
    stage.innerHTML=
      '<div class="preview"><div class="plabel">'+esc(labelText||(isNew?"Check the details, adjust if needed, then Save":"Edit details"))+'</div>'+
      autofillWarn+
      '<div class="card" style="animation:none;margin:0 0 10px;">'+
        '<div class="thumb"><img alt="" src="'+m.thumb+'"></div>'+
        '<div class="card-body">'+
          '<div class="field-label">Title</div><input class="edit-field" data-p="title" value="'+esc(m.title)+'">'+
          '<div class="field-label">Address (link)</div><input class="edit-field" data-p="url" value="'+esc(m.url)+'">'+
          '<div class="field-label">Description</div><textarea class="edit-field" data-p="desc">'+esc(m.desc||"")+'</textarea>'+
          '<div class="field-label">Your tags</div>'+
          '<div class="tagbox" data-t="box"><input data-t="entry" placeholder="Type a tag, press Enter"></div>'+
          '<div class="field-label" style="margin-top:2px">Your existing tags — click to add</div><div class="suggest" data-t="suggest"></div>'+
          '<div class="field-label">Your note</div>'+
          '<textarea class="edit-field" data-p="note" style="min-height:120px" placeholder="Why did you save this? Longer notes can use headings, lists, and links.">'+esc(m.note||"")+'</textarea>'+
          '<div class="hint">Formatting: # Heading, **bold**, *italic*, https://links, "- " bullet lists, "1. " numbered lists, and blank lines for paragraphs.</div>'+
        '</div></div>'+
      '<div class="card-actions"><button class="btn" data-p="ok">Save</button>'+
      '<button class="btn secondary" data-p="cancel">Cancel</button></div></div>';

    const box=stage.querySelector('[data-t="box"]'), entry=stage.querySelector('[data-t="entry"]'), sug=stage.querySelector('[data-t="suggest"]');
    function renderChips(){
      box.querySelectorAll(".tag").forEach(n=>n.remove());
      workingTags.forEach((t,i)=>{const el=document.createElement("span");el.className="tag";el.innerHTML='#'+esc(t)+' <span class="x">×</span>';el.querySelector(".x").addEventListener("click",()=>{workingTags.splice(i,1);renderChips();renderSuggest();});box.insertBefore(el,entry);});
    }
    function add(v){v=v.trim().replace(/^#/,"");if(v&&!workingTags.includes(v))workingTags.push(v);entry.value="";renderChips();renderSuggest();}
    function renderSuggest(){const avail=allTags().filter(t=>!workingTags.includes(t));sug.innerHTML=avail.length?avail.map(t=>'<span class="chip">#'+esc(t)+'</span>').join(""):'<span class="hint">No other tags yet.</span>';sug.querySelectorAll(".chip").forEach(ch=>ch.addEventListener("click",()=>add(ch.textContent.replace(/^#/,""))));}
    entry.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();add(entry.value);}else if(e.key==="Backspace"&&!entry.value&&workingTags.length){workingTags.pop();renderChips();renderSuggest();}});
    box.addEventListener("click",()=>entry.focus());
    renderChips(); renderSuggest();
    stage.querySelector('[data-p="title"]').focus();

    stage.querySelector('[data-p="ok"]').addEventListener("click",()=>{
      if(entry.value.trim())add(entry.value);
      const newUrl=stage.querySelector('[data-p="url"]').value.trim();
      // Prevent creating a duplicate by editing the address into one already saved.
      if(newUrl){ const nn=normalize(newUrl); const other=findExisting(nn);
        if(other && other!==existingCard){
          stage.innerHTML=""; btn.disabled=false;
          openEditScreen({...other._data, tags:(other._data.tags||[]).slice()}, false, other, other._data.saved, "That address is already saved — here's the existing bookmark");
          flash(other); return;
        }
      }
      m.title=stage.querySelector('[data-p="title"]').value;
      if(newUrl){ m.url=newUrl; m.norm=normalize(newUrl); }
      m.desc=stage.querySelector('[data-p="desc"]').value;
      m.note=stage.querySelector('[data-p="note"]').value.trim();
      m.tags=workingTags.slice();
      stage.innerHTML=""; btn.disabled=false;
      if(isNew){m.saved=savedLabel();m.ts=Date.now();if(autoCopy)makeCopy(m);const c=addCard(m);input.value="";input.focus();flash(c);}
      else{fillCard(existingCard,m);applySort();applyFilter();flash(existingCard);}
    });
    stage.querySelector('[data-p="cancel"]').addEventListener("click",()=>{stage.innerHTML="";btn.disabled=false;if(isNew)input.focus();});
    stage.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  const saveErrEl=document.getElementById("saveerror");
  function showSaveError(msg){ if(saveErrEl){saveErrEl.textContent=msg;saveErrEl.style.display=msg?"block":"none";} }
  function isPlausibleLink(u){
    if(/^https?:\/\//i.test(u)) return /^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(u);
    return /^[^\s]+\.[^\s]{2,}$/.test(u); // has a dot, no spaces
  }
  if(input) input.addEventListener("input",()=>showSaveError(""));

  function save(){
    const url=input.value.trim();
    if(!url){ showSaveError("Paste a web address to save."); input.focus(); return; }
    if(!isPlausibleLink(url)){ showSaveError('That doesn\'t look like a link. Paste a web address like https://example.com.'); input.focus(); return; }
    showSaveError("");
    const existing=findExisting(normalize(url));
    if(existing){ openEditScreen({...existing._data, tags:(existing._data.tags||[]).slice()}, false, existing, existing._data.saved, "Already saved — update existing bookmark"); input.value=""; flash(existing); return; }
    btn.disabled=true;
    stage.innerHTML='<div class="preview"><div class="plabel">Fetching page details…</div><div class="skeleton w70"></div><div class="skeleton w90"></div><div class="skeleton w40"></div></div>';
    setTimeout(()=>{ openEditScreen(lookup(url), true, null, null); }, 850);
  }
  btn.addEventListener("click",save);
  input.addEventListener("keydown",e=>{if(e.key==="Enter")save();});

  // seed collection with some tags already in use (for suggestions)
  const demo=(location.search.match(/[?&]demo=([a-z]+)/)||[])[1];
  let seeds;
  if(demo==="empty"){ seeds=[]; }
  else {
    seeds=[
      {...lookup("https://recipes.example.com/ramen"), tags:["recipes","cooking"], note:"Try on a free weekend.", status:"finished", saved:"Saved · Aug 10, 2026"},
      {...lookup("https://developer.mozilla.org/css-grid"), tags:["reference","frontend"], note:"", status:"finished", saved:"Saved · Aug 6, 2026"},
      {...lookup("https://guide.example.com/rome"), tags:["travel","article"], note:"Plan the **Rome** trip for spring.", status:"toread", saved:"Saved · Aug 5, 2026"},
      {...lookup("https://books.example.com/spqr"), tags:["book","history"], note:"Deep dive on ancient Rome.", status:"toread", saved:"Saved · Aug 4, 2026"},
      {...lookup("https://papers.example.com/deep-learning.pdf"), tags:["research","pdf"], note:"", status:"toread", saved:"Saved · Aug 3, 2026"},
      {...lookup("https://nasa.gov/webb"), title:"James Webb Space Telescope", tags:[], note:"", status:"toread", saved:"Saved · Aug 2, 2026"}
    ];
  }
  seeds.forEach((m,i)=>{ if(autoCopy && !m.copy && i!==2) makeCopy(m); }); // one left without a copy to show the on-demand action
  if(demo==="long"){
    const longTitle="The Exceptionally Long and Winding Title of a Deep-Dive Article That Refuses to Fit Neatly on a Single Line No Matter How Wide Your Screen Happens to Be Today";
    const longDesc="This description goes on at length about everything the page covers, including a great many clauses, asides, and qualifications, so we can see how the card copes when the summary is far longer than a tidy sentence and keeps wrapping across several lines without breaking the layout.".repeat(1);
    const longNote="# A longer note\nHere is a note that mixes **bold**, *italic*, and a [link](https://example.com/very/long/path/that/keeps/going/and/going).\n\n1. First a numbered point that itself is rather long and wraps onto more than one line to test list wrapping\n2. Second point\n\n- a bullet\n- another bullet with a superlongunbrokenword abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz to test breaking";
    const manyTags=["reference","reading","longform","science","space","astronomy","physics","must-read","2026","weekend","research","favourites"];
    seeds.unshift({...lookup("https://example.com/a/very/long/url/path/segment/that/keeps/going/on/and/on/and/on?with=lots&of=query&parameters=too"),
      title:longTitle, desc:longDesc, note:longNote, tags:manyTags, status:"toread", saved:"Saved · Aug 12, 2026"});
  }
  if(demo==="many"){
    const sites=[["news.example.com","N","#b91c1c","#ef4444"],["blog.example.com","B","#7c3aed","#a78bfa"],["docs.example.com","D","#0f766e","#2dd4bf"],["shop.example.com","S","#a16207","#eab308"]];
    const tagPool=["reference","reading","recipes","travel","work","fun","research","2026"];
    for(let i=1;i<=60;i++){ const s=sites[i%sites.length];
      seeds.push({url:"https://"+s[0]+"/article-"+i, norm:(s[0]+"/article-"+i), title:"Saved article #"+i+" — "+s[0], site:s[0],
        desc:"A sample saved item number "+i+" for testing a larger collection.", thumb:thumbSVG(s[0],s[2],s[3]), fav:favSVG(s[1],s[2]),
        tags:[tagPool[i%tagPool.length], tagPool[(i*3)%tagPool.length]], note:"", status:(i%3===0?"finished":"toread"), saved:"Saved · 2026"}); }
  }
  seeds.forEach((m,i)=>{ if(m.ts==null) m.ts=Date.now()-i*3600000; addCard(m); });

  refreshEmpty();
  document.body.setAttribute("data-harness-ready","true");
})();
