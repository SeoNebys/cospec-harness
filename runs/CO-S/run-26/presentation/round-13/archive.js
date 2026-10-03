// Archiving prototype — builds on the approved tabs layout (SCN-004).
// Active tabs (All / To read / Finished) show only NON-archived bookmarks.
// A separate "Archived" tab shows archived bookmarks, which can be restored.

const DATA = [
  { url:"https://reactjs.org/docs/hooks-intro.html", title:"Introducing Hooks - React", site:"reactjs.org",
    desc:"Use state and other React features without writing a class.",
    tags:["frontend","react","reference"], note:"Re-read before refactoring the dashboard.", savedAt:"2026-09-20", status:"to-read", archived:false },
  { url:"https://www.nasa.gov/mission/artemis-ii/", title:"Artemis II - NASA", site:"nasa.gov",
    desc:"The first crewed mission of NASA's Artemis campaign around the Moon.",
    tags:["space","science"], note:"", savedAt:"2026-09-18", status:"to-read", archived:false },
  { url:"https://www.nytimes.com/2026/09/15/well/sleep-habits.html", title:"Better Sleep Habits That Actually Work", site:"nytimes.com",
    desc:"Evidence-based routines for falling asleep faster and waking rested.",
    tags:["health"], note:"Try the wind-down routine.", savedAt:"2026-09-15", status:"finished", archived:false },
  { url:"https://martinfowler.com/articles/microservices.html", title:"Microservices - Martin Fowler", site:"martinfowler.com",
    desc:"A definition and trade-offs of the microservices architectural style.",
    tags:["backend","architecture","reference"], note:"", savedAt:"2026-09-12", status:"finished", archived:false },
  { url:"https://www.smashingmagazine.com/2026/08/css-grid-guide/", title:"A Complete Guide to CSS Grid", site:"smashingmagazine.com",
    desc:"Practical patterns for building layouts with CSS Grid.",
    tags:["frontend","css","reference"], note:"Grid template areas cheat sheet.", savedAt:"2026-09-08", status:"to-read", archived:false },
  { url:"https://en.wikipedia.org/wiki/Bookmark", title:"Bookmark - Wikipedia", site:"en.wikipedia.org",
    desc:"A saved reference to a web page or a marker for a reader's place.",
    tags:["reference"], note:"", savedAt:"2026-09-05", status:"finished", archived:true },
  { url:"https://www.seriouseats.com/the-food-lab-perfect-roast-chicken", title:"The Food Lab: Perfect Roast Chicken", site:"seriouseats.com",
    desc:"The science behind an evenly cooked, crisp-skinned roast chicken.",
    tags:["cooking"], note:"For Sunday dinner.", savedAt:"2026-09-01", status:"to-read", archived:false },
  { url:"https://kubernetes.io/docs/concepts/overview/", title:"Kubernetes Concepts Overview", site:"kubernetes.io",
    desc:"Core concepts for running containerised workloads on Kubernetes.",
    tags:["backend","devops","reference"], note:"", savedAt:"2026-08-27", status:"finished", archived:true }
];

let activeTag = null, query = "", tab = "all";

const listEl = document.getElementById("list");
const tagfiltersEl = document.getElementById("tagfilters");
const searchEl = document.getElementById("search");
const tabsEl = document.getElementById("tabs");
const allTags = [...new Set(DATA.flatMap(b => b.tags))].sort();

function esc(s){ return s.replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function hl(text){
  if(!query) return esc(text);
  const q = query.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return esc(text).replace(new RegExp("("+q+")","ig"), "<mark>$1</mark>");
}
function fmt(d){ return new Date(d+"T00:00:00").toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}); }
function idx(b){ return DATA.indexOf(b); }

function matchesFilters(b){
  if(activeTag && !b.tags.includes(activeTag)) return false;
  if(query){
    const hay = (b.title+" "+b.site+" "+b.url+" "+b.tags.join(" ")+" "+b.desc+" "+b.note).toLowerCase();
    if(!hay.includes(query.toLowerCase())) return false;
  }
  return true;
}

function cardHtml(b){
  const pill = b.status==="finished"
    ? `<span class="status-pill finished">✓ Finished</span>`
    : `<span class="status-pill toread">● To read</span>`;
  const statusBtn = b.archived ? "" :
    `<button class="status-toggle" data-act="status" data-i="${idx(b)}">${b.status==="finished"?"Mark as to read":"Mark as finished"}</button>`;
  const archiveBtn = b.archived
    ? `<button class="status-toggle restore" data-act="archive" data-i="${idx(b)}">↩ Restore</button>`
    : `<button class="status-toggle" data-act="archive" data-i="${idx(b)}">🗄 Archive</button>`;
  return `
    <div class="card ${b.archived?'archived':''}">
      <div class="top">
        <div>
          <p class="title"><a href="${b.url}" target="_blank" rel="noreferrer">${hl(b.title)}</a></p>
          <p class="site">${hl(b.site)}</p>
        </div>
        ${pill}
      </div>
      <p class="desc">${hl(b.desc)}</p>
      <div class="chips">${b.tags.map(t=>`<span class="chip" data-t="${t}">${hl(t)}</span>`).join("")}</div>
      ${b.note?`<p class="note">📝 ${hl(b.note)}</p>`:""}
      <p class="meta">Saved ${fmt(b.savedAt)}</p>
      <div class="actions">${statusBtn}${archiveBtn}</div>
    </div>`;
}

function wireCards(){
  listEl.querySelectorAll(".chip").forEach(el => el.onclick = () => { activeTag = el.dataset.t; render(); });
  listEl.querySelectorAll("[data-act]").forEach(el => el.onclick = () => {
    const b = DATA[+el.dataset.i];
    if(el.dataset.act==="status") b.status = b.status==="finished" ? "to-read" : "finished";
    else b.archived = !b.archived;
    render();
  });
}

function renderTagFilters(){
  tagfiltersEl.innerHTML = allTags.map(t =>
    `<span class="tagfilter ${t===activeTag?"active":""}" data-t="${t}">${t}</span>`).join("");
  tagfiltersEl.querySelectorAll(".tagfilter").forEach(el =>
    el.onclick = () => { activeTag = (activeTag===el.dataset.t)?null:el.dataset.t; render(); });
}

// active scope = non-archived; archived scope = archived
function inScope(b, t){ return t==="archived" ? b.archived : !b.archived; }

function renderTabs(){
  const active = DATA.filter(b => !b.archived && matchesFilters(b));
  const counts = {
    all: active.length,
    "to-read": active.filter(b=>b.status==="to-read").length,
    finished: active.filter(b=>b.status==="finished").length,
    archived: DATA.filter(b=>b.archived && matchesFilters(b)).length
  };
  const defs = [["all","All"],["to-read","To read"],["finished","Finished"],["archived","🗄 Archived"]];
  tabsEl.innerHTML = defs.map(([k,label]) =>
    `<div class="tab ${k===tab?"active":""} ${k==="archived"?"archived-tab":""}" data-k="${k}">${label} (${counts[k]})</div>`).join("");
  tabsEl.querySelectorAll(".tab").forEach(el => el.onclick = () => { tab = el.dataset.k; render(); });
}

function render(){
  renderTagFilters();
  renderTabs();
  let rows = DATA.filter(b => matchesFilters(b) && inScope(b, tab));
  if(tab==="to-read") rows = rows.filter(b=>b.status==="to-read");
  if(tab==="finished") rows = rows.filter(b=>b.status==="finished");

  if(!rows.length){
    const msg = tab==="archived" ? "Nothing archived." : "Nothing here.";
    listEl.innerHTML = `<div class="empty">${msg}</div>`;
    return;
  }
  const banner = tab==="archived"
    ? `<div class="archive-banner">Archived bookmarks are kept out of your main lists but never deleted. Restore any of them anytime.</div>`
    : "";
  listEl.innerHTML = banner + rows.map(cardHtml).join("");
  wireCards();
}

searchEl.addEventListener("input", () => { query = searchEl.value.trim(); render(); });
render();
document.body.setAttribute("data-harness-ready", "true");
