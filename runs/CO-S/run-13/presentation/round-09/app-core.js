// Shared front-of-list behaviour: search + filtering + tag suggestions.
// Loaded after tags-shared.js. Filter-variant pages set window.TAGS_CLICKABLE
// and/or define window.onRender() and their own filter UI; everything else here
// is identical between them.

let query = "";
let activeTag = null;

function matchesQuery(bm, q){
  if (!q) return true;
  const hay = [bm.title, bm.desc, bm.site, bm.url, bm.note, bm.tags.join(" ")].join(" ").toLowerCase();
  return hay.indexOf(q) >= 0;
}
function matchesTag(bm){
  if (!activeTag) return true;
  return bm.tags.map(t=>t.toLowerCase()).indexOf(activeTag.toLowerCase()) >= 0;
}
function hl(text){
  if (!query) return escapeHtml(text);
  const t=text||"", lc=t.toLowerCase(), q=query; let out="", i=0;
  while (true){ const idx=lc.indexOf(q,i); if(idx<0){ out+=escapeHtml(t.slice(i)); break; }
    out+=escapeHtml(t.slice(i,idx))+"<mark>"+escapeHtml(t.slice(idx,idx+q.length))+"</mark>"; i=idx+q.length; }
  return out;
}

render = function(){
  const list=$("list"); list.innerHTML="";
  const shown = bookmarks.filter(bm => matchesTag(bm) && matchesQuery(bm, query));
  const total = bookmarks.length;
  const filtering = query || activeTag;
  $("count").textContent = filtering ? "showing "+shown.length+" of "+total : (total ? total+(total===1?" link":" links") : "");
  if (!shown.length){
    $("empty").style.display="block";
    $("empty").innerHTML = filtering
      ? '<p>No bookmarks match your filter.<br/>Try a different word or tag.</p>'
      : '<p>No bookmarks yet.<br/>Paste a web address above to save your first one.</p>';
  } else {
    $("empty").style.display="none";
    shown.forEach(bm => {
      const li=document.createElement("li"); li.className="bm-item";
      const thumb = bm.preview ? '<img class="thumb" src="'+bm.preview+'" alt="preview" />' : '<div class="thumb-none">No preview</div>';
      const tagClass = window.TAGS_CLICKABLE ? 'tag clickable' : 'tag';
      li.innerHTML = thumb + '<div class="body">'+
        '<p class="title"><a href="'+bm.url+'" target="_blank" rel="noopener">'+hl(bm.title)+'</a></p>'+
        '<div class="site-row">'+faviconHtml(bm.host,16)+'<span class="site">'+hl(bm.site)+'</span></div>'+
        (bm.desc ? '<p class="desc">'+hl(bm.desc)+'</p>' : '')+
        (bm.tags.length ? '<div class="tags">'+bm.tags.map(t=>'<span class="'+tagClass+'" data-tag="'+escapeHtml(t)+'"'+(window.TAGS_CLICKABLE?' title="Filter by this tag"':'')+'>'+hl(t)+'</span>').join('')+'</div>' : '')+
        (bm.note ? '<div class="note">'+hl(bm.note)+'</div>' : '')+
      '</div>';
      list.appendChild(li);
    });
  }
  if (typeof window.onRender === "function") window.onRender(shown);
};

// ---- Version A tag suggestions (approved) ----
function segmentInfo(){
  const val=$("tags").value, lastComma=val.lastIndexOf(",");
  const prefix = lastComma>=0 ? val.slice(0,lastComma+1)+" " : "";
  const seg = (lastComma>=0 ? val.slice(lastComma+1) : val).trim();
  const already = val.split(",").map(t=>t.trim().toLowerCase()).filter(Boolean);
  return { prefix, seg, already };
}
function tagMatches(seg, already){
  const s=seg.toLowerCase();
  return existingTags().filter(t => t.toLowerCase().includes(s) && already.indexOf(t.toLowerCase())<0).slice(0,6);
}
function showSuggest(){
  const box=$("tagSuggest"); const { seg, already }=segmentInfo();
  if(!seg){ box.style.display="none"; return; }
  const opts=tagMatches(seg,already);
  if(!opts.length){ box.style.display="none"; return; }
  box.dataset.active="-1";
  box.innerHTML=opts.map(t=>'<div class="opt" data-tag="'+escapeHtml(t)+'"><span class="dot"></span>'+escapeHtml(t)+'<small>existing tag</small></div>').join("");
  box.style.display="block";
  box.querySelectorAll(".opt").forEach(el=>el.addEventListener("mousedown",e=>{e.preventDefault();addSuggestedTag(el.getAttribute("data-tag"));}));
}
function addSuggestedTag(tag){ const { prefix }=segmentInfo(); $("tags").value=prefix+tag+", "; $("tagSuggest").style.display="none"; $("tags").focus(); }

function initSearchAndTags(){
  $("search").addEventListener("input", ()=>{ query=$("search").value.trim().toLowerCase(); render(); });
  $("tags").addEventListener("input", showSuggest);
  $("tags").addEventListener("keydown", e=>{
    const box=$("tagSuggest"); if(box.style.display!=="block") return;
    const opts=[...box.querySelectorAll(".opt")]; let ai=parseInt(box.dataset.active||"-1",10);
    if(e.key==="ArrowDown"){ e.preventDefault(); ai=(ai+1)%opts.length; }
    else if(e.key==="ArrowUp"){ e.preventDefault(); ai=(ai-1+opts.length)%opts.length; }
    else if(e.key==="Enter" && ai>=0){ e.preventDefault(); addSuggestedTag(opts[ai].getAttribute("data-tag")); return; }
    else return;
    box.dataset.active=ai; opts.forEach((o,i)=>o.classList.toggle("active",i===ai));
  });
  $("tags").addEventListener("blur", ()=> setTimeout(()=>$("tagSuggest").style.display="none",120));
  if (window.TAGS_CLICKABLE){
    $("list").addEventListener("click", e=>{
      const chip=e.target.closest(".tag.clickable"); if(!chip) return;
      activeTag = chip.getAttribute("data-tag"); render();
    });
  }
}

function initCore(){ initApp(); initSearchAndTags(); if (typeof window.onInit==="function") window.onInit(); render(); }
