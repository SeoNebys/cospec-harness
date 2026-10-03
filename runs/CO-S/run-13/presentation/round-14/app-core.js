// Shared front-of-list behaviour: search + filtering + tag suggestions.
// Loaded after tags-shared.js. Filter-variant pages set window.TAGS_CLICKABLE
// and/or define window.onRender() and their own filter UI; everything else here
// is identical between them.

let query = "";
let activeTag = null;
let sortMode = "new"; // new | old | az | za
let view = "all";     // all | later | archived
let editingId = null; // id of the bookmark currently being edited inline

function matchesView(bm){
  if (view==="archived") return !!bm.archived;
  if (view==="later") return !!bm.readLater && !bm.archived;
  return !bm.archived; // "all" excludes archived so it stays uncluttered
}

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

function sortShown(arr){
  const by = {
    new: (a,b)=> (b.savedAt||0) - (a.savedAt||0),
    old: (a,b)=> (a.savedAt||0) - (b.savedAt||0),
    az:  (a,b)=> (a.title||"").localeCompare(b.title||"", undefined, {sensitivity:"base"}),
    za:  (a,b)=> (b.title||"").localeCompare(a.title||"", undefined, {sensitivity:"base"})
  };
  return arr.slice().sort(by[sortMode] || by.new);
}

function syncTabs(){
  if (!$("viewTabs")) return;
  const allN = bookmarks.filter(b=>!b.archived).length;
  const laterN = bookmarks.filter(b=>b.readLater && !b.archived).length;
  const archN = bookmarks.filter(b=>b.archived).length;
  const btnAll=$("viewTabs").querySelector('[data-view="all"]');
  const btnLater=$("viewTabs").querySelector('[data-view="later"]');
  const btnArch=$("viewTabs").querySelector('[data-view="archived"]');
  if (btnAll) btnAll.innerHTML = 'All bookmarks <span class="tabn">'+allN+'</span>';
  if (btnLater) btnLater.innerHTML = 'Read later <span class="tabn">'+laterN+'</span>';
  if (btnArch) btnArch.innerHTML = 'Archived <span class="tabn">'+archN+'</span>';
  $("viewTabs").querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active', b.getAttribute('data-view')===view));
}

render = function(){
  syncTabs();
  const list=$("list"); list.innerHTML="";
  const shown = sortShown(bookmarks.filter(bm => matchesView(bm) && matchesTag(bm) && matchesQuery(bm, query)));
  const viewTotal = bookmarks.filter(matchesView).length;
  const filtering = query || activeTag;
  $("count").textContent = filtering ? "showing "+shown.length+" of "+viewTotal : (viewTotal ? viewTotal+(viewTotal===1?" link":" links") : "");
  if (!shown.length){
    $("empty").style.display="block";
    $("empty").innerHTML = filtering
      ? '<p>No bookmarks match your filter.<br/>Try a different word or tag.</p>'
      : (view==="later"
          ? '<p>Your read-later list is empty.<br/>Use “Read later” on a bookmark to add it here.</p>'
          : view==="archived"
            ? '<p>No archived bookmarks.<br/>Use “Archive” to keep a link here without cluttering your main list.</p>'
            : '<p>No bookmarks yet.<br/>Paste a web address above to save your first one.</p>');
  } else {
    $("empty").style.display="none";
    shown.forEach(bm => {
      const li=document.createElement("li"); li.className="bm-item"; li.dataset.id=bm.id;
      const thumb = bm.preview ? '<img class="thumb" src="'+bm.preview+'" alt="preview" />' : '<div class="thumb-none">No preview</div>';
      if (bm.id===editingId){
        li.classList.add("editing");
        li.innerHTML = thumb + '<div class="body editform">'+
          '<div class="editrow"><label>Title</label><input class="ed-title" type="text" value="'+escapeHtml(bm.title)+'"></div>'+
          '<div class="editrow"><label>Description</label><textarea class="ed-desc">'+escapeHtml(bm.desc)+'</textarea></div>'+
          '<div class="editrow"><label>Tags (comma separated)</label><input class="ed-tags" type="text" value="'+escapeHtml(bm.tags.join(", "))+'"></div>'+
          '<div class="editrow"><label>Note</label><textarea class="ed-note">'+escapeHtml(bm.note)+'</textarea></div>'+
          '<div class="site-row" style="margin-top:6px">'+faviconHtml(bm.host,16)+'<span class="site">'+escapeHtml(bm.url)+'</span></div>'+
          '<div class="cardactions">'+
            '<button class="btn-primary" data-act="edit-save" data-id="'+bm.id+'">Save changes</button>'+
            '<button class="linkbtn" data-act="edit-cancel" data-id="'+bm.id+'">Cancel</button>'+
          '</div>'+
        '</div>';
        list.appendChild(li); return;
      }
      const tagClass = (window.TAGS_CLICKABLE && !bm.archived) ? 'tag clickable' : 'tag';
      li.innerHTML = thumb + '<div class="body">'+
        '<p class="title"><a href="'+bm.url+'" target="_blank" rel="noopener">'+hl(bm.title)+'</a></p>'+
        '<div class="site-row">'+faviconHtml(bm.host,16)+'<span class="site">'+hl(bm.site)+'</span></div>'+
        (bm.desc ? '<p class="desc">'+hl(bm.desc)+'</p>' : '')+
        (bm.tags.length ? '<div class="tags">'+bm.tags.map(t=>'<span class="'+tagClass+'" data-tag="'+escapeHtml(t)+'"'+(window.TAGS_CLICKABLE?' title="Filter by this tag"':'')+'>'+hl(t)+'</span>').join('')+'</div>' : '')+
        (bm.note ? '<div class="note">'+hl(bm.note)+'</div>' : '')+
        (window.SHOW_READLATER ? '<div class="cardactions">'+
           (bm.archived
             ? '<button class="linkbtn" data-act="archive" data-id="'+bm.id+'">↩ Restore to bookmarks</button>'
             : '<button class="linkbtn'+(bm.readLater?' on':'')+'" data-act="later" data-id="'+bm.id+'">'+
                 (bm.readLater? '✓ In read later' : '+ Read later')+'</button>'+
               '<button class="linkbtn" data-act="archive" data-id="'+bm.id+'">Archive</button>')+
           '<button class="linkbtn" data-act="edit" data-id="'+bm.id+'">Edit</button>'+
         '</div>' : '')+
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
  if ($("sort")) $("sort").addEventListener("change", ()=>{ sortMode=$("sort").value; render(); });
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
  $("list").addEventListener("click", e=>{
    const chip=e.target.closest(".tag.clickable");
    if (window.TAGS_CLICKABLE && chip){ activeTag = chip.getAttribute("data-tag"); render(); return; }
    const laterBtn=e.target.closest('[data-act="later"]');
    if (laterBtn){ const bm=findById(parseInt(laterBtn.getAttribute("data-id"),10)); if(bm){ bm.readLater=!bm.readLater; render(); } return; }
    const archBtn=e.target.closest('[data-act="archive"]');
    if (archBtn){ const bm=findById(parseInt(archBtn.getAttribute("data-id"),10)); if(bm){ bm.archived=!bm.archived; render(); } return; }
    const editBtn=e.target.closest('[data-act="edit"]');
    if (editBtn){ editingId=parseInt(editBtn.getAttribute("data-id"),10); render();
      const el=document.querySelector('li.bm-item[data-id="'+editingId+'"]'); if(el) el.scrollIntoView({block:"center"}); return; }
    const saveEdit=e.target.closest('[data-act="edit-save"]');
    if (saveEdit){ const bm=findById(parseInt(saveEdit.getAttribute("data-id"),10));
      if(bm){ const li=saveEdit.closest("li");
        const t=li.querySelector(".ed-title").value.trim();
        bm.title = t || bm.title;
        bm.desc = li.querySelector(".ed-desc").value.trim();
        bm.tags = li.querySelector(".ed-tags").value.split(",").map(x=>x.trim()).filter(Boolean);
        bm.note = li.querySelector(".ed-note").value.trim();
      }
      editingId=null; render();
      const f=$("flash"); f.textContent="Changes saved."; f.style.display="block"; setTimeout(()=>f.style.display="none",3000);
      return; }
    const cancelEdit=e.target.closest('[data-act="edit-cancel"]');
    if (cancelEdit){ editingId=null; render(); return; }
  });
  if ($("viewTabs")){
    $("viewTabs").querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener("click", ()=>{
      view=btn.getAttribute("data-view"); render();
    }));
  }
}

function initCore(){ initApp(); initSearchAndTags(); if (typeof window.onInit==="function") window.onInit(); render(); }
