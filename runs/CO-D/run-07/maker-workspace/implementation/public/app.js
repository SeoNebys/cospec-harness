import { buildQuery, contextFor } from "/lib/query.js";
import { normalizeUrl, isPlausibleLink } from "/lib/normalize.js";

// ---------- tiny API layer ----------
const api = {
  async j(method, url, body) {
    const opt = { method, headers: {} };
    if (body !== undefined) { opt.headers["content-type"] = "application/json"; opt.body = JSON.stringify(body); }
    const res = await fetch(url, opt);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  },
  get: (u) => api.j("GET", u),
  post: (u, b) => api.j("POST", u, b),
  patch: (u, b) => api.j("PATCH", u, b),
  put: (u, b) => api.j("PUT", u, b),
  del: (u) => api.j("DELETE", u),
};

// ---------- state ----------
let state = { bookmarks: [], views: [], prefs: { sort: "new", autoCopy: true, pageSize: "25", textSize: "md" } };
const ui = { search: "", activeTags: [], status: "all", scope: "active", page: 1, selecting: false, selected: new Set() };

const $ = (id) => document.getElementById(id);
const el = {
  url: $("url"), saveBtn: $("saveBtn"), saveError: $("saveError"), stage: $("stage"),
  search: $("search"), searchHint: $("searchHint"), filters: $("filters"),
  segment: $("segment"), sort: $("sort"), viewsBtn: $("viewsBtn"), viewsList: $("viewsList"),
  selectBtn: $("selectBtn"), settingsBtn: $("settingsBtn"), archiveBtn: $("archiveBtn"),
  bulkBar: $("bulkBar"), count: $("count"), list: $("list"), empty: $("empty"),
  noResults: $("noResults"), pager: $("pager"),
};

// ---------- utilities ----------
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function inlineMd(s) {
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, u) => `<a href="${u.replace(/&amp;/g, "&")}" target="_blank" rel="noopener">${t}</a>`);
  s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (m, pre, u) => `${pre}<a href="${u.replace(/&amp;/g, "&")}" target="_blank" rel="noopener">${u}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return s;
}
function renderNote(src) {
  const lines = esc(src).split(/\r?\n/);
  let html = "", para = [], list = null;
  const flushP = () => { if (para.length) { html += "<p>" + para.map(inlineMd).join("<br>") + "</p>"; para = []; } };
  const flushL = () => { if (list) { html += "</" + list + ">"; list = null; } };
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/), ol = line.match(/^\s*\d+[.)]\s+(.*)$/), ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (h) { flushP(); flushL(); const lv = Math.min(h[1].length, 3); html += `<div class="nh nh${lv}">${inlineMd(h[2])}</div>`; }
    else if (ol) { flushP(); if (list && list !== "ol") flushL(); if (!list) { html += "<ol>"; list = "ol"; } html += "<li>" + inlineMd(ol[1]) + "</li>"; }
    else if (ul) { flushP(); if (list && list !== "ul") flushL(); if (!list) { html += "<ul>"; list = "ul"; } html += "<li>" + inlineMd(ul[1]) + "</li>"; }
    else if (line.trim() === "") { flushP(); flushL(); }
    else { flushL(); para.push(line); }
  }
  flushP(); flushL();
  return html;
}
function thumbFallback(bm) {
  const label = esc((bm.site || bm.title || "?").slice(0, 22));
  const c1 = "#3a4a63", c2 = "#8894a8";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='236' height='164'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='236' height='164' fill='url(#g)'/><text x='16' y='90' font-family='sans-serif' font-size='20' font-weight='700' fill='rgba(255,255,255,.95)'>${label}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
function allTags() {
  const set = new Set();
  state.bookmarks.forEach((b) => (b.tags || []).forEach((t) => set.add(t)));
  return [...set].sort();
}
function findBookmark(id) { return state.bookmarks.find((b) => b.id === id); }
function closeMenus() { document.querySelectorAll(".menu-list").forEach((m) => { if (m.id !== "viewsList") m.hidden = true; }); el.viewsList.hidden = true; }
document.addEventListener("click", closeMenus);

// ---------- filtering / sorting / paging ----------
function includeTags() { return ui.activeTags.filter((f) => f.mode === "include").map((f) => f.tag); }
function excludeTags() { return ui.activeTags.filter((f) => f.mode === "exclude").map((f) => f.tag); }

function computeMatching() {
  const inArch = ui.scope === "archived";
  const { match, fallback } = buildQuery(ui.search);
  el.searchHint.hidden = inArch || !fallback;
  const inc = includeTags(), exc = excludeTags();
  let list = state.bookmarks.filter((b) => {
    if (inArch) return b.archived;
    if (b.archived) return false;
    if (!match(contextFor(b))) return false;
    if (!inc.every((t) => (b.tags || []).includes(t))) return false;
    if (exc.some((t) => (b.tags || []).includes(t))) return false;
    if (ui.status !== "all" && b.status !== ui.status) return false;
    return true;
  });
  const s = state.prefs.sort;
  list.sort((a, b) => {
    if (s === "old") return a.ts - b.ts;
    if (s === "az") return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    if (s === "za") return b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
    return b.ts - a.ts;
  });
  return list;
}

// ---------- rendering ----------
function render() {
  const inArch = ui.scope === "archived";
  const activeTotal = state.bookmarks.filter((b) => !b.archived).length;
  const archivedTotal = state.bookmarks.filter((b) => b.archived).length;
  el.archiveBtn.textContent = inArch ? "← Back to collection" : `🗄 Archived (${archivedTotal})`;
  el.segment.style.display = inArch ? "none" : "";
  el.search.parentElement.style.display = inArch ? "none" : "";

  const matching = computeMatching();
  const shown = matching.length;

  // pagination
  let pageItems = matching;
  const ps = state.prefs.pageSize;
  if (ps !== "all") {
    const size = parseInt(ps, 10) || 25;
    const pages = Math.max(1, Math.ceil(shown / size));
    if (ui.page > pages) ui.page = pages;
    if (ui.page < 1) ui.page = 1;
    pageItems = matching.slice((ui.page - 1) * size, (ui.page - 1) * size + size);
    renderPager(shown, size, pages);
  } else { el.pager.hidden = true; }

  el.list.innerHTML = "";
  pageItems.forEach((b) => el.list.appendChild(cardEl(b)));

  // counts + placeholders
  const narrowing = !inArch && (ui.search || ui.activeTags.length || ui.status !== "all");
  el.count.textContent = inArch ? `· ${shown} archived` : (activeTotal ? (narrowing ? `· ${shown} of ${activeTotal}` : `· ${activeTotal}`) : "");
  el.empty.hidden = !(!inArch && state.bookmarks.length === 0);
  const showNo = shown === 0 && (inArch ? true : activeTotal > 0);
  el.noResults.hidden = !showNo;
  if (showNo) {
    el.noResults.textContent = inArch ? "Nothing archived. Archived bookmarks are kept here, out of your main collection."
      : (ui.search || ui.activeTags.length) ? "No bookmarks match your search or filters."
      : ui.status === "toread" ? "Nothing left to read — you're all caught up."
      : ui.status === "finished" ? "Nothing marked as finished yet." : "No bookmarks match.";
  }
  renderFilters();
  renderBulkBar();
  el.sort.value = state.prefs.sort;
  [...el.segment.children].forEach((btn) => btn.classList.toggle("active", btn.dataset.v === ui.status));
}

function renderPager(shown, size, pages) {
  if (pages <= 1) { el.pager.hidden = true; return; }
  el.pager.hidden = false;
  el.pager.innerHTML = `<button class="btn ghost small" data-p="prev" ${ui.page <= 1 ? "disabled" : ""}>‹ Prev</button>` +
    `<span class="pageinfo">Page ${ui.page} of ${pages}</span>` +
    `<button class="btn ghost small" data-p="next" ${ui.page >= pages ? "disabled" : ""}>Next ›</button>`;
  el.pager.querySelector('[data-p="prev"]').onclick = () => { if (ui.page > 1) { ui.page--; render(); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  el.pager.querySelector('[data-p="next"]').onclick = () => { if (ui.page < pages) { ui.page++; render(); window.scrollTo({ top: 0, behavior: "smooth" }); } };
}

function cardEl(b) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.id = b.id;
  const tagsHTML = (b.tags && b.tags.length) ? `<div class="tags">${b.tags.map((t) => `<span class="tag" data-tag="${esc(t)}" title="Show everything tagged #${esc(t)}">#${esc(t)}</span>`).join("")}</div>` : "";
  const noteHTML = b.note ? `<div class="note-line"><span class="note-label">Note</span>${renderNote(b.note)}</div>` : "";
  const badge = `<span class="status-badge ${b.status}">${b.status === "toread" ? "To read" : "Finished"}</span>`;
  const img = b.imageUrl || thumbFallback(b);
  const fav = b.iconUrl ? `<img alt="" src="${esc(b.iconUrl)}" onerror="this.style.display='none'">` : "";
  card.innerHTML =
    `<label class="selwrap"><input type="checkbox" class="selbox" ${ui.selected.has(b.id) ? "checked" : ""}></label>` +
    `<a class="thumb" href="${esc(b.url)}" target="_blank" rel="noopener"><img alt="" src="${esc(img)}" onerror="this.src='${thumbFallback(b)}'"></a>` +
    `<div class="card-body">${badge}` +
      `<a class="card-title" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title)}</a>` +
      `<div class="card-site">${fav}<span>${esc(b.site || "")}</span></div>` +
      (b.description ? `<p class="card-desc">${esc(b.description)}</p>` : "") +
      tagsHTML + noteHTML +
      `<div class="card-url">${esc(b.url)}</div>` +
      `<div class="card-meta">${esc(b.savedLabel || "")}${b.archived ? ' · <span class="arch-tag">Archived</span>' : ""}</div>` +
      copyLine(b) + actions(b) +
    `</div>`;
  wireCard(card, b);
  return card;
}
function copyLine(b) {
  if (b.copy) {
    const viewUrl = b.copy.kind === "pdf" ? `/copy/${b.id}` : `/copy/${b.id}`;
    let s = `🗂 Saved copy${b.copy.kind === "pdf" ? " (PDF)" : ""} · captured ${esc(b.copy.at)} · <a href="${viewUrl}" target="_blank" rel="noopener">View copy</a>`;
    if (b.ia) s += ` · <a href="${esc(b.ia.url)}" target="_blank" rel="noopener">Internet Archive</a>`;
    return `<div class="copy-line">${s}</div>`;
  }
  return `<div class="copy-line muted">No preserved copy yet${b.ia ? ` · <a href="${esc(b.ia.url)}" target="_blank" rel="noopener">Internet Archive</a>` : ""}</div>`;
}
function actions(b) {
  if (b.archived) {
    return `<div class="card-actions"><button class="btn ghost small" data-a="restore">Restore</button>` +
      `<div class="menu"><button class="btn ghost small" data-a="more">More ▾</button><div class="menu-list" hidden>` +
      `<button data-a="copy">${b.copy ? "Refresh saved copy" : "Save a copy"}</button>` +
      `<button data-a="delete" class="danger">Delete…</button></div></div></div>`;
  }
  const tl = b.status === "toread" ? "Mark as finished" : "Move to To-read";
  return `<div class="card-actions"><button class="btn ghost small" data-a="edit">Edit</button>` +
    `<button class="btn ghost small" data-a="toggle">${tl}</button>` +
    `<div class="menu"><button class="btn ghost small" data-a="more">More ▾</button><div class="menu-list" hidden>` +
    `<button data-a="copy">${b.copy ? "Refresh saved copy" : "Save a copy"}</button>` +
    `<button data-a="ia">${b.ia ? "Re-save to Internet Archive" : "Save to Internet Archive"}</button>` +
    `<button data-a="archive">Archive</button>` +
    `<button data-a="delete" class="danger">Delete…</button></div></div></div>`;
}
function wireCard(card, b) {
  const on = (sel, fn) => { const e = card.querySelector(sel); if (e) e.addEventListener("click", fn); };
  const cb = card.querySelector(".selbox");
  if (cb) cb.addEventListener("change", () => { cb.checked ? ui.selected.add(b.id) : ui.selected.delete(b.id); renderBulkBar(); });
  card.querySelectorAll("[data-tag]").forEach((t) => t.addEventListener("click", () => addTagFilter(t.dataset.tag)));
  on('[data-a="edit"]', () => openEditExisting(b));
  on('[data-a="toggle"]', async () => { await updateBookmark(b.id, { status: b.status === "toread" ? "finished" : "toread" }); render(); });
  on('[data-a="archive"]', async () => { await updateBookmark(b.id, { archived: true }); render(); });
  on('[data-a="restore"]', async () => { await updateBookmark(b.id, { archived: false }); render(); });
  on('[data-a="copy"]', async (e) => { e.target.textContent = "Saving copy…"; const r = await api.post(`/api/bookmarks/${b.id}/copy`); if (r.data.copy) b.copy = r.data.copy; render(); flash(b.id); });
  on('[data-a="ia"]', async (e) => { e.target.textContent = "Saving…"; const r = await api.post(`/api/bookmarks/${b.id}/ia`); b.ia = r.data.ia; render(); flash(b.id); });
  on('[data-a="delete"]', () => confirmDelete(card, b));
  const more = card.querySelector('[data-a="more"]');
  if (more) { const list = card.querySelector(".menu-list"); more.addEventListener("click", (e) => { e.stopPropagation(); const open = !list.hidden; closeMenus(); list.hidden = open; }); }
}
function confirmDelete(card, b) {
  const bar = card.querySelector(".card-actions");
  bar.innerHTML = `<span class="confirm-text">Delete permanently? This can't be undone.</span>` +
    `<button class="btn danger small" data-c="yes">Delete</button><button class="btn ghost small" data-c="no">Cancel</button>`;
  bar.querySelector('[data-c="yes"]').onclick = async () => { await api.del(`/api/bookmarks/${b.id}`); state.bookmarks = state.bookmarks.filter((x) => x.id !== b.id); ui.selected.delete(b.id); render(); };
  bar.querySelector('[data-c="no"]').onclick = () => render();
}
function flash(id) {
  const c = el.list.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
  if (c) { c.classList.remove("flash"); void c.offsetWidth; c.classList.add("flash"); c.scrollIntoView({ behavior: "smooth", block: "center" }); }
}

// ---------- filters bar ----------
function addTagFilter(tag) { if (!ui.activeTags.find((f) => f.tag === tag)) { ui.activeTags.push({ tag, mode: "include" }); ui.page = 1; render(); } }
function renderFilters() {
  const hasSearch = !!ui.search.trim();
  if (!ui.activeTags.length) { el.filters.innerHTML = hasSearch ? saveViewBtn() : ""; wireFilters(); return; }
  el.filters.innerHTML = `<span class="flabel">Showing:</span>` +
    ui.activeTags.map((f) => `<span class="fchip ${f.mode}"><button class="ftoggle" data-tg="${esc(f.tag)}" title="Click to switch include/exclude">${f.mode === "exclude" ? "−" : ""}#${esc(f.tag)}</button><span class="x" data-rm="${esc(f.tag)}">×</span></span>`).join("") +
    `<button class="clear">Clear all</button>` + saveViewBtn();
  wireFilters();
}
function saveViewBtn() { return `<button class="saveview">★ Save this view</button>`; }
function wireFilters() {
  el.filters.querySelectorAll("[data-rm]").forEach((x) => x.onclick = () => { ui.activeTags = ui.activeTags.filter((f) => f.tag !== x.dataset.rm); ui.page = 1; render(); });
  el.filters.querySelectorAll("[data-tg]").forEach((x) => x.onclick = () => { const f = ui.activeTags.find((f) => f.tag === x.dataset.tg); if (f) { f.mode = f.mode === "include" ? "exclude" : "include"; ui.page = 1; render(); } });
  const cl = el.filters.querySelector(".clear"); if (cl) cl.onclick = () => { ui.activeTags = []; ui.search = ""; el.search.value = ""; ui.page = 1; render(); };
  const sv = el.filters.querySelector(".saveview"); if (sv) sv.onclick = openSaveView;
}

// ---------- save flow ----------
async function startSave() {
  const raw = el.url.value.trim();
  if (!raw) { showSaveError("Paste a web address to save."); return; }
  if (!isPlausibleLink(raw)) { showSaveError("That doesn't look like a link. Paste a web address like https://example.com."); return; }
  showSaveError("");
  el.saveBtn.disabled = true;
  el.stage.innerHTML = `<div class="panel"><div class="plabel">Fetching page details…</div><div class="skeleton w70"></div><div class="skeleton w90"></div><div class="skeleton w40"></div></div>`;
  const { data } = await api.post("/api/preview", { url: raw });
  el.saveBtn.disabled = false;
  if (data.duplicateId) { el.stage.innerHTML = ""; const ex = findBookmark(data.duplicateId); if (ex) openEditExisting(ex, "Already saved — update existing bookmark"); return; }
  const d = data.details || {};
  openEditPanel({ url: data.url || raw, title: d.title || raw, description: d.description || "", site: d.site || "", iconUrl: d.iconUrl || "", imageUrl: d.imageUrl || "", tags: [], note: "", autofilled: d.autofilled }, { isNew: true });
}
function showSaveError(msg) { el.saveError.textContent = msg; el.saveError.hidden = !msg; }

function openEditExisting(b, label) {
  openEditPanel({ ...b, tags: [...(b.tags || [])] }, { isNew: false, existingId: b.id, label });
  flash(b.id);
}

function openEditPanel(data, { isNew, existingId, label }) {
  el.saveBtn.disabled = isNew;
  const warn = (isNew && data.autofilled === false)
    ? `<div class="banner">🔎 We couldn't read this page's details automatically. Add a title, description, tags or a note yourself, then Save.</div>` : "";
  el.stage.innerHTML =
    `<div class="panel"><div class="plabel">${esc(label || (isNew ? "Check the details, adjust if needed, then Save" : "Edit details"))}</div>${warn}` +
    `<div class="field-label">Title</div><input class="f" data-f="title" value="${esc(data.title)}">` +
    `<div class="field-label">Address (link)</div><input class="f" data-f="url" value="${esc(data.url)}">` +
    `<div class="field-label">Description</div><textarea class="f" data-f="desc">${esc(data.description || "")}</textarea>` +
    `<div class="field-label">Your tags</div><div class="tagbox" data-f="tagbox"><input data-f="tagentry" placeholder="Type a tag, press Enter"></div>` +
    `<div class="field-label">Your existing tags — click to add</div><div class="suggest" data-f="suggest"></div>` +
    `<div class="field-label">Your note</div><textarea class="f" data-f="note" style="min-height:110px" placeholder="Why did you save this? Use # headings, **bold**, links, - and 1. lists.">${esc(data.note || "")}</textarea>` +
    `<p class="hint">Formatting: # Heading, **bold**, *italic*, https://links, "- " bullets, "1." numbers, blank line = paragraph.</p>` +
    `<div class="card-actions" style="margin-top:12px"><button class="btn primary" data-f="ok">Save</button><button class="btn ghost" data-f="cancel">Cancel</button></div></div>`;

  const working = [...(data.tags || [])];
  const box = el.stage.querySelector('[data-f="tagbox"]'), entry = el.stage.querySelector('[data-f="tagentry"]'), sug = el.stage.querySelector('[data-f="suggest"]');
  const drawChips = () => {
    box.querySelectorAll(".chipedit").forEach((n) => n.remove());
    working.forEach((t, i) => { const c = document.createElement("span"); c.className = "chipedit"; c.innerHTML = `#${esc(t)} <span class="x">×</span>`; c.querySelector(".x").onclick = () => { working.splice(i, 1); drawChips(); drawSug(); }; box.insertBefore(c, entry); });
  };
  const add = (v) => { v = v.trim().replace(/^#/, ""); if (v && !working.includes(v)) working.push(v); entry.value = ""; drawChips(); drawSug(); };
  const drawSug = () => { const avail = allTags().filter((t) => !working.includes(t)); sug.innerHTML = avail.length ? avail.map((t) => `<span class="chip">#${esc(t)}</span>`).join("") : `<span class="hint">No other tags yet.</span>`; sug.querySelectorAll(".chip").forEach((ch) => ch.onclick = () => add(ch.textContent.replace(/^#/, ""))); };
  entry.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(entry.value); } else if (e.key === "Backspace" && !entry.value && working.length) { working.pop(); drawChips(); drawSug(); } });
  box.addEventListener("click", () => entry.focus());
  drawChips(); drawSug();
  el.stage.querySelector('[data-f="title"]').focus();

  el.stage.querySelector('[data-f="ok"]').onclick = async () => {
    if (entry.value.trim()) add(entry.value);
    const payload = {
      url: el.stage.querySelector('[data-f="url"]').value.trim(),
      title: el.stage.querySelector('[data-f="title"]').value,
      description: el.stage.querySelector('[data-f="desc"]').value,
      note: el.stage.querySelector('[data-f="note"]').value.trim(),
      tags: working,
    };
    if (isNew) {
      const r = await api.post("/api/bookmarks", { ...payload, site: data.site, iconUrl: data.iconUrl, imageUrl: data.imageUrl, autofilled: data.autofilled });
      if (r.data.duplicateId) { const ex = findBookmark(r.data.duplicateId); el.stage.innerHTML = ""; el.saveBtn.disabled = false; if (ex) openEditExisting(ex, "Already saved — update existing bookmark"); return; }
      state.bookmarks.push(r.data.bookmark);
      el.stage.innerHTML = ""; el.url.value = ""; el.saveBtn.disabled = false; ui.page = 1; render(); flash(r.data.bookmark.id);
      if (state.prefs.autoCopy) pollCopy(r.data.bookmark.id);
    } else {
      const r = await api.patch(`/api/bookmarks/${existingId}`, payload);
      if (r.data.duplicateId) { const ex = findBookmark(r.data.duplicateId); el.stage.innerHTML = ""; if (ex) openEditExisting(ex, "That address is already saved — here's the existing bookmark"); return; }
      const idx = state.bookmarks.findIndex((x) => x.id === existingId);
      if (idx >= 0) state.bookmarks[idx] = r.data.bookmark;
      el.stage.innerHTML = ""; render(); flash(existingId);
    }
  };
  el.stage.querySelector('[data-f="cancel"]').onclick = () => { el.stage.innerHTML = ""; el.saveBtn.disabled = false; };
  el.stage.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// After an auto-copy save, the snapshot is captured in the background; poll a
// few times so the "Saved copy" line appears without blocking the save.
function pollCopy(id) {
  let tries = 0;
  const timer = setInterval(async () => {
    tries++;
    const r = await api.get(`/api/bookmarks/${id}`);
    const bm = r.data && r.data.bookmark;
    if (bm && bm.copy) {
      const i = state.bookmarks.findIndex((x) => x.id === id);
      if (i >= 0) { state.bookmarks[i].copy = bm.copy; render(); }
      clearInterval(timer);
    } else if (tries >= 10 || !bm) clearInterval(timer);
  }, 700);
}

async function updateBookmark(id, patch) {
  const r = await api.patch(`/api/bookmarks/${id}`, patch);
  if (r.data && r.data.bookmark) { const i = state.bookmarks.findIndex((x) => x.id === id); if (i >= 0) state.bookmarks[i] = r.data.bookmark; }
  return r;
}

// ---------- saved views ----------
function viewDesc(v) {
  return [v.search ? `search "${v.search}"` : "", v.include.length ? "with " + v.include.map((t) => "#" + t).join(", ") : "", v.exclude.length ? "without " + v.exclude.map((t) => "#" + t).join(", ") : ""].filter(Boolean).join("; ") || "everything";
}
function openSaveView() {
  const inc = includeTags(), exc = excludeTags(), q = ui.search.trim();
  const desc = viewDesc({ search: q, include: inc, exclude: exc });
  el.stage.innerHTML = `<div class="panel"><div class="plabel">Save this view</div><p class="hint">Saving: ${esc(desc)}</p>` +
    `<div class="field-label">Name</div><input class="f" id="viewname" placeholder="e.g. Rome trip reading">` +
    `<div class="card-actions" style="margin-top:12px"><button class="btn primary" id="vok">Save view</button><button class="btn ghost" id="vcancel">Cancel</button></div></div>`;
  const name = el.stage.querySelector("#viewname"); name.focus();
  el.stage.querySelector("#vok").onclick = async () => { const r = await api.post("/api/views", { name: name.value.trim() || desc, search: q, include: inc, exclude: exc }); state.views = r.data.views; el.stage.innerHTML = ""; };
  el.stage.querySelector("#vcancel").onclick = () => { el.stage.innerHTML = ""; };
  el.stage.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function renderViewsMenu() {
  if (!state.views.length) { el.viewsList.innerHTML = `<div class="menu-empty">No saved views yet. Filter, then "★ Save this view".</div>`; return; }
  el.viewsList.innerHTML = state.views.map((v) => `<div class="view-row"><button class="apply" data-v="${v.id}" title="${esc(viewDesc(v))}">${esc(v.name)}</button><button class="del" data-d="${v.id}" title="Delete view">×</button></div>`).join("");
  el.viewsList.querySelectorAll(".apply").forEach((b) => b.onclick = () => { applyView(state.views.find((v) => v.id === b.dataset.v)); el.viewsList.hidden = true; });
  el.viewsList.querySelectorAll(".del").forEach((b) => b.onclick = async (e) => { e.stopPropagation(); const r = await api.del(`/api/views/${b.dataset.d}`); state.views = r.data.views; renderViewsMenu(); });
}
function applyView(v) {
  if (!v) return;
  ui.search = v.search || ""; el.search.value = ui.search;
  ui.activeTags = [...(v.include || []).map((t) => ({ tag: t, mode: "include" })), ...(v.exclude || []).map((t) => ({ tag: t, mode: "exclude" }))];
  ui.page = 1;
  if (ui.scope === "archived") ui.scope = "active";
  render();
}

// ---------- bulk ----------
function matchingIds() { return computeMatching().map((b) => b.id); }
function renderBulkBar() {
  const n = ui.selected.size;
  const show = n > 0 && ui.selecting;
  el.bulkBar.hidden = !show;
  if (!show) return;
  const shownCount = computeMatching().length;
  el.bulkBar.innerHTML = `<span class="bulk-n">${n} selected</span>` +
    `<button class="btn ghost small" data-b="selall">Select all matching (${shownCount})</button>` +
    `<button class="btn ghost small" data-b="addtags">Add tags</button>` +
    `<button class="btn ghost small" data-b="rmtags">Remove tags</button>` +
    `<button class="btn ghost small" data-b="toread">Mark To read</button>` +
    `<button class="btn ghost small" data-b="finished">Mark Finished</button>` +
    `<button class="btn ghost small" data-b="archive">Archive</button>` +
    `<button class="btn ghost small" data-b="delete">Delete…</button>` +
    `<button class="btn ghost small" data-b="clear">Clear</button>`;
  const B = (k) => el.bulkBar.querySelector(`[data-b="${k}"]`);
  B("selall").onclick = () => { matchingIds().forEach((id) => ui.selected.add(id)); render(); };
  B("clear").onclick = () => { ui.selected.clear(); render(); };
  B("toread").onclick = () => bulk("toread");
  B("finished").onclick = () => bulk("finished");
  B("archive").onclick = () => bulk("archive");
  B("delete").onclick = bulkDelete;
  B("addtags").onclick = () => bulkTags("addTags");
  B("rmtags").onclick = () => bulkTags("removeTags");
}
async function bulk(op, tags) {
  const r = await api.post("/api/bulk", { ids: [...ui.selected], op, tags });
  state.bookmarks = r.data.bookmarks; ui.selected.clear(); render();
}
function bulkDelete() {
  const n = ui.selected.size;
  el.stage.innerHTML = `<div class="panel"><div class="plabel">Delete ${n} bookmark${n === 1 ? "" : "s"}?</div><p class="hint">This can't be undone.</p><div class="card-actions" style="margin-top:10px"><button class="btn danger" id="bdok">Delete ${n}</button><button class="btn ghost" id="bdno">Cancel</button></div></div>`;
  el.stage.querySelector("#bdok").onclick = async () => { await bulk("delete"); el.stage.innerHTML = ""; };
  el.stage.querySelector("#bdno").onclick = () => { el.stage.innerHTML = ""; };
  el.stage.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function bulkTags(op) {
  const ids = [...ui.selected];
  const sel = state.bookmarks.filter((b) => ui.selected.has(b.id));
  const title = (op === "addTags" ? "Add tags to " : "Remove tags from ") + ids.length + " bookmark" + (ids.length === 1 ? "" : "s");
  let inner;
  if (op === "addTags") inner = `<div class="tagbox" data-f="tagbox"><input data-f="tagentry" placeholder="Type a tag, press Enter"></div><div class="field-label">Your existing tags — click to add</div><div class="suggest" data-f="suggest"></div>`;
  else { const union = [...new Set(sel.flatMap((b) => b.tags || []))].sort(); inner = union.length ? `<div class="suggest" data-f="rm">${union.map((t) => `<span class="chip" data-t="${esc(t)}">#${esc(t)} ✕</span>`).join("")}</div><p class="hint">Click a tag to remove it from all selected.</p>` : `<p class="hint">The selected bookmarks have no tags.</p>`; }
  el.stage.innerHTML = `<div class="panel"><div class="plabel">${title}</div>${inner}<div class="card-actions" style="margin-top:12px"><button class="btn primary" id="btdone">Done</button></div></div>`;
  if (op === "addTags") {
    const working = []; const box = el.stage.querySelector('[data-f="tagbox"]'), entry = el.stage.querySelector('[data-f="tagentry"]'), sug = el.stage.querySelector('[data-f="suggest"]');
    const chips = () => { box.querySelectorAll(".chipedit").forEach((n) => n.remove()); working.forEach((t, i) => { const c = document.createElement("span"); c.className = "chipedit"; c.innerHTML = `#${esc(t)} <span class="x">×</span>`; c.querySelector(".x").onclick = () => { working.splice(i, 1); chips(); }; box.insertBefore(c, entry); }); };
    const add = (v) => { v = v.trim().replace(/^#/, ""); if (v && !working.includes(v)) working.push(v); entry.value = ""; chips(); };
    entry.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(entry.value); } });
    sug.innerHTML = allTags().map((t) => `<span class="chip">#${esc(t)}</span>`).join(""); sug.querySelectorAll(".chip").forEach((ch) => ch.onclick = () => add(ch.textContent.replace(/^#/, "")));
    el.stage.querySelector("#btdone").onclick = async () => { if (entry.value.trim()) add(entry.value); if (working.length) await bulk("addTags", working); el.stage.innerHTML = ""; };
  } else {
    el.stage.querySelectorAll('[data-f="rm"] .chip').forEach((ch) => ch.onclick = async () => { await bulk("removeTags", [ch.dataset.t]); ch.remove(); });
    el.stage.querySelector("#btdone").onclick = () => { el.stage.innerHTML = ""; };
  }
  el.stage.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ---------- settings, import/export ----------
function openSettings() {
  const p = state.prefs;
  el.stage.innerHTML = `<div class="panel"><div class="plabel">Settings</div>` +
    `<div class="field-label">My default order (remembered between visits)</div>` +
    `<select class="f" id="setSort"><option value="new">Newest saved</option><option value="old">Oldest saved</option><option value="az">Title A–Z</option><option value="za">Title Z–A</option></select>` +
    `<div class="field-label" style="margin-top:12px">Preserved copies</div>` +
    `<label class="setting-check"><input type="checkbox" id="setAuto"> Automatically save a self-contained copy of each new bookmark</label>` +
    `<p class="hint">Turn off to save copies only when you choose "Save a copy". Internet Archive stays a separate, manual action.</p>` +
    `<div class="field-label" style="margin-top:12px">Display</div>` +
    `<div class="setting-row">Items per page <select class="f" id="setPage" style="width:auto"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option><option value="all">All</option></select></div>` +
    `<div class="setting-row">Text size <select class="f" id="setText" style="width:auto"><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select></div>` +
    `<div class="field-label" style="margin-top:12px">Your data</div>` +
    `<div class="card-actions"><button class="btn ghost" id="setImport">Import browser bookmarks…</button><button class="btn ghost" id="setExport">Export collection…</button></div>` +
    `<div class="card-actions" style="margin-top:12px"><button class="btn primary" id="setOk">Save</button><button class="btn ghost" id="setCancel">Cancel</button></div></div>`;
  el.stage.querySelector("#setSort").value = p.sort;
  el.stage.querySelector("#setAuto").checked = !!p.autoCopy;
  el.stage.querySelector("#setPage").value = p.pageSize;
  el.stage.querySelector("#setText").value = p.textSize;
  el.stage.querySelector("#setImport").onclick = openImport;
  el.stage.querySelector("#setExport").onclick = openExport;
  el.stage.querySelector("#setCancel").onclick = () => { el.stage.innerHTML = ""; };
  el.stage.querySelector("#setOk").onclick = async () => {
    const patch = { sort: el.stage.querySelector("#setSort").value, autoCopy: el.stage.querySelector("#setAuto").checked, pageSize: el.stage.querySelector("#setPage").value, textSize: el.stage.querySelector("#setText").value };
    const r = await api.put("/api/prefs", patch); state.prefs = r.data.prefs; applyTextSize(); ui.page = 1; el.stage.innerHTML = ""; render();
  };
  el.stage.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function applyTextSize() { document.body.classList.remove("text-sm", "text-md", "text-lg"); document.body.classList.add("text-" + (state.prefs.textSize || "md")); }

function openImport() {
  el.stage.innerHTML = `<div class="panel"><div class="plabel">Import browser bookmarks</div>` +
    `<p class="hint">Choose the .html bookmarks file exported from your browser. Folders become tags; saved dates are kept; links you already have are skipped.</p>` +
    `<input type="file" id="impFile" accept=".html,text/html" class="f">` +
    `<div id="impPrev"></div>` +
    `<div class="card-actions" style="margin-top:12px"><button class="btn ghost" id="impClose">Close</button></div></div>`;
  el.stage.querySelector("#impClose").onclick = () => { el.stage.innerHTML = ""; };
  el.stage.querySelector("#impFile").onchange = (ev) => { const f = ev.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => showImportPreview(String(r.result)); r.readAsText(f); };
  el.stage.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
async function showImportPreview(html) {
  const { data } = await api.post("/api/import/preview", { html });
  const box = el.stage.querySelector("#impPrev");
  box.innerHTML = `<div class="banner">Found ${data.total} bookmark${data.total === 1 ? "" : "s"}. ${data.neu} new, ${data.dup} already saved (skipped).</div>` +
    `<p class="hint">Folders become tags and original saved dates are kept. To keep the import quick, preserved copies are <b>not</b> made now — use "Save a copy" afterwards.</p>` +
    `<p class="hint">${data.sample.map((s) => esc(s.title) + (s.tags.length ? " — #" + s.tags.join(" #") : "")).join("<br>")}${data.neu > data.sample.length ? "<br>…" : ""}</p>` +
    `<div class="card-actions"><button class="btn primary" id="impDo" ${data.neu ? "" : "disabled"}>Import ${data.neu}</button></div>`;
  const doBtn = box.querySelector("#impDo");
  if (doBtn) doBtn.onclick = async () => { const r = await api.post("/api/import", { html }); state.bookmarks = r.data.bookmarks; ui.page = 1; el.stage.innerHTML = ""; render(); };
}
function openExport() {
  window.open("/api/export", "_blank");
  el.stage.innerHTML = `<div class="panel"><div class="plabel">Export collection</div><p class="hint">Your download has started (my-bookmarks.html). It uses the standard browser-bookmark format and includes every bookmark (including archived), preserving titles, tags, saved dates, status and notes.</p><div class="card-actions"><button class="btn ghost" id="expClose">Close</button></div></div>`;
  el.stage.querySelector("#expClose").onclick = () => { el.stage.innerHTML = ""; };
}

// ---------- wiring ----------
el.saveBtn.addEventListener("click", startSave);
el.url.addEventListener("keydown", (e) => { if (e.key === "Enter") startSave(); });
el.url.addEventListener("input", () => showSaveError(""));
el.search.addEventListener("input", () => { ui.search = el.search.value; ui.page = 1; render(); });
el.segment.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { ui.status = b.dataset.v; ui.page = 1; render(); }));
el.sort.addEventListener("change", async () => { const r = await api.put("/api/prefs", { sort: el.sort.value }); state.prefs = r.data.prefs; ui.page = 1; render(); });
el.archiveBtn.addEventListener("click", () => { ui.scope = ui.scope === "archived" ? "active" : "archived"; ui.page = 1; ui.selected.clear(); render(); });
el.settingsBtn.addEventListener("click", openSettings);
el.selectBtn.addEventListener("click", () => { ui.selecting = !ui.selecting; document.body.classList.toggle("selecting", ui.selecting); el.selectBtn.textContent = ui.selecting ? "Done selecting" : "Select"; if (!ui.selecting) ui.selected.clear(); render(); });
el.viewsBtn.addEventListener("click", (e) => { e.stopPropagation(); const open = !el.viewsList.hidden; closeMenus(); el.viewsList.hidden = open; if (!el.viewsList.hidden) renderViewsMenu(); });

// ---------- init ----------
async function init() {
  const { data } = await api.get("/api/state");
  state = data;
  if (!state.prefs) state.prefs = { sort: "new", autoCopy: true, pageSize: "25", textSize: "md" };
  applyTextSize();
  render();
  document.body.setAttribute("data-harness-ready", "true");
}
init();
