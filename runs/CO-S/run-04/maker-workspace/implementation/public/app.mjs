// Bookmarks app — UI and interaction wiring.
// Behaviour is derived from the approved scenarios SCN-001..SCN-012.
// Pure logic lives in the imported modules; this file handles state + DOM.

import { loadBookmarks, saveBookmarks } from "./store.mjs";
import {
  normalizeUrl,
  isValidLink,
  findDuplicate,
  hostFromUrl,
  makeId,
} from "./model.mjs";
import { buildMatcher, toRecord } from "./search.mjs";
import { renderMarkdown, escapeHtml } from "./markdown.mjs";

// ---- State ----------------------------------------------------------------
let bookmarks = loadBookmarks();
let view = "all"; // all | readlater | archive
let query = "";
let filterTags = [];
let flashId = null;
let editingId = null; // bookmark being edited (link/title/description)
let organizeId = null; // bookmark whose tags & note are being edited
let organizeDraft = null; // { tags: string[], note: string }

// ---- DOM refs -------------------------------------------------------------
const els = {
  saver: document.getElementById("saver"),
  urlInput: document.getElementById("urlInput"),
  saveBtn: document.getElementById("saveBtn"),
  notice: document.getElementById("notice"),
  viewbar: document.getElementById("viewbar"),
  searchInput: document.getElementById("searchInput"),
  filterbar: document.getElementById("filterbar"),
  resultmeta: document.getElementById("resultmeta"),
  list: document.getElementById("list"),
  empty: document.getElementById("empty"),
};

// ---- Persistence ----------------------------------------------------------
function persist() {
  // Never persist the transient "pending" flag.
  saveBookmarks(bookmarks.map(({ pending, ...rest }) => rest));
}

// ---- Metadata fetch (SCN-001, SCN-008) ------------------------------------
async function fetchMetadata(url) {
  try {
    const res = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
    if (!res.ok) return { error: true, host: hostFromUrl(url) };
    return await res.json();
  } catch {
    return { error: true, host: hostFromUrl(url) };
  }
}

async function resolveDetails(entry) {
  entry.pending = true;
  entry.error = false;
  render();
  const meta = await fetchMetadata(entry.url);
  if (meta.error) {
    entry.error = true;
    entry.host = meta.host || hostFromUrl(entry.url);
    if (!entry.title) entry.title = entry.url;
    entry.description = entry.description || "";
    entry.favicon = entry.favicon || faviconGuess(entry.url);
    entry.image = entry.image || "";
  } else {
    entry.error = false;
    entry.title = meta.title || entry.title || entry.url;
    entry.description = meta.description || "";
    entry.host = meta.host || hostFromUrl(entry.url);
    entry.favicon = meta.favicon || faviconGuess(entry.url);
    entry.image = meta.image || "";
  }
  entry.pending = false;
}

function faviconGuess(url) {
  try {
    return new URL("/favicon.ico", url).href;
  } catch {
    return "";
  }
}

// ---- Save flow (SCN-001, SCN-008, SCN-009, SCN-011) -----------------------
els.saver.addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = els.urlInput.value.trim();
  if (!raw) return; // empty input: do nothing
  const url = normalizeUrl(raw);
  if (!isValidLink(url)) {
    showNotice("That doesn't look like a valid link — please check it and try again.", null, true);
    return;
  }
  const dup = findDuplicate(bookmarks, url);
  if (dup) {
    els.urlInput.value = "";
    const where = dup.archived ? " It's in your Archive." : "";
    showNotice("You've already saved this link." + where, dup);
    return;
  }
  const entry = {
    id: makeId(),
    url,
    title: "",
    description: "",
    host: hostFromUrl(url),
    favicon: "",
    image: "",
    tags: [],
    note: "",
    readLater: false,
    archived: false,
    edited: false,
    error: false,
    createdAt: Date.now(),
    pending: true,
  };
  bookmarks.unshift(entry);
  els.urlInput.value = "";
  els.saveBtn.disabled = true;
  render();
  await resolveDetails(entry);
  persist();
  els.saveBtn.disabled = false;
  render();
});

// ---- View tabs (SCN-006, SCN-007) -----------------------------------------
els.viewbar.addEventListener("click", (e) => {
  const tab = e.target.closest(".viewtab");
  if (!tab) return;
  view = tab.dataset.view;
  closeEditors();
  render();
});

// ---- Search (SCN-005) -----------------------------------------------------
els.searchInput.addEventListener("input", (e) => {
  query = e.target.value;
  render();
});

// ---- Filter bar (SCN-004) -------------------------------------------------
els.filterbar.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-filter-tag]");
  if (chip) {
    const t = chip.dataset.filterTag;
    const i = filterTags.indexOf(t);
    if (i >= 0) filterTags.splice(i, 1);
    else filterTags.push(t);
    render();
    return;
  }
  if (e.target.closest("[data-action='clear-filters']")) {
    filterTags = [];
    query = "";
    els.searchInput.value = "";
    render();
  }
});

// ---- Notice banner --------------------------------------------------------
let noticeTimer = null;
function showNotice(text, target, isWarn = false) {
  els.notice.innerHTML = "";
  els.notice.classList.toggle("warn", !!isWarn);
  const span = document.createElement("span");
  span.textContent = text;
  els.notice.appendChild(span);
  if (target) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Show it";
    btn.addEventListener("click", () => revealBookmark(target));
    els.notice.appendChild(btn);
  }
  els.notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { els.notice.hidden = true; }, 6000);
}

function revealBookmark(target) {
  if (target.archived) view = "archive";
  else if (view === "readlater" && !target.readLater) view = "all";
  query = "";
  filterTags = [];
  els.searchInput.value = "";
  flashId = target.id;
  render();
  const el = els.list.querySelector(`[data-id="${target.id}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => { flashId = null; }, 1600);
}

// ---- Card action delegation ----------------------------------------------
els.list.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const card = e.target.closest("[data-id]");
  const b = card && bookmarks.find((x) => x.id === card.dataset.id);
  const action = btn.dataset.action;

  switch (action) {
    case "edit":
      if (b) { closeEditors(); editingId = b.id; render(); }
      break;
    case "organize":
      if (b) {
        closeEditors();
        organizeId = b.id;
        organizeDraft = { tags: [...(b.tags || [])], note: b.note || "" };
        render();
      }
      break;
    case "readlater":
      if (b) { b.readLater = !b.readLater; persist(); render(); }
      break;
    case "archive":
      if (b) { b.archived = true; closeEditors(); persist(); render(); }
      break;
    case "restore":
      if (b) { b.archived = false; persist(); render(); }
      break;
    case "retry":
      if (b) { resolveDetails(b).then(() => { persist(); render(); }); }
      break;
    case "save-edit":
      if (b) saveEdit(b, card);
      break;
    case "cancel-edit":
      closeEditors(); render();
      break;
    case "org-toggle":
      toggleDraftTag(btn.dataset.tag, card);
      break;
    case "org-remove":
      removeDraftTag(btn.dataset.tag, card);
      break;
    case "save-org":
      if (b) saveOrganize(b, card);
      break;
    case "cancel-org":
      closeEditors(); render();
      break;
  }
});

function closeEditors() {
  editingId = null;
  organizeId = null;
  organizeDraft = null;
}

// ---- Edit save (SCN-002) --------------------------------------------------
async function saveEdit(b, card) {
  const urlVal = normalizeUrl(card.querySelector(".edit-url").value);
  const refetch = card.querySelector(".edit-refetch").checked;
  const titleVal = card.querySelector(".edit-title").value.trim();
  const descVal = card.querySelector(".edit-desc").value.trim();
  const newUrl = isValidLink(urlVal) ? urlVal : b.url;

  b.url = newUrl;
  if (refetch) {
    editingId = null;
    await resolveDetails(b);
    b.edited = true;
    persist();
    render();
    return;
  }
  b.title = titleVal || b.title;
  b.description = descVal;
  b.host = hostFromUrl(newUrl);
  b.favicon = faviconGuess(newUrl);
  b.edited = true;
  editingId = null;
  persist();
  render();
}

// ---- Organize save (SCN-003) ----------------------------------------------
function syncDraftNote(card) {
  const noteEl = card && card.querySelector(".org-note");
  if (noteEl && organizeDraft) organizeDraft.note = noteEl.value;
}

function toggleDraftTag(tag, card) {
  if (!organizeDraft || !tag) return;
  syncDraftNote(card);
  const i = organizeDraft.tags.indexOf(tag);
  if (i >= 0) organizeDraft.tags.splice(i, 1);
  else organizeDraft.tags.push(tag);
  render();
}

function removeDraftTag(tag, card) {
  if (!organizeDraft || !tag) return;
  syncDraftNote(card);
  const i = organizeDraft.tags.indexOf(tag);
  if (i >= 0) organizeDraft.tags.splice(i, 1);
  render();
}

function addDraftTag(value, card) {
  const t = value.trim().replace(/,+$/, "").trim();
  if (!t || !organizeDraft) return;
  syncDraftNote(card);
  if (!organizeDraft.tags.includes(t)) organizeDraft.tags.push(t);
  render();
}

function saveOrganize(b, card) {
  const newEl = card.querySelector(".org-newtag");
  if (newEl && newEl.value.trim()) {
    const t = newEl.value.trim().replace(/,+$/, "").trim();
    if (t && !organizeDraft.tags.includes(t)) organizeDraft.tags.push(t);
  }
  syncDraftNote(card);
  b.tags = [...organizeDraft.tags];
  b.note = (organizeDraft.note || "").trim();
  closeEditors();
  persist();
  render();
}

// ---- Derived data ---------------------------------------------------------
function allTags() {
  const set = [];
  for (const b of bookmarks) {
    for (const t of b.tags || []) if (!set.includes(t)) set.push(t);
  }
  return set.sort((a, b) => a.localeCompare(b));
}

function inView(b) {
  if (view === "archive") return !!b.archived;
  if (b.archived) return false;
  if (view === "readlater") return !!b.readLater;
  return true;
}

function makeMatcher() {
  return query.trim() ? buildMatcher(query) : null;
}

function visibleBookmarks(matcher) {
  return bookmarks.filter((b) => {
    if (!inView(b)) return false;
    if (filterTags.length && !filterTags.every((t) => (b.tags || []).includes(t))) return false;
    if (matcher && !b.pending) return matcher(toRecord(b));
    return true;
  });
}

// ---- Render ---------------------------------------------------------------
function render() {
  const matcher = makeMatcher();
  renderTabs();
  renderFilterBar();
  const visible = visibleBookmarks(matcher);
  renderResultMeta(visible);
  renderList(visible);
  renderEmpty(visible);
  postRender();
}

function renderTabs() {
  const readCount = bookmarks.filter((b) => b.readLater && !b.archived).length;
  const archiveCount = bookmarks.filter((b) => b.archived).length;
  for (const tab of els.viewbar.querySelectorAll(".viewtab")) {
    const v = tab.dataset.view;
    const on = v === view;
    tab.classList.toggle("on", on);
    tab.setAttribute("aria-pressed", String(on));
    let label = v === "all" ? "All" : v === "readlater" ? "Read Later" : "Archive";
    if (v === "readlater") label += ` <span class="count">${readCount}</span>`;
    if (v === "archive") label += ` <span class="count">${archiveCount}</span>`;
    tab.innerHTML = label;
  }
}

function renderFilterBar() {
  const tags = allTags();
  const parts = [];
  if (tags.length) {
    parts.push('<span class="flabel">Filter by tag:</span>');
    for (const t of tags) {
      const on = filterTags.includes(t) ? " on" : "";
      parts.push(`<span class="filter-chip${on}" data-filter-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`);
    }
    if (filterTags.length || query.trim()) {
      parts.push('<button class="clearf" type="button" data-action="clear-filters">Clear</button>');
    }
  }
  els.filterbar.innerHTML = parts.join("");
}

function renderResultMeta(visible) {
  const finding = !!(query.trim() || filterTags.length);
  if (finding && bookmarks.length) {
    let meta = `${visible.length} ${visible.length === 1 ? "match" : "matches"}`;
    if (filterTags.length) meta += ` · tags: ${filterTags.join(", ")}`;
    if (query.trim()) meta += ` · "${query.trim()}"`;
    els.resultmeta.textContent = meta;
  } else {
    els.resultmeta.textContent = "";
  }
}

function renderList(visible) {
  els.list.innerHTML = visible.map(cardHtml).join("");
}

function renderEmpty(visible) {
  const finding = !!(query.trim() || filterTags.length);
  let message = "";
  if (bookmarks.length === 0) {
    message = "No bookmarks yet. Paste a link above to save your first one.";
  } else if (visible.length === 0) {
    if (finding) {
      message = "No bookmarks match your search. Try a different word or clear the filters.";
    } else if (view === "readlater") {
      message = "Nothing in your read-later list yet. On any bookmark, choose <strong>Read later</strong> to add it here.";
    } else if (view === "archive") {
      message = "Your archive is empty. Archive a bookmark to keep it without cluttering your main list.";
    } else {
      message = "Nothing in your library right now. Save a new link, or check your <strong>Archive</strong>.";
    }
  }
  if (message) {
    els.empty.innerHTML = message;
    els.empty.hidden = false;
  } else {
    els.empty.hidden = true;
  }
}

function postRender() {
  if (organizeId) {
    const input = els.list.querySelector(".org-newtag");
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          const card = e.target.closest("[data-id]");
          addDraftTag(input.value, card);
        }
      });
    }
  }
}

// ---- Card templates -------------------------------------------------------
function cardHtml(b) {
  if (b.pending) return pendingCard(b);
  if (editingId === b.id) return editCard(b);
  if (organizeId === b.id) return organizeCard(b);
  return normalCard(b);
}

function pendingCard(b) {
  return `
    <article class="card pending" data-id="${b.id}">
      <div class="thumb"></div>
      <div class="body">
        <div class="fetching"><span class="spin"></span>Fetching page details…</div>
        <div class="skeleton t" style="margin-top:10px"></div>
        <div class="skeleton d"></div>
        <div class="skeleton d2"></div>
      </div>
    </article>`;
}

function normalCard(b) {
  const flash = flashId === b.id ? " flash" : "";
  const image = safeImageUrl(b.image);
  const favicon = safeImageUrl(b.favicon);
  const badges =
    (b.readLater && !b.archived ? '<span class="badge readlater">Read later</span>' : "") +
    (b.archived ? '<span class="badge archived">Archived</span>' : "");
  const warn = b.error
    ? '<p class="fetchwarn">⚠ Couldn\'t fetch this page\'s details. The link is saved — you can retry or edit it yourself.</p>'
    : "";
  const desc = b.description ? `<p class="desc">${escapeHtml(b.description)}</p>` : "";
  const tags = (b.tags && b.tags.length)
    ? `<div class="tags">${b.tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}</div>`
    : "";
  const note = b.note ? `<div class="note">${renderMarkdown(b.note)}</div>` : "";

  const actions = b.archived
    ? '<button class="linkbtn" type="button" data-action="restore">Restore to library</button>'
    : [
        '<button class="linkbtn" type="button" data-action="edit">Edit</button>',
        `<button class="linkbtn" type="button" data-action="organize">${(b.tags && b.tags.length) || b.note ? "Tags &amp; note" : "Add tags &amp; note"}</button>`,
        `<button class="linkbtn" type="button" data-action="readlater">${b.readLater ? "Remove from read later" : "Read later"}</button>`,
        b.error ? '<button class="linkbtn" type="button" data-action="retry">Try again</button>' : "",
        '<button class="linkbtn muted" type="button" data-action="archive">Archive</button>',
      ].join("");

  return `
    <article class="card${flash}" data-id="${b.id}">
      <div class="thumb" style="${image ? `background-image:url('${image}')` : ""}"></div>
      <div class="body">
        <div class="title-row">
          ${favicon ? `<img class="favicon" src="${favicon}" alt="" onerror="this.style.visibility='hidden'"/>` : ""}
          <h3 class="title"><a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.title || b.url)}</a></h3>
          ${badges}
        </div>
        ${warn}
        ${desc}
        <p class="host">${escapeHtml(b.host)} ${b.edited ? '<span class="edited-flag">· edited</span>' : ""}</p>
        ${tags}
        ${note}
        <div class="actions">${actions}</div>
      </div>
    </article>`;
}

function editCard(b) {
  const image = safeImageUrl(b.image);
  return `
    <article class="card" data-id="${b.id}">
      <div class="thumb" style="${image ? `background-image:url('${image}')` : ""}"></div>
      <div class="body">
        <div class="editor">
          <label>Link (URL)</label>
          <input class="edit-url" type="text" value="${escapeHtml(b.url)}" />
          <label class="checkline"><input class="edit-refetch" type="checkbox" /> Re-fetch page details from this link when I save</label>
          <label>Title</label>
          <input class="edit-title" type="text" value="${escapeHtml(b.title)}" />
          <label>Description</label>
          <textarea class="edit-desc">${escapeHtml(b.description)}</textarea>
          <div class="row">
            <button class="save" type="button" data-action="save-edit">Save changes</button>
            <button class="cancel" type="button" data-action="cancel-edit">Cancel</button>
          </div>
        </div>
      </div>
    </article>`;
}

function organizeCard(b) {
  const image = safeImageUrl(b.image);
  const existing = allTags();
  const draft = organizeDraft || { tags: [], note: "" };
  const suggestions = existing.length
    ? existing
        .map((t) => `<span class="chip suggest${draft.tags.includes(t) ? " on" : ""}" data-action="org-toggle" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`)
        .join("")
    : '<span style="color:#6b7580;font-size:12px;">No tags yet — add your first below.</span>';
  const newChips = draft.tags
    .filter((t) => !existing.includes(t))
    .map((t) => `<span class="chip">${escapeHtml(t)}<span class="x" data-action="org-remove" data-tag="${escapeHtml(t)}">×</span></span>`)
    .join("");

  return `
    <article class="card" data-id="${b.id}">
      <div class="thumb" style="${image ? `background-image:url('${image}')` : ""}"></div>
      <div class="body">
        <div class="editor">
          <label>Your tags</label>
          <div class="tags">${suggestions}</div>
          <label>Add new</label>
          <div class="chip-input">${newChips}<input class="org-newtag" type="text" placeholder="New tag, press Enter…" /></div>
          <label>Note <span style="text-transform:none;letter-spacing:0;font-style:italic;">(private · simple Markdown)</span></label>
          <textarea class="org-note" placeholder="Add a private note… **bold**, *italic*, - lists, [links](https://…)">${escapeHtml(draft.note)}</textarea>
          <div class="row">
            <button class="save" type="button" data-action="save-org">Save</button>
            <button class="cancel" type="button" data-action="cancel-org">Cancel</button>
          </div>
        </div>
      </div>
    </article>`;
}

function safeImageUrl(u) {
  return /^https?:\/\//i.test(u || "") ? u : "";
}

// ---- Boot -----------------------------------------------------------------
render();
document.body.setAttribute("data-harness-ready", "true");
