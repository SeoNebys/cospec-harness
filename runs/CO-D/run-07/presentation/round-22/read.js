(function () {
  const MODE = window.VIEW_MODE || "tabs"; // tabs | segment | sections

  function thumbSVG(site,c1,c2){const s="<svg xmlns='http://www.w3.org/2000/svg' width='320' height='224'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='"+c1+"'/><stop offset='1' stop-color='"+c2+"'/></linearGradient></defs><rect width='320' height='224' fill='url(#g)'/><rect x='0' y='168' width='320' height='56' fill='rgba(0,0,0,0.18)'/><text x='22' y='104' font-family='sans-serif' font-size='34' font-weight='700' fill='rgba(255,255,255,0.96)'>"+site+"</text></svg>";return "data:image/svg+xml;utf8,"+encodeURIComponent(s);}
  function favSVG(l,c1){const s="<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' rx='7' fill='"+c1+"'/><text x='16' y='22' text-anchor='middle' font-family='sans-serif' font-size='18' font-weight='700' fill='#fff'>"+l+"</text></svg>";return "data:image/svg+xml;utf8,"+encodeURIComponent(s);}
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const data=[
    {title:"Rome in 3 Days — City Guide", site:"guide.example.com", url:"https://guide.example.com/rome", tags:["travel","article"], thumb:thumbSVG("guide.example.com","#7c2d12","#d97706"), fav:favSVG("G","#7c2d12"), status:"toread", saved:"Saved · Aug 5, 2026"},
    {title:"SPQR: A History of Ancient Rome", site:"books.example.com", url:"https://books.example.com/spqr", tags:["book","history"], thumb:thumbSVG("books.example.com","#3730a3","#6366f1"), fav:favSVG("B","#3730a3"), status:"toread", saved:"Saved · Aug 4, 2026"},
    {title:"Rich Tonkotsu Ramen from Scratch", site:"recipes.example.com", url:"https://recipes.example.com/ramen", tags:["recipes","cooking"], thumb:thumbSVG("recipes.example.com","#b45309","#f59e0b"), fav:favSVG("R","#b45309"), status:"finished", saved:"Saved · Aug 10, 2026"},
    {title:"CSS Grid Layout — MDN Web Docs", site:"developer.mozilla.org", url:"https://developer.mozilla.org/css-grid", tags:["reference","frontend"], thumb:thumbSVG("developer.mozilla.org","#111827","#4b5563"), fav:favSVG("M","#111827"), status:"finished", saved:"Saved · Aug 6, 2026"}
  ];

  const view=document.getElementById("view");
  let current="toread"; // for tabs/segment

  function count(st){return data.filter(d=>d.status===st).length;}

  function cardEl(d){
    const card=document.createElement("div");
    card.className="card";
    const badge='<span class="status-badge '+d.status+'">'+(d.status==="toread"?"To read":"Finished")+'</span>';
    const toggle=d.status==="toread"?'<button class="btn small" data-act="toggle">Mark as finished</button>':'<button class="btn small secondary" data-act="toggle">Move to To-read</button>';
    card.innerHTML=
      '<div class="thumb"><img alt="" src="'+d.thumb+'"></div>'+
      '<div class="card-body">'+
        badge+
        '<div class="card-title">'+esc(d.title)+'</div>'+
        '<div class="card-site"><img alt="" src="'+d.fav+'"><span>'+esc(d.site)+'</span></div>'+
        '<div class="tags">'+d.tags.map(t=>'<span class="tag">#'+esc(t)+'</span>').join("")+'</div>'+
        '<div class="card-url">'+esc(d.url)+'</div>'+
        '<div class="card-meta">'+esc(d.saved)+'</div>'+
        '<div class="card-actions">'+toggle+'</div>'+
      '</div>';
    card.querySelector('[data-act="toggle"]').addEventListener("click",()=>{
      d.status=d.status==="toread"?"finished":"toread"; render();
    });
    return card;
  }

  function render(){
    view.innerHTML="";
    if(MODE==="sections"){
      [["toread","To read"],["finished","Finished"]].forEach(([st,label])=>{
        const h=document.createElement("div"); h.className="group-title";
        h.innerHTML=label+' <span class="n">('+count(st)+')</span>';
        view.appendChild(h);
        const items=data.filter(d=>d.status===st);
        if(!items.length){const e=document.createElement("div");e.className="group-empty";e.textContent=st==="toread"?"Nothing left to read — nice.":"Nothing finished yet.";view.appendChild(e);}
        items.forEach(d=>view.appendChild(cardEl(d)));
      });
      return;
    }
    // tabs or segment: a selector + one list
    const sel=document.createElement("div");
    if(MODE==="tabs"){
      sel.className="tabs";
      sel.innerHTML=
        '<button data-v="toread">To read <span class="n">('+count("toread")+')</span></button>'+
        '<button data-v="finished">Finished <span class="n">('+count("finished")+')</span></button>';
    } else {
      sel.className="segment";
      sel.innerHTML=
        '<button data-v="all">All</button>'+
        '<button data-v="toread">To read</button>'+
        '<button data-v="finished">Finished</button>';
    }
    sel.querySelectorAll("button").forEach(btn=>{
      if(btn.getAttribute("data-v")===current) btn.classList.add("active");
      btn.addEventListener("click",()=>{current=btn.getAttribute("data-v");render();});
    });
    view.appendChild(sel);
    const items=data.filter(d=>current==="all"?true:d.status===current);
    if(!items.length){const e=document.createElement("div");e.className="empty";e.textContent="Nothing here.";view.appendChild(e);}
    items.forEach(d=>view.appendChild(cardEl(d)));
  }

  render();
  document.body.setAttribute("data-harness-ready","true");
})();
