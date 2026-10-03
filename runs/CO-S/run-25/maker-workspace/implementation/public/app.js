"use strict";
(function () {
  const U = window.LL_urls;
  const Q = window.LL_query;

  const state = { items: [], view: "library", query: "", sortBy: "new", selected: new Set() };
  let lastShownIds = [];
  let openPop = null;

  // ---------- API ----------
  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { ok: res.ok, status: res.status, data };
  }
  async function loadItems() {
    const r = await api("GET", "/api/bookmarks");
    state.items = (r.data && r.data.items) || [];
  }

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function byId(id) { return state.items.find((x) => x.id === id); }
  function allTags() {
    const s = new Set();
    state.items.forEach((it) => (it.tags || []).forEach((t) => s.add(t)));
    return [...s].sort();
  }
  function fmtTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }

  // Minimal Markdown for note previews (bold, italic, code, links, headings, lists).
  function mdToHtml(src) {
    let s = esc(src);
    const lines = s.split(/\n/); const out = []; let inList = false;
    const inline = (t) => t
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    for (const ln of lines) {
      let m;
      if ((m = ln.match(/^\s*[-*]\s+(.*)$/))) { if (!inList) { out.push("<ul>"); inList = true; } out.push("<li>" + inline(m[1]) + "</li>"); continue; }
      if (inList) { out.push("</ul>"); inList = false; }
      if ((m = ln.match(/^\s*(#{1,3})\s+(.*)$/))) { const h = m[1].length; out.push("<h" + h + ">" + inline(m[2]) + "</h" + h + ">"); continue; }
      if (ln.trim() === "") continue;
      out.push("<p>" + inline(ln) + "</p>");
    }
    if (inList) out.push("</ul>");
    return out.join("");
  }
  function hl(text, terms) {
    if (!terms || !terms.length) return esc(text);
    const escd = esc(text);
    const parts = terms.map((t) => esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean);
    if (!parts.length) return escd;
    return escd.replace(new RegExp("(" + parts.join("|") + ")", "ig"), "<mark>$1</mark>");
  }

  // ---------- rendering ----------
  function inView(it) {
    if (state.view === "archive") return it.archived;
    if (state.view === "toread") return it.toRead && !it.archived;
    return !it.archived;
  }
  function viewLabel() {
    let base = state.view === "toread" ? "the Reading list" : state.view === "archive" ? "the Archive" : "your Library";
    if (state.query.trim()) base = 'results for "' + state.query.trim() + '" in ' + base;
    return base;
  }

  function render() {
    const q = state.query.trim();
    const ast = q ? Q.parse(q) : null;
    const terms = ast ? Q.collectTerms(ast, []) : [];
    let shown = state.items.filter((it) => inView(it) && (!ast || Q.matches(it, ast)));
    shown.sort((a, b) => {
      if (state.sortBy === "title") return String(a.title).localeCompare(String(b.title));
      if (state.sortBy === "old") return (a.order || 0) - (b.order || 0);
      return (b.order || 0) - (a.order || 0);
    });
    lastShownIds = shown.map((it) => it.id);

    // Reading-list badge
    const toReadCount = state.items.filter((it) => it.toRead && !it.archived).length;
    document.querySelector('.tab[data-view="toread"]').innerHTML =
      "Reading list" + (toReadCount ? ' <span class="badge">' + toReadCount + "</span>" : "");

    // Count line
    const count = document.getElementById("count");
    const n = shown.length;
    if (q) count.textContent = n + (n === 1 ? " result" : " results") + ' for "' + q + '"' +
      (state.view === "archive" ? " in Archive" : state.view === "toread" ? " in Reading list" : "");
    else {
      const lbl = state.view === "toread" ? (n === 1 ? "link to read" : "links to read")
        : state.view === "archive" ? (n === 1 ? "archived link" : "archived links")
          : (n === 1 ? "saved link" : "saved links");
      count.textContent = n + " " + lbl;
    }

    const lib = document.getElementById("library");
    lib.innerHTML = "";
    if (shown.length === 0) {
      lib.innerHTML = emptyState(q);
      document.getElementById("selectAll").innerHTML = "";
      updateBulk();
      return;
    }
    shown.forEach((it) => lib.appendChild(card(it, terms, q)));
    wire();
    updateSelectAll();
    updateBulk();
  }

  function emptyState(q) {
    if (q) return '<div class="noresult">No links match "<strong>' + esc(q) + '</strong>".<br>Try a different word, or check your spelling.</div>';
    if (state.view === "toread") return '<div class="noresult">Your reading list is empty.<br>Mark any link as “Read later” to line it up here.</div>';
    if (state.view === "archive") return '<div class="noresult">Nothing archived.<br>Archive a link to keep it without showing it in your everyday library.</div>';
    return '<div class="empty"><div class="big">🔖</div><div class="lead">Your library is empty</div>Paste any web address in the box above to save your first link.<br>It’ll be enriched with a title, and a copy will be preserved automatically.</div>';
  }

  function card(it, terms, q) {
    const li = document.createElement("li");
    li.className = "item" + (state.selected.has(it.id) ? " selected" : "");

    const copyBad = it.copy && it.copy.status !== "ok";
    const copyFlag = copyBad
      ? '<span class="flag copy bad" title="No copy available">⚠ Copy unavailable</span>'
      : '<span class="flag copy" title="A copy is preserved">📄 ' + (it.copy && it.copy.kind === "pdf" ? "Saved PDF" : "Saved copy") + "</span>";

    const chips = (it.tags || []).map((t) =>
      '<span class="chip">' + esc(t) + ' <span class="x" data-untag="' + it.id + '" data-tag="' + esc(t) + '">×</span></span>').join("");

    let noteBlock = "";
    if (it.note) {
      const long = it.note.length > 90 || /\n/.test(it.note.trim());
      const clamp = long && !it._expanded ? " clamped" : "";
      const toggle = long ? '<button class="act" data-act="togglenote" data-id="' + it.id + '">' + (it._expanded ? "show less" : "show full note") + "</button>" : "";
      noteBlock = '<div class="note-box"><div class="note-text' + clamp + '">' + mdToHtml(it.note) + "</div>" +
        '<div class="actions">' + toggle + '<button class="act" data-act="editnote" data-id="' + it.id + '">edit note</button></div></div>';
    } else {
      noteBlock = '<div class="actions"><button class="act" data-act="editnote" data-id="' + it.id + '">＋ add a note</button></div>';
    }

    const warn = (it.copy && it.copy.status === "unavailable")
      ? '<div class="warnstrip">⚠ We couldn’t reach this page, so its details and saved copy aren’t available yet — but the link is safely saved. <button data-act="retry" data-id="' + it.id + '">Retry</button></div>'
      : "";

    const actions = state.view === "archive"
      ? '<button class="act" data-act="copy" data-id="' + it.id + '">📄 View saved copy</button>' +
        '<button class="act" data-act="restore" data-id="' + it.id + '">↩ Restore to library</button>' +
        '<button class="act" data-act="edit" data-id="' + it.id + '">✎ Edit</button>' +
        '<button class="act" data-act="delete" data-id="' + it.id + '">🗑 Delete</button>'
      : '<button class="act ' + (it.toRead ? "on" : "") + '" data-act="toread" data-id="' + it.id + '">' +
          (it.toRead ? (state.view === "toread" ? "✓ Mark as read" : "In reading list") : "☆ Read later") + "</button>" +
        '<button class="act" data-act="copy" data-id="' + it.id + '">📄 View saved copy</button>' +
        '<button class="act" data-act="archive" data-id="' + it.id + '">🗄 Archive</button>' +
        '<button class="act" data-act="edit" data-id="' + it.id + '">✎ Edit</button>' +
        '<button class="act" data-act="delete" data-id="' + it.id + '">🗑 Delete</button>';

    li.innerHTML =
      '<input type="checkbox" class="pick-cb" data-pick="' + it.id + '"' + (state.selected.has(it.id) ? " checked" : "") + ">" +
      '<div class="favicon">' + esc((it.host || "?").charAt(0).toUpperCase()) + "</div>" +
      '<div class="body">' +
        '<a class="title" href="' + esc(it.url) + '" target="_blank" rel="noopener" title="' + esc(it.title) + '">' + hl(it.title || it.url, terms) + "</a>" +
        (it.toRead ? '<span class="flag toread">To read</span>' : "") + copyFlag +
        '<div class="desc">' + hl(it.desc || "", terms) + "</div>" + warn + noteBlock +
        '<div class="tags" data-id="' + it.id + '">' + chips + '<span class="addtag" data-addtag="' + it.id + '">＋ add tag</span></div>' +
        '<div class="meta"><a href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.host) + "</a><span>Saved " + esc(fmtTime(it.savedAt)) + "</span></div>" +
        '<div class="actions">' + actions + "</div>" +
      "</div>";
    return li;
  }

  // ---------- selection UI ----------
  function updateSelectAll() {
    const el = document.getElementById("selectAll");
    const total = lastShownIds.length;
    if (total === 0) { el.innerHTML = ""; return; }
    const allSel = lastShownIds.every((id) => state.selected.has(id));
    if (allSel) {
      el.innerHTML = "All " + total + ' shown selected. <a id="selNone">Clear selection</a>';
      el.querySelector("#selNone").onclick = () => { state.selected.clear(); render(); };
    } else {
      el.innerHTML = '<a id="selAll">Select all ' + total + " in " + viewLabel() + "</a>";
      el.querySelector("#selAll").onclick = () => { lastShownIds.forEach((id) => state.selected.add(id)); render(); };
    }
  }
  function updateBulk() {
    const bar = document.getElementById("bulkbar");
    const n = state.selected.size;
    if (n === 0) { bar.classList.remove("show"); return; }
    bar.classList.add("show");
    document.getElementById("bulkCount").textContent = n + " selected";
    document.getElementById("bulkScope").textContent = "· actions apply only to these " + n;
    document.getElementById("bulkArchive").textContent = state.view === "archive" ? "↩ Restore" : "🗄 Archive";
  }

  // ---------- per-card wiring ----------
  function wire() {
    document.querySelectorAll(".pick-cb").forEach((cb) => cb.addEventListener("change", () => {
      const id = +cb.dataset.pick;
      if (cb.checked) state.selected.add(id); else state.selected.delete(id);
      render();
    }));
    document.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => onCardAction(b.dataset.act, +b.dataset.id)));
    document.querySelectorAll("[data-untag]").forEach((x) => x.addEventListener("click", async () => {
      await api("POST", "/api/bookmarks/" + x.dataset.untag + "/untag", { tag: x.dataset.tag });
      await refresh();
    }));
    document.querySelectorAll("[data-addtag]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); showTagPop(b); }));
  }

  async function onCardAction(act, id) {
    const it = byId(id);
    if (act === "togglenote") { it._expanded = !it._expanded; render(); return; }
    if (act === "editnote") return editNote(id);
    if (act === "toread") { await api("PATCH", "/api/bookmarks/" + id, { toRead: !it.toRead }); return refresh(); }
    if (act === "archive") { await api("PATCH", "/api/bookmarks/" + id, { archived: true }); return refresh(); }
    if (act === "restore") { await api("PATCH", "/api/bookmarks/" + id, { archived: false }); return refresh(); }
    if (act === "retry") { await api("POST", "/api/bookmarks/" + id + "/retry"); return refresh(); }
    if (act === "edit") return openEdit(id);
    if (act === "delete") return askDelete(id);
    if (act === "copy") return openSnapshot(id);
  }

  // ---------- note editing ----------
  function editNote(id) {
    const it = byId(id);
    const card = [...document.querySelectorAll("li.item")].find((li) => li.querySelector('[data-pick="' + id + '"]'));
    if (!card) return;
    const box = card.querySelector(".note-box") || card.querySelector(".body > .actions");
    const ta = document.createElement("textarea");
    ta.className = "note-edit";
    ta.value = it.note || "";
    ta.placeholder = "Why did you save this? Markdown supported. (Enter to save, Shift+Enter for a new line, Esc to cancel)";
    box.replaceWith(ta);
    ta.focus();
    let done = false;
    const commit = async () => { if (done) return; done = true; await api("PATCH", "/api/bookmarks/" + id, { note: ta.value.trim() }); await refresh(); };
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { done = true; render(); }
    });
    ta.addEventListener("blur", commit);
  }

  // ---------- tag popover ----------
  function showTagPop(btn) {
    closePop();
    const id = +btn.dataset.addtag;
    const it = byId(id);
    const pop = document.createElement("div");
    pop.className = "pop";
    const picks = allTags().map((t) => '<span class="pick ' + (it.tags.includes(t) ? "on" : "") + '" data-tag="' + esc(t) + '">' + esc(t) + "</span>").join("");
    pop.innerHTML = '<p class="lbl">Your tags</p><div class="picklist">' + (picks || '<span class="lbl">No tags yet</span>') + "</div><input placeholder=\"Create a new tag, Enter\">";
    btn.parentElement.appendChild(pop);
    openPop = pop;
    pop.querySelectorAll(".pick").forEach((p) => p.addEventListener("click", async () => {
      const t = p.dataset.tag;
      if (it.tags.includes(t)) await api("POST", "/api/bookmarks/" + id + "/untag", { tag: t });
      else await api("POST", "/api/bookmarks/" + id + "/tags", { tag: t });
      await refresh(); reopenPop(id);
    }));
    const inp = pop.querySelector("input");
    inp.focus();
    inp.addEventListener("keydown", async (e) => {
      if (e.key === "Enter" && inp.value.trim()) { await api("POST", "/api/bookmarks/" + id + "/tags", { tag: inp.value.trim() }); await refresh(); reopenPop(id); }
      else if (e.key === "Escape") closePop();
    });
  }
  function reopenPop(id) { const b = document.querySelector('[data-addtag="' + id + '"]'); if (b) showTagPop(b); }
  function closePop() { if (openPop) { openPop.remove(); openPop = null; } }
  document.addEventListener("click", (e) => { if (openPop && !e.target.closest(".pop") && !e.target.hasAttribute("data-addtag")) closePop(); });

  // ---------- snapshot viewer ----------
  function openSnapshot(id) {
    const it = byId(id);
    const cap = document.getElementById("snapCap");
    const banner = document.getElementById("snapBanner");
    document.getElementById("snapUrl").textContent = it.url;
    if (!it.copy || it.copy.status !== "ok") {
      cap.textContent = "No preserved copy";
      banner.style.display = "none";
      document.getElementById("snapBody").innerHTML =
        '<div style="text-align:center;padding:24px;color:#a3352b">⚠ This page couldn’t be reached, so no copy was preserved.<br>Use <strong>Retry</strong> on the card to try again.</div>';
    } else {
      const pdf = it.copy.kind === "pdf";
      cap.textContent = (pdf ? "Preserved PDF" : "Preserved copy") + " · captured " + fmtTime(it.capturedAt);
      banner.style.display = "";
      document.getElementById("snapBody").innerHTML = '<iframe class="snapframe" src="/api/bookmarks/' + id + '/copy"></iframe>';
    }
    document.getElementById("snapOverlay").classList.add("open");
  }

  // ---------- edit ----------
  let editId = null;
  function openEdit(id) {
    editId = id; const it = byId(id);
    document.getElementById("edTitle").value = it.title || "";
    document.getElementById("edUrl").value = it.url || "";
    document.getElementById("edDesc").value = it.desc || "";
    document.getElementById("edError").textContent = "";
    document.getElementById("editOverlay").classList.add("open");
    document.getElementById("edTitle").focus();
  }
  function closeEdit() { document.getElementById("editOverlay").classList.remove("open"); editId = null; }
  async function saveEdit() {
    const err = document.getElementById("edError");
    const body = {
      title: document.getElementById("edTitle").value,
      url: document.getElementById("edUrl").value,
      desc: document.getElementById("edDesc").value,
    };
    const r = await api("PATCH", "/api/bookmarks/" + editId, body);
    if (!r.ok) {
      err.textContent = r.data && r.data.error === "duplicate" ? "Another saved link already uses that address."
        : r.data && r.data.error === "not_a_url" ? "That doesn’t look like a web address."
          : r.data && r.data.error === "empty" ? "An address is required."
            : "Could not save changes.";
      return;
    }
    closeEdit(); await refresh();
  }

  // ---------- delete ----------
  let deleteId = null; let bulkDelete = false;
  function askDelete(id) {
    deleteId = id; bulkDelete = false; const it = byId(id);
    document.getElementById("cfMsg").innerHTML = "“<strong>" + esc(it.title || it.url) + "</strong>” and its saved copy, tags, and notes will be permanently removed. This cannot be undone.";
    document.getElementById("confirmOverlay").classList.add("open");
  }
  function askBulkDelete(n) {
    bulkDelete = true;
    document.getElementById("cfMsg").innerHTML = "<strong>" + n + "</strong> selected link(s), with their saved copies, tags, and notes, will be permanently removed. This cannot be undone.";
    document.getElementById("confirmOverlay").classList.add("open");
  }
  function closeConfirm() { document.getElementById("confirmOverlay").classList.remove("open"); deleteId = null; bulkDelete = false; }

  // ---------- save ----------
  async function save() {
    const input = document.getElementById("url");
    const raw = input.value.trim();
    const dup = document.getElementById("dupNotice");
    const serr = document.getElementById("saveError");
    dup.classList.remove("show"); serr.classList.remove("show");
    const r = await api("POST", "/api/bookmarks", { url: raw });
    if (r.ok) { input.value = ""; input.focus(); await refresh(); return; }
    if (r.status === 409 && r.data && r.data.existing) {
      const ex = r.data.existing; input.value = "";
      const where = ex.archived ? "your archive" : "your library";
      dup.innerHTML = "You’ve already saved this — “<strong>" + esc(ex.title || ex.url) + "</strong>” is in " + where + '. <a id="dupGo">Show it</a>';
      dup.classList.add("show");
      document.getElementById("dupGo").onclick = () => {
        if (ex.archived && state.view !== "archive") switchView("archive");
        else if (!ex.archived && state.view === "toread" && !ex.toRead) switchView("library");
        setTimeout(() => flash(ex.id), 60);
      };
      return;
    }
    serr.textContent = r.data && r.data.error === "not_a_url"
      ? "“" + raw + "” doesn’t look like a web address. A link needs a site like example.com."
      : "Please paste a web address to save.";
    serr.classList.add("show");
  }

  function flash(id) {
    const li = [...document.querySelectorAll("li.item")].find((el) => el.querySelector('[data-pick="' + id + '"]'));
    if (li) { li.classList.add("flash"); li.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  function switchView(v) {
    state.view = v;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === v));
    render();
  }

  async function refresh() { await loadItems(); render(); }

  // ---------- static wiring ----------
  function bind() {
    document.getElementById("saveBtn").addEventListener("click", save);
    document.getElementById("url").addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
    document.getElementById("search").addEventListener("input", (e) => { state.query = e.target.value; render(); });
    document.getElementById("sort").addEventListener("change", (e) => { state.sortBy = e.target.value; render(); });
    document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => switchView(t.dataset.view)));

    document.getElementById("snapClose").addEventListener("click", () => document.getElementById("snapOverlay").classList.remove("open"));
    document.getElementById("snapOverlay").addEventListener("click", (e) => { if (e.target.id === "snapOverlay") e.currentTarget.classList.remove("open"); });
    document.getElementById("editClose").addEventListener("click", closeEdit);
    document.getElementById("editCancel").addEventListener("click", closeEdit);
    document.getElementById("editSave").addEventListener("click", saveEdit);
    document.getElementById("editOverlay").addEventListener("click", (e) => { if (e.target.id === "editOverlay") closeEdit(); });
    document.getElementById("cfCancel").addEventListener("click", closeConfirm);
    document.getElementById("confirmOverlay").addEventListener("click", (e) => { if (e.target.id === "confirmOverlay") closeConfirm(); });
    document.getElementById("cfOk").addEventListener("click", async () => {
      if (bulkDelete) { await api("POST", "/api/bookmarks/bulk", { ids: [...state.selected], action: "delete" }); state.selected.clear(); }
      else if (deleteId != null) { await api("DELETE", "/api/bookmarks/" + deleteId); }
      closeConfirm(); await refresh();
    });

    document.querySelectorAll("[data-bulk]").forEach((b) => b.addEventListener("click", async () => {
      const action = b.dataset.bulk;
      if (action === "clear") { state.selected.clear(); render(); return; }
      const ids = [...state.selected];
      if (ids.length === 0) return;
      if (action === "delete") return askBulkDelete(ids.length);
      if (action === "addTag") {
        const t = prompt("Add a tag to the " + ids.length + " selected link(s):");
        if (t && t.trim()) { await api("POST", "/api/bookmarks/bulk", { ids, action: "addTag", tag: t.trim() }); }
        state.selected.clear(); return refresh();
      }
      if (action === "removeTag") {
        const present = [...new Set(ids.map(byId).flatMap((it) => it.tags || []))].sort();
        const hint = present.length ? "\n\nTags on the selection: " + present.join(", ") : "\n\n(None of the selected links have tags.)";
        const t = prompt("Remove a tag from the " + ids.length + " selected link(s):" + hint);
        if (t && t.trim()) { await api("POST", "/api/bookmarks/bulk", { ids, action: "removeTag", tag: t.trim() }); }
        state.selected.clear(); return refresh();
      }
      const map = { toread: "toread", read: "read", archive: state.view === "archive" ? "restore" : "archive" };
      await api("POST", "/api/bookmarks/bulk", { ids, action: map[action] });
      state.selected.clear(); return refresh();
    }));
  }

  async function init() {
    bind();
    await loadItems();
    render();
    document.body.setAttribute("data-harness-ready", "true");
  }
  init();
})();
