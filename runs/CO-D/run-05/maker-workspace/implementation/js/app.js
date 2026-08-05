// UI layer (browser). Wires the tested pure modules + store into the screens the
// client approved. No new behaviour beyond the 16 approved scenarios.
import { createStore } from "./store.js";
import { looksLikeLink } from "./model.js";
import { createLabelIndex } from "./labels.js";
import { resolveMetadata } from "./resolver.js";
import { tokenize, matches, highlightSegments } from "./search.js";
import { sortItems } from "./sort.js";
import {
  visibleItems, VIEW, toReadCount, activeLabelCounts, labelCount,
} from "./library.js";
import { parseBookmarksHtml, planImport } from "./importer.js";

const store = createStore();
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const EMOJI = { "cooking.nytimes.com": "🍝", "nytimes.com": "🗞️", "github.com": "🐙",
  "youtube.com": "▶️", "wikipedia.org": "📚", "medium.com": "✍️", "bbc.com": "📰", "stackoverflow.com": "💬" };
function emojiFor(host) {
  const h = (host || "").replace(/^www\./, "");
  const k = Object.keys(EMOJI).find((x) => h === x || h.endsWith("." + x));
  return k ? EMOJI[k] : "🔖";
}
function hiHtml(text, tokens) {
  return highlightSegments(text, tokens).map((s) => (s.hit ? "<mark>" + esc(s.text) + "</mark>" : esc(s.text))).join("");
}

// ---- UI state (not persisted) ----
let view = VIEW.ALL;
let sortMode = "new";
let query = "";
let editingId = null;
const expandedNotes = new Set();
const NOTE_CAP = 220;

// ---- toast (delete/put-away undo) ----
let toastTimer = null;
function showToast(msg, actionLabel, fn) {
  $("toastmsg").textContent = msg;
  const btn = $("toastaction");
  btn.textContent = actionLabel || "";
  btn.style.display = actionLabel ? "inline" : "none";
  $("toast").style.display = "flex";
  clearTimeout(toastTimer);
  btn.onclick = () => { if (fn) fn(); $("toast").style.display = "none"; clearTimeout(toastTimer); };
  toastTimer = setTimeout(() => ($("toast").style.display = "none"), 6500); // lingers, per SCN-011
}
function showNotice(msg) {
  const n = $("notice"); n.textContent = msg; n.style.display = "block";
  clearTimeout(showNotice._t); showNotice._t = setTimeout(() => (n.style.display = "none"), 4500);
}

// ---- filter bar ----
function renderFilterbar() {
  const bar = $("filterbar"); bar.innerHTML = "";
  const counts = activeLabelCounts(store.items);
  const mk = (cls, label, count, on, onClick) => {
    const b = document.createElement("button");
    b.className = "fb " + cls + (on ? " on" : "");
    b.innerHTML = `${esc(label)}${count != null ? ` <span class="n">${count}</span>` : ""}`;
    b.onclick = onClick; bar.appendChild(b);
  };
  mk("toread", "📖 To read", toReadCount(store.items), view === VIEW.TOREAD && !query, () => setView(VIEW.TOREAD));
  mk("", "All", visibleItems(store.items, VIEW.ALL).length, view === VIEW.ALL && !query, () => setView(VIEW.ALL));
  const labels = [...counts.keys()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
  if (labels.length) { const s = document.createElement("span"); s.className = "sep"; bar.appendChild(s); }
  labels.forEach((l) => mk("", l, counts.get(l), view === l && !query, () => setView(l)));
  const archived = store.items.filter((it) => it.archived).length;
  if (archived) mk("away", "🗄 Put away", archived, view === VIEW.ARCHIVED, () => setView(VIEW.ARCHIVED));
}

function setView(v) { view = v; query = ""; $("search").value = ""; $("searchclr").style.display = "none"; editingId = null; render(); }

// ---- status line ----
function renderStatus(shown) {
  const s = $("statusline");
  if (query) s.innerHTML = `${shown.length} result${shown.length === 1 ? "" : "s"} for <b>“${esc(query)}”</b> · <a data-clear>clear search</a>`;
  else if (view === VIEW.ARCHIVED) s.innerHTML = `<b>Put away</b> — hidden from your list and search, kept safe. ${shown.length} tucked away. · <a data-clear>back to all</a>`;
  else if (view === VIEW.TOREAD) s.innerHTML = shown.length ? `Your <b>to-read</b> pile — ${shown.length} to go. · <a data-clear>show all</a>` : `<span>🎉 Nothing left to read — pile’s empty.</span> · <a data-clear>show all</a>`;
  else if (view !== VIEW.ALL) s.innerHTML = `Showing <b>${esc(view)}</b> — ${shown.length} link${shown.length === 1 ? "" : "s"}. · <a data-clear>show all</a>`;
  else s.innerHTML = "";
  const clr = s.querySelector("[data-clear]");
  if (clr) clr.onclick = () => { if (query) { query = ""; $("search").value = ""; $("searchclr").style.display = "none"; } else view = VIEW.ALL; render(); };
}

// ---- main render ----
function render() {
  renderFilterbar();
  const tokens = tokenize(query);
  let shown;
  if (query) shown = store.items.filter((it) => !it.archived && matches(it, tokens));
  else shown = visibleItems(store.items, view);
  shown = sortItems(shown, sortMode);

  renderStatus(shown);

  const list = $("list"), empty = $("empty");
  list.innerHTML = "";
  if (!shown.length) {
    empty.style.display = "block";
    empty.innerHTML = emptyMessage();
  } else empty.style.display = "none";

  for (const it of shown) list.appendChild(editingId === it.id ? editRow(it) : row(it, tokens));
  $("more").textContent = "";
}

function emptyMessage() {
  if (query) return `No bookmarks match “${esc(query)}”. Try a different word.`;
  if (view === VIEW.ARCHIVED) return "Nothing put away.";
  if (view === VIEW.TOREAD) return `<span class="celebrate">Your to-read pile is empty — nicely done.</span>`;
  if (view !== VIEW.ALL) return `No links labelled “${esc(view)}” yet.`;
  return `<div class="big">Nothing saved yet 📎</div>Paste your first link above — the title and summary fill themselves in.`;
}

// ---- a bookmark row ----
function row(it, tokens) {
  const li = document.createElement("li");
  li.className = "item" + (it.archived ? " away" : "") + (it.read ? " isread" : "") + (it.needsName ? " needsname" : "");
  li.dataset.id = it.id;

  if (it.resolving) {
    li.innerHTML = `<span class="readck spacer"></span><div class="favicon"><div class="spinner"></div></div>
      <div class="body"><p class="title">Figuring out this page…</p><p class="meta">Reading the title and summary</p></div>`;
    return li;
  }

  const ck = (it.archived) ? `<span class="readck spacer"></span>`
    : (it.toRead || it.read) ? `<button class="readck${it.read ? " done" : ""}" title="${it.read ? "Mark as still to read" : "Mark as read"}">${it.read ? "✓" : ""}</button>`
      : `<span class="readck spacer"></span>`;

  const titleHtml = it.needsName
    ? `<span class="raw">${esc(it.url)}</span>`
    : `<a href="${esc(it.url)}" target="_blank" rel="noopener">${hiHtml(it.title, tokens)}</a>`;

  const summaryHtml = it.summary ? `<p class="desc">${hiHtml(it.summary, tokens)}</p>` : "";
  const noteHtml = noteBlock(it, tokens);
  const warn = it.needsName ? `<p><span class="warnnote">⚠️ Couldn’t read this page automatically — it’s saved, give it a name so you’ll find it.</span></p>` : "";
  const stateBadge = it.archived ? `<span class="state away">🗄 Put away</span>`
    : it.toRead ? `<span class="state toread">📖 To read</span>` : it.read ? `<span class="state read">✓ Read</span>` : "";
  const chips = it.labels.map((l) => `<span class="lchip" data-label="${esc(l)}">${esc(l)}</span>`).join("");

  const right = it.archived
    ? `<button class="btn putback">↩ Put back</button><button class="btn del2">Delete</button>`
    : `<button class="btn ${it.needsName ? "fix" : ""} edit">${it.needsName ? "Name it" : "Edit"}</button>` +
      (!it.toRead && !it.read ? `<button class="btn markread">📖 To read</button>` : "");

  li.innerHTML = `${ck}<div class="favicon">${emojiFor(it.host)}</div>
    <div class="body">
      <p class="title">${titleHtml}</p>
      ${summaryHtml}${noteHtml}
      <p class="meta">${esc(it.host)}</p>
      ${warn}
      <div class="badges">${stateBadge}${chips}</div>
    </div>
    <div class="actions">${right}</div>`;

  const ckEl = li.querySelector(".readck:not(.spacer)");
  if (ckEl) ckEl.onclick = () => toggleRead(it, li);
  const ed = li.querySelector(".edit"); if (ed) ed.onclick = () => { editingId = it.id; render(); };
  const mr = li.querySelector(".markread"); if (mr) mr.onclick = () => store.setToRead(it.id, true);
  const pb = li.querySelector(".putback"); if (pb) pb.onclick = () => { store.setArchived(it.id, false); showToast(`Put “${trim(it.title)}” back.`); };
  const d2 = li.querySelector(".del2"); if (d2) d2.onclick = () => del(it);
  li.querySelectorAll(".lchip").forEach((c) => (c.onclick = () => setView(c.dataset.label)));
  const exp = li.querySelector(".note .expand"); if (exp) exp.onclick = () => { expandedNotes.add(it.id); render(); };
  return li;
}

function noteBlock(it, tokens) {
  if (!it.note) return "";
  const long = it.note.length > NOTE_CAP && !expandedNotes.has(it.id);
  const text = long ? it.note.slice(0, NOTE_CAP) + "…" : it.note;
  return `<div class="note"><span class="lbl">My note</span>${hiHtml(text, tokens)}${long ? ` <span class="expand">show more</span>` : ""}</div>`;
}

function toggleRead(it, li) {
  if (it.read) { store.setRead(it.id, false); store.setToRead(it.id, true); return; }
  // marking read; if we're in the to-read view, animate it leaving before re-render
  if (view === VIEW.TOREAD && !query) {
    li.classList.add("leaving");
    setTimeout(() => store.setRead(it.id, true), 300);
  } else store.setRead(it.id, true);
}

function del(it) {
  const removed = store.remove(it.id);
  if (!removed) return;
  editingId = null;
  showToast(`Deleted “${trim(it.title)}”.`, "Undo", () => store.restore(removed.item, removed.index));
}
function trim(s) { s = s || ""; return s.length > 34 ? s.slice(0, 31) + "…" : s; }

// ---- edit / manage panel ----
function editRow(it) {
  const li = document.createElement("li"); li.className = "item"; li.dataset.id = it.id;
  const draft = { title: it.title, summary: it.summary, note: it.note, labels: [...it.labels] };
  li.innerHTML = `<span class="readck spacer"></span><div class="favicon">${emojiFor(it.host)}</div>
    <div class="editform">
      <label>Title</label><input class="field t" value="${esc(it.title)}">
      <label>Summary</label><textarea class="field s">${esc(it.summary)}</textarea>
      <label>My note <span style="opacity:.7">— your own words, just for you</span></label>
      <textarea class="field nt" placeholder="Why did you save this? What's the good part?">${esc(it.note)}</textarea>
      <label>Labels</label>
      <div class="labelbox"><div class="chips" data-chips></div></div>
      <div class="suggest" data-suggest></div>
      <div class="formbtns"><button class="done">Done</button><button class="cancel">Cancel</button></div>
      <div class="mgmt">
        <button class="away">🗄 Put away</button>
        <span class="mgmtnote">tuck it out of sight, keep it safe</span>
        <button class="del">🗑 Delete…</button>
      </div>
    </div>`;

  const chipsEl = li.querySelector("[data-chips]"), suggestEl = li.querySelector("[data-suggest]");
  const idx = createLabelIndex(store.labelIndex.list());

  function drawChips() {
    chipsEl.innerHTML = "";
    draft.labels.forEach((l) => {
      const c = document.createElement("span"); c.className = "echip";
      c.innerHTML = `${esc(l)} <button title="remove">×</button>`;
      c.querySelector("button").onclick = () => { draft.labels = draft.labels.filter((x) => x !== l); drawChips(); };
      chipsEl.appendChild(c);
    });
    const inp = document.createElement("input"); inp.className = "labelinput";
    inp.placeholder = draft.labels.length ? "Add another…" : "Add a label…";
    inp.oninput = () => drawSuggest(inp);
    inp.onkeydown = (e) => {
      if (e.key === "Enter") { e.preventDefault(); const first = suggestEl.querySelector(".drop button"); if (first) first.click(); }
      else if (e.key === "Backspace" && !inp.value && draft.labels.length) { draft.labels.pop(); drawChips(); }
      else if (e.key === "Escape") { e.preventDefault(); editingId = null; render(); }
    };
    chipsEl.appendChild(inp); inp.focus();
  }
  function addLabel(name) {
    const c = idx.canon(name); if (!c) return;
    if (!draft.labels.includes(c)) draft.labels.push(c);
    drawChips();
  }
  function drawSuggest(inp) {
    suggestEl.innerHTML = ""; const q = inp.value.trim(); if (!q) return;
    const drop = document.createElement("div"); drop.className = "drop";
    idx.suggestions(q, draft.labels).forEach((l) => {
      const b = document.createElement("button");
      b.innerHTML = `<span>${esc(l)}</span><span class="tag">reuse existing</span>`;
      b.onclick = () => { addLabel(l); const i = chipsEl.querySelector(".labelinput"); if (i) drawSuggest(i); };
      drop.appendChild(b);
    });
    if (!idx.has(q)) {
      const b = document.createElement("button");
      b.innerHTML = `<span class="create">＋ Create “${esc(q)}”</span><span class="tag">new label</span>`;
      b.onclick = () => { addLabel(q); };
      drop.appendChild(b);
    }
    suggestEl.appendChild(drop);
  }

  li.querySelector(".t").focus();
  drawChips();
  li.querySelector(".done").onclick = () => {
    const t = li.querySelector(".t").value.trim();
    store.update(it.id, {
      title: t || it.title,
      summary: li.querySelector(".s").value.trim(),
      note: li.querySelector(".nt").value.trim(),
      labels: [...draft.labels],
    });
    editingId = null; render();
  };
  li.querySelector(".cancel").onclick = () => { editingId = null; render(); };
  li.querySelectorAll(".t,.s,.nt").forEach((el) => el.addEventListener("keydown", (e) => { if (e.key === "Escape") { editingId = null; render(); } }));
  li.querySelector(".away").onclick = () => { store.setArchived(it.id, true); editingId = null; showToast(`Put “${trim(it.title)}” away. It’s safe in 🗄 Put away.`, "Undo", () => store.setArchived(it.id, false)); };
  li.querySelector(".del").onclick = () => del(it);
  return li;
}

// ---- saving ----
async function save() {
  const raw = $("url").value.trim();
  $("urlerr").textContent = ""; $("url").classList.remove("bad");
  if (!raw) return;
  if (!looksLikeLink(raw)) {
    $("url").classList.add("bad");
    $("urlerr").textContent = "That doesn’t look like a web link yet — it should include something like “.com”.";
    return;
  }
  const dup = store.findDuplicate(raw);
  if (dup) {
    $("url").value = ""; view = VIEW.ALL; query = ""; $("search").value = "";
    showNotice("You already saved this one — here it is. You can open it up to fix it.");
    render(); flash(dup.id); return;
  }
  const toRead = $("savetoread").checked;
  $("url").value = "";
  view = VIEW.ALL; query = ""; $("search").value = ""; $("searchclr").style.display = "none";
  const res = store.addFromUrl(raw, { toRead });
  if (res.status !== "saved") return;
  // read the page in the background; keep the link no matter what (SCN-008)
  const meta = await resolveMetadata(res.item.url).catch(() => ({ ok: false }));
  store.applyResolution(res.item.id, meta);
}
function flash(id) {
  const li = $("list").querySelector(`li[data-id="${(window.CSS && CSS.escape) ? CSS.escape(id) : id.replace(/["\\]/g, "\\$&")}"]`);
  if (!li) return;
  li.classList.add("flash"); li.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => li.classList.remove("flash"), 1600);
}

// ---- import dialog ----
function openImport() {
  const dlg = $("importdialog");
  dlg.innerHTML = `
    <h3>Bring in your existing bookmarks</h3>
    <p class="lead">Hand me the file your browser gives you when you “export bookmarks”. Nothing changes until you confirm.</p>
    <div class="drop">
      <div class="big">Choose your bookmarks file</div>
      <div>a .html file exported from your browser</div>
      <div class="row" style="justify-content:center">
        <button class="ghost" id="pickfile">Choose file…</button>
        <button class="ghost" id="cancelimport">Cancel</button>
      </div>
      <p class="lead" id="parsemsg" style="margin-top:12px"></p>
    </div>`;
  $("importoverlay").style.display = "grid";
  dlg.querySelector("#pickfile").onclick = () => $("importfile").click();
  dlg.querySelector("#cancelimport").onclick = closeImport;
}
function closeImport() { $("importoverlay").style.display = "none"; $("importfile").value = ""; }

function showImportPreview(rawList) {
  const idx = createLabelIndex(store.labelIndex.list()); // throwaway index; no pollution on cancel
  const plan = planImport(rawList, store.items, idx);
  const p = plan.stats;
  const chips = p.labels.slice(0, 12).map((l) => `<span class="lchip">${esc(l)}</span>`).join("") + (p.labels.length > 12 ? ` <span class="lead">+${p.labels.length - 12} more</span>` : "");
  const dlg = $("importdialog");
  dlg.innerHTML = `
    <h3>Found ${p.total.toLocaleString()} bookmarks. Here’s what I’ll do:</h3>
    <p class="lead">Nothing happens until you press the button.</p>
    <ul class="promises">
      <li><span class="tick">✓</span><div><b>Keep the names you gave them.</b> ${p.keptTitles.toLocaleString()} keep your own titles.</div></li>
      <li><span class="tick">✓</span><div><b>Folders → labels, both levels, capitals merged.</b> ${p.labels.length} labels${p.caseMerges ? `, ${p.caseMerges} merged into labels you already have (no “Work”/“work” split)` : ""}.<div class="labelmap">${chips || '<span class="lead">none</span>'}</div></div></li>
      <li><span class="tick">✓</span><div><b>Keep when you saved each.</b> ${p.dateFrom ? `saves span ${new Date(p.dateFrom).toISOString().slice(0, 10)} – ${new Date(p.dateTo).toISOString().slice(0, 10)}; that order is kept.` : "dates kept where recorded."}</div></li>
      <li><span class="tick">✓</span><div><b>No duplicates.</b> ${p.dupes > 0 ? `${p.dupes} already saved here — skipped, keeping your copy.` : "none clash with what you have."}</div></li>
      <li><span class="tick">✓</span><div><b>All at once.</b> ${p.fresh.length.toLocaleString()} new links, no babysitting.</div></li>
    </ul>
    <div class="progress" id="prog" style="display:none"><div></div></div>
    <div class="row">
      <button class="ghost" id="cancelimport" style="order:2">Cancel</button>
      <button class="primary" id="go" style="order:1">Bring in ${p.fresh.length.toLocaleString()} links</button>
    </div>`;
  dlg.querySelector("#cancelimport").onclick = closeImport;
  dlg.querySelector("#go").onclick = () => runImport(plan.fresh);
}

function runImport(fresh) {
  const prog = $("prog"), bar = prog.firstElementChild, go = $("go");
  prog.style.display = "block"; go.disabled = true;
  let i = 0; const step = Math.max(1, Math.floor(fresh.length / 60));
  const tick = setInterval(() => {
    i = Math.min(fresh.length, i + step);
    bar.style.width = Math.round((i / Math.max(1, fresh.length)) * 100) + "%";
    if (i >= fresh.length) {
      clearInterval(tick);
      store.importItems(fresh);
      closeImport();
      showToast(`Brought in ${fresh.length.toLocaleString()} bookmarks.`);
    }
  }, 60);
}

// ---- export ----
function exportCollection() {
  const html = store.exportHtml();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  a.download = "my-bookmarks.html"; a.click();
  URL.revokeObjectURL(a.href);
  showToast("Exported your collection to my-bookmarks.html.");
}

// ---- wiring ----
$("save").onclick = save;
$("url").addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
$("url").addEventListener("input", () => { $("urlerr").textContent = ""; $("url").classList.remove("bad"); });
$("savetoread").checked = store.savePref.toRead; // sticky (SCN-007)
$("savetoread").onchange = (e) => store.setSavePref(e.target.checked);

$("search").addEventListener("input", (e) => { query = e.target.value.trim(); $("searchclr").style.display = query ? "block" : "none"; render(); });
$("searchclr").onclick = () => { $("search").value = ""; query = ""; $("searchclr").style.display = "none"; render(); };
$("sort").onchange = (e) => { sortMode = e.target.value; render(); };

$("importbtn").onclick = openImport;
$("exportbtn").onclick = exportCollection;
$("importfile").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const msg = $("parsemsg"); if (msg) msg.textContent = `Reading “${f.name}”…`;
  const r = new FileReader();
  r.onload = () => {
    const list = parseBookmarksHtml(r.result);
    if (!list.length) { if (msg) msg.textContent = "Hmm — I couldn’t find bookmarks in that file. Is it the one from your browser’s “export bookmarks”?"; return; }
    showImportPreview(list);
  };
  r.readAsText(f);
};

store.subscribe(render);
render();
