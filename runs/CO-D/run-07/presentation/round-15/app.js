(function () {
  // Consolidated prototype: save->preview->confirm, duplicate handling,
  // shared edit screen with title/description/tags(Option B)/formatted note.

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
    for(const key in KNOWN){if(clean.startsWith(key.toLowerCase())){const k=KNOWN[key];return{url,norm:clean,title:k.title,site:k.site,desc:k.desc,thumb:thumbSVG(k.site,k.c1,k.c2),fav:favSVG(k.letter,k.c1),tags:[],note:""};}}
    const host=clean.split("/")[0];const path=clean.split("/").slice(1).join("/");
    let t=path?decodeURIComponent(path.split(/[/?#]/)[0]).replace(/[-_]+/g," ").replace(/\.\w+$/,"").trim():host;
    t=t?t.replace(/\b\w/g,c=>c.toUpperCase()):host;const col=hashColor(host);
    return{url,norm:clean,title:t||host,site:host,desc:"",thumb:thumbSVG(host,col,"#8894a8"),fav:favSVG((host[0]||"?").toUpperCase(),col),tags:[],note:""};
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
    const toggle=m.status==="toread"?'<button class="btn small" data-act="toggle">Mark as finished</button>':'<button class="btn small secondary" data-act="toggle">Move to To-read</button>';
    card.innerHTML=
      '<div class="thumb"><img alt="" src="'+m.thumb+'"></div>'+
      '<div class="card-body">'+
        badge+
        '<div class="card-title">'+esc(m.title)+'</div>'+
        '<div class="card-site"><img alt="" src="'+m.fav+'"><span>'+esc(m.site)+'</span></div>'+
        '<p class="card-desc">'+esc(m.desc||"No description found on the page.")+'</p>'+
        tagsHTML+noteHTML+
        '<div class="card-url">'+esc(m.url)+'</div>'+
        '<div class="card-meta">'+esc(m.saved||savedLabel())+'</div>'+
        '<div class="card-actions"><button class="btn small secondary" data-act="edit">Edit</button>'+toggle+'</div>'+
      '</div>';
    card.querySelector('[data-act="edit"]').addEventListener("click",()=>openEditScreen({...m, tags:(m.tags||[]).slice()}, false, card, m.saved));
    card.querySelector('[data-act="toggle"]').addEventListener("click",()=>{ m.status=m.status==="toread"?"finished":"toread"; fillCard(card,m); applyFilter(); });
    card.querySelectorAll('[data-tag]').forEach(el=>el.addEventListener("click",()=>addTagFilter(el.getAttribute("data-tag"))));
  }
  function addCard(m,atTop){const card=document.createElement("div");card.className="card";fillCard(card,m);if(atTop)listEl.prepend(card);else listEl.append(card);refreshEmpty();applyFilter();return card;}

  // ---- finding: search + tag filters ----
  const searchEl=document.getElementById("search");
  const searchHintEl=document.getElementById("searchhint");
  const filtersEl=document.getElementById("filters");
  const countEl=document.getElementById("count");
  const noResEl=document.getElementById("noresults");
  const segmentEl=document.getElementById("segment");
  const activeTags=[];
  let statusFilter="all"; // all | toread | finished

  if(segmentEl){
    segmentEl.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      statusFilter=btn.getAttribute("data-v");
      segmentEl.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===btn));
      applyFilter();
    }));
  }

  function addTagFilter(t){ if(!activeTags.includes(t)){activeTags.push(t);renderFilters();applyFilter();} }
  function removeTagFilter(t){ const i=activeTags.indexOf(t); if(i>=0){activeTags.splice(i,1);renderFilters();applyFilter();} }
  function clearFilters(){ activeTags.length=0; searchEl.value=""; renderFilters(); applyFilter(); }
  function renderFilters(){
    if(!activeTags.length){ filtersEl.innerHTML=""; return; }
    filtersEl.innerHTML='<span class="flabel">Showing:</span>'+
      activeTags.map(t=>'<span class="fchip">#'+esc(t)+' <span class="x" data-rm="'+esc(t)+'">×</span></span>').join("")+
      '<button class="clear">Clear all</button>';
    filtersEl.querySelectorAll('[data-rm]').forEach(x=>x.addEventListener("click",()=>removeTagFilter(x.getAttribute("data-rm"))));
    filtersEl.querySelector(".clear").addEventListener("click",clearFilters);
  }
  function cardText(m){ return [m.title,m.desc,m.note,m.site,m.url,(m.tags||[]).join(" ")].join(" ").toLowerCase(); }

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
    const q=(searchEl?searchEl.value.trim():"");
    const { pred, fallback }=buildQuery(q);
    if(searchHintEl) searchHintEl.style.display = fallback ? "block" : "none";
    let shown=0; const total=listEl.children.length;
    Array.from(listEl.children).forEach(card=>{
      const m=card._data;
      const okText=pred(m);
      const okTags=activeTags.every(t=>(m.tags||[]).includes(t));
      const okStatus=statusFilter==="all"||m.status===statusFilter;
      const vis=okText&&okTags&&okStatus; card.style.display=vis?"":"none"; if(vis)shown++;
    });
    const narrowing=!!(q||activeTags.length||statusFilter!=="all");
    if(countEl) countEl.textContent = total? (narrowing? "· "+shown+" of "+total : "· "+total) : "";
    if(noResEl){
      const showNo=(total>0&&shown===0);
      noResEl.style.display=showNo?"block":"none";
      if(showNo){
        if(q||activeTags.length) noResEl.textContent="No bookmarks match your search or filters.";
        else if(statusFilter==="toread") noResEl.textContent="Nothing left to read — you're all caught up.";
        else if(statusFilter==="finished") noResEl.textContent="Nothing marked as finished yet.";
        else noResEl.textContent="No bookmarks match.";
      }
    }
    if(emptyEl) emptyEl.style.display=(total===0)?"block":"none";
  }
  if(searchEl) searchEl.addEventListener("input",applyFilter);

  function openEditScreen(m, isNew, existingCard, savedText, labelText){
    btn.disabled=true;
    let workingTags=(m.tags||[]).slice();
    stage.innerHTML=
      '<div class="preview"><div class="plabel">'+esc(labelText||(isNew?"Check the details, adjust if needed, then Save":"Edit details"))+'</div>'+
      '<div class="card" style="animation:none;margin:0 0 10px;">'+
        '<div class="thumb"><img alt="" src="'+m.thumb+'"></div>'+
        '<div class="card-body">'+
          '<div class="field-label">Title</div><input class="edit-field" data-p="title" value="'+esc(m.title)+'">'+
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
      m.title=stage.querySelector('[data-p="title"]').value;
      m.desc=stage.querySelector('[data-p="desc"]').value;
      m.note=stage.querySelector('[data-p="note"]').value.trim();
      m.tags=workingTags.slice();
      stage.innerHTML=""; btn.disabled=false;
      if(isNew){m.saved=savedLabel();const c=addCard(m,true);input.value="";input.focus();flash(c);}
      else{fillCard(existingCard,m);flash(existingCard);}
    });
    stage.querySelector('[data-p="cancel"]').addEventListener("click",()=>{stage.innerHTML="";btn.disabled=false;if(isNew)input.focus();});
    stage.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  function save(){
    const url=input.value.trim(); if(!url){input.focus();return;}
    const existing=findExisting(normalize(url));
    if(existing){ openEditScreen({...existing._data, tags:(existing._data.tags||[]).slice()}, false, existing, existing._data.saved, "Already saved — update existing bookmark"); input.value=""; flash(existing); return; }
    btn.disabled=true;
    stage.innerHTML='<div class="preview"><div class="plabel">Fetching page details…</div><div class="skeleton w70"></div><div class="skeleton w90"></div><div class="skeleton w40"></div></div>';
    setTimeout(()=>{ openEditScreen(lookup(url), true, null, null); }, 850);
  }
  btn.addEventListener("click",save);
  input.addEventListener("keydown",e=>{if(e.key==="Enter")save();});

  // seed collection with some tags already in use (for suggestions)
  const startEmpty=/[?&]demo=empty\b/.test(location.search);
  (startEmpty?[]:[
    {...lookup("https://recipes.example.com/ramen"), tags:["recipes","cooking"], note:"Try on a free weekend.", status:"finished", saved:"Saved · Aug 10, 2026"},
    {...lookup("https://developer.mozilla.org/css-grid"), tags:["reference","frontend"], note:"", status:"finished", saved:"Saved · Aug 6, 2026"},
    {...lookup("https://guide.example.com/rome"), tags:["travel","article"], note:"Plan the **Rome** trip for spring.", status:"toread", saved:"Saved · Aug 5, 2026"},
    {...lookup("https://books.example.com/spqr"), tags:["book","history"], note:"Deep dive on ancient Rome.", status:"toread", saved:"Saved · Aug 4, 2026"},
    {...lookup("https://nasa.gov/webb"), title:"James Webb Space Telescope", tags:[], note:"", status:"toread", saved:"Saved · Aug 2, 2026"}
  ]).forEach(m=>addCard(m,false));

  refreshEmpty();
  document.body.setAttribute("data-harness-ready","true");
})();
