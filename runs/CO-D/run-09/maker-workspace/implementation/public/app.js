/*
 * Calm Bookmarks — frontend.
 * Implements the approved behaviours SCN-001..SCN-022 against the REST API.
 * Search/filter/sort/paginate/collections/preferences run here for a live feel;
 * persistence, metadata, copies, and import/export are server-side.
 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- API ----------
  async function api(url, opts) {
    const res = await fetch(url, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* some endpoints return no json */ }
    return { ok: res.ok, status: res.status, data };
  }
  const getJSON = (u) => fetch(u).then((r) => r.json());
  const post = (u, body) => api(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const put = (u, body) => api(u, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const del = (u) => api(u, { method: "DELETE" });

  // ---------- state ----------
  let S = { bookmarks: [], collections: [], prefs: { sort: "newest", pageSize: "25", fontSize: "medium" } };
  let query = "";
  let filter = "all";
  let archivedView = false;
  let selected = new Set();
  let bulkMode = "actions";
  let shownCount = 25;
  let collSaveMode = false;
  let lastDeletedColl = null, undoTimer = null;
  let compiled = { match: () => true, highlights: [] };

  // editor context
  let editingId = null;
  let pending = { url: "", domain: "", preview: null, favicon: null };
  let readLater = true, keepCopy = true, iaOn = false;

  const sortMode = () => S.prefs.sort || "newest";
  const pageLimit = () => (S.prefs.pageSize === "all" ? Infinity : parseInt(S.prefs.pageSize, 10) || 25);
  const resetPaging = () => { shownCount = pageLimit(); };

  function normUrl(u) { return String(u || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, ""); }
  function looksLikeLink(u) { const s = (u || "").trim(); return !!s && !/\s/.test(s) && (/^https?:\/\//i.test(s) || /\.[a-z]{2,}/i.test(s)); }
  function domainOf(u) { try { return new URL(/^https?:\/\//i.test(u) ? u : "https://" + u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }
  function monogram(d) { return ((d || "?")[0] || "?").toUpperCase(); }
  const PAL = ["#4a6b57", "#7a5c8a", "#b5713f", "#3f6f8a", "#8a4a58", "#5a7a3f"];
  function colorFor(s) { let h = 0; for (const c of (s || "x")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PAL[h % PAL.length]; }
  function faviconUrl(b) { return b.favicon || (b.domain ? "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(b.domain) + "&sz=64" : null); }
  function knownTags() { const t = new Set(); S.bookmarks.forEach((b) => (b.tags || []).forEach((x) => t.add(x))); return [...t]; }
  function allTags() { return knownTags(); }

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600); }
  function status(msg) { $("toolsStatus").textContent = msg; }

  // ================= EDITOR (save / edit) =================
  const overlay = $("overlay");
  function setToggle(btn, on) { btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", on ? "true" : "false"); }
  $("rlSwitch").onclick = () => { readLater = !readLater; setToggle($("rlSwitch"), readLater); };
  $("copySwitch").onclick = () => { keepCopy = !keepCopy; setToggle($("copySwitch"), keepCopy); };
  $("iaSwitch").onclick = () => { iaOn = !iaOn; setToggle($("iaSwitch"), iaOn); $("iaNote").hidden = !iaOn; };

  function paintPreview(preview, favicon, domain, cap) {
    const col = colorFor(domain || "x");
    const t = $("mThumb");
    if (preview) { t.hidden = false; t.style.background = col; t.innerHTML = `<img src="${esc(preview)}" alt="" onerror="this.remove()">`; }
    else { t.hidden = true; t.innerHTML = ""; }
    const f = $("mFav"); f.style.background = col;
    f.innerHTML = favicon ? `<img src="${esc(favicon)}" alt="" onerror="this.replaceWith(document.createTextNode('${esc(monogram(domain))}'))">` : esc(monogram(domain));
    $("previewCap").textContent = cap || "";
  }

  const urlInput = $("urlInput");

  async function fetchMeta(url) {
    const r = await post("/api/fetch", { url });
    return r.ok ? r.data : { readable: false, domain: domainOf(url) };
  }

  async function startSaveFill(url) {
    const m = await fetchMeta(url);
    if (editingId !== null) return; // user switched to edit meanwhile
    pending.domain = m.domain || pending.domain;
    pending.preview = m.preview || null;
    pending.favicon = m.favicon || null;
    if (!m.readable) {
      $("fTitle").value = ""; $("fDesc").value = "";
      $("modalHint").textContent = "We couldn't read this page automatically — please add a title yourself. You can still save it.";
      $("titleAuto").hidden = true;
      paintPreview(null, m.favicon || null, m.domain, "couldn't read this page — you can still save it");
      $("fTitle").focus();
      return;
    }
    $("fTitle").value = m.title || pending.url;
    $("fDesc").value = m.desc || "";
    $("modalHint").textContent = "We filled in the details from the page. Adjust anything you like.";
    $("titleAuto").hidden = !m.title;
    paintPreview(m.preview || null, m.favicon || null, m.domain, m.isPdf ? "PDF — will be kept as-is" : (m.preview ? "preview image + site icon collected" : "site icon collected (no preview image on this page)"));
  }

  function openEdit(b) {
    editingId = b.id;
    pending = { url: b.url, domain: b.domain, preview: b.preview, favicon: b.favicon };
    $("modalTitle").textContent = "You already saved this";
    $("modalHint").textContent = "Here's the one you saved before — update anything you like.";
    $("urlField").hidden = false; $("urlErr").hidden = true; $("fUrl").value = b.url;
    $("fTitle").value = b.title; $("fDesc").value = b.desc || ""; $("fNote").value = b.note || ""; $("fTags").value = (b.tags || []).join(", ");
    readLater = !!b.readLater; keepCopy = b.keepCopy !== false; iaOn = !!b.iaUrl;
    setToggle($("rlSwitch"), readLater); setToggle($("copySwitch"), keepCopy); setToggle($("iaSwitch"), iaOn); $("iaNote").hidden = !iaOn;
    $("titleAuto").hidden = true;
    $("confirmBtn").textContent = "Update";
    paintPreview(b.preview, b.favicon, b.domain, "already in your list");
    renderSuggest(); updateNotePreview();
    overlay.hidden = false;
  }

  $("cancelBtn").onclick = () => { overlay.hidden = true; };
  $("confirmBtn").onclick = onConfirm;

  async function onConfirm() {
    const tags = $("fTags").value.split(",").map((s) => s.trim()).filter(Boolean);
    const common = {
      title: $("fTitle").value.trim(),
      desc: $("fDesc").value.trim(),
      note: $("fNote").value.trim(),
      tags,
      readLater,
      keepCopy,
      ia: iaOn,
      preview: pending.preview,
      favicon: pending.favicon,
    };
    if (editingId != null) {
      const finalUrl = $("fUrl").value.trim() || pending.url;
      const r = await put("/api/bookmarks/" + editingId, { ...common, url: finalUrl });
      if (r.status === 409) {
        const clash = r.data.existing;
        const err = $("urlErr");
        err.innerHTML = "Another saved link already uses this address: “" + esc(clash.title) + "”. " +
          "Change the address, or <a href='#' id='openClash'>open that one instead</a>.";
        err.hidden = false;
        $("openClash").onclick = (ev) => { ev.preventDefault(); openEdit(clash); };
        return;
      }
      overlay.hidden = true;
      await reload();
      toast("Updated your saved link.");
      highlight(editingId);
    } else {
      const r = await post("/api/bookmarks", { ...common, url: pending.url });
      if (r.status === 409) { overlay.hidden = true; openEdit(r.data.existing); return; }
      overlay.hidden = true;
      urlInput.value = "";
      await reload();
      if (r.data && r.data.bookmark && r.data.bookmark.copyFailed) toast("Saved. We couldn't capture a copy — you can retry from the card.");
    }
  }
  function highlight(id) { const el = $("item-" + id); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash-hit"); setTimeout(() => el.classList.remove("flash-hit"), 1600); } }

  // ---------- note toolbar + preview (SCN-019) ----------
  const fNote = $("fNote");
  function updateNotePreview() {
    const v = fNote.value;
    const on = !!v.trim();
    $("notePreview").hidden = !on; $("notePreviewLabel").hidden = !on;
    if (on) $("notePreview").innerHTML = window.BMFormat.render(v);
  }
  fNote.addEventListener("input", updateNotePreview);
  function wrap(before, after) {
    const s = fNote.selectionStart, e = fNote.selectionEnd, v = fNote.value, sel = v.slice(s, e) || "text";
    fNote.value = v.slice(0, s) + before + sel + after + v.slice(e);
    fNote.focus(); fNote.selectionStart = s + before.length; fNote.selectionEnd = s + before.length + sel.length;
    updateNotePreview();
  }
  function linePrefix(prefix) {
    const s = fNote.selectionStart, v = fNote.value, ls = v.lastIndexOf("\n", s - 1) + 1;
    fNote.value = v.slice(0, ls) + prefix + v.slice(ls);
    fNote.focus(); updateNotePreview();
  }
  $("noteToolbar").querySelectorAll("button").forEach((btn) => btn.onclick = () => {
    const k = btn.dataset.md;
    if (k === "bold") wrap("**", "**");
    else if (k === "italic") wrap("*", "*");
    else if (k === "link") wrap("[", "](https://)");
    else if (k === "heading") linePrefix("## ");
    else if (k === "list") linePrefix("- ");
    else if (k === "numbered") linePrefix("1. ");
  });

  // ---------- label suggestions in editor (SCN-002) ----------
  function renderSuggest() {
    const box = $("suggest");
    const current = $("fTags").value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const opts = knownTags().filter((t) => !current.includes(t.toLowerCase()));
    box.innerHTML = opts.length ? `<span class="s-label">Labels you've used:</span>` + opts.map((t) => `<span class="chip" data-t="${esc(t)}">${esc(t)}</span>`).join("") : "";
    box.querySelectorAll(".chip").forEach((c) => c.onclick = () => {
      const f = $("fTags"); const arr = f.value.split(",").map((s) => s.trim()).filter(Boolean); arr.push(c.dataset.t); f.value = arr.join(", "); renderSuggest();
    });
  }
  $("fTags").addEventListener("input", renderSuggest);

  // ================= SEARCH / COLLECTIONS =================
  const searchInput = $("searchInput"), searchClear = $("searchClear");
  function applySearch(q) { searchInput.value = q; query = q; searchClear.hidden = !q.trim(); compiled = window.BMQuery.compile(q); }
  searchInput.addEventListener("input", () => { query = searchInput.value; searchClear.hidden = !query.trim(); compiled = window.BMQuery.compile(query); resetPaging(); render(); });
  searchClear.addEventListener("click", () => { applySearch(""); resetPaging(); render(); searchInput.focus(); });

  const collectionsEl = $("collections");
  function renderCollections() {
    const cur = query.trim();
    const saved = S.collections.find((c) => c.query.trim() === cur);
    let html = S.collections.length ? `<span class="lbl">Saved searches:</span>` : "";
    html += S.collections.map((c) => `<span class="coll ${c.query.trim() === cur && cur ? "active" : ""}" data-coll="${c.id}">${esc(c.name)}<span class="del" data-delcoll="${c.id}" title="Remove">×</span></span>`).join("");
    if (collSaveMode) html += `<span class="lbl">Name:</span><input id="collName" placeholder="e.g. Reading list" /><button class="mini" data-savecoll="1">Save</button><button class="mini ghost" data-cancelcoll="1">Cancel</button>`;
    else if (cur && !saved) html += `<button class="save-coll" data-startsave="1">＋ Save this search</button>`;
    if (lastDeletedColl) html += `<span class="mini ghost" data-undocoll="1" style="cursor:pointer">Undo remove “${esc(lastDeletedColl.name)}”</span>`;
    collectionsEl.innerHTML = html;

    collectionsEl.querySelectorAll("[data-coll]").forEach((el) => el.onclick = (e) => {
      if (e.target.hasAttribute("data-delcoll")) return;
      const c = S.collections.find((x) => x.id === +el.dataset.coll);
      if (c) { applySearch(c.query); resetPaging(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    });
    collectionsEl.querySelectorAll("[data-delcoll]").forEach((el) => el.onclick = async (e) => {
      e.stopPropagation();
      const c = S.collections.find((x) => x.id === +el.dataset.delcoll);
      await del("/api/collections/" + el.dataset.delcoll);
      S.collections = S.collections.filter((x) => x.id !== +el.dataset.delcoll);
      lastDeletedColl = c; clearTimeout(undoTimer); undoTimer = setTimeout(() => { lastDeletedColl = null; render(); }, 6000);
      render();
    });
    const sb = collectionsEl.querySelector("[data-startsave]"); if (sb) sb.onclick = () => { collSaveMode = true; render(); const i = $("collName"); if (i) i.focus(); };
    const sv = collectionsEl.querySelector("[data-savecoll]"); if (sv) sv.onclick = async () => {
      const name = ($("collName").value || "").trim(); if (!name) return;
      const r = await post("/api/collections", { name, query: query.trim() });
      if (r.ok) S.collections.push(r.data.collection);
      collSaveMode = false; render();
    };
    const cc = collectionsEl.querySelector("[data-cancelcoll]"); if (cc) cc.onclick = () => { collSaveMode = false; render(); };
    const uc = collectionsEl.querySelector("[data-undocoll]"); if (uc) uc.onclick = async () => {
      if (!lastDeletedColl) return;
      const r = await post("/api/collections", { name: lastDeletedColl.name, query: lastDeletedColl.query });
      if (r.ok) S.collections.push(r.data.collection);
      lastDeletedColl = null; clearTimeout(undoTimer); render();
    };
  }

  // ================= LIST RENDER =================
  const listEl = $("list"), countEl = $("resultCount"), filterEl = $("filter"), sortEl = $("sortControls");
  const archivedToggleEl = $("archivedToggle"), archivedBanner = $("archivedBanner"), bulkbarEl = $("bulkbar");

  function renderSort() {
    sortEl.innerHTML = `<label class="sel-label">Sort by <select id="sortSelect">
      <option value="newest">Newest added</option><option value="oldest">Oldest added</option><option value="alpha">Title A–Z</option>
    </select></label>`;
    const sel = $("sortSelect"); sel.value = sortMode();
    sel.onchange = async () => { S.prefs.sort = sel.value; await put("/api/prefs", { sort: sel.value }); resetPaging(); render(); };
  }
  function renderFilter(searchSet) {
    const c = { all: searchSet.length, toread: searchSet.filter((b) => b.readLater).length, finished: searchSet.filter((b) => !b.readLater).length };
    const defs = [["all", "All", c.all], ["toread", "To read", c.toread], ["finished", "Finished", c.finished]];
    filterEl.innerHTML = defs.map(([k, label, n]) => `<button data-f="${k}" class="${filter === k ? "active" : ""}">${label}<span class="n">${n}</span></button>`).join("");
    filterEl.querySelectorAll("button").forEach((btn) => btn.onclick = () => { filter = btn.dataset.f; resetPaging(); render(); });
  }
  function sortCmp(a, b) {
    if (sortMode() === "alpha") return (a.title || "").toLowerCase().localeCompare((b.title || "").toLowerCase());
    if (sortMode() === "oldest") return a.id - b.id;
    return b.id - a.id;
  }

  function render() {
    // Clean, calm empty state: hide all management controls when nothing is saved (SCN-010).
    if (!S.bookmarks.length) {
      countEl.textContent = "";
      $("controlsRow").hidden = true;
      collectionsEl.hidden = true;
      bulkbarEl.hidden = true;
      archivedBanner.hidden = true;
      selected.clear();
      listEl.innerHTML = '<div class="empty"><div class="big">Nothing saved yet.</div><div>Paste a link above to keep your first one.</div></div>';
      return;
    }
    $("controlsRow").hidden = false;
    collectionsEl.hidden = false;
    archivedToggleEl.textContent = archivedView ? "← Back to list" : `Archived (${S.bookmarks.filter((b) => b.archived).length})`;
    archivedToggleEl.classList.toggle("active", archivedView);
    renderCollections();

    const base = S.bookmarks.filter((b) => (archivedView ? b.archived : !b.archived));
    const searchSet = base.filter((b) => compiled.match(b));
    if (archivedView) { filterEl.innerHTML = ""; filterEl.hidden = true; archivedBanner.hidden = false; archivedBanner.textContent = "Archived — hidden from your main list and search. Restore any to bring it back."; }
    else { filterEl.hidden = false; renderFilter(searchSet); archivedBanner.hidden = true; }
    renderSort();

    let filtered = archivedView ? searchSet : searchSet.filter((b) => (filter === "all" ? true : filter === "toread" ? b.readLater : !b.readLater));
    filtered = filtered.slice().sort(sortCmp);

    const total = filtered.length, shown = Math.min(shownCount, total);
    countEl.textContent = query.trim() ? (total === 1 ? "1 match" : total + " matches") : (total > shown ? `Showing ${shown} of ${total}` : "");
    renderBulk(filtered);

    if (!total) {
      let msg;
      if (archivedView) msg = `<div class="big">No archived bookmarks${query.trim() ? " match “" + esc(query) + "”" : ""}.</div>`;
      else if (query.trim()) msg = `<div class="big">No bookmarks match “${esc(query)}”.</div><div>Try a different word, topic, or label.</div>`;
      else if (filter === "toread") msg = `<div class="big">Nothing left to read — you're all caught up.</div>`;
      else if (filter === "finished") msg = `<div class="big">Nothing finished yet.</div>`;
      else msg = `<div class="big">Nothing here.</div>`;
      listEl.innerHTML = `<div class="no-results">${msg}</div>`;
      return;
    }

    const hl = (text) => { let o = esc(text); compiled.highlights.forEach((t) => { if (!t) return; const re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"); o = o.replace(re, '<span style="background:#fff2c2;border-radius:3px">$1</span>'); }); return o; };

    listEl.innerHTML = filtered.slice(0, shownCount).map((b) => {
      const col = colorFor(b.domain || b.url);
      const fav = faviconUrl(b);
      const thumb = b.preview ? `<div class="thumb" style="background:${col}"><img class="thumb" src="${esc(b.preview)}" alt="" onerror="this.remove()"></div>` : "";
      const dim = (!archivedView && !b.readLater && filter !== "finished") ? " done" : "";
      const sel = selected.has(b.id);
      const statusBtn = archivedView
        ? `<button class="statusbtn" data-restore="${b.id}">Restore</button>`
        : (b.readLater ? `<button class="statusbtn" data-read="${b.id}">Mark as read</button>` : `<button class="statusbtn" data-read="${b.id}">Move back to “To read”</button>`);
      const badge = b.readLater ? `<span class="badge">Read later</span>` : `<span class="badge read">Read ✓</span>`;
      const favHtml = fav ? `<span class="favicon" style="background:${col}"><img src="${esc(fav)}" alt="" onerror="this.replaceWith(document.createTextNode('${esc(monogram(b.domain))}'))"></span>` : `<span class="favicon" style="background:${col}">${esc(monogram(b.domain))}</span>`;
      const copy = [];
      if (b.keepCopy && b.capturedAt) copy.push(`<a class="copy-link" href="/api/snapshot/${b.id}" target="_blank" rel="noopener" title="Saved ${esc(b.capturedAt)}">🗎 ${b.copyKind === "pdf" ? "Saved PDF" : "Saved copy"}</a>`);
      else if (b.copyFailed) copy.push(`<button class="copy-link fail" data-savecopy="${b.id}">Copy didn't save — Try again</button>`);
      else copy.push(`<button class="copy-link ghost" data-savecopy="${b.id}">Save a copy</button>`);
      if (b.iaUrl) copy.push(`<a class="copy-link" href="${esc(b.iaUrl)}" target="_blank" rel="noopener">Internet Archive ↗</a>`);
      return `
      <div class="item${dim}${sel ? " selected" : ""}" id="item-${b.id}">
        <div class="selbox ${sel ? "on" : ""}" data-sel="${b.id}" title="Select">${sel ? "✓" : ""}</div>
        ${thumb}
        <div class="body">
          <div class="titleline"><a class="openlink" href="${esc(b.url)}" target="_blank" rel="noopener" title="Open in a new tab">${favHtml}<p class="title">${hl(b.title)}</p></a></div>
          ${b.desc ? `<p class="desc">${hl(b.desc)}</p>` : ""}
          <div class="chips">${badge}${(b.tags || []).map((t) => `<span class="chip" data-label="${esc(t)}" title="Show everything labelled “${esc(t)}”">${hl(t)}</span>`).join("")}</div>
          ${statusBtn}
          <p class="url">${hl(b.url)}</p>
          ${b.note ? `<div class="note-wrap"><div class="note collapsed" data-note="${b.id}">${window.BMFormat.render(b.note)}</div></div>` : ""}
          <div class="copy-row">${copy.join("")}</div>
        </div>
      </div>`;
    }).join("");

    // wire per-card actions
    listEl.querySelectorAll("[data-sel]").forEach((el) => el.onclick = () => { const id = +el.dataset.sel; selected.has(id) ? selected.delete(id) : selected.add(id); render(); });
    listEl.querySelectorAll("[data-read]").forEach((el) => el.onclick = async () => { const b = S.bookmarks.find((x) => x.id === +el.dataset.read); await put("/api/bookmarks/" + b.id, { readLater: !b.readLater, url: b.url }); await reload(); });
    listEl.querySelectorAll("[data-restore]").forEach((el) => el.onclick = async () => { await post("/api/bulk", { ids: [+el.dataset.restore], op: "restore" }); await reload(); });
    listEl.querySelectorAll("[data-savecopy]").forEach((el) => el.onclick = async () => { const id = +el.dataset.savecopy; toast("Capturing a copy…"); const r = await post("/api/bookmarks/" + id + "/capture", {}); await reload(); if (r.data && r.data.bookmark && r.data.bookmark.copyFailed) toast("Couldn't capture a copy — the page couldn't be read. Try again later."); else toast("Saved a viewable copy."); });
    listEl.querySelectorAll("[data-label]").forEach((chip) => chip.onclick = () => {
      const lab = chip.dataset.label; const token = /[\s()"#]/.test(lab) ? `#"${lab}"` : `#${lab}`;
      const cur = searchInput.value.trim();
      const nq = !cur ? token : (cur.includes(token) ? cur : `(${cur}) AND ${token}`);
      applySearch(nq); resetPaging(); render(); window.scrollTo({ top: 0, behavior: "smooth" });
    });
    listEl.querySelectorAll(".note[data-note]").forEach((note) => {
      if (note.scrollHeight > note.clientHeight + 2) {
        const btn = document.createElement("button"); btn.className = "note-toggle"; btn.textContent = "Show more";
        btn.onclick = () => { const c = note.classList.toggle("collapsed"); btn.textContent = c ? "Show more" : "Show less"; };
        note.parentElement.appendChild(btn);
      } else note.classList.remove("collapsed");
    });
    if (total > shownCount) {
      const more = document.createElement("button"); more.className = "show-more"; more.textContent = `Show more (${total - shownCount} more)`;
      more.onclick = () => { shownCount += pageLimit(); render(); };
      listEl.appendChild(more);
    }
  }

  // ================= BULK BAR (SCN-016) =================
  function selectedList() { return S.bookmarks.filter((b) => selected.has(b.id)); }
  async function bulk(op, value) { await post("/api/bulk", { ids: [...selected], op, value }); }
  function renderBulk(filtered) {
    const n = selected.size;
    if (!n) { bulkbarEl.hidden = true; bulkbarEl.innerHTML = ""; bulkMode = "actions"; return; }
    bulkbarEl.hidden = false;
    const allVis = filtered.length > 0 && filtered.every((b) => selected.has(b.id));
    const selAll = allVis ? `<button class="selall" data-selnone="1">Clear selection</button>` : `<button class="selall" data-selall="1">Select all ${filtered.length} in this view</button>`;
    let actions;
    if (bulkMode === "addlabel") {
      const sugs = allTags();
      const chips = sugs.length ? `<span class="sugwrap"><span class="sug-label">reuse:</span>` + sugs.map((t) => `<button class="sug" data-addsug="${esc(t)}">+ ${esc(t)}</button>`).join("") + `</span>` : "";
      actions = `<input id="bulkLabel" placeholder="Label to add…" /><button class="act" data-doadd="1">Add to ${n}</button>${chips}<button class="link" data-cancel="1">Back</button>`;
    } else if (bulkMode === "removelabel") {
      const present = [...new Set(selectedList().flatMap((b) => b.tags || []))];
      const chips = present.length ? `<span class="sugwrap"><span class="sug-label">on selected:</span>` + present.map((t) => `<button class="sug" data-remsug="${esc(t)}">− ${esc(t)}</button>`).join("") + `</span>` : `<span class="sug-label">(selected links have no labels)</span>`;
      actions = `<input id="bulkLabel" placeholder="Label to remove…" /><button class="act" data-dorem="1">Remove from ${n}</button>${chips}<button class="link" data-cancel="1">Back</button>`;
    } else if (bulkMode === "confirmdelete") {
      actions = `<span>Delete ${n} permanently? This can't be undone.</span><button class="act danger" data-dodelete="1">Delete ${n}</button><button class="link" data-cancel="1">Cancel</button>`;
    } else if (archivedView) {
      actions = `<button class="act" data-brestore="1">Restore</button><button class="act danger" data-confirmdelete="1">Delete</button>`;
    } else {
      actions = `<button class="act" data-mread="1">Mark read</button><button class="act" data-munread="1">Mark unread</button><button class="act" data-addlabel="1">Add label</button><button class="act" data-removelabel="1">Remove label</button><button class="act" data-archive="1">Archive</button><button class="act danger" data-confirmdelete="1">Delete</button>`;
    }
    bulkbarEl.innerHTML = `<span class="count">${n} selected</span>${selAll}<span class="spacer"></span>${actions}<button class="link" data-clear="1">Done</button>`;

    const on = (sel, fn) => { const el = bulkbarEl.querySelector(sel); if (el) el.onclick = fn; };
    on("[data-selall]", () => { filtered.forEach((b) => selected.add(b.id)); render(); });
    on("[data-selnone]", () => { selected.clear(); render(); });
    on("[data-clear]", () => { selected.clear(); render(); });
    on("[data-cancel]", () => { bulkMode = "actions"; render(); });
    const finish = async () => { selected.clear(); bulkMode = "actions"; await reload(); };
    on("[data-mread]", async () => { await bulk("read"); await finish(); });
    on("[data-munread]", async () => { await bulk("unread"); await finish(); });
    on("[data-archive]", async () => { await bulk("archive"); await finish(); });
    on("[data-brestore]", async () => { await bulk("restore"); await finish(); });
    on("[data-confirmdelete]", () => { bulkMode = "confirmdelete"; render(); });
    on("[data-dodelete]", async () => { await bulk("delete"); await finish(); });
    const applyLabel = async (op, v) => { if (v) { await bulk(op, v); await reloadKeepSelection(); } };
    on("[data-doadd]", () => applyLabel("addLabel", $("bulkLabel").value.trim()));
    on("[data-dorem]", () => applyLabel("removeLabel", $("bulkLabel").value.trim()));
    bulkbarEl.querySelectorAll("[data-addsug]").forEach((el) => el.onclick = () => applyLabel("addLabel", el.dataset.addsug));
    bulkbarEl.querySelectorAll("[data-remsug]").forEach((el) => el.onclick = () => applyLabel("removeLabel", el.dataset.remsug));
  }

  // ================= TOOLS: import / export / display =================
  $("exportBtn").onclick = () => { window.location.href = "/api/export"; status(`Exported ${S.bookmarks.length} bookmarks (titles, labels, dates).`); };
  $("importBtn").onclick = () => $("importFile").click();
  $("importFile").onchange = () => {
    const file = $("importFile").files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => { await doImport(reader.result); $("importFile").value = ""; };
    reader.readAsText(file);
  };
  async function doImport(html) {
    const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "text/html" }, body: html });
    const data = await res.json();
    await reload();
    status(`Imported ${data.added} bookmark${data.added !== 1 ? "s" : ""}${data.skipped ? `, skipped ${data.skipped} already saved` : ""}.`);
  }

  const displayPanel = $("displayPanel"), fontSeg = $("fontSeg"), pageSizeSel = $("pageSizeSel");
  function renderDisplayControls() { fontSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.fs === S.prefs.fontSize)); pageSizeSel.value = S.prefs.pageSize; }
  $("displayBtn").onclick = () => { displayPanel.hidden = !displayPanel.hidden; renderDisplayControls(); };
  fontSeg.querySelectorAll("button").forEach((btn) => btn.onclick = async () => { S.prefs.fontSize = btn.dataset.fs; applyFontSize(); renderDisplayControls(); await put("/api/prefs", { fontSize: S.prefs.fontSize }); });
  pageSizeSel.onchange = async () => { S.prefs.pageSize = pageSizeSel.value; resetPaging(); render(); await put("/api/prefs", { pageSize: S.prefs.pageSize }); };
  function applyFontSize() { document.body.classList.remove("fs-small", "fs-medium", "fs-large"); document.body.classList.add("fs-" + (S.prefs.fontSize || "medium")); }

  archivedToggleEl.onclick = () => { archivedView = !archivedView; selected.clear(); bulkMode = "actions"; resetPaging(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // ================= boot =================
  async function reload() { S = await getJSON("/api/state"); compiled = window.BMQuery.compile(query); render(); }
  async function reloadKeepSelection() { const keep = new Set(selected); S = await getJSON("/api/state"); selected = keep; render(); }

  (async function boot() {
    S = await getJSON("/api/state");
    resetPaging(); applyFontSize(); compiled = window.BMQuery.compile("");
    render();
    document.body.setAttribute("data-harness-ready", "true");
  })();

  $("saveBtn").onclick = () => openSaveFlow();
  urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") openSaveFlow(); });
  async function openSaveFlow() {
    const url = urlInput.value.trim();
    if (!url) return;
    const note = $("urlNote");
    if (!looksLikeLink(url)) { note.textContent = "That doesn't look like a link — try a web address, like example.com/article."; note.hidden = false; return; }
    note.hidden = true;
    const existing = S.bookmarks.find((b) => normUrl(b.url) === normUrl(url));
    if (existing) { openEdit(existing); return; }
    editingId = null;
    pending = { url, domain: domainOf(url), preview: null, favicon: null };
    $("urlField").hidden = true;
    $("modalTitle").textContent = "Save this link";
    $("modalHint").textContent = "Reading the page…";
    $("fTitle").value = "…"; $("fDesc").value = ""; $("fNote").value = ""; $("fTags").value = "";
    readLater = true; keepCopy = true; iaOn = false;
    setToggle($("rlSwitch"), true); setToggle($("copySwitch"), true); setToggle($("iaSwitch"), false); $("iaNote").hidden = true;
    $("titleAuto").hidden = true; $("confirmBtn").textContent = "Save to my list";
    paintPreview(null, null, pending.domain, "reading the page…");
    renderSuggest(); updateNotePreview();
    overlay.hidden = false;
    await startSaveFill(url);
  }
})();
