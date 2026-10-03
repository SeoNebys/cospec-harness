// Shared card rendering for the "open the page" interaction comparison.
// The three variants differ ONLY in window.OPEN_MODE: 'card' | 'title' | 'action'.
(function(){
  const PALETTE = ["#4a6b57","#7a5c8a","#b5713f","#3f6f8a"];
  function colorFor(s){ let h=0; for(const c of (s||"x")) h=(h*31+c.charCodeAt(0))>>>0; return PALETTE[h%PALETTE.length]; }
  function esc(s){ return (s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
  const DATA = [
    { url:"https://www.smashingmagazine.com/calm-interfaces", domain:"smashingmagazine.com", mono:"S",
      title:"Designing Calm Interfaces — Smashing Magazine",
      desc:"Principles for building software that respects a user's attention.",
      preview:"Calm Interfaces", tags:["reading","design"], readLater:true },
    { url:"https://en.wikipedia.org/wiki/Spaced_repetition", domain:"en.wikipedia.org", mono:"W",
      title:"Spaced repetition — Wikipedia",
      desc:"A learning technique using increasing intervals between reviews of learned material.",
      preview:null, tags:["learning"], readLater:false }
  ];
  const mode = window.OPEN_MODE || "card";
  let toastTimer;
  function toast(msg){ const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),2200); }
  function openPage(b){ toast("Opening “"+b.title+"” in a new tab…"); }
  function openEditor(b){ toast("Opening the editor for “"+b.title+"”…"); }

  const list=document.getElementById("list");
  DATA.forEach(b=>{
    const col=colorFor(b.domain);
    const item=document.createElement("div"); item.className="item"+(mode==="card"?" card-clickable":"");
    const thumb=b.preview?`<div class="thumb" style="background:linear-gradient(135deg,${col},${col})">${esc(b.preview)}</div>`:"";
    const titleHtml = mode==="title"
      ? `<div class="favicon link" style="background:${col}" data-open="1">${esc(b.mono)}</div><p class="title link" data-open="1">${esc(b.title)}</p>`
      : `<div class="favicon" style="background:${col}">${esc(b.mono)}</div><p class="title">${esc(b.title)}</p>`;
    const openAction = mode==="action" ? `<button class="openbtn" data-open="1">Open ↗</button>` : "";
    item.innerHTML = thumb + `
      <div class="body">
        <div class="titleline">${titleHtml}</div>
        ${b.desc?`<p class="desc">${esc(b.desc)}</p>`:""}
        <div class="chips">${b.readLater?`<span class="badge">Read later</span>`:""}${b.tags.map(t=>`<span class="chip">${esc(t)}</span>`).join("")}</div>
        ${openAction}
        <p class="url">${esc(b.url)}</p>
      </div>
      <span class="edit" data-edit="1">Edit</span>`;

    // Edit is identical across all variants
    item.querySelector("[data-edit]").addEventListener("click", e=>{ e.stopPropagation(); openEditor(b); });

    if(mode==="card"){
      item.addEventListener("click", ()=> openPage(b));
    } else {
      item.querySelectorAll("[data-open]").forEach(el=> el.addEventListener("click", e=>{ e.stopPropagation(); openPage(b); }));
    }
    list.appendChild(item);
  });

  document.body.setAttribute("data-harness-ready","true");
})();
