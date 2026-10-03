// Browser UI for the personal bookmarks app.
// Behaviour basis: SCN-001..SCN-009. Pure logic lives in shared.mjs.

import {
  isValidHttpUrl,
  matchesQuery,
  filterBookmarks,
  tabCounts,
  allTags,
} from "./shared.mjs";

// ---- state -------------------------------------------------------------
let bookmarks = [];
let tab = "all"; // all | to-read | finished | archived
let activeTag = null;
let query = "";
let flashId = null;
const modes = new Map(); // id -> "edit" | "confirm"
const drafts = new Map(); // id -> { title, url, description, tags:[], note }

// ---- elements ----------------------------------------------------------
const listEl = document.getElementById("list");
const tabsEl = document.getElementById("tabs");
const tagBrowseEl = document.getElementById("tagBrowse");
const tagFiltersEl = document.getElementById("tagFilters");
const searchEl = document.getElementById("search");
const saveUrl = document.getElementById("saveUrl");
const saveBtn = document.getElementById("saveBtn");
const saveFetching = document.getElementById("saveFetching");
const saveError = document.getElementById("saveError");
const saveInfo = document.getElementById("saveInfo");

// ---- helpers -----------------------------------------------------------
function esc(s) {
  return (s == null ? "" : String(s)).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}
function hl(text) {
  const safe = esc(text);
  const q = query.trim();
  if (!q) return safe;
  const rx = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
  return safe.replace(rx, "<mark>$1</mark>");
}
function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  let body = null;
  if (res.status !== 204) {
    try { body = await res.json(); } catch { body = null; }
  }
  return { status: res.status, ok: res.ok, body };
}

// ---- save flow (SCN-001, SCN-007) --------------------------------------
function clearSaveMsgs() {
  saveError.hidden = true; saveInfo.hidden = true; saveUrl.classList.remove("bad");
}
async function save() {
  clearSaveMsgs();
  const url = saveUrl.value.trim();
  if (!url) return;
  if (!isValidHttpUrl(url)) {
    saveUrl.classList.add("bad");
    saveError.textContent = "That doesn't look like a web address. A link should start with http:// or https://";
    saveError.hidden = false;
    return;
  }
  saveBtn.disabled = true;
  saveFetching.hidden = false;
  const { status, ok, body } = await api("/api/bookmarks", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  saveFetching.hidden = true;
  saveBtn.disabled = false;

  if (status === 409 && body && body.bookmark) {
    // duplicate: point to the one already saved
    saveInfo.textContent = "You've already saved this link — here it is.";
    saveInfo.hidden = false;
    saveUrl.value = "";
    if (body.bookmark.archived) tab = "archived";
    else if (tab !== "all") tab = "all";
    activeTag = null; query = ""; searchEl.value = "";
    await refresh();
    flash(body.bookmark.id);
    return;
  }
  if (!ok || !body) {
    saveError.textContent = (body && body.message) || "Sorry, that couldn't be saved.";
    saveError.hidden = false;
    return;
  }
  saveUrl.value = "";
  await refresh();
  flash(body.id);
}

function flash(id) {
  flashId = id;
  render();
  const el = listEl.querySelector(`.card[data-id="${id}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => { flashId = null; render(); }, 1600);
}

// ---- data --------------------------------------------------------------
async function refresh() {
  const { body } = await api("/api/bookmarks");
  bookmarks = Array.isArray(body) ? body : [];
  render();
}

// ---- rendering ---------------------------------------------------------
function renderTabs() {
  const counts = tabCounts(bookmarks, { tag: activeTag, query });
  const defs = [
    ["all", "All"],
    ["to-read", "To read"],
    ["finished", "Finished"],
    ["archived", "🗄 Archived"],
  ];
  tabsEl.innerHTML = defs
    .map(
      ([k, label]) =>
        `<button class="tab ${k === tab ? "active" : ""} ${k === "archived" ? "tab--archived" : ""}" data-tab="${k}">${label} (${counts[k]})</button>`
    )
    .join("");
}

function renderTagBrowse() {
  const tags = allTags(bookmarks);
  if (!tags.length) { tagBrowseEl.hidden = true; return; }
  tagBrowseEl.hidden = false;
  tagFiltersEl.innerHTML = tags
    .map(
      (t) =>
        `<button class="tag-filter ${t === activeTag ? "active" : ""}" data-tagfilter="${esc(t)}">${esc(t)}</button>`
    )
    .join("");
}

function statusPill(bm) {
  return bm.status === "finished"
    ? `<span class="status-pill status-pill--finished">✓ Finished</span>`
    : `<span class="status-pill status-pill--toread">● To read</span>`;
}

function viewCard(bm) {
  const actions = bm.archived
    ? `<button class="btn" data-action="restore" data-id="${bm.id}">↩ Restore</button>
       <button class="btn btn--danger" data-action="delete" data-id="${bm.id}">🗑 Delete…</button>`
    : `<button class="btn" data-action="edit" data-id="${bm.id}">✎ Edit</button>
       <button class="btn" data-action="toggle" data-id="${bm.id}">${bm.status === "finished" ? "Mark as to read" : "Mark as finished"}</button>
       <button class="btn" data-action="archive" data-id="${bm.id}">🗄 Archive</button>
       <button class="btn btn--danger" data-action="delete" data-id="${bm.id}">🗑 Delete…</button>`;
  return `
    <div class="card ${bm.archived ? "archived" : ""} ${bm.id === flashId ? "flash" : ""}" data-id="${bm.id}">
      <div class="card__top">
        <div>
          <p class="title"><a href="${esc(bm.url)}" target="_blank" rel="noreferrer">${hl(bm.title)}</a></p>
          <p class="site">${hl(bm.site)}</p>
        </div>
        ${statusPill(bm)}
      </div>
      ${bm.unreadable ? `<span class="flag">⚠ Couldn't read this page's details — saved with what we could work out. Use Edit to set the title, tags, and note.</span>` : ""}
      ${bm.description ? `<p class="desc">${hl(bm.description)}</p>` : ""}
      ${(bm.tags && bm.tags.length) ? `<div class="chips">${bm.tags.map((t) => `<button class="chip" data-tagfilter="${esc(t)}">${hl(t)}</button>`).join("")}</div>` : ""}
      ${bm.note ? `<p class="note">📝 ${hl(bm.note)}</p>` : ""}
      <p class="meta">Saved ${fmtDate(bm.savedAt)}</p>
      <div class="card__actions">${actions}</div>
    </div>`;
}

function editCard(bm) {
  const d = drafts.get(bm.id);
  return `
    <div class="card edit" data-id="${bm.id}">
      <label>Title</label>
      <input type="text" class="f-title" value="${esc(d.title)}" />
      <label>Web address</label>
      <input type="text" class="f-url" value="${esc(d.url)}" />
      <div class="err f-url-err" hidden>That doesn't look like a web address. It should start with http:// or https://</div>
      <label>Description</label>
      <textarea class="f-desc">${esc(d.description)}</textarea>
      <label>Tags</label>
      <div class="taginput"><input type="text" class="f-tag" placeholder="Type to find or create a tag…" /></div>
      <div class="suggests"></div>
      <label>Note</label>
      <textarea class="f-note">${esc(d.note)}</textarea>
      <div class="editrow">
        <button class="btn btn--primary" data-action="save-edit" data-id="${bm.id}">Save changes</button>
        <button class="btn" data-action="cancel-edit" data-id="${bm.id}">Cancel</button>
      </div>
    </div>`;
}

function confirmCard(bm) {
  return `
    <div class="card" data-id="${bm.id}">
      <p class="title">${esc(bm.title)}</p>
      <p class="site">${esc(bm.site)}</p>
      <div class="confirm">
        <p class="q">Delete this bookmark permanently?</p>
        <p class="sub">This is different from archiving — it removes the bookmark for good and can't be undone. To just set it aside, use Archive instead.</p>
        <div class="editrow">
          <button class="btn btn--danger-solid" data-action="delete-yes" data-id="${bm.id}">Delete permanently</button>
          <button class="btn" data-action="delete-no" data-id="${bm.id}">Cancel</button>
        </div>
      </div>
    </div>`;
}

function render() {
  renderTabs();
  renderTagBrowse();

  // Overall empty state — brand-new user, nothing saved at all (SCN-006).
  if (bookmarks.length === 0) {
    listEl.innerHTML = `
      <div class="empty">
        <div class="big">🔖</div>
        <div class="t">No bookmarks yet</div>
        Paste a link above to save your first one. Saved links show up here, ready to tag, search, and revisit.
      </div>`;
    return;
  }

  const rows = filterBookmarks(bookmarks, { tab, tag: activeTag, query });

  if (rows.length === 0) {
    const what = query || activeTag;
    const msg =
      tab === "archived"
        ? "Nothing archived matches."
        : what
        ? "No bookmarks match your search or tag."
        : "Nothing here.";
    listEl.innerHTML = `<div class="empty">${esc(msg)}${
      what ? `<div><button class="btn" data-action="clear-filters">Clear filters</button></div>` : ""
    }</div>`;
    return;
  }

  const banner =
    tab === "archived"
      ? `<div class="archive-banner">Archived bookmarks are kept out of your everyday lists but never deleted. Restore any of them anytime.</div>`
      : "";

  listEl.innerHTML =
    banner +
    rows
      .map((bm) => {
        const mode = modes.get(bm.id);
        if (mode === "edit") return editCard(bm);
        if (mode === "confirm") return confirmCard(bm);
        return viewCard(bm);
      })
      .join("");

  wireEditCards();
}

// ---- edit-card wiring (tags with suggestions) --------------------------
function wireEditCards() {
  listEl.querySelectorAll(".card.edit").forEach((cardEl) => {
    const id = cardEl.dataset.id;
    const d = drafts.get(id);
    const box = cardEl.querySelector(".taginput");
    const field = cardEl.querySelector(".f-tag");
    const suggestsEl = cardEl.querySelector(".suggests");

    const existing = allTags(bookmarks);

    function renderChips() {
      box.querySelectorAll(".chip").forEach((c) => c.remove());
      d.tags.forEach((t, i) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerHTML = `${esc(t)} <button type="button" title="remove">×</button>`;
        chip.querySelector("button").onclick = () => {
          d.tags.splice(i, 1);
          renderChips();
          renderSuggests();
        };
        box.insertBefore(chip, field);
      });
    }
    function addTag(t) {
      const v = (t || "").trim();
      if (v && !d.tags.includes(v)) d.tags.push(v);
      field.value = "";
      renderChips();
      renderSuggests();
    }
    function renderSuggests() {
      const q = field.value.trim().toLowerCase();
      const pool = existing.filter((t) => !d.tags.includes(t) && (!q || t.toLowerCase().includes(q)));
      let html = pool.map((t) => `<span class="sug" data-sug="${esc(t)}">${esc(t)}</span>`).join("");
      if (q && !existing.some((t) => t.toLowerCase() === q) && !d.tags.includes(field.value.trim())) {
        html += `<span class="sug" data-sug="${esc(field.value.trim())}">+ create "${esc(field.value.trim())}"</span>`;
      }
      suggestsEl.innerHTML = html;
      suggestsEl.querySelectorAll(".sug").forEach((s) => (s.onclick = () => addTag(s.dataset.sug)));
    }

    box.addEventListener("click", () => field.focus());
    field.addEventListener("input", () => { renderSuggests(); });
    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addTag(field.value); }
      else if (e.key === "Backspace" && !field.value && d.tags.length) { d.tags.pop(); renderChips(); renderSuggests(); }
    });
    // keep drafts in sync so a re-render preserves in-progress edits
    cardEl.querySelector(".f-title").addEventListener("input", (e) => (d.title = e.target.value));
    cardEl.querySelector(".f-url").addEventListener("input", (e) => (d.url = e.target.value));
    cardEl.querySelector(".f-desc").addEventListener("input", (e) => (d.description = e.target.value));
    cardEl.querySelector(".f-note").addEventListener("input", (e) => (d.note = e.target.value));

    renderChips();
    renderSuggests();
  });
}

// ---- actions -----------------------------------------------------------
async function toggleStatus(id) {
  const bm = bookmarks.find((b) => b.id === id);
  if (!bm) return;
  const next = bm.status === "finished" ? "to-read" : "finished";
  await api(`/api/bookmarks/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
  await refresh();
}
async function setArchived(id, archived) {
  await api(`/api/bookmarks/${id}`, { method: "PATCH", body: JSON.stringify({ archived }) });
  await refresh();
}
async function saveEdit(id, cardEl) {
  const d = drafts.get(id);
  const urlEl = cardEl.querySelector(".f-url");
  const errEl = cardEl.querySelector(".f-url-err");
  const url = urlEl.value.trim();
  if (!isValidHttpUrl(url)) {
    urlEl.classList.add("bad");
    errEl.hidden = false;
    return;
  }
  const payload = {
    title: cardEl.querySelector(".f-title").value,
    url,
    description: cardEl.querySelector(".f-desc").value,
    note: cardEl.querySelector(".f-note").value,
    tags: d.tags,
  };
  const { ok, body } = await api(`/api/bookmarks/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  if (!ok) {
    errEl.textContent = (body && body.message) || "Couldn't save changes.";
    errEl.hidden = false;
    urlEl.classList.add("bad");
    return;
  }
  modes.delete(id);
  drafts.delete(id);
  await refresh();
}
async function deletePermanently(id) {
  await api(`/api/bookmarks/${id}`, { method: "DELETE" });
  modes.delete(id);
  drafts.delete(id);
  await refresh();
}

function beginEdit(id) {
  const bm = bookmarks.find((b) => b.id === id);
  if (!bm) return;
  drafts.set(id, {
    title: bm.title || "",
    url: bm.url || "",
    description: bm.description || "",
    note: bm.note || "",
    tags: [...(bm.tags || [])],
  });
  modes.set(id, "edit");
  render();
}

// ---- event delegation --------------------------------------------------
listEl.addEventListener("click", (e) => {
  const tagBtn = e.target.closest("[data-tagfilter]");
  if (tagBtn) { activeTag = tagBtn.dataset.tagfilter; render(); return; }

  const el = e.target.closest("[data-action]");
  if (!el) return;
  const id = el.dataset.id;
  const action = el.dataset.action;
  const cardEl = el.closest(".card");

  switch (action) {
    case "clear-filters": query = ""; activeTag = null; searchEl.value = ""; render(); break;
    case "edit": beginEdit(id); break;
    case "cancel-edit": modes.delete(id); drafts.delete(id); render(); break;
    case "save-edit": saveEdit(id, cardEl); break;
    case "toggle": toggleStatus(id); break;
    case "archive": setArchived(id, true); break;
    case "restore": setArchived(id, false); break;
    case "delete": modes.set(id, "confirm"); render(); break;
    case "delete-no": modes.delete(id); render(); break;
    case "delete-yes": deletePermanently(id); break;
  }
});

tabsEl.addEventListener("click", (e) => {
  const t = e.target.closest("[data-tab]");
  if (!t) return;
  tab = t.dataset.tab;
  render();
});
tagFiltersEl.addEventListener("click", (e) => {
  const t = e.target.closest("[data-tagfilter]");
  if (!t) return;
  activeTag = activeTag === t.dataset.tagfilter ? null : t.dataset.tagfilter;
  render();
});
searchEl.addEventListener("input", () => { query = searchEl.value; render(); });
saveBtn.addEventListener("click", save);
saveUrl.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
saveUrl.addEventListener("input", clearSaveMsgs);

// ---- boot --------------------------------------------------------------
(async function boot() {
  await refresh();
  document.body.setAttribute("data-harness-ready", "true");
})();
