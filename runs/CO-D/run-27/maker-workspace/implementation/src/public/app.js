import { normalize, isValidWebUrl, withScheme } from "./shared/normalize.js";
import { buildMatcher, matchesAll } from "./shared/search.js";
import { mdToHtml, mdToPlain, normalizeTag } from "./shared/md.js";
import { svgPreview, deriveVisual } from "./shared/visuals.js";

const $ = (id) => document.getElementById(id);
const state = {
  user: null, bookmarks: [], views: [], prefs: { sort: "added-desc", pageSize: 20, textSize: "medium" },
  query: "", include: [], exclude: [], filter: "all", sort: "added-desc",
  visible: 20, selectMode: false, selected: new Set(), pendingDelete: null, noteViewId: null,
};

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  let body = null; try { body = await res.json(); } catch {}
  if (!res.ok) { const err = new Error((body && body.error) || "Request failed"); err.status = res.status; err.body = body; throw err; }
  return body;
}
function flash(msg, kind = "ok") {
  const f = $("flash"); f.className = "flash " + kind; f.textContent = msg; f.style.display = "block";
  clearTimeout(f._t); f._t = setTimeout(() => { f.style.display = "none"; }, 3200);
}
function ready() { document.body.setAttribute("data-harness-ready", "true"); }
function allUsedTags() { const s = new Set(); state.bookmarks.forEach((b) => (b.tags || []).forEach((t) => s.add(String(t).toLowerCase()))); return [...s]; }

/* ---------------- auth ---------------- */
let authMode = "login";
function showAuth() {
  $("appScreen").hidden = true; $("authScreen").hidden = false;
  $("reviewHint").textContent = "Reviewing? Sign in with review@example.com / review-access";
  ready();
}
function setAuthMode(m) {
  authMode = m;
  $("tabLogin").classList.toggle("active", m === "login");
  $("tabRegister").classList.toggle("active", m === "register");
  $("authSubmit").textContent = m === "login" ? "Sign in" : "Create account";
  $("authPassword").autocomplete = m === "login" ? "current-password" : "new-password";
  $("authErr").textContent = "";
}
$("tabLogin").addEventListener("click", () => setAuthMode("login"));
$("tabRegister").addEventListener("click", () => setAuthMode("register"));
$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault(); $("authErr").textContent = "";
  const email = $("authEmail").value, password = $("authPassword").value;
  try {
    await api("/api/" + (authMode === "login" ? "login" : "register"), { method: "POST", body: JSON.stringify({ email, password }) });
    await startApp();
  } catch (err) { $("authErr").textContent = err.message; }
});
$("logoutBtn").addEventListener("click", async () => { await api("/api/logout", { method: "POST" }); location.reload(); });

/* ---------------- load ---------------- */
async function startApp() {
  const me = await api("/api/me");
  state.user = me;
  const [bl, pf, vw] = await Promise.all([api("/api/bookmarks"), api("/api/prefs"), api("/api/views")]);
  state.bookmarks = bl.bookmarks; state.prefs = pf; state.views = vw.views;
  state.sort = pf.sort; state.visible = pf.pageSize;
  $("authScreen").hidden = true; $("appScreen").hidden = false;
  $("whoami").textContent = "Signed in as " + me.email;
  applyPrefs(); renderViews(); render(); ready();
}
function applyPrefs() {
  state.sort = state.prefs.sort; state.visible = state.prefs.pageSize;
  document.body.classList.remove("text-small", "text-large");
  if (state.prefs.textSize === "small") document.body.classList.add("text-small");
  else if (state.prefs.textSize === "large") document.body.classList.add("text-large");
  $("sortSelect").value = state.sort; $("setSort").value = state.prefs.sort;
  $("setPageSize").value = String(state.prefs.pageSize); $("setTextSize").value = state.prefs.textSize;
}

/* ---------------- rendering ---------------- */
function sortItems(arr) {
  const a = arr.slice();
  a.sort((x, y) => {
    if (state.sort === "added-asc") return (x.savedAt || 0) - (y.savedAt || 0);
    if (state.sort === "title-asc") return String(x.title).localeCompare(String(y.title));
    if (state.sort === "title-desc") return String(y.title).localeCompare(String(x.title));
    return (y.savedAt || 0) - (x.savedAt || 0);
  });
  return a;
}
function setFilterLabel(key, label, n) { const b = document.querySelector(`.filters button[data-filter="${key}"]`); if (b) b.textContent = `${label} (${n})`; }
function renderActiveTags() {
  const bar = $("activeTags");
  if (!state.include.length && !state.exclude.length) { bar.hidden = true; bar.innerHTML = ""; return; }
  bar.innerHTML = ""; bar.hidden = false;
  if (state.include.length) { const s = document.createElement("span"); s.textContent = "Including: "; bar.appendChild(s); state.include.forEach((t) => { const c = document.createElement("span"); c.className = "atg"; c.textContent = "#" + t; bar.appendChild(c); }); }
  if (state.exclude.length) { const s = document.createElement("span"); s.textContent = " Excluding: "; s.style.marginLeft = "6px"; bar.appendChild(s); state.exclude.forEach((t) => { const c = document.createElement("span"); c.className = "atg exc"; c.textContent = "#" + t; bar.appendChild(c); }); }
  const clr = document.createElement("button"); clr.className = "clearTags"; clr.textContent = "Clear tag filters";
  clr.addEventListener("click", () => { state.include = []; state.exclude = []; state.visible = state.prefs.pageSize; render(); });
  bar.appendChild(clr);
}

function render() {
  const matcher = buildMatcher(state.query);
  const matched = state.bookmarks.filter((b) => matchesAll(b, matcher, state.include, state.exclude));
  const active = matched.filter((b) => !b.archived);
  const archived = matched.filter((b) => b.archived);
  const nToRead = active.filter((b) => b.toRead).length;
  setFilterLabel("all", "All", active.length);
  setFilterLabel("unread", "To read", nToRead);
  setFilterLabel("read", "Read", active.length - nToRead);
  setFilterLabel("archived", "Archived", archived.length);
  renderActiveTags();

  let items = state.filter === "archived" ? archived
    : active.filter((b) => state.filter === "unread" ? b.toRead : state.filter === "read" ? !b.toRead : true);
  items = sortItems(items);

  const list = $("list"), count = $("count"), lm = $("loadMoreWrap");
  list.innerHTML = ""; lm.innerHTML = "";
  $("bulkBar").hidden = !state.selectMode;
  $("bulkActive").hidden = state.filter === "archived";
  $("bulkArchived").hidden = state.filter !== "archived";
  if (state.selectMode) $("bulkCount").textContent = state.selected.size + " selected";

  if (state.bookmarks.length === 0) { count.textContent = ""; list.innerHTML = '<div class="empty"><div class="big">🔖</div>Nothing saved yet. Paste a link above and press Save.</div>'; return; }
  if (items.length === 0) {
    count.textContent = "";
    let icon = "🔍", msg;
    const raw = state.query.trim();
    if ((raw || state.include.length || state.exclude.length) && matched.length === 0) msg = "No saved links match your search.";
    else if (state.filter === "unread") { icon = "🎉"; msg = "You're all caught up — nothing left to read."; }
    else if (state.filter === "read") { icon = "📖"; msg = "No read or reference links yet."; }
    else if (state.filter === "archived") { icon = "🗄️"; msg = "Nothing archived. Archived links are kept here and can be restored."; }
    else msg = "No links to show.";
    list.innerHTML = `<div class="empty"><div class="big">${icon}</div><span id="noRes"></span></div>`;
    $("noRes").textContent = msg; return;
  }

  const total = items.length, shown = Math.min(state.visible, total);
  const parts = [shown < total ? `Showing ${shown} of ${total} link${total === 1 ? "" : "s"}` : `${total} link${total === 1 ? "" : "s"}`];
  if (state.filter === "all") parts.push(nToRead + " to read");
  count.textContent = parts.join(" · ") + ((state.query.trim() || state.include.length || state.exclude.length) ? " (filtered)" : "");

  items.slice(0, shown).forEach((it) => list.appendChild(renderItem(it)));

  if (shown < total) { const btn = document.createElement("button"); btn.textContent = `Load more (${total - shown} more)`; btn.addEventListener("click", () => { state.visible += state.prefs.pageSize; render(); }); lm.appendChild(btn); }
}

function renderItem(it) {
  const li = document.createElement("li");
  li.className = "item" + (it.archived ? " archived" : "") + (state.selectMode && state.selected.has(it.id) ? " selected" : "");
  const cb = state.selectMode ? `<input type="checkbox" class="selBox" ${state.selected.has(it.id) ? "checked" : ""} />` : "";
  const actions = it.archived
    ? `<button data-restore>Restore</button><span class="more"><button class="moreBtn" aria-label="More">⋯</button><div class="moreMenu"><button class="danger" data-del>Delete</button></div></span>`
    : `<button class="readBtn">${it.toRead ? "Mark as read" : "Read later"}</button><button data-edit>Edit</button>` +
      `<span class="more"><button class="moreBtn" aria-label="More">⋯</button><div class="moreMenu">` +
      (it.snapshot ? `<button data-snap="update">Update saved copy</button><button data-snap="remove">Remove saved copy</button>` : `<button data-snap="save">Save a copy</button>`) +
      (it.archiveUrl ? `<button data-ia="remove">Remove Internet Archive link</button>` : `<button data-ia="add">Preserve on Internet Archive</button>`) +
      `<button data-arch>Archive</button><button class="danger" data-del>Delete</button></div></span>`;
  li.innerHTML =
    cb + '<div class="thumb"></div><div class="body">' +
    `<a class="open" href="${escapeAttr(it.url)}" target="_blank" rel="noopener"><div class="titleRow"><span class="fav"></span><span class="title"></span>` +
    (!it.archived && it.toRead ? '<span class="chip">To read</span>' : "") + '</div><p class="desc"></p><div class="url"></div></a>' +
    '<div class="tags"></div>' +
    (it.note ? '<div class="note"></div><button class="noteOpen" data-note>Open note</button>' : "") +
    (it.snapshot ? `<button class="snapOpen" data-snapview>📄 ${it.snapshot.kind === "pdf" ? "View saved PDF" : "View saved copy"}</button>` : "") +
    (it.archiveUrl ? `<a class="snapOpen archiveLink" href="${escapeAttr(it.archiveUrl)}" target="_blank" rel="noopener">🌐 Internet Archive ↗</a>` : "") +
    `<div class="actions">${actions}</div></div>`;
  li.querySelector(".thumb").style.backgroundImage = svgPreview(it.preview.label, it.preview.color);
  const fav = li.querySelector(".fav"); fav.textContent = it.icon.letter; fav.style.background = it.icon.color;
  li.querySelector(".title").textContent = it.title;
  li.querySelector(".desc").textContent = it.description;
  li.querySelector(".url").textContent = it.url;
  if (it.note) li.querySelector(".note").textContent = mdToPlain(it.note);
  const tagsBox = li.querySelector(".tags");
  (it.tags || []).forEach((tg) => { const s = document.createElement("span"); s.className = "tag"; s.textContent = "#" + tg; s.addEventListener("click", () => { $("searchInput").value = "#" + tg; state.query = "#" + tg; state.visible = state.prefs.pageSize; render(); }); tagsBox.appendChild(s); });

  // wire actions
  const q = (sel) => li.querySelector(sel);
  if (q(".selBox")) q(".selBox").addEventListener("change", (e) => { if (e.target.checked) state.selected.add(it.id); else state.selected.delete(it.id); li.classList.toggle("selected", e.target.checked); $("bulkCount").textContent = state.selected.size + " selected"; });
  if (q("[data-edit]")) q("[data-edit]").addEventListener("click", () => openEdit(it));
  if (q(".readBtn")) q(".readBtn").addEventListener("click", () => toggleRead(it));
  if (q("[data-arch]")) q("[data-arch]").addEventListener("click", () => setArchived(it, true));
  if (q("[data-restore]")) q("[data-restore]").addEventListener("click", () => setArchived(it, false));
  if (q("[data-del]")) q("[data-del]").addEventListener("click", () => askDelete(it));
  if (q("[data-note]")) q("[data-note]").addEventListener("click", (e) => { e.stopPropagation(); openNote(it); });
  if (q("[data-snapview]")) q("[data-snapview]").addEventListener("click", (e) => { e.stopPropagation(); openSnapshot(it); });
  li.querySelectorAll("[data-snap]").forEach((b) => b.addEventListener("click", () => snapshotAction(it, b.getAttribute("data-snap"))));
  li.querySelectorAll("[data-ia]").forEach((b) => b.addEventListener("click", () => iaAction(it, b.getAttribute("data-ia"))));
  const moreBtn = q(".moreBtn");
  if (moreBtn) moreBtn.addEventListener("click", (e) => { e.stopPropagation(); const menu = moreBtn.parentNode.querySelector(".moreMenu"); const open = menu.classList.contains("show"); document.querySelectorAll(".moreMenu.show").forEach((m) => m.classList.remove("show")); if (!open) menu.classList.add("show"); });
  return li;
}
function escapeAttr(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
document.addEventListener("click", () => document.querySelectorAll(".moreMenu.show").forEach((m) => m.classList.remove("show")));

/* ---------------- mutations ---------------- */
function replaceLocal(bm) { const i = state.bookmarks.findIndex((b) => b.id === bm.id); if (i >= 0) state.bookmarks[i] = bm; else state.bookmarks.unshift(bm); }
async function toggleRead(it) { const bm = (await api(`/api/bookmarks/${it.id}`, { method: "PATCH", body: JSON.stringify({ toRead: !it.toRead, touch: false }) })).bookmark; replaceLocal(bm); render(); flash(bm.toRead ? "Added to “Read later”." : "Marked as read."); }
async function setArchived(it, v) { const bm = (await api(`/api/bookmarks/${it.id}`, { method: "PATCH", body: JSON.stringify({ archived: v, touch: false }) })).bookmark; replaceLocal(bm); render(); flash(v ? "Archived." : "Restored to your bookmarks."); }
async function snapshotAction(it, action) {
  try {
    if (action === "remove") { const bm = (await api(`/api/bookmarks/${it.id}/snapshot`, { method: "DELETE" })).bookmark; replaceLocal(bm); render(); flash("Saved copy removed."); return; }
    flash("Saving a copy…", "info");
    const bm = (await api(`/api/bookmarks/${it.id}/snapshot`, { method: "POST" })).bookmark; replaceLocal(bm); render();
    flash(bm.snapshot && bm.snapshot.kind === "pdf" ? "PDF saved." : (action === "update" ? "Saved copy updated." : "Copy saved."));
  } catch (e) { flash(e.message || "Couldn't save a copy.", "err"); }
}
async function iaAction(it, action) {
  try {
    if (action === "remove") { const bm = (await api(`/api/bookmarks/${it.id}/archive`, { method: "DELETE" })).bookmark; replaceLocal(bm); render(); flash("Internet Archive link removed."); return; }
    flash("Submitting to the Internet Archive…", "info");
    const bm = (await api(`/api/bookmarks/${it.id}/archive`, { method: "POST" })).bookmark; replaceLocal(bm); render(); flash("Preserved on the Internet Archive.");
  } catch (e) { flash(e.message || "Couldn't reach the Internet Archive.", "err"); }
}

/* ---------------- delete confirm ---------------- */
function askDelete(it) { state.pendingDelete = it.id; $("confirmTitle").textContent = "Delete bookmark?"; $("confirmBody").textContent = `“${it.title}” will be permanently deleted. This can't be undone. If you might want it later, archive it instead.`; $("confirmOverlay").classList.add("show"); }
function askBulkDelete() { state.pendingDelete = "__BULK__"; const n = state.selected.size; $("confirmTitle").textContent = "Delete bookmarks?"; $("confirmBody").textContent = `${n} bookmark${n === 1 ? "" : "s"} will be permanently deleted. This can't be undone. If you might want them later, archive instead.`; $("confirmOverlay").classList.add("show"); }
$("confirmCancel").addEventListener("click", () => { $("confirmOverlay").classList.remove("show"); state.pendingDelete = null; });
$("confirmOverlay").addEventListener("click", (e) => { if (e.target === $("confirmOverlay")) $("confirmCancel").click(); });
$("confirmDelete").addEventListener("click", async () => {
  if (state.pendingDelete === "__BULK__") {
    const ids = [...state.selected]; const r = await api("/api/bookmarks/bulk", { method: "POST", body: JSON.stringify({ ids, action: "delete" }) });
    state.bookmarks = r.bookmarks; state.selected.clear();
    $("confirmOverlay").classList.remove("show"); render(); flash(`${ids.length} bookmark${ids.length === 1 ? "" : "s"} deleted.`);
  } else if (state.pendingDelete) {
    const id = state.pendingDelete; await api(`/api/bookmarks/${id}`, { method: "DELETE" });
    state.bookmarks = state.bookmarks.filter((b) => b.id !== id);
    $("confirmOverlay").classList.remove("show"); render(); flash("Bookmark deleted.");
  }
  state.pendingDelete = null;
});

/* ---------------- tag picker ---------------- */
function makeTagPicker(wrapId, inputId, suggestId, onChange) {
  let tags = []; let listS = [], activeS = -1;
  const wrap = $(wrapId), input = $(inputId), suggest = $(suggestId);
  function renderChips() {
    wrap.querySelectorAll(".tagChip").forEach((c) => c.remove());
    tags.forEach((tg, idx) => {
      const chip = document.createElement("span"); chip.className = "tagChip";
      const label = document.createElement("span"); label.textContent = "#" + tg;
      const x = document.createElement("button"); x.type = "button"; x.textContent = "×";
      x.addEventListener("click", () => { tags.splice(idx, 1); renderChips(); onChange && onChange(); });
      chip.appendChild(label); chip.appendChild(x); wrap.insertBefore(chip, input);
    });
    onChange && onChange();
  }
  function hide() { suggest.classList.remove("show"); suggest.innerHTML = ""; listS = []; activeS = -1; }
  function add(t) { const n = normalizeTag(t); if (n && tags.indexOf(n) < 0) tags.push(n); input.value = ""; renderChips(); hide(); }
  function update() {
    const qv = input.value.trim().toLowerCase().replace(/^#+/, "");
    if (!qv) return hide();
    let pool = allUsedTags().filter((t) => t.indexOf(qv) >= 0 && tags.indexOf(t) < 0);
    pool.sort((a, b) => { const sa = a.indexOf(qv) === 0 ? 0 : 1, sb = b.indexOf(qv) === 0 ? 0 : 1; return sa !== sb ? sa - sb : a.localeCompare(b); });
    listS = pool.slice(0, 8); if (!listS.length) return hide();
    activeS = 0; suggest.innerHTML = "";
    listS.forEach((t, i) => { const o = document.createElement("div"); o.className = "opt" + (i === 0 ? " active" : ""); o.textContent = "#" + t; o.addEventListener("mousedown", (e) => { e.preventDefault(); add(t); input.focus(); }); suggest.appendChild(o); });
    suggest.classList.add("show");
  }
  function move(d) { if (!listS.length) return; activeS = (activeS + d + listS.length) % listS.length; suggest.querySelectorAll(".opt").forEach((o, i) => o.classList.toggle("active", i === activeS)); }
  input.addEventListener("input", update);
  input.addEventListener("keydown", function (e) {
    const open = listS.length > 0;
    if (e.key === "ArrowDown") { if (open) { e.preventDefault(); move(1); } }
    else if (e.key === "ArrowUp") { if (open) { e.preventDefault(); move(-1); } }
    else if (e.key === "Enter" || e.key === ",") { e.preventDefault(); if (open && activeS >= 0) add(listS[activeS]); else if (input.value.trim()) add(input.value); }
    else if (e.key === "Escape") hide();
    else if (e.key === "Backspace" && !this.value && tags.length) { tags.pop(); renderChips(); }
  });
  input.addEventListener("blur", () => setTimeout(() => { if (input.value.trim()) add(input.value); }, 120));
  return { get: () => tags.slice(), set: (a) => { tags = (a || []).slice(); input.value = ""; hide(); renderChips(); }, flush: () => { if (input.value.trim()) add(input.value); } };
}
const editorTags = makeTagPicker("mTagInput", "mTagField", "mTagSuggest", null);

/* ---------------- editor / review ---------------- */
const overlay = $("overlay");
let editState = { mode: null, id: null, url: null, meta: null };
function showModal() { overlay.classList.add("show"); }
function hideModal() { overlay.classList.remove("show"); }
function showLoading() { $("modalHead").textContent = "Review & save"; $("loadingBox").hidden = false; $("formBox").hidden = true; $("footBox").hidden = true; showModal(); }
function fillForm(head, meta, url) {
  $("modalHead").textContent = head; $("loadingBox").hidden = true; $("formBox").hidden = false; $("footBox").hidden = false;
  $("mPreview").style.backgroundImage = svgPreview(meta.preview.label, meta.preview.color);
  const fav = $("mFav"); fav.textContent = meta.icon.letter; fav.style.background = meta.icon.color;
  $("mTitle").value = meta.title || ""; $("mDesc").value = meta.description || ""; $("mUrl").value = url;
  $("mErr").textContent = ""; $("mNotice").hidden = true;
}
async function openAddFlow(url) {
  showLoading();
  let meta;
  try { meta = await api("/api/fetch-metadata", { method: "POST", body: JSON.stringify({ url }) }); }
  catch { const v = deriveVisual(url); meta = { url, title: url, description: "", icon: v.icon, preview: v.preview, failed: true }; }
  editState = { mode: "new", id: null, url: meta.url || url, meta };
  fillForm("Review & save", meta, editState.url);
  if (meta.failed) { const n = $("mNotice"); n.textContent = "We couldn't fetch this page's details. You can still save it and fill in the title and description yourself."; n.hidden = false; }
  $("readLaterRow").style.display = "flex"; $("mReadLater").checked = false;
  editorTags.set([]); $("mNote").value = ""; $("mTitle").focus();
}
function openEdit(it) {
  editState = { mode: "edit", id: it.id, url: it.url, meta: { title: it.title, description: it.description, icon: it.icon, preview: it.preview } };
  fillForm("Edit bookmark", editState.meta, it.url);
  $("readLaterRow").style.display = "none";
  editorTags.set(it.tags || []); $("mNote").value = it.note || ""; showModal();
}
$("mCancel").addEventListener("click", hideModal);
overlay.addEventListener("click", (e) => { if (e.target === overlay) hideModal(); });
$("mSave").addEventListener("click", async () => {
  editorTags.flush();
  const title = $("mTitle").value.trim(), desc = $("mDesc").value.trim(), url = withScheme($("mUrl").value.trim()), note = $("mNote").value.trim();
  const err = $("mErr"); err.textContent = "";
  if (!url) { err.textContent = "Please enter a web address."; return; }
  if (!isValidWebUrl(url)) { err.textContent = "That doesn't look like a valid web link. It should start with http:// or https://"; return; }
  try {
    if (editState.mode === "new") {
      const payload = { url, title: title || editState.meta.title, description: desc, icon: editState.meta.icon, preview: editState.meta.preview, tags: editorTags.get(), note, toRead: $("mReadLater").checked };
      const bm = (await api("/api/bookmarks", { method: "POST", body: JSON.stringify(payload) })).bookmark;
      state.bookmarks.unshift(bm); hideModal(); render(); flash(`Saved “${bm.title}”` + ($("mReadLater").checked ? " · added to Read later." : "."));
    } else {
      const bm = (await api(`/api/bookmarks/${editState.id}`, { method: "PATCH", body: JSON.stringify({ title: title || undefined, description: desc, url, tags: editorTags.get(), note }) })).bookmark;
      replaceLocal(bm); hideModal(); render(); flash("Changes saved.");
    }
  } catch (e) {
    if (e.status === 409 && e.body && e.body.error === "clash") { err.textContent = `Another saved bookmark already uses this address (“${e.body.title}”).`; }
    else err.textContent = e.message || "Couldn't save.";
  }
});

/* ---------------- saver submit ---------------- */
$("saver").addEventListener("submit", (e) => {
  e.preventDefault();
  const raw = $("urlInput").value.trim(); $("saverErr").textContent = "";
  if (!raw) return;
  const url = withScheme(raw);
  if (!isValidWebUrl(url)) { $("saverErr").textContent = "That doesn't look like a valid web address."; return; }
  const existing = state.bookmarks.find((b) => b.norm === normalize(url));
  $("urlInput").value = "";
  if (existing) { flash("You already saved this link — opening it so you can edit.", "info"); openEdit(existing); return; }
  openAddFlow(url);
});
$("urlInput").addEventListener("input", () => { $("saverErr").textContent = ""; });

/* ---------------- note & snapshot viewers ---------------- */
$("noteClose").addEventListener("click", () => $("noteOverlay").classList.remove("show"));
$("noteOverlay").addEventListener("click", (e) => { if (e.target === $("noteOverlay")) $("noteOverlay").classList.remove("show"); });
$("noteEdit").addEventListener("click", () => { const it = state.bookmarks.find((b) => b.id === state.noteViewId); $("noteOverlay").classList.remove("show"); if (it) openEdit(it); });
function openNote(it) { state.noteViewId = it.id; $("noteHead").textContent = it.title; $("noteView").innerHTML = mdToHtml(it.note || ""); $("noteOverlay").classList.add("show"); }
$("snapClose").addEventListener("click", () => $("snapOverlay").classList.remove("show"));
$("snapOverlay").addEventListener("click", (e) => { if (e.target === $("snapOverlay")) $("snapOverlay").classList.remove("show"); });
async function openSnapshot(it) {
  const s = await api(`/api/bookmarks/${it.id}/snapshot`);
  const when = new Date(s.capturedAt).toLocaleString();
  $("snapHead").textContent = it.title + (s.kind === "pdf" ? " — saved PDF" : " — saved copy");
  if (s.kind === "pdf") {
    $("snapBanner").textContent = `Preserved PDF captured on ${when}. Opens even if the original disappears.`;
    $("snapView").innerHTML = `<p>A copy of the PDF is preserved.</p><p><a href="/api/bookmarks/${it.id}/snapshot/file" target="_blank" rel="noopener">Open the saved PDF ↗</a></p>`;
  } else {
    $("snapBanner").textContent = `Preserved copy captured on ${when}. This is a self-contained saved page and may differ from the live one.`;
    $("snapView").innerHTML = `<iframe title="Saved copy" style="width:100%;height:60vh;border:1px solid var(--line);border-radius:8px;background:#fff" sandbox="allow-same-origin" src="/api/bookmarks/${it.id}/snapshot/file"></iframe>` +
      `<p style="margin-top:8px"><a href="/api/bookmarks/${it.id}/snapshot/file" target="_blank" rel="noopener">Open the saved page in a new tab ↗</a></p>`;
  }
  $("snapOriginal").href = it.url; $("snapOverlay").classList.add("show");
}

/* ---------------- bulk ---------------- */
$("selectBtn").addEventListener("click", function () { state.selectMode = !state.selectMode; state.selected.clear(); this.classList.toggle("active", state.selectMode); this.textContent = state.selectMode ? "Done" : "Select"; render(); });
$("bulkCancel").addEventListener("click", () => { state.selectMode = false; state.selected.clear(); $("selectBtn").classList.remove("active"); $("selectBtn").textContent = "Select"; render(); });
$("bulkSelectAll").addEventListener("click", () => {
  const matcher = buildMatcher(state.query);
  const matched = state.bookmarks.filter((b) => matchesAll(b, matcher, state.include, state.exclude));
  const set = state.filter === "archived" ? matched.filter((b) => b.archived) : matched.filter((b) => !b.archived).filter((b) => state.filter === "unread" ? b.toRead : state.filter === "read" ? !b.toRead : true);
  const allSel = set.length > 0 && set.every((b) => state.selected.has(b.id));
  state.selected.clear(); if (!allSel) set.forEach((b) => state.selected.add(b.id)); render();
});
document.querySelectorAll(".bulkBar button[data-bulk]").forEach((b) => b.addEventListener("click", async () => {
  const action = b.getAttribute("data-bulk"); const ids = [...state.selected];
  if (action === "delete") { if (!ids.length) return flash("Select some links first.", "info"); return askBulkDelete(); }
  if (action === "addtag" || action === "removetag") {
    const tag = normalizeTag($("bulkTagField").value); if (!tag) return flash("Type a tag first.", "info");
    if (!ids.length) return flash("Select some links first.", "info");
    const r = await api("/api/bookmarks/bulk", { method: "POST", body: JSON.stringify({ ids, action, tag }) });
    state.bookmarks = r.bookmarks; state.selected.clear(); $("bulkTagField").value = ""; render(); flash(`${r.changed} link${r.changed === 1 ? "" : "s"} ${action === "addtag" ? "tagged" : "untagged"} “#${tag}”.`); return;
  }
  if (!ids.length) return flash("Select some links first.", "info");
  const r = await api("/api/bookmarks/bulk", { method: "POST", body: JSON.stringify({ ids, action }) });
  state.bookmarks = r.bookmarks; state.selected.clear(); render();
  const verb = { readlater: "added to Read later", read: "marked as read", archive: "archived", restore: "restored" }[action];
  flash(`${r.changed} link${r.changed === 1 ? "" : "s"} ${verb}.`);
}));

/* ---------------- filters / sort / search ---------------- */
$("searchInput").addEventListener("input", (e) => { state.query = e.target.value; state.visible = state.prefs.pageSize; render(); });
document.querySelectorAll('.filters button[data-filter]').forEach((b) => b.addEventListener("click", () => { state.filter = b.getAttribute("data-filter"); document.querySelectorAll(".filters button").forEach((x) => x.classList.remove("active")); b.classList.add("active"); state.visible = state.prefs.pageSize; render(); }));
$("sortSelect").addEventListener("change", async (e) => { state.sort = e.target.value; state.prefs.sort = e.target.value; $("setSort").value = e.target.value; state.visible = state.prefs.pageSize; render(); await savePrefs(); });

/* ---------------- settings + prefs ---------------- */
async function savePrefs() { state.prefs = await api("/api/prefs", { method: "PUT", body: JSON.stringify(state.prefs) }); }
$("settingsBtn").addEventListener("click", () => $("settingsOverlay").classList.add("show"));
$("setClose").addEventListener("click", () => $("settingsOverlay").classList.remove("show"));
$("settingsOverlay").addEventListener("click", (e) => { if (e.target === $("settingsOverlay")) $("settingsOverlay").classList.remove("show"); });
$("setSort").addEventListener("change", async (e) => { state.prefs.sort = e.target.value; applyPrefs(); render(); await savePrefs(); });
$("setPageSize").addEventListener("change", async (e) => { state.prefs.pageSize = parseInt(e.target.value, 10) || 20; applyPrefs(); render(); await savePrefs(); });
$("setTextSize").addEventListener("change", async (e) => { state.prefs.textSize = e.target.value; applyPrefs(); await savePrefs(); });

/* ---------------- import / export ---------------- */
function downloadFile(name, text, type) { const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$("exportJson").addEventListener("click", async () => {
  try { const data = await api("/api/export"); downloadFile("bookmarks-backup.json", JSON.stringify(data, null, 2), "application/json"); flash("Backup exported (includes saved copies, Archive links and dates)."); }
  catch { flash("Couldn't export the backup.", "err"); }
});
$("exportHtml").addEventListener("click", () => {
  const rows = state.bookmarks.map((b) => { const add = Math.floor((b.savedAt || Date.now()) / 1000); const tags = (b.tags || []).join(","); return `    <DT><A HREF="${escapeAttr(b.url)}" ADD_DATE="${add}"${tags ? ` TAGS="${escapeAttr(tags)}"` : ""}>${escapeAttr(b.title || b.url)}</A>`; }).join("\n");
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n${rows}\n</DL><p>\n`;
  downloadFile("bookmarks.html", html, "text/html"); flash("Bookmarks exported.");
});
$("importFile").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const text = String(reader.result || ""); const out = $("importResult");
    try {
      const isJson = /\.json$/i.test(file.name) || /^\s*[\[{]/.test(text);
      const incoming = isJson ? parseJsonImport(text) : parseHtmlImport(text);
      const r = await api("/api/bookmarks/import", { method: "POST", body: JSON.stringify({ bookmarks: incoming }) });
      state.bookmarks = r.bookmarks; render();
      out.textContent = `Imported ${r.added} bookmark${r.added === 1 ? "" : "s"}` + (r.skipped ? `, skipped ${r.skipped} (duplicates or invalid).` : ".");
      flash(`Imported ${r.added} bookmark${r.added === 1 ? "" : "s"}.`);
    } catch { out.textContent = "Sorry, that file couldn't be read as bookmarks."; }
    e.target.value = "";
  };
  reader.readAsText(file);
});
function parseJsonImport(text) {
  const d = JSON.parse(text); const list = Array.isArray(d) ? d : (d.bookmarks || []);
  return list.map((b) => ({
    url: b.url, title: b.title, description: b.description, tags: b.tags, note: b.note,
    toRead: b.toRead, archived: b.archived, icon: b.icon, preview: b.preview,
    savedAt: b.savedAt, editedAt: b.editedAt, snapshot: b.snapshot,
    archiveUrl: b.archiveUrl, archivedAt: b.archivedAt,
  }));
}
function parseHtmlImport(text) {
  const doc = new DOMParser().parseFromString(text, "text/html");
  return [...doc.querySelectorAll("a")].map((a) => ({ url: a.getAttribute("href") || "", title: (a.textContent || "").trim(), tags: (a.getAttribute("tags") || "").split(",").map((t) => t.trim()).filter(Boolean), savedAt: (parseInt(a.getAttribute("add_date") || "0", 10) || 0) * 1000 || undefined })).filter((b) => b.url);
}

/* ---------------- saved views ---------------- */
const includePicker = makeTagPicker("incInput", "incField", "incSuggest", refreshViewSummary);
const excludePicker = makeTagPicker("excInput", "excField", "excSuggest", refreshViewSummary);
function labelFilter(f) { return f === "unread" ? "To read" : f === "read" ? "Read" : f === "archived" ? "Archived" : "All"; }
function labelSort(s) { return s === "added-asc" ? "Oldest first" : s === "title-asc" ? "Title A–Z" : s === "title-desc" ? "Title Z–A" : "Newest first"; }
function describeView(v) {
  const p = [v.query ? `Search: “${v.query}”` : "Search: (none)"];
  if (v.includeTags && v.includeTags.length) p.push("Include: " + v.includeTags.map((t) => "#" + t).join(" "));
  if (v.excludeTags && v.excludeTags.length) p.push("Exclude: " + v.excludeTags.map((t) => "#" + t).join(" "));
  p.push("Filter: " + labelFilter(v.filter)); p.push("Sort: " + labelSort(v.sort));
  return p.join(" · ");
}
function refreshViewSummary() { $("viewSummary").textContent = describeView({ query: state.query.trim(), includeTags: includePicker.get(), excludeTags: excludePicker.get(), filter: state.filter, sort: state.sort }); }
function renderViews() {
  const box = $("viewsChips"); box.innerHTML = "";
  state.views.forEach((v) => {
    const chip = document.createElement("span"); chip.className = "viewChip";
    const open = document.createElement("button"); open.className = "open"; open.textContent = v.name; open.title = describeView(v); open.addEventListener("click", () => applyView(v));
    const del = document.createElement("button"); del.className = "del"; del.textContent = "×"; del.title = "Delete this view";
    del.addEventListener("click", async () => { const r = await api(`/api/views/${v.id}`, { method: "DELETE" }); state.views = r.views; renderViews(); flash(`View “${v.name}” removed.`); });
    chip.appendChild(open); chip.appendChild(del); box.appendChild(chip);
  });
}
function applyView(v) {
  $("searchInput").value = v.query; state.query = v.query;
  state.include = (v.includeTags || []).slice(); state.exclude = (v.excludeTags || []).slice();
  state.filter = v.filter; document.querySelectorAll(".filters button").forEach((x) => x.classList.toggle("active", x.getAttribute("data-filter") === v.filter));
  state.sort = v.sort; $("sortSelect").value = v.sort; state.visible = state.prefs.pageSize; render(); flash(`Opened view “${v.name}”.`);
}
$("saveViewBtn").addEventListener("click", () => { $("viewName").value = ""; $("viewErr").textContent = ""; includePicker.set(state.include); excludePicker.set(state.exclude); refreshViewSummary(); $("viewOverlay").classList.add("show"); $("viewName").focus(); });
$("viewCancel").addEventListener("click", () => $("viewOverlay").classList.remove("show"));
$("viewOverlay").addEventListener("click", (e) => { if (e.target === $("viewOverlay")) $("viewOverlay").classList.remove("show"); });
$("viewSave").addEventListener("click", async () => {
  const name = $("viewName").value.trim(); if (!name) { $("viewErr").textContent = "Please give the view a name."; return; }
  const r = await api("/api/views", { method: "POST", body: JSON.stringify({ name, query: state.query.trim(), includeTags: includePicker.get(), excludeTags: excludePicker.get(), filter: state.filter, sort: state.sort }) });
  state.views = r.views; renderViews(); $("viewOverlay").classList.remove("show"); flash(`View “${name}” saved.`);
});

/* ---------------- boot ---------------- */
(async function boot() {
  try { await api("/api/me"); await startApp(); }
  catch { setAuthMode("login"); showAuth(); }
})();
