(function () {
  const MODE = window.TAG_MODE || "chip"; // chip = type+Enter chips; suggest = chips + suggestions from existing; comma = comma-separated text

  function hashColor(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))&0xffffff;return "#"+((h|0x404040)&0x9f9f9f).toString(16).padStart(6,"0");}
  function thumbSVG(site,c1,c2){const s="<svg xmlns='http://www.w3.org/2000/svg' width='320' height='224'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='"+c1+"'/><stop offset='1' stop-color='"+c2+"'/></linearGradient></defs><rect width='320' height='224' fill='url(#g)'/><rect x='0' y='168' width='320' height='56' fill='rgba(0,0,0,0.18)'/><text x='22' y='104' font-family='sans-serif' font-size='34' font-weight='700' fill='rgba(255,255,255,0.96)'>"+site+"</text></svg>";return "data:image/svg+xml;utf8,"+encodeURIComponent(s);}
  function favSVG(l,c1){const s="<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' rx='7' fill='"+c1+"'/><text x='16' y='22' text-anchor='middle' font-family='sans-serif' font-size='18' font-weight='700' fill='#fff'>"+l+"</text></svg>";return "data:image/svg+xml;utf8,"+encodeURIComponent(s);}
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const listEl=document.getElementById("list");
  const stage=document.getElementById("stage");

  // seed bookmarks, some already tagged so suggestions have material
  const seeds=[
    {url:"https://recipes.example.com/ramen", title:"Rich Tonkotsu Ramen from Scratch — Recipes", site:"recipes.example.com",
     desc:"A weekend project: 12-hour pork bone broth, homemade tare, and springy noodles.",
     thumb:thumbSVG("recipes.example.com","#b45309","#f59e0b"), fav:favSVG("R","#b45309"),
     tags:["recipes","cooking"], note:"Try on a free weekend.", saved:"Saved · Aug 10, 2026"},
    {url:"https://developer.mozilla.org/css-grid", title:"CSS Grid Layout — MDN Web Docs", site:"developer.mozilla.org",
     desc:"A complete guide to CSS Grid: rows, columns, areas, and alignment.",
     thumb:thumbSVG("developer.mozilla.org","#111827","#4b5563"), fav:favSVG("M","#111827"),
     tags:["reference","frontend"], note:"", saved:"Saved · Aug 6, 2026"},
    {url:"https://nasa.gov/webb", title:"James Webb Space Telescope", site:"nasa.gov",
     desc:"The largest, most powerful space telescope ever built.",
     thumb:thumbSVG("nasa.gov","#0b3d91","#2f6df6"), fav:favSVG("N","#0b3d91"),
     tags:[], note:"", saved:"Saved · Aug 2, 2026"}
  ];

  function allTags(){
    const set=new Set();
    Array.from(listEl.children).forEach(c=>(c._data.tags||[]).forEach(t=>set.add(t)));
    return Array.from(set).sort();
  }

  function tagsHTML(tags){
    if(!tags||!tags.length) return "";
    return '<div class="tags">'+tags.map(t=>'<span class="tag">#'+esc(t)+'</span>').join("")+'</div>';
  }
  function fillCard(card,m){
    card._data=m;
    card.innerHTML=
      '<div class="thumb"><img alt="" src="'+m.thumb+'"></div>'+
      '<div class="card-body">'+
        '<div class="card-title">'+esc(m.title)+'</div>'+
        '<div class="card-site"><img alt="" src="'+m.fav+'"><span>'+esc(m.site)+'</span></div>'+
        '<p class="card-desc">'+esc(m.desc||"No description found on the page.")+'</p>'+
        tagsHTML(m.tags)+
        (m.note?'<div class="note-line"><b>Note:</b> '+esc(m.note)+'</div>':'')+
        '<div class="card-url">'+esc(m.url)+'</div>'+
        '<div class="card-meta">'+esc(m.saved||"Saved")+'</div>'+
        '<div class="card-actions"><button class="btn small secondary" data-act="edit">Edit</button></div>'+
      '</div>';
    card.querySelector('[data-act="edit"]').addEventListener("click",()=>openEditScreen(card));
  }
  function addCard(m){const card=document.createElement("div");card.className="card";fillCard(card,m);listEl.append(card);return card;}

  function openEditScreen(card){
    const m=card._data;
    let workingTags=(m.tags||[]).slice();

    stage.innerHTML=
      '<div class="preview"><div class="plabel">Edit details</div>'+
      '<div class="card" style="animation:none;margin:0 0 10px;">'+
        '<div class="thumb"><img alt="" src="'+m.thumb+'"></div>'+
        '<div class="card-body">'+
          '<div class="field-label">Title</div>'+
          '<input class="edit-field" data-p="title" value="'+esc(m.title)+'">'+
          '<div class="field-label">Description</div>'+
          '<textarea class="edit-field" data-p="desc">'+esc(m.desc||"")+'</textarea>'+
          '<div class="field-label">Your tags</div>'+
          tagEditorHTML()+
          '<div class="field-label">Your note</div>'+
          '<textarea class="edit-field" data-p="note" placeholder="Why did you save this? (optional)">'+esc(m.note||"")+'</textarea>'+
        '</div></div>'+
      '<div class="card-actions"><button class="btn" data-p="ok">Save</button>'+
      '<button class="btn secondary" data-p="cancel">Cancel</button></div></div>';

    wireTagEditor(workingTags);

    stage.querySelector('[data-p="ok"]').addEventListener("click",()=>{
      m.title=stage.querySelector('[data-p="title"]').value;
      m.desc=stage.querySelector('[data-p="desc"]').value;
      m.note=stage.querySelector('[data-p="note"]').value.trim();
      m.tags=readTags(workingTags);
      stage.innerHTML=""; fillCard(card,m);
      card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash");
      card.scrollIntoView({behavior:"smooth",block:"center"});
    });
    stage.querySelector('[data-p="cancel"]').addEventListener("click",()=>{ stage.innerHTML=""; });
    stage.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  // ---- tag editor: three interaction variants ----
  function tagEditorHTML(){
    if(MODE==="comma"){
      return '<input class="edit-field" data-t="comma" placeholder="e.g. space, science, reference">'+
             '<div class="hint">Separate tags with commas.</div>';
    }
    // chip and suggest share the chip box; suggest adds a suggestion row
    let html='<div class="tagbox" data-t="box"><input data-t="entry" placeholder="Type a tag, press Enter"></div>';
    if(MODE==="suggest") html+='<div class="field-label" style="margin-top:2px">Your existing tags — click to add</div><div class="suggest" data-t="suggest"></div>';
    return html;
  }
  function wireTagEditor(workingTags){
    if(MODE==="comma"){
      stage.querySelector('[data-t="comma"]').value=workingTags.join(", ");
      return;
    }
    const box=stage.querySelector('[data-t="box"]');
    const entry=stage.querySelector('[data-t="entry"]');
    function render(){
      box.querySelectorAll(".tag").forEach(n=>n.remove());
      workingTags.forEach((t,i)=>{
        const el=document.createElement("span");
        el.className="tag"; el.innerHTML='#'+esc(t)+' <span class="x">×</span>';
        el.querySelector(".x").addEventListener("click",()=>{workingTags.splice(i,1);render();refreshSuggest();});
        box.insertBefore(el, entry);
      });
    }
    function add(v){v=v.trim().replace(/^#/,"");if(v&&!workingTags.includes(v)){workingTags.push(v);}entry.value="";render();refreshSuggest();}
    entry.addEventListener("keydown",e=>{
      if(e.key==="Enter"||e.key===","){e.preventDefault();add(entry.value);}
      else if(e.key==="Backspace"&&!entry.value&&workingTags.length){workingTags.pop();render();refreshSuggest();}
    });
    box.addEventListener("click",()=>entry.focus());
    let refreshSuggest=()=>{};
    if(MODE==="suggest"){
      const sug=stage.querySelector('[data-t="suggest"]');
      refreshSuggest=()=>{
        const avail=allTags().filter(t=>!workingTags.includes(t));
        sug.innerHTML=avail.length?avail.map(t=>'<span class="chip">#'+esc(t)+'</span>').join(""):'<span class="hint">No other tags yet.</span>';
        sug.querySelectorAll(".chip").forEach(ch=>ch.addEventListener("click",()=>add(ch.textContent.replace(/^#/,""))));
      };
    }
    render(); refreshSuggest();
    entry._working=workingTags;
  }
  function readTags(workingTags){
    if(MODE==="comma"){
      return stage.querySelector('[data-t="comma"]').value.split(",").map(s=>s.trim().replace(/^#/,"")).filter(Boolean)
        .filter((v,i,a)=>a.indexOf(v)===i);
    }
    // capture any half-typed entry too
    const entry=stage.querySelector('[data-t="entry"]');
    if(entry && entry.value.trim()){const v=entry.value.trim().replace(/^#/,"");if(!workingTags.includes(v))workingTags.push(v);}
    return workingTags.slice();
  }

  seeds.forEach(addCard);
  document.body.setAttribute("data-harness-ready","true");
})();
