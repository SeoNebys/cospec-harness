// Shared prototype logic for the tag-suggestion comparison (Versions A and B).
// Identical in both versions; only the tag-suggestion interaction differs,
// and that part lives in each page's own inline script.

const $ = id => document.getElementById(id);

function banner(text, c1, c2){
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="135">'+
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'+
    '<stop offset="0" stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient></defs>'+
    '<rect width="240" height="135" fill="url(#g)"/>'+
    '<text x="16" y="120" font-family="Arial" font-size="16" fill="#ffffff" opacity="0.9">'+text+'</text></svg>';
  return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg);
}
const CANNED = {
  "nytimes.com":   { title:"The Science of a Good Night's Sleep", desc:"How small evening habits change how rested you feel.", site:"The New York Times", preview:banner("nytimes.com","#111827","#374151") },
  "github.com":    { title:"tldr-pages/tldr: Simplified man pages", desc:"Community-maintained help pages for command-line tools.", site:"GitHub", preview:banner("github.com","#24292f","#57606a") },
  "wikipedia.org": { title:"Bookmark (digital) — Wikipedia", desc:"A saved shortcut used to return to a web page later.", site:"Wikipedia", preview:banner("wikipedia.org","#3366cc","#6699ff") },
  "medium.com":    { title:"Designing Calm Software", desc:"An essay on interfaces that respect your attention.", site:"Medium", preview:banner("medium.com","#0f9d58","#34c77b") }
};
function domainOf(url){ try { return new URL(url).hostname.replace(/^www\./,""); } catch(e){ return ""; } }
function faviconColor(host){ let h=0; for (let i=0;i<host.length;i++){ h=(h*31+host.charCodeAt(i))>>>0; } return "hsl("+(h%360)+",55%,45%)"; }
function faviconHtml(host, size){ const letter=(host||"?").charAt(0).toUpperCase(); const s=size||18; return '<span class="favicon" style="background:'+faviconColor(host)+';width:'+s+'px;height:'+s+'px;font-size:'+Math.round(s*0.6)+'px">'+letter+'</span>'; }
function lookup(url){
  const host = domainOf(url);
  for (const key in CANNED){ if (host.endsWith(key)) return { ...CANNED[key] }; }
  const path = (function(){ try { return new URL(url).pathname; } catch(e){ return ""; } })();
  const slug = path.split("/").filter(Boolean).pop() || host;
  const pretty = slug.replace(/[-_]+/g," ").replace(/\.\w+$/,"").replace(/\b\w/g, c=>c.toUpperCase());
  return { title: pretty || host, desc:"", site: host, preview: null };
}
function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

const bookmarks = [];
let current = null;
let idSeq = 1;
function findById(id){ return bookmarks.find(b => b.id === id); }

// Pre-loaded example bookmarks so there are existing tags to suggest from.
function seed(){
  // savedAt increases with recency; listed newest-first by default.
  const day = 24*60*60*1000; const now = Date.now();
  const seeds = [
    { url:"https://en.wikipedia.org/wiki/Bookmark_(digital)", tags:["reference"], savedAt: now - 30*day, readLater:false, archived:true },
    { url:"https://medium.com/@writer/designing-calm-software", tags:["design","reading"], savedAt: now - 9*day, readLater:true },
    { url:"https://github.com/tldr-pages/tldr", tags:["work","reference","cli"], savedAt: now - 4*day, readLater:false },
    { url:"https://www.nytimes.com/2024/03/01/well/sleep-habits.html", tags:["reading","sleep"], savedAt: now - 1*day, readLater:true }
  ];
  seeds.forEach(s => {
    const d = lookup(s.url); const host = domainOf(s.url);
    bookmarks.push({ id:idSeq++, url:s.url, title:d.title, desc:d.desc, tags:s.tags, note:"", site:d.site||host, host:host, preview:d.preview, savedAt:s.savedAt, readLater:!!s.readLater, archived:!!s.archived });
  });
}
function existingTags(){
  const set = new Map(); // lowercase -> display
  bookmarks.forEach(b => b.tags.forEach(t => { if(!set.has(t.toLowerCase())) set.set(t.toLowerCase(), t); }));
  return [...set.values()].sort((a,b)=>a.localeCompare(b));
}

function refreshSaveState(){
  const hasUrl = $("url").value.trim() !== "";
  const hasTitle = $("title").value.trim() !== "";
  $("saveBtn").disabled = !(hasUrl && hasTitle);
}

function wireCommon(){
  $("fetchBtn").addEventListener("click", () => {
    const url = $("url").value.trim(); const note = $("fetchNote");
    if (!url){ note.textContent="Paste a web address first."; note.className="fetch-note"; return; }
    const d = lookup(url); const host = domainOf(url);
    $("title").value=d.title; $("desc").value=d.desc;
    current = { site:d.site||host, host:host, preview:d.preview };
    $("auto").style.display="block";
    $("autoFavicon").innerHTML=faviconHtml(host,18);
    $("autoSite").textContent=d.site||host;
    $("autoPreview").innerHTML = d.preview ? '<img class="preview" src="'+d.preview+'" alt="preview" />' : '<div class="preview-none">No preview image on this page</div>';
    note.textContent="Details filled in automatically — edit the title, description, tags or note as you like.";
    note.className="fetch-note filled";
    refreshSaveState();
  });
  ["url","title"].forEach(id => $(id).addEventListener("input", refreshSaveState));
  $("saveBtn").addEventListener("click", () => {
    const host = domainOf($("url").value.trim());
    bookmarks.unshift({
      id:idSeq++, url:$("url").value.trim(), title:$("title").value.trim(), desc:$("desc").value.trim(),
      tags:$("tags").value.split(",").map(t=>t.trim()).filter(Boolean), note:$("note").value.trim(),
      site:(current&&current.site)||host, host:host, preview:current?current.preview:null, savedAt:Date.now(), readLater:false, archived:false
    });
    render();
    ["url","title","desc","tags","note"].forEach(id => $(id).value="");
    $("fetchNote").textContent=""; $("fetchNote").className="fetch-note";
    $("auto").style.display="none"; current=null;
    refreshSaveState();
    const f=$("flash"); f.textContent="Saved. It's now at the top of your list."; f.style.display="block";
    setTimeout(()=>{ f.style.display="none"; }, 3000);
  });
}

function render(){
  const list=$("list"); list.innerHTML="";
  $("count").textContent = bookmarks.length ? bookmarks.length+(bookmarks.length===1?" link":" links") : "";
  $("empty").style.display = bookmarks.length ? "none" : "block";
  bookmarks.forEach(bm => {
    const li=document.createElement("li"); li.className="bm-item";
    const thumb = bm.preview ? '<img class="thumb" src="'+bm.preview+'" alt="preview" />' : '<div class="thumb-none">No preview</div>';
    li.innerHTML = thumb + '<div class="body">'+
      '<p class="title"><a href="'+bm.url+'" target="_blank" rel="noopener">'+escapeHtml(bm.title)+'</a></p>'+
      '<div class="site-row">'+faviconHtml(bm.host,16)+'<span class="site">'+escapeHtml(bm.site)+'</span></div>'+
      (bm.desc ? '<p class="desc">'+escapeHtml(bm.desc)+'</p>' : '')+
      (bm.tags.length ? '<div class="tags">'+bm.tags.map(t=>'<span class="tag">'+escapeHtml(t)+'</span>').join('')+'</div>' : '')+
      (bm.note ? '<div class="note">'+escapeHtml(bm.note)+'</div>' : '')+
    '</div>';
    list.appendChild(li);
  });
}

function initApp(){
  seed();
  wireCommon();
  render();
  document.body.setAttribute("data-harness-ready","true");
}
