// Shared rendering for the "change read status" interaction comparison.
// Variants differ ONLY in window.STATUS_MODE: 'check' | 'badge' | 'action'.
// The filter (All / To read / Finished) is identical across all three.
(function(){
  const PALETTE=["#4a6b57","#7a5c8a","#b5713f","#3f6f8a"];
  function colorFor(s){ let h=0; for(const c of (s||"x")) h=(h*31+c.charCodeAt(0))>>>0; return PALETTE[h%PALETTE.length]; }
  function esc(s){ return (s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
  const DATA=[
    {id:5,domain:"github.com",mono:"G",title:"sindresorhus/awesome",desc:"A community-driven collection of awesome resources.",preview:"GitHub",tags:["tools"],readLater:true},
    {id:4,domain:"en.wikipedia.org",mono:"W",title:"Spaced repetition — Wikipedia",desc:"A learning technique using increasing intervals between reviews.",preview:null,tags:["learning"],readLater:false},
    {id:3,domain:"nytimes.com",mono:"N",title:"The Quiet Power of Reading Slowly",desc:"Why unhurried reading may be the antidote to information overload.",preview:"NYT",tags:["reading"],readLater:true},
    {id:2,domain:"developer.mozilla.org",mono:"M",title:"Array.prototype.reduce() — MDN",desc:"Executes a reducer on each element, resulting in a single value.",preview:"MDN",tags:["javascript"],readLater:true},
    {id:1,domain:"smashingmagazine.com",mono:"S",title:"Designing Calm Interfaces",desc:"Principles for building software that respects attention.",preview:"Calm",tags:["reading","design"],readLater:true}
  ];
  const mode=window.STATUS_MODE||"check";
  let filter="all";
  let toastTimer;
  function toast(msg){ const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),1800); }

  function counts(){ return { all:DATA.length, toread:DATA.filter(b=>b.readLater).length, finished:DATA.filter(b=>!b.readLater).length }; }
  function visible(){ return DATA.filter(b=> filter==="all" ? true : filter==="toread" ? b.readLater : !b.readLater); }

  function setStatus(b, toRead){ b.readLater=toRead; toast(toRead? "Moved to “To read”" : "Marked as read"); renderAll(); }

  function renderFilter(){
    const c=counts();
    const f=document.getElementById("filter");
    const defs=[["all","All",c.all],["toread","To read",c.toread],["finished","Finished",c.finished]];
    f.innerHTML=defs.map(([k,label,n])=>`<button data-f="${k}" class="${filter===k?'active':''}">${label}<span class="n">${n}</span></button>`).join("");
    f.querySelectorAll("button").forEach(btn=> btn.onclick=()=>{ filter=btn.dataset.f; renderAll(); });
  }

  function statusControl(b){
    if(mode==="check"){
      return `<div class="check ${b.readLater?'':'on'}" data-toggle="1" title="${b.readLater?'Mark as read':'Move back to To read'}">${b.readLater?'':'✓'}</div>`;
    }
    return "";
  }
  function statusBadge(b){
    if(mode==="badge"){
      return b.readLater
        ? `<span class="badge toggle" data-toggle="1" title="Click to mark as read">Read later</span>`
        : `<span class="badge read toggle" data-toggle="1" title="Click to move back to To read">Read ✓</span>`;
    }
    // non-badge modes still show a (non-interactive) status label
    return b.readLater ? `<span class="badge">Read later</span>` : `<span class="badge read">Read ✓</span>`;
  }
  function statusAction(b){
    if(mode==="action"){
      return b.readLater
        ? `<button class="statusbtn" data-toggle="1">Mark as read</button>`
        : `<button class="statusbtn" data-toggle="1">Move back to “To read”</button>`;
    }
    return "";
  }

  function renderList(){
    const list=document.getElementById("list");
    const vis=visible();
    if(!vis.length){
      const msg = filter==="toread" ? "Nothing left to read — you're all caught up." :
                  filter==="finished" ? "Nothing finished yet." : "Nothing here yet.";
      list.innerHTML=`<div class="empty"><div class="big">${msg}</div></div>`;
      return;
    }
    list.innerHTML="";
    vis.forEach(b=>{
      const col=colorFor(b.domain);
      const item=document.createElement("div"); item.className="item"+(b.readLater?"":" done");
      const thumb=b.preview?`<div class="thumb" style="background:linear-gradient(135deg,${col},${col})">${esc(b.preview)}</div>`:"";
      item.innerHTML = (mode==="check"? statusControl(b):"") + thumb + `
        <div class="body">
          <div class="titleline"><div class="favicon" style="background:${col}">${esc(b.mono)}</div><p class="title">${esc(b.title)}</p></div>
          <p class="desc">${esc(b.desc)}</p>
          <div class="chips">${statusBadge(b)}${b.tags.map(t=>`<span class="chip">${esc(t)}</span>`).join("")}</div>
          ${statusAction(b)}
        </div>`;
      item.querySelectorAll("[data-toggle]").forEach(el=> el.addEventListener("click", e=>{ e.stopPropagation(); setStatus(b, !b.readLater); }));
      list.appendChild(item);
    });
  }

  function renderAll(){ renderFilter(); renderList(); }
  renderAll();
  document.body.setAttribute("data-harness-ready","true");
})();
