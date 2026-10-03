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
      c1: "#b45309", c2: "#f59e0b", letter: "R" }
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
    const text=esc(src);
    const lines=text.split(/\r?\n/); let html=""; let inList=false;
    for(const raw of lines){
      if(/^\s*[-*]\s+/.test(raw)){ if(!inList){html+="<ul>";inList=true;} html+="<li>"+inlineMd(raw.replace(/^\s*[-*]\s+/,""))+"</li>"; }
      else { if(inList){html+="</ul>";inList=false;} if(raw.trim()!=="") html+="<div>"+inlineMd(raw)+"</div>"; }
    }
    if(inList)html+="</ul>";
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
    card._data=m;
    const tagsHTML=(m.tags&&m.tags.length)?'<div class="tags">'+m.tags.map(t=>'<span class="tag">#'+esc(t)+'</span>').join("")+'</div>':"";
    const noteHTML=m.note?'<div class="note-line"><span class="note-label">Note</span>'+renderNote(m.note)+'</div>':"";
    card.innerHTML=
      '<div class="thumb"><img alt="" src="'+m.thumb+'"></div>'+
      '<div class="card-body">'+
        '<div class="card-title">'+esc(m.title)+'</div>'+
        '<div class="card-site"><img alt="" src="'+m.fav+'"><span>'+esc(m.site)+'</span></div>'+
        '<p class="card-desc">'+esc(m.desc||"No description found on the page.")+'</p>'+
        tagsHTML+noteHTML+
        '<div class="card-url">'+esc(m.url)+'</div>'+
        '<div class="card-meta">'+esc(m.saved||savedLabel())+'</div>'+
        '<div class="card-actions"><button class="btn small secondary" data-act="edit">Edit</button></div>'+
      '</div>';
    card.querySelector('[data-act="edit"]').addEventListener("click",()=>openEditScreen({...m, tags:(m.tags||[]).slice()}, false, card, m.saved));
  }
  function addCard(m,atTop){const card=document.createElement("div");card.className="card";fillCard(card,m);if(atTop)listEl.prepend(card);else listEl.append(card);refreshEmpty();return card;}

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
          '<textarea class="edit-field" data-p="note" style="min-height:96px" placeholder="Why did you save this? You can use **bold**, links, and - lists.">'+esc(m.note||"")+'</textarea>'+
          '<div class="hint">Formatting: **bold**, *italic*, https://links, and lines starting with - become a list.</div>'+
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
  [
    {...lookup("https://recipes.example.com/ramen"), tags:["recipes","cooking"], note:"Try on a free weekend.", saved:"Saved · Aug 10, 2026"},
    {...lookup("https://developer.mozilla.org/css-grid"), tags:["reference","frontend"], note:"", saved:"Saved · Aug 6, 2026"},
    {...lookup("https://nasa.gov/webb"), title:"James Webb Space Telescope", tags:[], note:"", saved:"Saved · Aug 2, 2026"}
  ].forEach(m=>addCard(m,false));

  refreshEmpty();
  document.body.setAttribute("data-harness-ready","true");
})();
