import { compileQuery } from "/shared/query.js";
import { renderNote, escapeHtml } from "/shared/notes.js";
import { normalizeInput, urlKey, isPdf } from "/shared/normalize.js";

const $ = (id) => document.getElementById(id);
const esc = escapeHtml;

// ---- Client state ---------------------------------------------------------
let state = { bookmarks: [], filters: [], prefs: {} };
let query = "";
let tagFilter = null;
let activeInclude = [];
let activeExclude = [];
let view = "all"; // all | unread | archived
let sortMode = "newest";
let pageSize = "25";
let textSize = "md";
let visibleCount = 25;
let lastSig = null;

let selected = new Set();
let bulkTagMode = null;
let bulkConfirmDelete = false;

let pending = null; // { url, meta } for a new capture
let editId = null;
let confirmDelete = null;
let confirmIA = null;
let openMenu = null;
let savingFilter = false;
let lastShown = [];

const SORT_OPTS = [["newest", "Newest first"], ["oldest", "Oldest first"], ["title-az", "Title A–Z"], ["title-za", "Title Z–A"]];
const PAGE_OPTS = [["10", "10"], ["25", "25"], ["50", "50"], ["100", "100"], ["all", "All"]];
const TEXT_OPTS = [["sm", "Small"], ["md", "Medium"], ["lg", "Large"]];

// ---- API ------------------------------------------------------------------
async function api(method, url, body, asText) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    if (asText) { opts.headers["Content-Type"] = "text/html"; opts.body = body; }
    else { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  return { ok: res.ok, status: res.status, data };
}
async function reload() {
  const res = await api("GET", "/api/state");
  if (res.ok) state = res.data;
  render();
}

// ---- Helpers --------------------------------------------------------------
function allTags() {
  const s = new Set();
  state.bookmarks.forEach((b) => b.tags.forEach((t) => s.add(t)));
  return [...s].sort((a, b) => a.localeCompare(b));
}
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } }
function hueOf(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
function byId(id) { return state.bookmarks.find((b) => b.id === id); }
function fmtDate(t) { return new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }

function highlight(text, terms) {
  const s = esc(text);
  const parts = (terms || []).filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!parts.length) return s;
  return s.replace(new RegExp("(" + parts.join("|") + ")", "gi"), "<mark>$1</mark>");
}
function showIoMsg(m) { const el = $("ioMsg"); el.textContent = m; clearTimeout(showIoMsg._t); showIoMsg._t = setTimeout(() => { el.textContent = ""; }, 6000); }

// ---- Tag suggestions (generic) -------------------------------------------
function attachSuggest(input, box, poolFn, headText) {
  const upd = () => {
    const parts = input.value.split(","); const token = parts[parts.length - 1].trim();
    const chosen = new Set(input.value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean));
    const pool = poolFn().filter((t) => !chosen.has(t.toLowerCase()));
    const items = token ? pool.filter((t) => t.toLowerCase().includes(token.toLowerCase())) : pool;
    if (!items.length) { box.classList.remove("show"); return; }
    box.innerHTML = (headText ? `<div class="s-head">${headText}</div>` : "") +
      items.map((t) => `<button type="button" class="s-item" data-t="${esc(t)}">#${esc(t)}</button>`).join("");
    box.querySelectorAll(".s-item").forEach((btn) => btn.addEventListener("mousedown", (e) => {
      e.preventDefault(); const p = input.value.split(","); p[p.length - 1] = " " + btn.dataset.t;
      input.value = p.join(",").replace(/^\s+/, "") + ", "; box.classList.remove("show"); input.focus(); upd();
    }));
    box.classList.add("show");
  };
  input.oninput = upd; input.onfocus = upd; input.onblur = () => setTimeout(() => box.classList.remove("show"), 150);
  return upd;
}

// ---- Capture / edit form --------------------------------------------------
$("fetchBtn").addEventListener("click", startCapture);
$("url").addEventListener("keydown", (e) => { if (e.key === "Enter") startCapture(); });
$("saveBtn").addEventListener("click", commitSave);
$("cancelBtn").addEventListener("click", resetCapture);
$("noteToolbar").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => formatNote(b.dataset.fmt)));
attachSuggest($("tags"), $("tagsSuggest"), () => allTags(), "Existing tags — click to reuse");

async function startCapture() {
  const norm = normalizeInput($("url").value);
  if (!norm.ok) { showFormError("urlError", "⚠ " + norm.reason); $("details").hidden = true; $("url").focus(); return; }
  $("urlError").hidden = true;
  $("details").hidden = true; $("fetching").hidden = false; $("fetchBtn").disabled = true;
  const res = await api("POST", "/api/metadata", { url: $("url").value });
  $("fetching").hidden = true; $("fetchBtn").disabled = false;
  if (!res.ok) { showFormError("urlError", "⚠ " + (res.data && res.data.reason ? res.data.reason : "Could not read that link.")); return; }
  if (res.data.existing) { openEdit(res.data.existing, "dup"); return; }
  pending = { url: res.data.url, meta: res.data.meta || {} }; editId = null;
  fillForm({ url: res.data.url, title: pending.meta.title || "", description: pending.meta.description || "", tags: [], note: "", readLater: false, fav: pending.meta.fav, preview: pending.meta.preview }, pending.meta.failed ? "failed" : "new");
  $("details").hidden = false; $("title").focus();
}
function openEdit(b, mode) {
  editId = b.id; pending = { url: b.url, meta: { fav: b.fav, preview: b.preview } };
  fillForm(b, mode || "edit");
  $("details").hidden = false; openMenu = null; render();
  $("capture").scrollIntoView({ behavior: "smooth", block: "start" }); $("title").focus();
}
function fillForm(b, mode) {
  $("editUrl").value = b.url; $("title").value = b.title || ""; $("desc").value = b.description || "";
  $("tags").value = (b.tags || []).join(", "); $("note").value = b.note || ""; $("readLater").checked = !!b.readLater;
  $("formError").hidden = true; $("tagsSuggest").classList.remove("show");
  const favBox = $("favBox"); const h = hueOf(host(b.url));
  favBox.style.background = `hsl(${h} 45% 55%)`; favBox.textContent = (host(b.url)[0] || "?").toUpperCase(); favBox.innerHTML = favBox.textContent;
  if (b.fav) { const img = new Image(); img.onload = () => { favBox.innerHTML = ""; favBox.appendChild(img); }; img.src = b.fav; }
  const pv = $("previewBox"); pv.innerHTML = ""; pv.style.background = b.preview ? "#e4e7ec" : `linear-gradient(135deg,hsl(${h} 60% 52%),hsl(${(h + 40) % 360} 60% 42%))`;
  if (b.preview) { const im = new Image(); im.onload = () => pv.appendChild(im); im.src = b.preview; }
  const note = $("autofillNote"); note.className = "autofill-note";
  if (mode === "dup") { note.classList.add("edit"); note.textContent = "↩ You've saved this link before — you're editing your existing bookmark, not making a duplicate"; }
  else if (mode === "edit") { note.classList.add("edit"); note.textContent = "✎ Editing this bookmark — change anything and save."; }
  else if (mode === "failed") { note.classList.add("failed"); note.textContent = "⚠ We couldn't read this page automatically — you can still add it and fill in the details yourself."; }
  else { note.textContent = "✓ Filled in automatically from the page — adjust anything you like"; }
  $("saveBtn").textContent = (mode === "edit" || mode === "dup") ? "Save changes" : "Add to collection";
}
function showFormError(id, msg) { const el = $(id); el.textContent = msg; el.hidden = false; }
async function commitSave() {
  const norm = normalizeInput($("editUrl").value);
  if (!norm.ok) return showFormError("formError", "⚠ " + norm.reason);
  const payload = {
    url: norm.url, title: $("title").value, description: $("desc").value, note: $("note").value,
    tags: $("tags").value.split(",").map((t) => t.trim()).filter(Boolean), readLater: $("readLater").checked,
    fav: pending.meta.fav || "", preview: pending.meta.preview || "",
  };
  let res;
  if (editId != null) res = await api("PUT", "/api/bookmarks/" + editId, payload);
  else res = await api("POST", "/api/bookmarks", payload);
  if (res.status === 409) {
    if (res.data && res.data.error === "address-in-use") return showFormError("formError", "⚠ Another bookmark already uses this address.");
    if (res.data && res.data.existing) { await reload(); openEdit(res.data.existing, "dup"); return; }
  }
  if (!res.ok) return showFormError("formError", "⚠ Could not save. Please try again.");
  resetCapture(); await reload();
}
function resetCapture() {
  pending = null; editId = null; $("url").value = ""; $("details").hidden = true; $("fetching").hidden = true;
  $("fetchBtn").disabled = false; $("formError").hidden = true; $("urlError").hidden = true; $("saveBtn").textContent = "Add to collection";
}
function formatNote(kind) {
  const ta = $("note"); const s = ta.value; const a = ta.selectionStart, b = ta.selectionEnd; const sel = s.slice(a, b);
  const wrap = (pre, post, ph) => { const t = sel || ph; ta.value = s.slice(0, a) + pre + t + post + s.slice(b); ta.focus(); const st = a + pre.length; ta.setSelectionRange(st, st + t.length); };
  const linePrefix = (fn) => { let ls = s.lastIndexOf("\n", a - 1) + 1; let le = s.indexOf("\n", b); if (le < 0) le = s.length; const seg = s.slice(ls, le).split("\n").map((l, i) => fn(l, i)).join("\n"); ta.value = s.slice(0, ls) + seg + s.slice(le); ta.focus(); ta.setSelectionRange(ls, ls + seg.length); };
  if (kind === "bold") wrap("**", "**", "bold text");
  else if (kind === "italic") wrap("*", "*", "italic text");
  else if (kind === "heading") linePrefix((l) => "## " + l.replace(/^#{1,3}\s*/, ""));
  else if (kind === "bullet") linePrefix((l) => "- " + l.replace(/^[-*]\s+/, ""));
  else if (kind === "number") linePrefix((l, i) => (i + 1) + ". " + l.replace(/^\d+\.\s+/, ""));
  else if (kind === "quote") linePrefix((l) => "> " + l.replace(/^>\s?/, ""));
  else if (kind === "link") wrap("[", "](https://)", "link text");
}

// ---- Views, tags, sort, banner -------------------------------------------
function activeSet() { return state.bookmarks.filter((b) => !b.archived); }
function archivedSet() { return state.bookmarks.filter((b) => b.archived); }
function baseForView() {
  if (view === "archived") return archivedSet();
  if (view === "unread") return activeSet().filter((b) => b.readLater);
  return activeSet();
}
function renderTabs() {
  const el = $("viewtabs");
  const active = activeSet();
  const unread = active.filter((b) => b.readLater).length;
  el.innerHTML =
    `<button class="vtab${view === "all" ? " active" : ""}" data-v="all">All bookmarks <span class="c">${active.length}</span></button>` +
    `<button class="vtab${view === "unread" ? " active" : ""}" data-v="unread">Read later <span class="c">${unread}</span></button>` +
    `<button class="vtab quiet${view === "archived" ? " active" : ""}" data-v="archived">Archived <span class="c">${archivedSet().length}</span></button>`;
  el.querySelectorAll(".vtab").forEach((btn) => btn.onclick = () => { view = btn.dataset.v; tagFilter = null; render(); });
}
function tagCounts(set) { const c = {}; set.forEach((b) => b.tags.forEach((t) => c[t] = (c[t] || 0) + 1)); return c; }
function renderTagbar() {
  const bar = $("tagbar");
  const counts = tagCounts(baseForView());
  const tags = Object.keys(counts).sort((a, b) => a.localeCompare(b));
  if (!tags.length) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = '<span class="tagbar-label">Browse by tag:</span>' +
    tags.map((t) => `<button class="tagbtn${tagFilter === t ? " active" : ""}" data-t="${esc(t)}">#${esc(t)} <span class="c">${counts[t]}</span></button>`).join("");
  bar.querySelectorAll(".tagbtn").forEach((btn) => btn.onclick = () => { tagFilter = btn.dataset.t === tagFilter ? null : btn.dataset.t; render(); });
}
function renderBanner() {
  const bb = $("browseBanner"); const parts = [];
  if (tagFilter) parts.push(`tag <strong>#${esc(tagFilter)}</strong>`);
  if (activeInclude.length) parts.push("including " + activeInclude.map((t) => `<strong>#${esc(t)}</strong>`).join(" "));
  if (activeExclude.length) parts.push("excluding " + activeExclude.map((t) => `<strong>#${esc(t)}</strong>`).join(" "));
  if (!parts.length) { bb.hidden = true; return; }
  bb.hidden = false;
  bb.innerHTML = "Filtered by " + parts.join(" · ") + ' <button id="clearTag">✕ clear</button>';
  bb.querySelector("#clearTag").onclick = () => { tagFilter = null; activeInclude = []; activeExclude = []; render(); };
}
function sortBookmarks(arr) {
  const a = arr.slice();
  if (sortMode === "oldest") a.sort((x, y) => x.addedAt - y.addedAt);
  else if (sortMode === "title-az") a.sort((x, y) => x.title.localeCompare(y.title));
  else if (sortMode === "title-za") a.sort((x, y) => y.title.localeCompare(x.title));
  else a.sort((x, y) => y.addedAt - x.addedAt);
  return a;
}
function renderSort() {
  const el = $("sortctl");
  el.innerHTML = '<label class="sortlabel" for="sortSelect">Sort by</label><select id="sortSelect">' +
    SORT_OPTS.map(([v, l]) => `<option value="${v}"${sortMode === v ? " selected" : ""}>${l}</option>`).join("") + "</select>";
  $("sortSelect").onchange = (e) => setSort(e.target.value);
}
function setSort(m) { sortMode = m; savePref("sort", m); render(); }
function pageLimit() { return pageSize === "all" ? Infinity : Number(pageSize); }

// ---- Saved filters --------------------------------------------------------
function renderSaved() {
  const el = $("savedbar"); let html = "";
  if (state.filters.length) {
    html += '<span class="saved-label">Saved filters:</span>' + state.filters.map((f) =>
      `<span class="savedchip"><button class="savedapply" data-fid="${f.id}" title="${esc(describeSaved(f))}">🔖 ${esc(f.name)}</button><button class="saveddel" data-fid="${f.id}" title="Remove">×</button></span>`).join("");
  }
  const hasActive = query.trim() || tagFilter || activeInclude.length || activeExclude.length;
  if (savingFilter) {
    html += `<div class="savepanel">
      <div class="sp-row"><label>Name</label><input id="filterName" placeholder="e.g. AI papers to read" maxlength="40" autocomplete="off"></div>
      <div class="sp-row"><label>Search text</label><input id="filterQuery" placeholder="optional words to match" autocomplete="off"></div>
      <div class="sp-row"><label>Include tags</label><span class="sugwrap"><input id="filterInc" placeholder="tags that must be present" autocomplete="off"><div class="suggest" id="incSug"></div></span></div>
      <div class="sp-row"><label>Exclude tags</label><span class="sugwrap"><input id="filterExc" placeholder="tags to leave out" autocomplete="off"><div class="suggest" id="excSug"></div></span></div>
      <div class="sp-actions"><button data-save="confirm">Save filter</button><button data-save="cancel" class="ghost secondary">Cancel</button></div>
      <div class="sp-hint">Include/exclude tags are pickers with suggestions; Search text still accepts the full expression (e.g. <code>#news NOT #reading</code>).</div>
    </div>`;
  } else if (hasActive) {
    html += `<button class="savebtn" data-save="start">🔖 Save current filter</button>`;
  }
  el.innerHTML = html; el.hidden = !html;
  el.querySelectorAll(".savedapply").forEach((b) => b.onclick = () => applyFilter(Number(b.dataset.fid)));
  el.querySelectorAll(".saveddel").forEach((b) => b.onclick = () => deleteFilter(Number(b.dataset.fid)));
  el.querySelectorAll("[data-save]").forEach((b) => b.onclick = () => {
    const a = b.dataset.save;
    if (a === "start") { savingFilter = true; renderSaved(); prefillSaveForm(); }
    else if (a === "cancel") { savingFilter = false; renderSaved(); }
    else if (a === "confirm") saveCurrentFilter();
  });
  if (savingFilter) {
    attachSuggest($("filterInc"), $("incSug"), () => allTags());
    attachSuggest($("filterExc"), $("excSug"), () => allTags());
    $("filterName").onkeydown = (e) => { if (e.key === "Escape") { savingFilter = false; renderSaved(); } };
  }
}
function prefillSaveForm() {
  if (!$("filterQuery")) return;
  $("filterQuery").value = query.trim();
  $("filterInc").value = [...(tagFilter ? [tagFilter] : []), ...activeInclude].join(", ");
  $("filterExc").value = activeExclude.join(", ");
  $("filterName").focus();
}
function describeSaved(f) {
  const bits = [];
  if (f.query) bits.push('search “' + f.query + '”');
  if (f.include && f.include.length) bits.push("include " + f.include.map((t) => "#" + t).join(" "));
  if (f.exclude && f.exclude.length) bits.push("exclude " + f.exclude.map((t) => "#" + t).join(" "));
  return "Apply: " + (bits.join(" · ") || "everything");
}
async function saveCurrentFilter() {
  const name = ($("filterName").value || "").trim(); if (!name) return $("filterName").focus();
  const payload = {
    name, query: ($("filterQuery").value || "").trim(),
    include: $("filterInc").value.split(",").map((t) => t.trim()).filter(Boolean),
    exclude: $("filterExc").value.split(",").map((t) => t.trim()).filter(Boolean),
  };
  const res = await api("POST", "/api/filters", payload);
  if (res.ok) state.filters = res.data.filters;
  savingFilter = false; render();
}
function applyFilter(id) {
  const f = state.filters.find((x) => x.id === id); if (!f) return;
  query = f.query || ""; $("search").value = query; $("clearSearch").hidden = !query;
  tagFilter = null; activeInclude = (f.include || []).slice(); activeExclude = (f.exclude || []).slice();
  selected.clear(); render();
}
async function deleteFilter(id) {
  const res = await api("DELETE", "/api/filters/" + id);
  if (res.ok) state.filters = res.data.filters;
  render();
}

// ---- Bulk -----------------------------------------------------------------
function selectedBookmarks() { return state.bookmarks.filter((b) => selected.has(b.id)); }
function renderBulk() {
  const el = $("bulkbar");
  if (!selected.size) { el.hidden = true; el.innerHTML = ""; bulkTagMode = null; bulkConfirmDelete = false; return; }
  el.hidden = false; const n = selected.size;
  if (bulkConfirmDelete) {
    el.innerHTML = `<span class="bulk-count">Delete ${n} bookmark${n > 1 ? "s" : ""} permanently?</span><button class="danger" data-bulk="delete-yes">Delete ${n}</button><button data-bulk="delete-no">Cancel</button>`;
  } else {
    let h = `<span class="bulk-count">${n} selected</span>`;
    if (n < lastShown.length) h += `<button data-bulk="all">Select all ${lastShown.length} matching</button>`;
    h += `<button data-bulk="clear">Clear</button><span class="bulk-sep"></span>`;
    if (view === "archived") h += `<button data-bulk="restore">♻ Restore</button>`;
    else {
      h += `<button data-bulk="read">Mark as read</button><button data-bulk="unread">Mark unread</button>`;
      h += `<button data-bulk="addtags">Add tags…</button><button data-bulk="removetags">Remove tags…</button><button data-bulk="archive">🗄 Archive</button>`;
    }
    h += `<button class="danger" data-bulk="delete">🗑 Delete…</button>`;
    if (bulkTagMode) h += `<span class="bulk-taginput"><span class="bulk-sug-wrap"><input id="bulkTags" placeholder="tags, comma separated" autocomplete="off"><div class="suggest" id="bulkSug"></div></span><button data-bulk="applytags">${bulkTagMode === "add" ? "Add to" : "Remove from"} ${n}</button></span>`;
    el.innerHTML = h;
  }
  el.querySelectorAll("button").forEach((b) => b.onclick = () => applyBulk(b.dataset.bulk));
  if (bulkTagMode) {
    const poolFn = bulkTagMode === "add" ? () => allTags() : () => { const s = new Set(); selectedBookmarks().forEach((b) => b.tags.forEach((t) => s.add(t))); return [...s].sort(); };
    const upd = attachSuggest($("bulkTags"), $("bulkSug"), poolFn, bulkTagMode === "add" ? "Your tags — click to reuse" : "Tags on selected — click to remove");
    $("bulkTags").focus(); $("bulkTags").addEventListener("keydown", (e) => { if (e.key === "Enter") applyBulk("applytags"); });
    upd();
  }
}
async function applyBulk(action) {
  if (action === "all") { lastShown.forEach((b) => selected.add(b.id)); render(); return; }
  if (action === "clear") { selected.clear(); bulkTagMode = null; render(); return; }
  if (action === "addtags" || action === "removetags") { bulkTagMode = action === "addtags" ? "add" : "remove"; renderBulk(); return; }
  if (action === "delete") { bulkConfirmDelete = true; renderBulk(); return; }
  if (action === "delete-no") { bulkConfirmDelete = false; renderBulk(); return; }
  const ids = [...selected];
  let body;
  if (action === "applytags") {
    const tags = ($("bulkTags") ? $("bulkTags").value : "").split(",").map((t) => t.trim()).filter(Boolean);
    body = { ids, action: bulkTagMode === "add" ? "addTags" : "removeTags", payload: { tags } };
  } else if (action === "delete-yes") body = { ids, action: "delete" };
  else body = { ids, action };
  const res = await api("POST", "/api/bookmarks/bulk", body);
  if (res.ok) state.bookmarks = res.data.bookmarks;
  selected.clear(); bulkTagMode = null; bulkConfirmDelete = false; render();
}

// ---- Card actions ---------------------------------------------------------
function rlButton(b) {
  if (b.readLater) return `<button class="rlbtn on" data-act="read" data-id="${b.id}">✓ Mark as read</button>`;
  return `<button class="rlbtn" data-act="later" data-id="${b.id}">☆ Save to read later</button>`;
}
function cardActions(b) {
  if (confirmDelete === b.id) {
    return `<span class="confirm-msg">Delete this permanently?</span><button class="rlbtn danger" data-act="del-yes" data-id="${b.id}">Delete</button><button class="rlbtn" data-act="del-no" data-id="${b.id}">Cancel</button>`;
  }
  if (confirmIA === b.id) {
    return `<span class="confirm-msg caution">This sends a <strong>public</strong> copy to the Internet Archive, a third party. Continue?</span><button class="rlbtn" data-act="ia-yes" data-id="${b.id}">Send to Internet Archive</button><button class="rlbtn" data-act="ia-no" data-id="${b.id}">Cancel</button>`;
  }
  const edit = `<button class="rlbtn" data-act="edit" data-id="${b.id}">✎ Edit</button>`;
  const del = `<button class="rlbtn danger" data-act="del-ask" data-id="${b.id}">🗑 Delete</button>`;
  const open = openMenu === b.id;
  if (b.archived) {
    return `<button class="rlbtn" data-act="restore" data-id="${b.id}">♻ Restore</button><span class="cardmenu${open ? " open" : ""}"><button class="rlbtn" data-act="menu" data-id="${b.id}">⋯ More</button><span class="menu">${edit}${del}</span></span>`;
  }
  const preserve = `<button class="rlbtn" data-act="preserve" data-id="${b.id}">🛡 ${b.preserved ? "Re-preserve copy" : "Preserve a copy"}</button>`;
  const ia = (b.ia && b.ia.status === "done") ? "" : `<button class="rlbtn" data-act="ia" data-id="${b.id}">🌐 Send to Internet Archive</button>`;
  return `${rlButton(b)}<span class="cardmenu${open ? " open" : ""}"><button class="rlbtn" data-act="menu" data-id="${b.id}">⋯ More</button><span class="menu">${edit}${preserve}${ia}${del}</span></span>`;
}
async function cardAction(id, act) {
  const b = byId(id);
  if (act === "menu") { openMenu = openMenu === id ? null : id; render(); return; }
  if (!b) return;
  if (act === "edit") { openEdit(b, "edit"); return; }
  if (act === "read") { await api("PUT", "/api/bookmarks/" + id, { readLater: false }); return reload(); }
  if (act === "later") { await api("PUT", "/api/bookmarks/" + id, { readLater: true }); return reload(); }
  if (act === "archive") { await api("PUT", "/api/bookmarks/" + id, { archived: true }); return reload(); }
  if (act === "restore") { await api("PUT", "/api/bookmarks/" + id, { archived: false }); return reload(); }
  if (act === "del-ask") { confirmDelete = id; openMenu = null; render(); return; }
  if (act === "del-no") { confirmDelete = null; render(); return; }
  if (act === "del-yes") { confirmDelete = null; await api("DELETE", "/api/bookmarks/" + id); return reload(); }
  if (act === "preserve") {
    openMenu = null; b.preserved = { pending: true }; render();
    const res = await api("POST", "/api/bookmarks/" + id + "/preserve");
    if (!res.ok) showIoMsg("Preserve failed" + (res.data && res.data.message ? ": " + res.data.message : ""));
    return reload();
  }
  if (act === "ia") { confirmIA = id; openMenu = null; render(); return; }
  if (act === "ia-no") { confirmIA = null; render(); return; }
  if (act === "ia-yes") {
    confirmIA = null; b.ia = { status: "pending" }; render();
    const res = await api("POST", "/api/bookmarks/" + id + "/internet-archive");
    if (res.ok && res.data.ia && res.data.ia.status === "error") showIoMsg(res.data.ia.message || "Internet Archive submission failed");
    return reload();
  }
}
function preservationRow(b) {
  const parts = [];
  if (b.preserved && b.preserved.pending) parts.push('<span class="pres pending">🛡 Preserving a copy…</span>');
  else if (b.preserved) { const label = b.preserved.kind === "pdf" ? "Preserved PDF" : "Preserved copy"; parts.push(`<a class="pres done" href="/preserved/${b.id}" target="_blank" rel="noopener">🛡 ${label} · ${fmtDate(b.preserved.at)} · View</a>`); }
  if (b.ia) {
    if (b.ia.status === "pending") parts.push('<span class="pres pending">🌐 Submitting to the Internet Archive…</span>');
    else if (b.ia.status === "done") parts.push(`<a class="pres done" href="${esc(b.ia.url)}" target="_blank" rel="noopener">🌐 On the Internet Archive · View</a>`);
    else if (b.ia.status === "error") parts.push(`<span class="pres err" title="${esc(b.ia.message || "")}">🌐 Internet Archive submission failed</span>`);
  }
  return parts.length ? `<div class="pres-row">${parts.join("")}</div>` : "";
}

// ---- Main render ----------------------------------------------------------
function render() {
  renderSaved(); renderTabs(); renderTagbar(); renderBanner(); renderSort();
  const list = $("list");
  if (!state.bookmarks.length) {
    $("count").textContent = "";
    renderBulk();
    list.innerHTML = '<div class="empty"><div class="big">Nothing saved yet</div>Paste a link above and it will appear here, safe and findable.</div>';
    return;
  }
  const cq = compileQuery(query);
  if (cq.error) {
    $("count").textContent = ""; renderBulk();
    list.innerHTML = `<div class="empty error"><div class="big">⚠ ${esc(cq.error)}</div>No results are shown until the search is fixed.</div>`;
    return;
  }
  const scope = baseForView();
  let shown = cq.empty ? scope.slice() : scope.filter((b) => cq.test(b));
  if (tagFilter) shown = shown.filter((b) => b.tags.some((x) => x.toLowerCase() === tagFilter.toLowerCase()));
  if (activeInclude.length) shown = shown.filter((b) => { const s = new Set(b.tags.map((x) => x.toLowerCase())); return activeInclude.every((t) => s.has(t.toLowerCase())); });
  if (activeExclude.length) shown = shown.filter((b) => { const s = new Set(b.tags.map((x) => x.toLowerCase())); return !activeExclude.some((t) => s.has(t.toLowerCase())); });
  shown = sortBookmarks(shown);
  lastShown = shown;
  renderBulk();

  const sig = [view, query, tagFilter, activeInclude.join(","), activeExclude.join(","), sortMode, pageSize].join("|");
  if (sig !== lastSig) { visibleCount = pageLimit(); lastSig = sig; }

  const filtered = !cq.empty || tagFilter || activeInclude.length || activeExclude.length;
  const scopeLabel = view === "unread" ? " in read later" : (view === "archived" ? " archived" : "");
  $("count").textContent = filtered ? `(${shown.length} of ${scope.length}${scopeLabel})` : `(${scope.length}${scopeLabel})`;
  if (!shown.length) {
    if (view === "unread" && !filtered) list.innerHTML = `<div class="empty"><div class="big">You're all caught up 🎉</div>Nothing is waiting in read later.</div>`;
    else if (view === "archived" && !filtered) list.innerHTML = `<div class="empty"><div class="big">Nothing archived</div>Archive bookmarks you want out of the way but not gone — they stay here and can be restored anytime.</div>`;
    else list.innerHTML = `<div class="empty"><div class="big">No bookmarks match</div>Try a different tag, search, or view.</div>`;
    return;
  }
  const page = shown.slice(0, visibleCount);
  list.innerHTML = page.map((b) => cardHtml(b, cq)).join("");
  if (shown.length > page.length) {
    const remaining = shown.length - page.length;
    const step = pageLimit() === Infinity ? remaining : Math.min(remaining, pageLimit());
    const more = document.createElement("div"); more.className = "loadmore";
    more.innerHTML = `<button id="showMore">Show ${step} more <span class="lm-count">(${remaining} not shown)</span></button>`;
    list.appendChild(more);
    more.querySelector("#showMore").onclick = () => { visibleCount += pageLimit() === Infinity ? remaining : pageLimit(); render(); };
  }
  wireCards(list);
}
function cardHtml(b, cq) {
  const h = hueOf(host(b.url));
  const favInner = b.fav ? `<img src="${esc(b.fav)}" alt="">` : (host(b.url)[0] || "?").toUpperCase();
  const thumb = b.preview ? `<div class="thumb"><img src="${esc(b.preview)}" alt=""></div>` : `<div class="thumb" style="background:linear-gradient(135deg,hsl(${h} 60% 52%),hsl(${(h + 40) % 360} 60% 42%))"></div>`;
  const sel = selected.has(b.id);
  return `<div class="card${sel ? " selected" : ""}" data-open="${esc(b.url)}" data-id="${b.id}" title="Click to open the original page">
    <label class="selcol"><input type="checkbox" class="selbox" data-id="${b.id}"${sel ? " checked" : ""} aria-label="Select"></label>
    <div class="body">
      <div class="head">
        <span class="card-fav" style="background:hsl(${h} 45% 55%)">${favInner}</span>
        <p class="title"><a href="${esc(b.url)}" target="_blank" rel="noopener">${highlight(b.title, cq.hiText)}</a></p>
        ${b.readLater ? '<span class="rl-badge">Read later</span>' : ""}
      </div>
      <div class="url">${highlight(b.url, cq.hiText)}</div>
      ${b.description ? `<p class="desc">${highlight(b.description, cq.hiText)}</p>` : ""}
      ${b.note ? `<div class="note"><span class="note-ico">📝</span><div class="note-body">${renderNote(b.note)}</div></div>` : ""}
      ${b.tags.length ? `<div class="tags">${b.tags.map((t) => { const isTag = cq.hiTag.some((x) => x.toLowerCase() === t.toLowerCase()); return `<span class="tag clickable" data-tag="${esc(t)}">#${isTag ? "<mark>" + esc(t) + "</mark>" : highlight(t, cq.hiText)}</span>`; }).join("")}</div>` : ""}
      ${preservationRow(b)}
      <div class="card-actions">${cardActions(b)}</div>
    </div>
    ${thumb}
  </div>`;
}
function wireCards(list) {
  list.querySelectorAll(".selbox").forEach((cb) => cb.addEventListener("change", (e) => { e.stopPropagation(); const id = Number(cb.dataset.id); if (cb.checked) selected.add(id); else selected.delete(id); render(); }));
  list.querySelectorAll(".selcol").forEach((el) => el.addEventListener("click", (e) => e.stopPropagation()));
  list.querySelectorAll(".tag.clickable").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); tagFilter = el.dataset.tag; render(); }));
  list.querySelectorAll(".rlbtn, .cardmenu > .rlbtn, .menu .rlbtn").forEach((btn) => btn.addEventListener("click", (e) => { e.stopPropagation(); cardAction(Number(btn.dataset.id), btn.dataset.act); }));
  list.querySelectorAll(".card").forEach((card) => card.addEventListener("click", (e) => {
    if (e.target.closest("button, a, .tag, .cardmenu, input, label, .selcol")) return;
    window.open(card.dataset.open, "_blank", "noopener");
  }));
}

// ---- Search wiring --------------------------------------------------------
$("search").addEventListener("input", () => { query = $("search").value.trim(); $("clearSearch").hidden = !query; render(); });
$("clearSearch").addEventListener("click", () => { $("search").value = ""; query = ""; $("clearSearch").hidden = true; render(); $("search").focus(); });

// ---- Settings -------------------------------------------------------------
$("settingsBtn").addEventListener("click", () => { renderSettings(); $("settingsOverlay").hidden = false; });
$("settingsClose").addEventListener("click", () => { $("settingsOverlay").hidden = true; });
$("settingsOverlay").addEventListener("click", (e) => { if (e.target === $("settingsOverlay")) $("settingsOverlay").hidden = true; });
function renderSettings() {
  $("setSort").innerHTML = SORT_OPTS.map(([v, l]) => `<option value="${v}"${sortMode === v ? " selected" : ""}>${l}</option>`).join("");
  $("setSort").onchange = (e) => setSort(e.target.value);
  $("setPageSize").innerHTML = PAGE_OPTS.map(([v, l]) => `<option value="${v}"${pageSize === v ? " selected" : ""}>${l}</option>`).join("");
  $("setPageSize").onchange = (e) => { pageSize = e.target.value; savePref("pagesize", pageSize); visibleCount = pageLimit(); render(); };
  $("setTextSize").innerHTML = TEXT_OPTS.map(([v, l]) => `<button class="seg${textSize === v ? " active" : ""}" data-ts="${v}">${l}</button>`).join("");
  $("setTextSize").querySelectorAll(".seg").forEach((b) => b.onclick = () => { textSize = b.dataset.ts; savePref("textsize", textSize); applyTextSize(); renderSettings(); });
}
function applyTextSize() { document.body.className = "text-" + textSize; }
async function savePref(key, value) { await api("PUT", "/api/prefs", { key, value }); state.prefs[key] = String(value); }

$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    const res = await api("POST", "/api/import", r.result, true);
    if (res.ok) { state.bookmarks = res.data.bookmarks; showIoMsg(`Imported ${res.data.added} bookmark${res.data.added === 1 ? "" : "s"}${res.data.skipped ? `, skipped ${res.data.skipped} already saved` : ""}`); render(); }
  };
  r.readAsText(f); e.target.value = "";
});
$("exportBtn").addEventListener("click", () => { window.location.href = "/api/export"; showIoMsg(`Exported ${state.bookmarks.length} bookmark${state.bookmarks.length === 1 ? "" : "s"}`); });

// ---- Boot -----------------------------------------------------------------
async function boot() {
  const res = await api("GET", "/api/state");
  if (res.ok) state = res.data;
  const p = state.prefs || {};
  if (p.sort && SORT_OPTS.some((o) => o[0] === p.sort)) sortMode = p.sort;
  if (p.pagesize && PAGE_OPTS.some((o) => o[0] === p.pagesize)) pageSize = p.pagesize;
  if (p.textsize && TEXT_OPTS.some((o) => o[0] === p.textsize)) textSize = p.textsize;
  visibleCount = pageLimit();
  applyTextSize();
  render();
  document.body.setAttribute("data-harness-ready", "true");
}
boot();
