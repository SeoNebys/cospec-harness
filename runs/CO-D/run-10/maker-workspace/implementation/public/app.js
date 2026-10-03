const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  bookmarks: [], view: "all", viewLabel: "", selectionMode: false, selected: new Set(),
  sort: localStorage.getItem("keepsake-sort") || "newest",
  search: { query: "", within: "", mode: "all", excludeLabel: "", excludeWords: "", exact: false },
  editor: null, editorLabels: [], pendingDeleteIds: [], returnToEditor: false,
  importContent: "", importFileName: "", importPreview: null
};

let toastTimer;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

function stripHtml(value = "") {
  const element = document.createElement("div");
  element.innerHTML = value;
  return (element.textContent || "").replace(/\s+/g, " ").trim();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {}) }
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("json") ? await response.json() : await response.text();
  if (!response.ok) throw Object.assign(new Error(payload.error || "Something went wrong."), { response, payload });
  return payload;
}

async function refreshLibrary() {
  const data = await api("/api/library");
  state.bookmarks = data.bookmarks;
  state.selected = new Set([...state.selected].filter((id) => state.bookmarks.some((bookmark) => bookmark.id === id)));
  render();
}

function showToast(message) {
  clearTimeout(toastTimer);
  $("#toastText").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 3600);
}

function allLabels(includeArchived = true) {
  const bookmarks = includeArchived ? state.bookmarks : state.bookmarks.filter((bookmark) => !bookmark.archived);
  const map = new Map();
  for (const bookmark of bookmarks) {
    for (const label of bookmark.labels || []) {
      if (!map.has(label.toLowerCase())) map.set(label.toLowerCase(), label);
    }
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b));
}

function searchIsActive() {
  const search = state.search;
  return Boolean(search.query.trim() || search.within || search.mode === "any" || search.excludeLabel || search.excludeWords.trim() || search.exact);
}

function queryMatches(text, query, exact, mode) {
  if (!query) return true;
  if (exact) return text.includes(query);
  const words = query.split(/\s+/).filter(Boolean);
  return mode === "any" ? words.some((word) => text.includes(word)) : words.every((word) => text.includes(word));
}

function searchMatch(bookmark) {
  const search = state.search;
  const query = search.query.trim().toLowerCase();
  const fields = {
    title: bookmark.title.toLowerCase(), description: bookmark.description.toLowerCase(),
    address: bookmark.url.toLowerCase(), note: stripHtml(bookmark.noteHtml).toLowerCase()
  };
  const combined = Object.values(fields).join(" ");
  const labels = bookmark.labels.map((label) => label.toLowerCase());
  const positive = queryMatches(combined, query, search.exact, search.mode);
  const within = !search.within || labels.includes(search.within.toLowerCase());
  const excludeLabel = !search.excludeLabel || !labels.includes(search.excludeLabel.toLowerCase());
  const excludedWords = search.excludeWords.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const excludeWords = excludedWords.every((word) => !combined.includes(word));
  if (!(positive && within && excludeLabel && excludeWords)) return { matches: false, reason: "" };
  if (!query || queryMatches(fields.title, query, search.exact, search.mode)) return { matches: true, reason: "" };
  const field = Object.entries(fields).find(([, value]) => queryMatches(value, query, search.exact, search.mode));
  const reasons = { description: "Matched the description", address: "Matched the web address", note: "Matched your personal note" };
  return { matches: true, reason: field ? reasons[field[0]] || "" : "Matched across saved details" };
}

function visibleBookmarks() {
  let bookmarks = state.bookmarks.filter((bookmark) => {
    if (state.view === "archive") return bookmark.archived;
    if (bookmark.archived) return false;
    if (state.view === "later") return bookmark.readLater;
    if (state.view === "label") return bookmark.labels.some((label) => label.toLowerCase() === state.viewLabel.toLowerCase());
    return true;
  });
  bookmarks = bookmarks.map((bookmark) => ({ bookmark, ...searchMatch(bookmark) })).filter((item) => item.matches);
  bookmarks.sort((a, b) => {
    if (state.sort === "name") return a.bookmark.title.localeCompare(b.bookmark.title);
    const direction = state.sort === "oldest" ? 1 : -1;
    return (new Date(a.bookmark.savedAt) - new Date(b.bookmark.savedAt)) * direction;
  });
  return bookmarks;
}

function dateLabel(value) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Saved today";
  return `Saved ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" }).format(date)}`;
}

function renderSidebar() {
  const active = state.bookmarks.filter((bookmark) => !bookmark.archived);
  $("#allCount").textContent = String(active.length);
  $("#laterCount").textContent = String(active.filter((bookmark) => bookmark.readLater).length);
  $("#archiveCount").textContent = String(state.bookmarks.filter((bookmark) => bookmark.archived).length);
  $$(".primary-nav .nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  const labels = allLabels(false);
  $("#labelNav").hidden = labels.length === 0;
  $("#labelNavItems").innerHTML = labels.map((label) => {
    const count = active.filter((bookmark) => bookmark.labels.some((item) => item.toLowerCase() === label.toLowerCase())).length;
    const selected = state.view === "label" && state.viewLabel.toLowerCase() === label.toLowerCase();
    return `<button class="nav-item${selected ? " active" : ""}" type="button" data-label-view="${escapeHtml(label)}"><span>${escapeHtml(label)}</span><span class="nav-count">${count}</span></button>`;
  }).join("");
}

function renderSearchControls() {
  const labels = allLabels(false);
  const selectMarkup = (selected, first) => first + labels.map((label) => `<option value="${escapeHtml(label)}"${selected.toLowerCase() === label.toLowerCase() ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
  $("#withinLabel").innerHTML = selectMarkup(state.search.within, '<option value="">Any label</option>');
  $("#excludeLabel").innerHTML = selectMarkup(state.search.excludeLabel, '<option value="">No excluded label</option>');
  $("#searchInput").value = state.search.query;
  $("#wordMode").value = state.search.mode;
  $("#excludeWords").value = state.search.excludeWords;
  $("#exactPhrase").checked = state.search.exact;
  $("#clearSearch").hidden = !searchIsActive();
  const chips = [];
  if (state.search.within) chips.push(`Within: ${state.search.within}`);
  if (state.search.mode === "any" && state.search.query.trim().split(/\s+/).length > 1) chips.push("Matching: any word");
  if (state.search.excludeLabel) chips.push(`Leaving out: ${state.search.excludeLabel}`);
  if (state.search.excludeWords.trim()) chips.push(`Leaving out words: ${state.search.excludeWords.trim().split(/\s+/).join(", ")}`);
  if (state.search.exact) chips.push("Exact phrase");
  $("#filterChips").innerHTML = chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("");
  $("#filterChips").hidden = chips.length === 0;
}

function cardMarkup(item) {
  const bookmark = item.bookmark;
  const selected = state.selected.has(bookmark.id);
  const labels = bookmark.labels || [];
  const visibleLabels = labels.slice(0, 3);
  const preview = bookmark.previewImage
    ? `<img src="${escapeHtml(bookmark.previewImage)}" alt="">`
    : `<span class="preview-placeholder">${escapeHtml(bookmark.siteName)}</span>`;
  const favicon = bookmark.favicon
    ? `<img src="${escapeHtml(bookmark.favicon)}" alt=""><span class="source-fallback" hidden>${escapeHtml((bookmark.siteName[0] || "•").toUpperCase())}</span>`
    : `<span class="source-fallback">${escapeHtml((bookmark.siteName[0] || "•").toUpperCase())}</span>`;
  return `<article class="bookmark-card${selected ? " selected" : ""}" data-id="${bookmark.id}">
    ${state.selectionMode ? `<label class="card-check"><input type="checkbox" data-select-card="${bookmark.id}" aria-label="Select ${escapeHtml(bookmark.title)}"${selected ? " checked" : ""}></label>` : ""}
    <button class="later-button${bookmark.readLater ? " active" : ""}" type="button" data-later-id="${bookmark.id}" aria-label="${bookmark.readLater ? "Mark as read" : "Add to Read later"}">◷</button>
    <a class="preview-link" href="${escapeHtml(bookmark.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(bookmark.title)}"><div class="card-preview">${preview}</div></a>
    <div class="card-body"><div class="source-line">${favicon}<span>${escapeHtml(bookmark.siteName)}</span></div>
      <h2 class="clamp-title"><a href="${escapeHtml(bookmark.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(bookmark.title)}</a></h2>
      <p class="card-description">${escapeHtml(bookmark.description || "No description saved.")}</p>
      ${item.reason ? `<p class="match-reason">${escapeHtml(item.reason)}</p>` : ""}
      ${labels.length ? `<div class="card-labels">${visibleLabels.map((label) => `<button class="label-chip" type="button" data-card-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`).join("")}${labels.length > 3 ? `<span class="more-labels">+${labels.length - 3} more</span>` : ""}</div>` : ""}
      <div class="card-footer"><p class="saved-date">${escapeHtml(dateLabel(bookmark.savedAt))}</p><div class="card-footer-actions"><button class="details-button" type="button" data-details-id="${bookmark.id}">View details &amp; note →</button>${state.view === "archive" ? `<button class="restore-card-button" type="button" data-restore-id="${bookmark.id}">Restore to All bookmarks</button>` : ""}</div></div>
    </div></article>`;
}

function renderEmpty(items) {
  const empty = $("#viewEmpty");
  if (items.length) { empty.hidden = true; return; }
  let html = "";
  if (searchIsActive()) {
    const query = state.search.query.trim();
    html = `<div class="empty-mark">⌕</div><h2>No bookmarks found</h2><p>Nothing in your library matches${query ? ` “${escapeHtml(query)}”` : " those choices"}.<br>Try another word or clear the search.</p><button class="secondary" id="emptyClearSearch" type="button">Clear search</button>`;
  } else if (state.view === "later") {
    html = '<div class="empty-mark">✓</div><h2>Nothing waiting for you</h2><p>Your Read later list is clear.<br>Use the clock on any bookmark when you want to return to it.</p><button class="secondary" id="browseAllEmpty" type="button">Browse all bookmarks</button>';
  } else if (state.view === "archive") {
    html = '<div class="empty-mark">▣</div><h2>Archive is empty</h2><p>Bookmarks you set aside will stay safe here.</p><button class="secondary" id="browseAllEmpty" type="button">Browse all bookmarks</button>';
  } else if (state.view === "label") {
    html = '<div class="empty-mark">#</div><h2>No bookmarks under this label</h2><p>Try another label or return to your whole library.</p><button class="secondary" id="browseAllEmpty" type="button">Browse all bookmarks</button>';
  } else {
    html = '<div class="empty-mark">▣</div><h2>Your main library is clear</h2><p>Any bookmarks you archived are still safe and ready to restore.</p><button class="secondary" id="browseArchiveEmpty" type="button">View Archive</button>';
  }
  empty.innerHTML = html;
  empty.hidden = false;
}

function renderSelection(items) {
  $("#bulkBar").hidden = !state.selectionMode;
  $("#selectModeButton").hidden = state.selectionMode || !items.length;
  $("#selectedCount").textContent = `${state.selected.size} selected`;
  const visibleIds = items.map((item) => item.bookmark.id);
  const selectedVisible = visibleIds.filter((id) => state.selected.has(id)).length;
  $("#selectAll").checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
  $("#selectAll").indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
  ["#bulkLabel", "#bulkLater", "#bulkArchive", "#bulkDelete"].forEach((selector) => { $(selector).disabled = state.selected.size === 0; });
}

function render() {
  renderSidebar();
  const hasBookmarks = state.bookmarks.length > 0;
  $("#welcome").hidden = hasBookmarks;
  $("#library").hidden = !hasBookmarks;
  $("#searchArea").hidden = !hasBookmarks;
  if (!hasBookmarks) {
    $("#viewTitle").textContent = "All bookmarks";
    $("#appShell").dataset.harnessReady = "true";
    return;
  }
  renderSearchControls();
  const items = visibleBookmarks();
  const baseTitle = state.view === "later" ? "Read later" : state.view === "archive" ? "Archive" : state.view === "label" ? state.viewLabel : "All bookmarks";
  $("#viewTitle").textContent = searchIsActive() ? "Search results" : baseTitle;
  $("#resultCount").textContent = `${items.length} ${items.length === 1 ? "bookmark" : "bookmarks"}`;
  $("#sortSelect").value = state.sort;
  $("#cardGrid").innerHTML = items.map(cardMarkup).join("");
  $$(".card-preview img").forEach((image) => image.addEventListener("error", () => { image.parentElement.innerHTML = `<span class="preview-placeholder">${escapeHtml(image.closest('.bookmark-card').querySelector('.source-line span:last-child')?.textContent || 'No preview')}</span>`; }));
  $$(".source-line img").forEach((image) => image.addEventListener("error", () => { image.hidden = true; if (image.nextElementSibling) image.nextElementSibling.hidden = false; }));
  renderEmpty(items);
  renderSelection(items);
  $("#appShell").dataset.harnessReady = "true";
}

function resetSearch() {
  state.search = { query: "", within: "", mode: "all", excludeLabel: "", excludeWords: "", exact: false };
  state.view = "all";
  state.viewLabel = "";
  render();
  $("#searchInput").focus();
}

function showModal(modal) {
  $$(".modal").forEach((item) => { item.hidden = true; });
  $("#modalBackdrop").hidden = false;
  modal.hidden = false;
}

function closeModals() {
  $$(".modal").forEach((item) => { item.hidden = true; });
  $("#modalBackdrop").hidden = true;
  $("#bulkLaterMenu").hidden = true;
  state.returnToEditor = false;
}

function renderEditorLabels() {
  $("#selectedLabels").innerHTML = state.editorLabels.map((label) => `<span class="selected-label">${escapeHtml(label)}<button type="button" data-remove-editor-label="${escapeHtml(label)}" aria-label="Remove ${escapeHtml(label)}">×</button></span>`).join("");
}

function canonicalLabel(value) {
  const cleaned = value.trim();
  if (!cleaned) return "";
  return allLabels().find((label) => label.toLowerCase() === cleaned.toLowerCase()) || cleaned;
}

function addEditorLabel(value) {
  const label = canonicalLabel(value);
  if (label && !state.editorLabels.some((item) => item.toLowerCase() === label.toLowerCase())) state.editorLabels.push(label);
  $("#labelInput").value = "";
  $("#labelSuggestions").hidden = true;
  renderEditorLabels();
}

function renderLabelSuggestions(input, container, onChoose) {
  const query = input.value.trim().toLowerCase();
  const selected = container === $("#labelSuggestions") ? state.editorLabels : [];
  const matches = query ? allLabels().filter((label) => label.toLowerCase().includes(query) && !selected.some((item) => item.toLowerCase() === label.toLowerCase())) : [];
  container.innerHTML = matches.map((label) => `<button type="button" data-suggest-label="${escapeHtml(label)}"><span># ${escapeHtml(label)}</span><small>Already in your library</small></button>`).join("");
  container.hidden = matches.length === 0;
  $$('[data-suggest-label]', container).forEach((button) => button.addEventListener("click", () => onChoose(button.dataset.suggestLabel)));
}

function setEditorPreview(bookmark) {
  const preview = $("#editorPreview");
  preview.innerHTML = "";
  if (bookmark.previewImage) {
    const image = document.createElement("img"); image.src = bookmark.previewImage; image.alt = "";
    image.addEventListener("error", () => { preview.innerHTML = `<span>${escapeHtml(bookmark.siteName || "NO PREVIEW")}</span>`; });
    preview.appendChild(image);
  } else preview.innerHTML = `<span>${escapeHtml(bookmark.siteName || "NO PREVIEW")}</span>`;
  $("#editorSite").textContent = bookmark.siteName;
  $("#editorFaviconFallback").textContent = (bookmark.siteName?.[0] || "•").toUpperCase();
  $("#editorFavicon").hidden = true;
  if (bookmark.favicon) {
    $("#editorFavicon").src = bookmark.favicon;
    $("#editorFavicon").hidden = false;
    $("#editorFavicon").onerror = () => { $("#editorFavicon").hidden = true; };
  }
}

function openEditor(bookmark, { isNew = false, duplicate = false, unavailable = false } = {}) {
  state.editor = { ...bookmark, isNew, duplicate };
  state.editorLabels = [...(bookmark.labels || [])];
  $("#urlStep").hidden = true; $("#loadingStep").hidden = true; $("#bookmarkForm").hidden = false;
  $("#editorEyebrow").textContent = duplicate ? "Already in your library" : isNew ? "Ready to save" : "Bookmark details";
  $("#editorTitle").textContent = duplicate ? "Edit your existing bookmark" : isNew ? unavailable ? "Name this page yourself" : "Here’s what we found" : "Your saved bookmark";
  $("#duplicateBadge").hidden = !duplicate;
  $("#metadataNotice").hidden = !(duplicate || unavailable);
  $("#metadataNotice").textContent = duplicate
    ? "You saved this page before. Your existing title, labels, and note are kept here for editing."
    : unavailable ? "We couldn’t read this page. It may not share its details, but you can still name and save it yourself." : "";
  $("#titleInput").value = bookmark.title || "";
  $("#descriptionInput").value = bookmark.description || "";
  $("#noteEditor").innerHTML = bookmark.noteHtml || "";
  $("#readLaterInput").checked = Boolean(bookmark.readLater);
  $("#editorSecondaryActions").hidden = isNew;
  $("#dangerZone").hidden = isNew;
  $("#archiveBookmarkButton").hidden = isNew || bookmark.archived;
  $("#restoreBookmarkButton").hidden = isNew || !bookmark.archived;
  $("#saveBookmarkButton").textContent = isNew ? "Save bookmark" : duplicate ? "Update bookmark" : "Save changes";
  renderEditorLabels(); setEditorPreview(bookmark);
  showModal($("#saveModal"));
  requestAnimationFrame(() => $("#titleInput").focus());
}

function openSaveFlow() {
  state.editor = null; state.editorLabels = [];
  $("#urlStep").hidden = false; $("#loadingStep").hidden = true; $("#bookmarkForm").hidden = true;
  $("#urlInput").value = ""; $("#urlError").hidden = true;
  showModal($("#saveModal"));
  requestAnimationFrame(() => $("#urlInput").focus());
}

async function updateBookmark(id, updates, message) {
  const result = await api(`/api/bookmarks/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
  const index = state.bookmarks.findIndex((bookmark) => bookmark.id === id);
  if (index >= 0) state.bookmarks[index] = result.bookmark;
  render(); showToast(message);
  return result.bookmark;
}

function openDeleteConfirmation(ids, returnToEditor = false) {
  const bookmarks = ids.map((id) => state.bookmarks.find((bookmark) => bookmark.id === id)).filter(Boolean);
  state.pendingDeleteIds = bookmarks.map((bookmark) => bookmark.id);
  state.returnToEditor = returnToEditor;
  $("#confirmTitle").textContent = bookmarks.length === 1 ? `Delete “${bookmarks[0].title}”?` : `Delete ${bookmarks.length} bookmarks?`;
  $("#confirmCopy").textContent = bookmarks.length === 1
    ? "Its saved title, description, labels, and personal note will be removed. This cannot be undone."
    : "Their saved titles, descriptions, labels, and personal notes will be removed. This cannot be undone.";
  $("#deleteList").innerHTML = bookmarks.map((bookmark) => `<div class="delete-list-item"><span class="source-fallback">${escapeHtml((bookmark.siteName[0] || "•").toUpperCase())}</span><div><strong>${escapeHtml(bookmark.title)}</strong><small>${escapeHtml(bookmark.siteName)}</small></div></div>`).join("");
  $("#cancelConfirm").textContent = bookmarks.length === 1 ? "Keep bookmark" : "Keep bookmarks";
  $("#confirmDeleteButton").textContent = bookmarks.length === 1 ? "Delete permanently" : `Delete ${bookmarks.length} permanently`;
  showModal($("#confirmModal"));
}

async function runBulkAction(action, extra = {}) {
  const ids = [...state.selected];
  const result = await api("/api/bulk", { method: "POST", body: JSON.stringify({ ids, action, ...extra }) });
  state.bookmarks = result.bookmarks;
  state.selected.clear();
  const messages = {
    label: `${extra.label} added to ${result.count} bookmarks`,
    "read-later": `${result.count} bookmarks added to Read later`,
    "mark-read": `${result.count} bookmarks marked as read`,
    archive: `${result.count} bookmarks moved to Archive`,
    delete: `${result.count} bookmarks deleted`
  };
  render(); showToast(messages[action]);
}

function showExport() {
  $("#exportView").hidden = false; $("#importPreviewView").hidden = true;
  showModal($("#transferModal"));
}

function renderImportPreview(preview) {
  state.importPreview = preview;
  $("#exportView").hidden = true; $("#importPreviewView").hidden = false;
  $("#importPreviewTitle").textContent = preview.kind === "backup" ? "Restore this complete backup?" : `Ready to import ${preview.newCount} bookmarks`;
  $("#importFileName").textContent = state.importFileName;
  $("#importStats").innerHTML = preview.kind === "backup"
    ? `<div><strong>${preview.total}</strong><span>bookmarks in backup</span></div><div><strong>${preview.dateCount}</strong><span>saved dates kept</span></div><div><strong>${preview.labels.length}</strong><span>labels kept</span></div>`
    : `<div><strong>${preview.newCount}</strong><span>new bookmarks</span></div><div><strong>${preview.duplicateCount}</strong><span>already here</span></div><div><strong>${preview.invalidCount}</strong><span>can’t be imported</span></div>`;
  const labels = preview.labels.slice(0, 12).map((label) => `<span>${escapeHtml(label)}</span>`).join("");
  $("#importDetails").innerHTML = preview.kind === "backup"
    ? `<strong>This replaces the current library with the complete saved copy.</strong><br>Titles, descriptions, labels, formatted notes, saved dates, Read later, and Archive state will be restored.${labels ? `<div class="import-label-list">${labels}</div>` : ""}`
    : `<strong>Your browser’s filing comes with the links.</strong><br>Folder names become labels, including nested folders. ${preview.dateCount} of ${preview.newCount} new bookmarks include their original saved date; the rest use today. Existing bookmarks stay unchanged.${labels ? `<div class="import-label-list">${labels}</div>` : ""}`;
  $("#confirmImportButton").textContent = preview.kind === "backup" ? `Restore ${preview.total} bookmarks` : `Import ${preview.newCount} bookmarks`;
  $("#confirmImportButton").disabled = preview.kind === "browser" && preview.newCount === 0;
  showModal($("#transferModal"));
}

$("#saveLinkButton").addEventListener("click", openSaveFlow);
$("#firstSaveButton").addEventListener("click", openSaveFlow);
$("#brandHome").addEventListener("click", (event) => { event.preventDefault(); resetSearch(); });
$$('[data-close-modal]').forEach((button) => button.addEventListener("click", closeModals));
$("#modalBackdrop").addEventListener("click", closeModals);
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("#modalBackdrop").hidden) closeModals(); });

$("#toolsButton").addEventListener("click", () => {
  $("#toolsMenu").hidden = !$("#toolsMenu").hidden;
  $("#toolsButton").setAttribute("aria-expanded", String(!$("#toolsMenu").hidden));
});
$("#importButton").addEventListener("click", () => { $("#toolsMenu").hidden = true; $("#importFile").click(); });
$("#exportButton").addEventListener("click", () => { $("#toolsMenu").hidden = true; showExport(); });
$("#browserExportLink").addEventListener("click", () => showToast("Browser bookmarks file downloaded"));
$("#backupExportLink").addEventListener("click", () => showToast("Complete library backup downloaded"));

$("#urlForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = $("#urlInput").value;
  $("#urlError").hidden = true;
  try {
    const likely = /^[a-z][a-z\d+.-]*:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
    const parsed = new URL(likely);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname.includes(".")) throw new Error();
  } catch {
    $("#urlError").textContent = "Enter a complete web address, such as example.com/article.";
    $("#urlError").hidden = false; $("#urlInput").focus(); return;
  }
  $("#urlStep").hidden = true; $("#loadingStep").hidden = false;
  try {
    const result = await api("/api/metadata", { method: "POST", body: JSON.stringify({ url: value }) });
    if (result.duplicate) openEditor(result.bookmark, { duplicate: true });
    else openEditor({
      url: result.url, title: result.title, description: result.description, siteName: result.siteName,
      favicon: result.favicon, previewImage: result.previewImage, labels: [], noteHtml: "", readLater: false, archived: false
    }, { isNew: true, unavailable: !result.available });
  } catch (error) {
    $("#loadingStep").hidden = true; $("#urlStep").hidden = false;
    $("#urlError").textContent = error.message; $("#urlError").hidden = false;
  }
});

$("#labelInput").addEventListener("input", () => renderLabelSuggestions($("#labelInput"), $("#labelSuggestions"), addEditorLabel));
$("#labelInput").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addEditorLabel(event.currentTarget.value); } });
$("#selectedLabels").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-editor-label]");
  if (!button) return;
  state.editorLabels = state.editorLabels.filter((label) => label.toLowerCase() !== button.dataset.removeEditorLabel.toLowerCase()); renderEditorLabels();
});
$("#bulletButton").addEventListener("click", () => { $("#noteEditor").focus(); document.execCommand("insertUnorderedList"); });
$("#boldButton").addEventListener("click", () => { $("#noteEditor").focus(); document.execCommand("bold"); });
$("#italicButton").addEventListener("click", () => { $("#noteEditor").focus(); document.execCommand("italic"); });

$("#bookmarkForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const editor = state.editor;
  const payload = {
    url: editor.url, siteName: editor.siteName, favicon: editor.favicon, previewImage: editor.previewImage,
    title: $("#titleInput").value, description: $("#descriptionInput").value, labels: state.editorLabels,
    noteHtml: $("#noteEditor").innerHTML, readLater: $("#readLaterInput").checked, archived: Boolean(editor.archived)
  };
  try {
    let result;
    if (editor.isNew) result = await api("/api/bookmarks", { method: "POST", body: JSON.stringify(payload) });
    else result = await api(`/api/bookmarks/${editor.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    await refreshLibrary(); closeModals();
    showToast(editor.duplicate ? "Bookmark updated — no duplicate created" : editor.isNew ? "Bookmark saved to your library" : "Bookmark details updated");
  } catch (error) { showToast(error.message); }
});

$("#archiveBookmarkButton").addEventListener("click", async () => {
  await updateBookmark(state.editor.id, { archived: true }, "Bookmark moved to Archive"); closeModals();
});
$("#restoreBookmarkButton").addEventListener("click", async () => {
  await updateBookmark(state.editor.id, { archived: false }, "Restored to All bookmarks"); state.view = "all"; closeModals(); render();
});
$("#deleteBookmarkButton").addEventListener("click", () => openDeleteConfirmation([state.editor.id], true));

$("#cancelConfirm").addEventListener("click", () => {
  if (state.returnToEditor) { showModal($("#saveModal")); state.returnToEditor = false; }
  else closeModals();
});
$("#confirmDeleteButton").addEventListener("click", async () => {
  const ids = [...state.pendingDeleteIds];
  if (ids.length === 1) await api(`/api/bookmarks/${ids[0]}`, { method: "DELETE" });
  else {
    state.selected = new Set(ids);
    await runBulkAction("delete");
  }
  await refreshLibrary(); closeModals();
  showToast(ids.length === 1 ? "Bookmark deleted" : `${ids.length} bookmarks deleted`);
});

$("#cardGrid").addEventListener("click", async (event) => {
  const later = event.target.closest("[data-later-id]");
  if (later) {
    const bookmark = state.bookmarks.find((item) => item.id === later.dataset.laterId);
    const next = !bookmark.readLater;
    await updateBookmark(bookmark.id, { readLater: next }, next ? "Added to Read later" : state.view === "later" ? "Marked as read and removed from the list" : "Marked as read");
    return;
  }
  const details = event.target.closest("[data-details-id]");
  if (details) { openEditor(state.bookmarks.find((bookmark) => bookmark.id === details.dataset.detailsId)); return; }
  const restore = event.target.closest("[data-restore-id]");
  if (restore) { await updateBookmark(restore.dataset.restoreId, { archived: false }, "Restored to All bookmarks"); return; }
  const label = event.target.closest("[data-card-label]");
  if (label) { state.view = "label"; state.viewLabel = label.dataset.cardLabel; state.search = { query: "", within: "", mode: "all", excludeLabel: "", excludeWords: "", exact: false }; render(); return; }
  const checkbox = event.target.closest("[data-select-card]");
  if (checkbox) {
    if (checkbox.checked) state.selected.add(checkbox.dataset.selectCard); else state.selected.delete(checkbox.dataset.selectCard);
    render();
  }
});

$("#labelNavItems").addEventListener("click", (event) => {
  const button = event.target.closest("[data-label-view]"); if (!button) return;
  state.view = "label"; state.viewLabel = button.dataset.labelView; state.search = { query: "", within: "", mode: "all", excludeLabel: "", excludeWords: "", exact: false }; state.selected.clear(); render();
});
$$('.primary-nav [data-view]').forEach((button) => button.addEventListener("click", () => {
  state.view = button.dataset.view; state.viewLabel = ""; state.search = { query: "", within: "", mode: "all", excludeLabel: "", excludeWords: "", exact: false }; state.selected.clear(); render();
}));

$("#searchInput").addEventListener("input", (event) => { state.search.query = event.currentTarget.value; render(); });
$("#searchOptionsButton").addEventListener("click", () => {
  $("#searchOptions").hidden = !$("#searchOptions").hidden;
  $("#searchOptionsButton").setAttribute("aria-expanded", String(!$("#searchOptions").hidden));
});
$("#withinLabel").addEventListener("change", (event) => { state.search.within = event.target.value; render(); });
$("#wordMode").addEventListener("change", (event) => { state.search.mode = event.target.value; render(); });
$("#excludeLabel").addEventListener("change", (event) => { state.search.excludeLabel = event.target.value; render(); });
$("#excludeWords").addEventListener("input", (event) => { state.search.excludeWords = event.target.value; render(); });
$("#exactPhrase").addEventListener("change", (event) => { state.search.exact = event.target.checked; render(); });
$("#clearSearch").addEventListener("click", resetSearch);
$("#viewEmpty").addEventListener("click", (event) => { if (event.target.id === "emptyClearSearch") resetSearch(); if (event.target.id === "browseAllEmpty") { state.view = "all"; state.viewLabel = ""; render(); } if (event.target.id === "browseArchiveEmpty") { state.view = "archive"; state.viewLabel = ""; render(); } });

$("#sortSelect").addEventListener("change", (event) => { state.sort = event.target.value; localStorage.setItem("keepsake-sort", state.sort); render(); });
$("#selectModeButton").addEventListener("click", () => { state.selectionMode = true; state.selected.clear(); render(); });
$("#doneSelecting").addEventListener("click", () => { state.selectionMode = false; state.selected.clear(); render(); });
$("#selectAll").addEventListener("change", (event) => {
  visibleBookmarks().forEach(({ bookmark }) => { if (event.target.checked) state.selected.add(bookmark.id); else state.selected.delete(bookmark.id); }); render();
});
$("#bulkLater").addEventListener("click", () => { $("#bulkLaterMenu").hidden = !$("#bulkLaterMenu").hidden; });
$("#bulkLaterMenu").addEventListener("click", async (event) => { const button = event.target.closest("[data-bulk-action]"); if (button) { $("#bulkLaterMenu").hidden = true; await runBulkAction(button.dataset.bulkAction); } });
$("#bulkArchive").addEventListener("click", () => runBulkAction("archive"));
$("#bulkDelete").addEventListener("click", () => openDeleteConfirmation([...state.selected]));
$("#bulkLabel").addEventListener("click", () => {
  $("#bulkLabelCopy").textContent = `Add one label to ${state.selected.size} selected bookmarks without replacing their existing labels.`;
  $("#bulkLabelInput").value = ""; $("#bulkLabelSuggestions").hidden = true; showModal($("#bulkLabelModal")); requestAnimationFrame(() => $("#bulkLabelInput").focus());
});
$("#bulkLabelInput").addEventListener("input", () => renderLabelSuggestions($("#bulkLabelInput"), $("#bulkLabelSuggestions"), (label) => { $("#bulkLabelInput").value = label; $("#bulkLabelSuggestions").hidden = true; }));
$("#applyBulkLabel").addEventListener("click", async () => { const label = canonicalLabel($("#bulkLabelInput").value); if (!label) return; closeModals(); await runBulkAction("label", { label }); });

$("#importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0]; if (!file) return;
  try {
    state.importContent = await file.text(); state.importFileName = file.name;
    renderImportPreview(await api("/api/import/preview", { method: "POST", body: JSON.stringify({ content: state.importContent, fileName: state.importFileName }) }));
  } catch (error) { showToast(error.message); }
  event.target.value = "";
});
$("#confirmImportButton").addEventListener("click", async () => {
  try {
    const result = await api("/api/import/apply", { method: "POST", body: JSON.stringify({ content: state.importContent, fileName: state.importFileName }) });
    await refreshLibrary(); closeModals();
    showToast(result.restored ? `Complete backup restored · ${result.imported} bookmarks` : `${result.imported} imported · ${result.duplicates} already here · ${result.skipped} skipped`);
  } catch (error) { showToast(error.message); }
});

refreshLibrary().catch((error) => {
  $("#welcome").hidden = false;
  $("#welcome").innerHTML = `<p class="eyebrow">Unable to open library</p><h2>Something went wrong.</h2><p>${escapeHtml(error.message)}</p>`;
});
