/*
 * app.js — the Link Library single-page app. Talks to the JSON API; all logic
 * derived from the approved scenarios (SCN-001..015). Pure helpers come from
 * core.js (global LL).
 */
(function () {
  "use strict";
  const {
    escapeHtml: esc, escapeAttr: escA, normalizeUrl, formatDate,
    parseQuery, evalQuery, collectQueryTerms, markdownToHtml,
    parseBookmarksHtml, buildBookmarksHtml, normalizeAddDate,
  } = LL;

  // ---------------- API ----------------
  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null; try { data = await res.json(); } catch (e) {}
    return { status: res.status, ok: res.ok, data };
  }

  // ---------------- State ----------------
  let S = { links: [], preferences: { defaultSort: "newest", perPage: "all", textSize: "normal" }, savedViews: [] };
  const ui = {
    filter: "all", sortBy: "newest", search: "", queryAst: null, highlight: [],
    include: [], exclude: [], selected: new Set(),
    draft: null, edit: new Map(), showPrefs: false,
    pagesShown: 1, lastSig: null,
  };

  // ---------------- DOM refs ----------------
  const $ = id => document.getElementById(id);
  const listEl = $("list"), emptyEl = $("empty"), countEl = $("count"), statusEl = $("status"),
    urlEl = $("url"), saverEl = $("saver"), draftMount = $("draftMount"), filtersEl = $("filters"),
    discoveryEl = $("discovery"), bulkEl = $("bulkbar"), moreEl = $("more"), prefsMount = $("prefsMount");

  function setStatus(msg, kind) { statusEl.textContent = msg || ""; statusEl.className = "status" + (kind ? " " + kind : ""); }

  // ---------------- Small helpers ----------------
  const SORT_LABELS = { newest: "Newest first", updated: "Recently updated", oldest: "Oldest first", "title-az": "Title A–Z", "title-za": "Title Z–A" };
  const inToRead = it => !!it.toRead;
  function letterOf(it) { return (it.site || it.domain || "?").charAt(0).toUpperCase(); }
  function favEl(it) {
    if (it.favicon) return `<img class="favicon" src="${escA(it.favicon)}" alt="" onerror="LLapp.favFallback(this,'${escA(letterOf(it))}')" />`;
    return `<span class="favicon">${esc(letterOf(it))}</span>`;
  }
  function hi(text) {
    const t = esc(text);
    if (!ui.highlight.length) return t;
    const terms = [...ui.highlight].sort((a, b) => b.length - a.length).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean);
    if (!terms.length) return t;
    return t.replace(new RegExp("(" + terms.join("|") + ")", "ig"), "<mark>$1</mark>");
  }
  function allTags() { return [...new Set(S.links.flatMap(it => it.tags || []))].sort(); }
  function findLink(id) { return S.links.find(l => l.id === id); }

  // ---------------- Filtering / sorting ----------------
  function counts() {
    const active = S.links.filter(l => !l.archived);
    return { all: active.length, toread: active.filter(inToRead).length, reference: active.filter(l => !l.toRead).length, archived: S.links.filter(l => l.archived).length };
  }
  function visible() {
    let list;
    if (ui.filter === "archived") list = S.links.filter(l => l.archived);
    else { list = S.links.filter(l => !l.archived); if (ui.filter === "toread") list = list.filter(inToRead); else if (ui.filter === "reference") list = list.filter(l => !l.toRead); }
    if (ui.include.length) list = list.filter(l => ui.include.every(t => (l.tags || []).includes(t)));
    if (ui.exclude.length) list = list.filter(l => !ui.exclude.some(t => (l.tags || []).includes(t)));
    if (ui.search.trim()) list = list.filter(l => evalQuery(ui.queryAst, l));
    return sortList(list);
  }
  function sortList(list) {
    const arr = [...list];
    arr.sort((a, b) => {
      switch (ui.sortBy) {
        case "newest": return (b.addedTs - a.addedTs) || (b.createdSeq - a.createdSeq);
        case "oldest": return (a.addedTs - b.addedTs) || (a.createdSeq - b.createdSeq);
        case "updated": return b.updatedSeq - a.updatedSeq;
        case "title-az": return a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) || (b.createdSeq - a.createdSeq);
        case "title-za": return b.title.localeCompare(a.title, undefined, { sensitivity: "base" }) || (b.createdSeq - a.createdSeq);
      }
      return 0;
    });
    return arr;
  }
  const hasActiveFilter = () => !!(ui.search.trim() || ui.include.length || ui.exclude.length);
  const selItems = () => S.links.filter(l => ui.selected.has(l.id));

  // ---------------- Save flow (SCN-001/002/003) ----------------
  saverEl.addEventListener("submit", async e => {
    e.preventDefault();
    const n = normalizeUrl(urlEl.value);
    if (!n.ok) { saverEl.classList.add("invalid"); setStatus("That doesn't look like a usable web address. Try something like nytimes.com or https://example.com/article.", "error"); return; }
    saverEl.classList.remove("invalid");
    const existing = S.links.find(l => l.url === n.url);
    if (existing) { setStatus("This link is already in your library — opening it so you can edit it.", "info"); urlEl.value = ""; ui.draft = null; renderDraft(); startEdit(existing.id, true); return; }
    setStatus("Looking up the page details…"); urlEl.value = "";
    ui.draft = { url: n.url, domain: n.domain, loading: true, shelf: "reference", tags: [], note: "", title: "", description: "" };
    renderDraft();
    const meta = (await api("POST", "/api/metadata", { url: n.url })).data || { ok: false };
    if (!ui.draft || ui.draft.url !== n.url) return; // superseded/cancelled
    if (meta.ok) ui.draft = { url: n.url, domain: meta.domain || n.domain, loading: false, fetchFailed: false, title: meta.title || "", description: meta.description || "", site: meta.site || n.domain, image: meta.image || null, favicon: meta.favicon || null, shelf: "reference", tags: [], note: "" };
    else ui.draft = { url: n.url, domain: n.domain, loading: false, fetchFailed: true, title: "", description: "", site: n.domain, image: null, favicon: null, shelf: "reference", tags: [], note: "" };
    setStatus(""); renderDraft();
    const t = $("draftTitle"); if (t) t.focus();
  });
  urlEl.addEventListener("input", () => { if (saverEl.classList.contains("invalid")) { saverEl.classList.remove("invalid"); setStatus(""); } });

  function shelfPills(current, kind) {
    return `<div class="pilllabel">Add to</div><div class="pills">
      <button type="button" class="pill ${current === "toread" ? "active" : ""}" data-shelf="toread" data-kind="${kind}">📖 To read</button>
      <button type="button" class="pill ${current === "reference" ? "active" : ""}" data-shelf="reference" data-kind="${kind}">🔖 Reference</button></div>`;
  }
  function tagEditor(tags, kind) {
    const chips = (tags || []).map(t => `<span class="chip">#${esc(t)}<button type="button" data-rmtag="${kind}" data-tag="${escA(t)}">×</button></span>`).join("");
    return `<div class="field"><label>Tags</label><div class="tagbox">${chips}<input class="taginput" id="taginput-${kind}" placeholder="Add a tag…" autocomplete="off" /></div>
      <div class="tagsuggest" id="tagsuggest-${kind}"></div>
      <div class="taghint">Type a word and press Enter. Suggestions come from tags you've used.</div></div>`;
  }
  function noteField(id, val) {
    return `<div class="field"><label for="${id}">Your note (optional)</label><textarea id="${id}" rows="3" placeholder="Why you saved this…">${esc(val || "")}</textarea>
      <div class="taghint">Supports Markdown — **bold**, *italic*, \`code\`, - lists, [links](url).</div></div>`;
  }
  function previewBlock(image) { return image ? `<div class="preview" style="background-image:url('${escA(image)}')"><span class="tag">Preview image</span></div>` : ""; }

  function renderDraft() {
    draftMount.innerHTML = "";
    if (!ui.draft) return;
    const d = ui.draft, el = document.createElement("div"); el.className = "panel";
    if (d.loading) { el.innerHTML = `<div class="banner">Looking up the page…</div><div class="body"><div style="height:150px;border-radius:12px;background:#f0efec"></div></div>`; draftMount.appendChild(el); return; }
    el.innerHTML = `<div class="banner">Review &amp; adjust before saving</div><div class="body">
      ${d.fetchFailed ? `<div class="notice">We couldn't automatically fetch this page's details. You can still save it and fill in the title, description, and note yourself.</div>` : ""}
      ${previewBlock(d.image)}
      ${shelfPills(d.shelf, "draft")}
      <div class="field"><label for="draftTitle">Title</label><input id="draftTitle" type="text" value="${escA(d.title)}" /></div>
      <div class="field"><label for="draftDesc">Description</label><textarea id="draftDesc" rows="2">${esc(d.description)}</textarea></div>
      ${noteField("draftNote", d.note)}
      ${tagEditor(d.tags, "draft")}
      <div class="srcline">${favEl(d)}<span>${esc(d.site || d.domain)}</span><span class="dot">·</span><span>${esc(d.domain)}</span></div>
      <div class="actions"><button class="btn-primary" id="draftSave">Save to library</button><button class="btn-ghost" id="draftCancel">Cancel</button></div></div>`;
    draftMount.appendChild(el);
    wireShelfPills(); wireTagEditors();
    $("draftSave").onclick = confirmDraft;
    $("draftCancel").onclick = () => { ui.draft = null; renderDraft(); setStatus(""); };
  }
  function stashDraft() { const t = $("draftTitle"), de = $("draftDesc"), nn = $("draftNote"); if (t) ui.draft.title = t.value; if (de) ui.draft.description = de.value; if (nn) ui.draft.note = nn.value; }

  async function confirmDraft() {
    stashDraft();
    const d = ui.draft;
    const payload = { url: d.url, title: (d.title || "").trim() || d.domain, description: (d.description || "").trim(), note: (d.note || "").trim(), site: d.site, image: d.image, favicon: d.favicon, toRead: d.shelf === "toread", tags: d.tags };
    const r = await api("POST", "/api/links", payload);
    if (r.status === 409) { ui.draft = null; renderDraft(); startEdit(r.data.existingId, true); setStatus("This link is already in your library.", "info"); return; }
    if (!r.ok) { setStatus("Could not save. Please try again.", "error"); return; }
    S.links.unshift(r.data);
    ui.draft = null; renderDraft(); setStatus("Saved to your library.", "info"); render(r.data.id);
    setTimeout(() => { if (statusEl.textContent === "Saved to your library.") setStatus(""); }, 2600);
  }

  // ---------------- Tag editors (shared draft + edit) ----------------
  function editBuf(id) { return ui.edit.get(id); }
  function tagsOf(kind) { return kind === "draft" ? (ui.draft.tags = ui.draft.tags || []) : (editBuf(kind).tags = editBuf(kind).tags || []); }
  function reRenderFor(kind) { if (kind === "draft") { stashDraft(); ui.draft._focusTag = true; renderDraft(); focusTag("draft"); } else { stashEdit(kind); editBuf(kind)._focusTag = true; renderList(); focusTag(kind); } }
  function focusTag(kind) { const el = $("taginput-" + kind); if (el && (kind === "draft" ? ui.draft._focusTag : editBuf(kind) && editBuf(kind)._focusTag)) { el.focus(); if (kind === "draft") ui.draft._focusTag = false; else editBuf(kind)._focusTag = false; } }
  function addTag(kind, raw) { const v = (raw || "").trim().toLowerCase().replace(/^#/, ""); if (!v) return; const arr = tagsOf(kind); if (!arr.includes(v)) arr.push(v); }
  function wireShelfPills() {
    document.querySelectorAll("[data-shelf]").forEach(b => b.onclick = () => {
      const kind = b.dataset.kind, shelf = b.dataset.shelf;
      if (kind === "draft") ui.draft.shelf = shelf; else { stashEdit(kind); editBuf(kind).shelf = shelf; }
      b.parentElement.querySelectorAll(".pill").forEach(p => p.classList.toggle("active", p === b));
    });
  }
  function wireTagEditors() {
    document.querySelectorAll(".taginput").forEach(inp => {
      const kind = inp.id.replace("taginput-", "");
      inp.onkeydown = e => {
        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(kind, inp.value); inp.value = ""; reRenderFor(kind); }
        else if (e.key === "Backspace" && inp.value === "") { const arr = tagsOf(kind); if (arr.length) { arr.pop(); reRenderFor(kind); } }
      };
      inp.oninput = () => showTagSuggest(kind, inp.value);
    });
    document.querySelectorAll("[data-rmtag]").forEach(b => b.onclick = () => { const arr = tagsOf(b.dataset.rmtag); const i = arr.indexOf(b.dataset.tag); if (i >= 0) arr.splice(i, 1); reRenderFor(b.dataset.rmtag); });
  }
  function showTagSuggest(kind, val) {
    const box = $("tagsuggest-" + kind); if (!box) return;
    const cur = tagsOf(kind); const v = (val || "").trim().toLowerCase().replace(/^#/, "");
    const matches = v ? allTags().filter(t => t.includes(v) && !cur.includes(t)).slice(0, 6) : [];
    box.innerHTML = matches.length ? `<span class="s-lead">Reuse:</span>` + matches.map(t => `<button type="button" data-addtag="${kind}" data-tag="${escA(t)}">#${esc(t)}</button>`).join("") : "";
    box.querySelectorAll("[data-addtag]").forEach(b => b.onclick = () => { addTag(b.dataset.addtag, b.dataset.tag); reRenderFor(b.dataset.addtag); });
  }

  // ---------------- Reading / archive / delete ----------------
  async function patchLink(id, patch, flash) {
    const r = await api("PATCH", "/api/links/" + id, patch);
    if (r.ok) { const i = S.links.findIndex(l => l.id === id); if (i >= 0) S.links[i] = r.data; render(flash ? id : undefined); }
    return r;
  }
  const markRead = id => patchLink(id, { toRead: false });
  const markToRead = id => patchLink(id, { toRead: true });
  const archiveLink = id => patchLink(id, { archived: true });
  const restoreLink = id => patchLink(id, { archived: false });
  async function deleteLink(id) {
    const it = findLink(id);
    if (!confirm(`Permanently delete “${it ? it.title || it.domain : "this link"}”? This cannot be undone.`)) return;
    const r = await api("DELETE", "/api/links/" + id);
    if (r.ok) { S.links = S.links.filter(l => l.id !== id); ui.selected.delete(id); render(); }
  }

  // ---------------- Edit (SCN-004/005) ----------------
  function startEdit(id, flash) {
    const it = findLink(id); if (!it) return;
    if (ui.filter === "toread" && !inToRead(it)) ui.filter = "all";
    ui.edit.set(id, { addr: it.url, fetchedFor: it.url, suggest: null, addrErr: "", title: it.title, description: it.description, note: it.note, tags: [...(it.tags || [])], shelf: it.toRead ? "toread" : "reference" });
    render(flash ? id : undefined);
    const t = $("edit-title-" + id); if (t) t.focus({ preventScroll: true });
    const card = $("card-" + id); if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function cancelEdit(id) { ui.edit.delete(id); render(); }
  function stashEdit(id) {
    const b = editBuf(id); if (!b) return;
    const a = $("edit-addr-" + id), t = $("edit-title-" + id), d = $("edit-desc-" + id), nn = $("edit-note-" + id);
    if (a) b.addr = a.value; if (t) b.title = t.value; if (d) b.description = d.value; if (nn) b.note = nn.value;
  }
  async function fetchNewAddress(id) {
    const it = findLink(id), b = editBuf(id); stashEdit(id);
    const n = normalizeUrl(b.addr);
    if (!n.ok) { b.addrErr = "That doesn't look like a usable web address."; render(); return; }
    if (n.url !== it.url && S.links.some(o => o.id !== id && o.url === n.url)) { b.addrErr = "Another saved link already uses that address."; render(); return; }
    b.addrErr = "";
    if (n.url === it.url) { b.fetchedFor = it.url; b.suggest = null; render(); return; }
    setStatus("Looking up the new page…");
    const meta = (await api("POST", "/api/metadata", { url: n.url })).data || { ok: false };
    setStatus("");
    b.suggest = meta.ok ? { title: meta.title || "", description: meta.description || "", site: meta.site || n.domain, image: meta.image || null, favicon: meta.favicon || null, domain: n.domain, failed: false }
                        : { title: "", description: "", site: n.domain, image: null, favicon: null, domain: n.domain, failed: true };
    b.fetchedFor = n.url; render();
  }
  async function saveEdit(id) {
    const it = findLink(id), b = editBuf(id); stashEdit(id);
    const n = normalizeUrl(b.addr);
    if (!n.ok) { b.addrErr = "That doesn't look like a usable web address."; render(); return; }
    if (n.url !== it.url && S.links.some(o => o.id !== id && o.url === n.url)) { b.addrErr = "Another saved link already uses that address."; render(); return; }
    if (n.url !== it.url && b.fetchedFor !== n.url) { b.addrErr = "You changed the address — press “Fetch page details” to review the new page first."; render(); return; }
    const patch = { title: (b.title || "").trim() || n.domain, description: (b.description || "").trim(), note: (b.note || "").trim(), toRead: b.shelf === "toread", tags: b.tags };
    if (n.url !== it.url) { patch.url = n.url; if (b.suggest) { patch.site = b.suggest.site; patch.image = b.suggest.image; patch.favicon = b.suggest.favicon; } }
    const r = await api("PATCH", "/api/links/" + id, patch);
    if (r.status === 409) { b.addrErr = "Another saved link already uses that address."; render(); return; }
    if (!r.ok) { setStatus("Could not save changes.", "error"); return; }
    const i = S.links.findIndex(l => l.id === id); if (i >= 0) S.links[i] = r.data;
    ui.edit.delete(id); render(id);
  }

  // ---------------- Bulk (SCN-012) ----------------
  function toggleSelect(id) { if (ui.selected.has(id)) ui.selected.delete(id); else ui.selected.add(id); render(); }
  function pruneSelection() { const vis = new Set(visible().map(v => v.id)); [...ui.selected].forEach(id => { if (!vis.has(id)) ui.selected.delete(id); }); }
  async function bulkOp(op, value) {
    const ids = [...ui.selected];
    if (!ids.length) return;
    if (op === "delete") { if (!confirm(`Permanently delete ${ids.length} link${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return; }
    const r = await api("POST", "/api/links/bulk", { ids, op, value });
    if (r.ok) { S.links = r.data.links; pruneSelection(); render(); }
  }
  function renderBulk() {
    if (ui.selected.size === 0) { bulkEl.style.display = "none"; bulkEl.innerHTML = ""; return; }
    bulkEl.style.display = "flex";
    const visIds = visible().map(v => v.id);
    const allVis = visIds.length > 0 && visIds.every(id => ui.selected.has(id));
    const arch = ui.filter === "archived";
    const tagsInSel = [...new Set(selItems().flatMap(l => l.tags || []))].sort();
    bulkEl.innerHTML = `
      <span class="b-count">${ui.selected.size} selected</span>
      <button data-selall>${allVis ? "Clear selection" : `Select all ${visIds.length} matching`}</button>
      <span class="spacer"></span>
      <span class="bulktagwrap"><input id="bulkTag" placeholder="add tag…" autocomplete="off" /><div id="bulkTagSuggest" class="bulk-suggest"></div></span>
      <button data-op="addTag">Add tag</button>
      ${tagsInSel.length ? `<select id="bulkRmTag"><option value="">remove tag…</option>${tagsInSel.map(t => `<option value="${escA(t)}">#${esc(t)}</option>`).join("")}</select>` : ""}
      ${arch ? `<button data-op="restore">Restore</button><button class="b-danger" data-op="delete">Delete</button>`
             : `<button data-op="read">Mark read</button><button data-op="toread">To read</button><button data-op="archive">Archive</button>`}
      <button data-clear title="Clear selection">✕</button>`;
    bulkEl.querySelector("[data-selall]").onclick = () => { if (allVis) visIds.forEach(id => ui.selected.delete(id)); else visIds.forEach(id => ui.selected.add(id)); render(); };
    const tagInp = bulkEl.querySelector("#bulkTag");
    bulkEl.querySelector('[data-op="addTag"]').onclick = () => bulkOp("addTag", tagInp.value);
    tagInp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); bulkOp("addTag", tagInp.value); } };
    tagInp.oninput = () => {
      const box = bulkEl.querySelector("#bulkTagSuggest"); const v = tagInp.value.trim().toLowerCase().replace(/^#/, "");
      const matches = v ? allTags().filter(t => t.includes(v)).slice(0, 6) : [];
      box.innerHTML = matches.map(t => `<button type="button" data-bsug="${escA(t)}">#${esc(t)}</button>`).join("");
      box.style.display = matches.length ? "flex" : "none";
      box.querySelectorAll("[data-bsug]").forEach(sb => sb.onclick = () => bulkOp("addTag", sb.dataset.bsug));
    };
    const rm = bulkEl.querySelector("#bulkRmTag"); if (rm) rm.onchange = () => bulkOp("removeTag", rm.value);
    const map = { read: () => bulkOp("setToRead", false), toread: () => bulkOp("setToRead", true), archive: () => bulkOp("setArchived", true), restore: () => bulkOp("setArchived", false), delete: () => bulkOp("delete") };
    bulkEl.querySelectorAll("[data-op]").forEach(b => { if (map[b.dataset.op]) b.onclick = map[b.dataset.op]; });
    bulkEl.querySelector("[data-clear]").onclick = () => { ui.selected.clear(); render(); };
  }

  // ---------------- Discovery: search, sort, saved views, tag filters ----------------
  async function saveCurrentView() {
    if (!hasActiveFilter()) return;
    const name = (prompt("Name this view:", "") || "").trim(); if (!name) return;
    const r = await api("POST", "/api/saved-views", { name, search: ui.search, include: ui.include, exclude: ui.exclude });
    if (r.ok) { S.savedViews.push(r.data); render(); }
  }
  function applySavedView(v) {
    ui.search = v.search || ""; ui.include = [...(v.include || [])]; ui.exclude = [...(v.exclude || [])];
    ui.queryAst = parseQuery(ui.search); ui.highlight = collectQueryTerms(ui.queryAst, false, []); ui.filter = "all"; ui.selected.clear(); render();
  }
  async function deleteSavedView(id) { const r = await api("DELETE", "/api/saved-views/" + id); if (r.ok) { S.savedViews = S.savedViews.filter(v => v.id !== id); render(); } }

  function renderDiscovery() {
    if (S.links.length === 0) { discoveryEl.innerHTML = ""; return; }
    const tagChip = (t, mode) => `<span class="chip ${mode === "exclude" ? "excl" : ""}">${mode === "exclude" ? "−" : ""}#${esc(t)}<button type="button" data-flip="${escA(t)}" data-mode="${mode}" title="${mode === "exclude" ? "Include instead" : "Exclude instead"}">${mode === "exclude" ? "＋" : "⊘"}</button><button type="button" data-rmfilter="${escA(t)}" data-mode="${mode}" title="Remove">×</button></span>`;
    discoveryEl.innerHTML = `
      ${S.savedViews.length ? `<div class="savedviews"><span class="sv-lead">Saved views</span>${S.savedViews.map(v => `<span class="sv-chip"><button data-applyview="${v.id}">${esc(v.name)}</button><button class="sv-x" data-delview="${v.id}" title="Delete view">×</button></span>`).join("")}</div>` : ""}
      <div class="searchbar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a83" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input id="search" type="text" placeholder="Search words, &quot;a phrase&quot;, #tag, and / or / not…" value="${escA(ui.search)}" />
        <button class="clear" id="clearSearch" style="display:${ui.search ? "inline" : "none"}">Clear</button>
      </div>
      <div class="controlrow">
        <div class="searchhint">Words narrow together; use "quotes" for a phrase, #tag for a tag, and and / or / not with ( ) to combine.</div>
        <div class="sortrow"><label for="sortby">Sort</label><select id="sortby">${Object.keys(SORT_LABELS).map(v => `<option value="${v}" ${ui.sortBy === v ? "selected" : ""}>${SORT_LABELS[v]}</option>`).join("")}</select></div>
      </div>
      ${(ui.include.length || ui.exclude.length) ? `<div class="tagfilter">Filtering ${ui.include.map(t => tagChip(t, "include")).join(" ")} ${ui.exclude.map(t => tagChip(t, "exclude")).join(" ")}</div>` : ""}
      ${hasActiveFilter() ? `<div class="saverow"><button id="saveView">＋ Save this view</button></div>` : ""}`;
    $("sortby").onchange = e => { ui.sortBy = e.target.value; renderList(); };
    const s = $("search");
    s.oninput = () => { ui.search = s.value; ui.queryAst = parseQuery(ui.search); ui.highlight = collectQueryTerms(ui.queryAst, false, []); $("clearSearch").style.display = ui.search ? "inline" : "none"; renderList(); };
    s.onkeydown = e => { if (e.key === "Escape") { ui.search = ""; ui.queryAst = null; ui.highlight = []; renderDiscovery(); renderList(); } };
    $("clearSearch").onclick = () => { ui.search = ""; ui.queryAst = null; ui.highlight = []; renderDiscovery(); renderList(); };
    const sv = $("saveView"); if (sv) sv.onclick = saveCurrentView;
    discoveryEl.querySelectorAll("[data-applyview]").forEach(b => b.onclick = () => { const v = S.savedViews.find(x => x.id === b.dataset.applyview); if (v) applySavedView(v); });
    discoveryEl.querySelectorAll("[data-delview]").forEach(b => b.onclick = () => deleteSavedView(b.dataset.delview));
    discoveryEl.querySelectorAll("[data-flip]").forEach(b => b.onclick = () => {
      const t = b.dataset.flip;
      if (b.dataset.mode === "include") { ui.include = ui.include.filter(x => x !== t); if (!ui.exclude.includes(t)) ui.exclude.push(t); }
      else { ui.exclude = ui.exclude.filter(x => x !== t); if (!ui.include.includes(t)) ui.include.push(t); }
      render();
    });
    discoveryEl.querySelectorAll("[data-rmfilter]").forEach(b => b.onclick = () => {
      const t = b.dataset.rmfilter;
      if (b.dataset.mode === "exclude") ui.exclude = ui.exclude.filter(x => x !== t); else ui.include = ui.include.filter(x => x !== t);
      render();
    });
  }

  function renderFilters() {
    const c = counts();
    const defs = [["all", "All", c.all], ["toread", "To read", c.toread], ["reference", "Reference", c.reference], ["archived", "Archived", c.archived]];
    filtersEl.innerHTML = defs.map(([k, label, n]) => `<button class="filter ${ui.filter === k ? "active" : ""}" data-filter="${k}">${label} <span class="n">${n}</span></button>`).join("");
    filtersEl.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => { ui.filter = b.dataset.filter; renderFilters(); renderBulk(); renderList(); });
    filtersEl.hidden = S.links.length === 0;
  }

  // ---------------- Preferences (SCN-015) ----------------
  function applyTextSize() { document.body.classList.remove("txt-small", "txt-normal", "txt-large"); document.body.classList.add("txt-" + (S.preferences.textSize || "normal")); }
  async function savePrefs(patch) { const r = await api("PUT", "/api/preferences", patch); if (r.ok) S.preferences = r.data; }
  function renderPrefs() {
    if (!ui.showPrefs) { prefsMount.innerHTML = ""; return; }
    const p = S.preferences;
    prefsMount.innerHTML = `<div class="panel"><div class="banner">Display preferences <span class="aside">saved with your library · syncs across devices</span></div><div class="body">
      <div class="field"><label>Default order (used each time you open the library)</label>
        <select id="prefSort">${Object.keys(SORT_LABELS).map(v => `<option value="${v}" ${p.defaultSort === v ? "selected" : ""}>${SORT_LABELS[v]}</option>`).join("")}</select></div>
      <div class="field"><label>Links per page</label>
        <select id="prefPer">${["10", "25", "50", "all"].map(v => `<option value="${v}" ${String(p.perPage) === v ? "selected" : ""}>${v === "all" ? "Show all" : v + " at a time"}</option>`).join("")}</select></div>
      <div class="field"><label>Text size</label><div class="pills">${["small", "normal", "large"].map(s => `<button type="button" class="pill ${p.textSize === s ? "active" : ""}" data-textsize="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join("")}</div></div>
      <div class="actions"><button class="btn-primary" id="prefDone">Done</button></div></div></div>`;
    $("prefSort").onchange = e => { ui.sortBy = e.target.value; savePrefs({ defaultSort: e.target.value }); render(); };
    $("prefPer").onchange = e => { const v = e.target.value === "all" ? "all" : parseInt(e.target.value, 10); ui.pagesShown = 1; savePrefs({ perPage: v }); render(); };
    prefsMount.querySelectorAll("[data-textsize]").forEach(b => b.onclick = () => { S.preferences.textSize = b.dataset.textsize; applyTextSize(); savePrefs({ textSize: b.dataset.textsize }); renderPrefs(); });
    $("prefDone").onclick = () => { ui.showPrefs = false; renderPrefs(); };
  }

  // ---------------- Import / export (SCN-014) ----------------
  async function doImport(file) {
    const text = await file.text();
    let rows;
    try { rows = parseBookmarksHtml(text); } catch (e) { setStatus("That file couldn't be read as a bookmark file.", "error"); return; }
    const links = rows.map(r => { const ts = normalizeAddDate(r.addDate); return { url: r.href, title: r.title, tags: r.tags, addedTs: ts || undefined }; });
    const r = await api("POST", "/api/links/bulk-create", { links });
    if (!r.ok) { setStatus("Import failed.", "error"); return; }
    S = r.data.state; applyTextSize(); ui.sortBy = ui.sortBy || S.preferences.defaultSort; render();
    setStatus(`Imported ${r.data.added} link${r.data.added === 1 ? "" : "s"}${r.data.skipped ? `, skipped ${r.data.skipped} (duplicates or invalid)` : ""}.`, "info");
  }
  function doExport() {
    const html = buildBookmarksHtml(S.links.map(l => ({ url: l.url, title: l.title, tags: l.tags, addedTs: l.addedTs, description: l.description })));
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a"); a.href = url; a.download = "link-library-bookmarks.html"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    setStatus(`Exported ${S.links.length} link${S.links.length === 1 ? "" : "s"} as a bookmark file.`, "info");
  }

  // ---------------- List rendering with pagination ----------------
  function render(flashId) { renderPrefs(); renderDiscovery(); renderFilters(); renderBulk(); renderList(flashId); }

  function renderList(flashId) {
    const vis = visible();
    const sig = JSON.stringify([ui.filter, ui.search, ui.include, ui.exclude, ui.sortBy]);
    if (sig !== ui.lastSig) { ui.pagesShown = 1; ui.lastSig = sig; }
    const per = S.preferences.perPage === "all" ? Infinity : S.preferences.perPage;
    const shown = vis.slice(0, per * ui.pagesShown);
    countEl.hidden = S.links.length === 0;
    listEl.innerHTML = "";
    if (S.links.length === 0) emptyEl.innerHTML = `<div class="big">Your library is empty.</div><div>Paste a link above to save your first one.</div>`;
    else if (vis.length === 0) {
      if (hasActiveFilter()) emptyEl.innerHTML = `<div class="big">No links match your search.</div><div>Try fewer or different words.</div>`;
      else { const msg = ui.filter === "toread" ? ["Nothing left to read.", "Links you mark “To read” show up here."] : ui.filter === "reference" ? ["No reference links yet.", "Keep pages here for looking up later."] : ui.filter === "archived" ? ["Nothing archived.", "Links you tidy away rest here — kept, not deleted."] : ["Nothing here.", ""]; emptyEl.innerHTML = `<div class="big">${msg[0]}</div><div>${msg[1]}</div>`; }
    } else emptyEl.innerHTML = "";
    countEl.textContent = (shown.length < vis.length ? `${shown.length} of ${vis.length}` : vis.length) + (vis.length === 1 ? " link" : " links");

    shown.forEach(it => {
      const b = editBuf(it.id);
      const li = document.createElement("li"); li.id = "card-" + it.id;
      li.className = "item" + (it.id === flashId ? " flash" : "") + (ui.selected.has(it.id) ? " selected" : "");
      if (b) li.innerHTML = editCardHtml(it, b); else li.innerHTML = viewCardHtml(it);
      listEl.appendChild(li);
    });

    if (shown.length < vis.length) {
      const remaining = vis.length - shown.length;
      const next = Math.min(remaining, S.preferences.perPage === "all" ? remaining : S.preferences.perPage);
      moreEl.innerHTML = `<button class="showmore">Show ${next} more (${remaining} remaining)</button>`;
      moreEl.querySelector("button").onclick = () => { ui.pagesShown++; renderList(); };
    } else moreEl.innerHTML = "";

    wireList();
  }

  function viewCardHtml(it) {
    const badge = it.toRead ? `<span class="badge toread">To read</span>` : `<span class="badge reference">Reference</span>`;
    const act = it.archived
      ? `<button class="linkbtn" data-restore="${it.id}">Restore</button><button class="linkbtn plain" data-delete="${it.id}">Delete</button>`
      : `${it.toRead ? `<button class="linkbtn" data-read="${it.id}">Mark as read</button>` : `<button class="linkbtn plain" data-toread="${it.id}">Move to “To read”</button>`}<button class="linkbtn plain" data-archive="${it.id}">Archive</button><button class="linkbtn" data-edit="${it.id}">Edit</button>`;
    const tags = (it.tags || []).length ? `<div class="tags">${it.tags.map(t => `<button class="tagchip" data-tagfilter="${escA(t)}">#${esc(t)}</button>`).join("")}</div>` : "";
    return `${it.image ? `<div class="thumb" style="background-image:url('${escA(it.image)}')"></div>` : ""}
      <div class="content">
        <div class="titlerow"><input type="checkbox" class="selbox" data-select="${it.id}" ${ui.selected.has(it.id) ? "checked" : ""} aria-label="Select this link" />
          <div class="title"><a href="${escA(it.url)}" target="_blank" rel="noopener">${hi(it.title)}</a></div></div>
        ${it.description ? `<div class="desc">${hi(it.description)}</div>` : ""}
        ${it.note ? `<div class="note">${markdownToHtml(it.note)}</div>` : ""}
        ${tags}
        <div class="meta">${favEl(it)}<span>${hi(it.site || it.domain)}</span><span class="dot">·</span><span>Saved ${formatDate(it.addedTs)}</span>${badge}<span class="act">${act}</span></div>
      </div>`;
  }
  function editCardHtml(it, b) {
    const src = b.suggest && !b.suggest.failed ? b.suggest : it;
    return `<div class="content">
      <div class="field"><label>Web address</label><div class="rowbtn">
        <input id="edit-addr-${it.id}" class="${b.addrErr ? "err" : ""}" type="text" value="${escA(b.addr)}" />
        <button class="btn-small" data-fetch="${it.id}">Fetch page details</button></div>
        ${b.addrErr ? `<div class="fielderr">${esc(b.addrErr)}</div>` : ""}
        ${b.suggest && b.suggest.failed ? `<div class="fielderr">We couldn't fetch that page's details — you can still save with your own title and description.</div>` : ""}</div>
      ${previewBlock(src.image)}
      ${shelfPills(b.shelf, it.id)}
      <div class="field"><label>Title</label><input id="edit-title-${it.id}" type="text" value="${escA(b.title)}" />
        ${b.suggest && b.suggest.title ? `<div class="suggest">This page suggests: <b>${esc(b.suggest.title)}</b> <button data-usetitle="${it.id}">Use this</button></div>` : ""}</div>
      <div class="field"><label>Description</label><textarea id="edit-desc-${it.id}" rows="2">${esc(b.description)}</textarea>
        ${b.suggest && b.suggest.description ? `<div class="suggest">This page suggests: <b>${esc(b.suggest.description)}</b> <button data-usedesc="${it.id}">Use this</button></div>` : ""}</div>
      ${noteField("edit-note-" + it.id, b.note)}
      ${tagEditor(b.tags, it.id)}
      <div class="srcline">${favEl(src)}<span>${esc(src.site || src.domain)}</span><span class="dot">·</span><span>${esc(src.domain || it.domain)}</span><span class="dot">·</span><span>Saved ${formatDate(it.addedTs)}</span></div>
      <div class="actions"><button class="btn-primary" data-save="${it.id}">Save changes</button><button class="btn-ghost" data-cancel="${it.id}">Cancel</button></div></div>`;
  }

  function wireList() {
    wireShelfPills(); wireTagEditors();
    const q = sel => listEl.querySelectorAll(sel);
    q("[data-select]").forEach(b => b.onchange = () => toggleSelect(b.dataset.select));
    q("[data-edit]").forEach(b => b.onclick = () => startEdit(b.dataset.edit));
    q("[data-read]").forEach(b => b.onclick = () => markRead(b.dataset.read));
    q("[data-toread]").forEach(b => b.onclick = () => markToRead(b.dataset.toread));
    q("[data-archive]").forEach(b => b.onclick = () => archiveLink(b.dataset.archive));
    q("[data-restore]").forEach(b => b.onclick = () => restoreLink(b.dataset.restore));
    q("[data-delete]").forEach(b => b.onclick = () => deleteLink(b.dataset.delete));
    q("[data-tagfilter]").forEach(b => b.onclick = () => { const t = b.dataset.tagfilter; ui.exclude = ui.exclude.filter(x => x !== t); if (!ui.include.includes(t)) ui.include.push(t); render(); });
    q("[data-fetch]").forEach(b => b.onclick = () => fetchNewAddress(b.dataset.fetch));
    q("[data-save]").forEach(b => b.onclick = () => saveEdit(b.dataset.save));
    q("[data-cancel]").forEach(b => b.onclick = () => cancelEdit(b.dataset.cancel));
    q("[data-usetitle]").forEach(b => b.onclick = () => { const id = b.dataset.usetitle, bf = editBuf(id); stashEdit(id); bf.title = bf.suggest.title; $("edit-title-" + id).value = bf.title; b.parentElement.remove(); });
    q("[data-usedesc]").forEach(b => b.onclick = () => { const id = b.dataset.usedesc, bf = editBuf(id); stashEdit(id); bf.description = bf.suggest.description; $("edit-desc-" + id).value = bf.description; b.parentElement.remove(); });
    // live-track edit inputs so re-renders preserve them
    [...ui.edit.keys()].forEach(id => {
      const a = $("edit-addr-" + id), t = $("edit-title-" + id), d = $("edit-desc-" + id), nn = $("edit-note-" + id), bf = editBuf(id);
      if (a) a.addEventListener("input", () => { bf.addr = a.value; if (bf.addrErr) { bf.addrErr = ""; a.classList.remove("err"); const fe = a.closest(".field").querySelector(".fielderr"); if (fe) fe.remove(); } });
      if (t) t.addEventListener("input", () => bf.title = t.value);
      if (d) d.addEventListener("input", () => bf.description = d.value);
      if (nn) nn.addEventListener("input", () => bf.note = nn.value);
      focusTag(id);
    });
  }

  // ---------------- Header actions & boot ----------------
  $("prefsBtn").onclick = () => { ui.showPrefs = !ui.showPrefs; renderPrefs(); };
  $("exportBtn").onclick = doExport;
  $("importBtn").onclick = () => $("importFile").click();
  $("importFile").onchange = e => { const f = e.target.files[0]; if (f) doImport(f); e.target.value = ""; };

  // Expose the minimal bits referenced by inline handlers.
  window.LLapp = { favFallback(img, letter) { const span = document.createElement("span"); span.className = "favicon"; span.textContent = letter; img.replaceWith(span); } };

  async function boot() {
    const r = await api("GET", "/api/state");
    if (r.ok && r.data) S = { links: r.data.links || [], preferences: Object.assign(S.preferences, r.data.preferences || {}), savedViews: r.data.savedViews || [] };
    ui.sortBy = S.preferences.defaultSort || "newest";
    applyTextSize();
    render();
    document.body.setAttribute("data-harness-ready", "true");
  }
  boot();
})();
