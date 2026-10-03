(function () {
  const MODE = window.DUP_MODE || "notice"; // notice = jump+highlight existing; openedit = open its edit screen directly

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
    for(const key in KNOWN){if(clean.startsWith(key.toLowerCase())){const k=KNOWN[key];return{url,norm:clean,title:k.title,site:k.site,desc:k.desc,thumb:thumbSVG(k.site,k.c1,k.c2),fav:favSVG(k.letter,k.c1)};}}
    const host=clean.split("/")[0];const path=clean.split("/").slice(1).join("/");
    let t=path?decodeURIComponent(path.split(/[/?#]/)[0]).replace(/[-_]+/g," ").replace(/\.\w+$/,"").trim():host;
    t=t?t.replace(/\b\w/g,c=>c.toUpperCase()):host;const col=hashColor(host);
    return{url,norm:clean,title:t||host,site:host,desc:"",thumb:thumbSVG(host,col,"#8894a8"),fav:favSVG((host[0]||"?").toUpperCase(),col)};
  }
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const listEl=document.getElementById("list");
  const emptyEl=document.getElementById("empty");
  const input=document.getElementById("url");
  const btn=document.getElementById("saveBtn");
  const stage=document.getElementById("stage");

  function refreshEmpty(){emptyEl.style.display=listEl.children.length?"none":"block";}
  function savedLabel(){const d=new Date();return "Saved · "+d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}

  function findExisting(norm){
    return Array.from(listEl.children).find(c => c._data && c._data.norm === norm);
  }
  function flash(card){
    card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash");
    card.scrollIntoView({behavior:"smooth", block:"center"});
  }

  function openEditScreen(m, isNew, existingCard, savedText, labelText){
    btn.disabled = true;
    stage.innerHTML =
      '<div class="preview"><div class="plabel">'+esc(labelText||(isNew?"Check the details, adjust if needed, then Save":"Edit details"))+'</div>'+
      '<div class="card" style="animation:none;margin:0 0 10px;">'+
        '<div class="thumb"><img alt="" src="'+m.thumb+'"></div>'+
        '<div class="card-body">'+
          '<input class="edit-field" data-p="title" value="'+esc(m.title)+'">'+
          '<div class="card-site"><img alt="" src="'+m.fav+'"><span>'+esc(m.site)+'</span></div>'+
          '<textarea class="edit-field" data-p="desc">'+esc(m.desc||"")+'</textarea>'+
          '<div class="card-url">'+esc(m.url)+'</div>'+
        '</div></div>'+
      '<div class="card-actions"><button class="btn" data-p="ok">Save</button>'+
      '<button class="btn secondary" data-p="cancel">Cancel</button></div></div>';
    const titleField=stage.querySelector('[data-p="title"]'); titleField.focus();
    stage.querySelector('[data-p="ok"]').addEventListener("click",()=>{
      m.title=titleField.value; m.desc=stage.querySelector('[data-p="desc"]').value;
      stage.innerHTML=""; btn.disabled=false;
      if(isNew){ const c=addCard(m); input.value=""; input.focus(); flash(c); }
      else { fillCard(existingCard,m,savedText); flash(existingCard); }
    });
    stage.querySelector('[data-p="cancel"]').addEventListener("click",()=>{ stage.innerHTML=""; btn.disabled=false; input.focus(); });
    stage.scrollIntoView({behavior:"smooth", block:"nearest"});
  }

  function fillCard(card,m,savedText){
    card._data=m;
    card.innerHTML=
      '<div class="thumb"><img alt="" src="'+m.thumb+'"></div>'+
      '<div class="card-body">'+
        '<div class="card-title">'+esc(m.title)+'</div>'+
        '<div class="card-site"><img alt="" src="'+m.fav+'"><span>'+esc(m.site)+'</span></div>'+
        '<p class="card-desc">'+esc(m.desc||"No description found on the page.")+'</p>'+
        '<div class="card-url">'+esc(m.url)+'</div>'+
        '<div class="card-meta">'+(savedText||savedLabel())+'</div>'+
        '<div class="card-actions"><button class="btn small secondary" data-act="edit">Edit</button></div>'+
      '</div>';
    card.querySelector('[data-act="edit"]').addEventListener("click",()=>{
      openEditScreen({...card._data}, false, card, card.querySelector(".card-meta").textContent);
    });
  }
  function addCard(m,savedText){const card=document.createElement("div");card.className="card";fillCard(card,m,savedText);listEl.prepend(card);refreshEmpty();return card;}

  function showDuplicateNotice(card){
    stage.innerHTML='<div class="banner"><span>🔖 You already saved this link — here it is below.</span>'+
      '<button class="btn small" data-b="edit">Update it</button></div>';
    stage.querySelector('[data-b="edit"]').addEventListener("click",()=>{
      stage.innerHTML="";
      openEditScreen({...card._data}, false, card, card.querySelector(".card-meta").textContent);
    });
    flash(card);
    input.value=""; btn.disabled=false;
  }

  function save(){
    const url=input.value.trim();
    if(!url){input.focus();return;}
    const norm=normalize(url);
    const existing=findExisting(norm);
    if(existing){
      if(MODE==="openedit"){
        openEditScreen({...existing._data}, false, existing, existing.querySelector(".card-meta").textContent,
                       "Already saved — update existing bookmark");
        input.value="";
        flash(existing);
      } else {
        showDuplicateNotice(existing);
      }
      return;
    }
    btn.disabled=true;
    stage.innerHTML='<div class="preview"><div class="plabel">Fetching page details…</div><div class="skeleton w70"></div><div class="skeleton w90"></div><div class="skeleton w40"></div></div>';
    setTimeout(()=>{ openEditScreen(lookup(url), true, null, null); }, 850);
  }

  btn.addEventListener("click",save);
  input.addEventListener("keydown",e=>{if(e.key==="Enter")save();});

  addCard(lookup("https://recipes.example.com/ramen"), "Saved · Aug 10, 2026");
  addCard(lookup("https://nasa.gov/webb"), "Saved · Aug 2, 2026");

  refreshEmpty();
  document.body.setAttribute("data-harness-ready","true");
})();
