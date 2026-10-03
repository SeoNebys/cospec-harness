// Bookmarks web client. Talks to the JSON API; does search / filter / sort /
// tab views locally over the loaded list (single user, modest data set).

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// ---------- state ----------
const state = {
  items: [],
  query: "",
  activeTag: null,
  sortMode: "new",
  view: "all",       // all | later | archived
  editingId: null,
  pendingMeta: null, // metadata attached to the next save
};

// ---------- api ----------
async function api(method, path, body) {
  const opt = { method, headers: {} };
  if (body !== undefined) {
    opt.headers["content-type"] = "application/json";
    opt.body = JSON.stringify(body);
  }
  const res = await fetch(path, opt);
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, ok: res.ok, data };
}

// ---------- helpers ----------
function faviconColor(host) {
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  return "hsl(" + (h % 360) + ",55%,45%)";
}
function badgeHtml(host, size = 16) {
  const letter = (host || "?").charAt(0).toUpperCase();
  return '<span class="favicon" style="background:' + faviconColor(host) + ";width:" + size +
    "px;height:" + size + "px;font-size:" + Math.round(size * 0.6) + 'px">' + esc(letter) + "</span>";
}
function faviconHtml(host, icon, size = 16) {
  if (icon) {
    return '<img class="favicon-img" src="' + esc(icon) + '" alt="" data-host="' + esc(host) +
      '" style="width:' + size + "px;height:" + size + 'px" />';
  }
  return badgeHtml(host, size);
}
function existingTags() {
  const map = new Map();
  for (const b of state.items) for (const t of b.tags) {
    if (!map.has(t.toLowerCase())) map.set(t.toLowerCase(), t);
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b));
}
function flash(msg, ms = 3500) {
  const f = $("flash");
  f.textContent = msg;
  f.hidden = false;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { f.hidden = true; }, ms);
}
// Swap broken preview / favicon images for their offline-safe fallbacks.
function wireImageFallbacks() {
  document.querySelectorAll("img.favicon-img").forEach((img) => {
    img.onerror = () => {
      const size = img.style.width ? parseInt(img.style.width, 10) : 16;
      img.outerHTML = badgeHtml(img.getAttribute("data-host") || "", size);
    };
  });
  document.querySelectorAll("img.thumb[data-fallback]").forEach((img) => {
    img.onerror = () => { img.outerHTML = '<div class="thumb-none">No preview</div>'; };
  });
  const ap = document.querySelector("#autoPreview img.preview[data-fallback]");
  if (ap) ap.onerror = () => { ap.outerHTML = '<div class="preview-none">No preview image on this page</div>'; };
}

// ---------- rendering ----------
function matchesView(b) {
  if (state.view === "archived") return b.archived;
  if (state.view === "later") return b.readLater && !b.archived;
  return !b.archived;
}
function matchesTag(b) {
  if (!state.activeTag) return true;
  return b.tags.map((t) => t.toLowerCase()).includes(state.activeTag.toLowerCase());
}
function matchesQuery(b) {
  const q = state.query;
  if (!q) return true;
  return [b.title, b.description, b.site, b.url, b.note, b.tags.join(" ")]
    .join(" ").toLowerCase().includes(q);
}
function sortShown(arr) {
  const by = {
    new: (a, b) => (b.savedAt || 0) - (a.savedAt || 0),
    old: (a, b) => (a.savedAt || 0) - (b.savedAt || 0),
    az: (a, b) => (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }),
    za: (a, b) => (b.title || "").localeCompare(a.title || "", undefined, { sensitivity: "base" }),
  };
  return arr.slice().sort(by[state.sortMode] || by.new);
}
function hl(text) {
  const q = state.query;
  if (!q) return esc(text);
  const t = text || "", lc = t.toLowerCase();
  let out = "", i = 0;
  for (;;) {
    const idx = lc.indexOf(q, i);
    if (idx < 0) { out += esc(t.slice(i)); break; }
    out += esc(t.slice(i, idx)) + "<mark>" + esc(t.slice(idx, idx + q.length)) + "</mark>";
    i = idx + q.length;
  }
  return out;
}

function syncTabs() {
  const allN = state.items.filter((b) => !b.archived).length;
  const laterN = state.items.filter((b) => b.readLater && !b.archived).length;
  const archN = state.items.filter((b) => b.archived).length;
  const tabs = $("viewTabs");
  tabs.querySelector('[data-view="all"]').innerHTML = 'All bookmarks <span class="tabn">' + allN + "</span>";
  tabs.querySelector('[data-view="later"]').innerHTML = 'Read later <span class="tabn">' + laterN + "</span>";
  tabs.querySelector('[data-view="archived"]').innerHTML = 'Archived <span class="tabn">' + archN + "</span>";
  tabs.querySelectorAll("[data-view]").forEach((b) =>
    b.classList.toggle("active", b.getAttribute("data-view") === state.view));
}

function renderActiveFilter() {
  const el = $("activeFilter");
  if (state.activeTag) {
    el.hidden = false;
    el.innerHTML = 'Showing only tag: <strong>' + esc(state.activeTag) +
      '</strong><button id="clearFilter" type="button" title="Clear">✕ clear</button>';
    $("clearFilter").addEventListener("click", () => { state.activeTag = null; render(); });
  } else {
    el.hidden = true; el.innerHTML = "";
  }
}

function cardEditForm(b) {
  const thumb = b.image
    ? '<img class="thumb" data-fallback="1" src="' + esc(b.image) + '" alt="preview" />'
    : '<div class="thumb-none">No preview</div>';
  return thumb + '<div class="body editform">' +
    '<div class="editrow"><label>Web address</label><input class="ed-url" type="text" value="' + esc(b.url) + '"></div>' +
    '<div class="editrow"><label>Title</label><input class="ed-title" type="text" value="' + esc(b.title) + '"></div>' +
    '<div class="editrow"><label>Description</label><textarea class="ed-desc">' + esc(b.description) + "</textarea></div>" +
    '<div class="editrow"><label>Tags (comma separated)</label><input class="ed-tags" type="text" value="' + esc(b.tags.join(", ")) + '"></div>' +
    '<div class="editrow"><label>Note</label><textarea class="ed-note">' + esc(b.note) + "</textarea></div>" +
    '<div class="ed-error"></div>' +
    '<div class="cardactions">' +
      '<button class="btn-primary" data-act="edit-save" data-id="' + b.id + '">Save changes</button>' +
      '<button class="linkbtn" data-act="edit-cancel" data-id="' + b.id + '">Cancel</button>' +
    "</div></div>";
}

function cardView(b) {
  const thumb = b.image
    ? '<img class="thumb" data-fallback="1" src="' + esc(b.image) + '" alt="preview" />'
    : '<div class="thumb-none">No preview</div>';
  const actions = b.archived
    ? '<button class="linkbtn" data-act="archive" data-id="' + b.id + '">↩ Restore to bookmarks</button>' +
      '<button class="linkbtn" data-act="edit" data-id="' + b.id + '">Edit</button>'
    : '<button class="linkbtn' + (b.readLater ? " on" : "") + '" data-act="later" data-id="' + b.id + '">' +
        (b.readLater ? "✓ In read later" : "+ Read later") + "</button>" +
      '<button class="linkbtn" data-act="archive" data-id="' + b.id + '">Archive</button>' +
      '<button class="linkbtn" data-act="edit" data-id="' + b.id + '">Edit</button>';
  const tagClass = b.archived ? "tag" : "tag clickable";
  return thumb + '<div class="body">' +
    '<p class="title"><a href="' + esc(b.url) + '" target="_blank" rel="noopener">' + hl(b.title) + "</a></p>" +
    '<div class="site-row">' + faviconHtml(b.host, b.icon, 16) + '<span class="site">' + hl(b.site) + "</span></div>" +
    (b.description ? '<p class="desc">' + hl(b.description) + "</p>" : "") +
    (b.tags.length ? '<div class="tags">' + b.tags.map((t) =>
      '<span class="' + tagClass + '" data-tag="' + esc(t) + '"' + (b.archived ? "" : ' title="Filter by this tag"') + ">" + hl(t) + "</span>"
    ).join("") + "</div>" : "") +
    (b.note ? '<div class="note">' + hl(b.note) + "</div>" : "") +
    '<div class="cardactions">' + actions + "</div>" +
    "</div>";
}

function render() {
  syncTabs();
  renderActiveFilter();
  const list = $("list");
  list.innerHTML = "";
  const shown = sortShown(state.items.filter((b) => matchesView(b) && matchesTag(b) && matchesQuery(b)));
  const viewTotal = state.items.filter(matchesView).length;
  const filtering = state.query || state.activeTag;
  $("count").textContent = filtering
    ? "showing " + shown.length + " of " + viewTotal
    : (viewTotal ? viewTotal + (viewTotal === 1 ? " link" : " links") : "");

  if (!shown.length) {
    $("empty").hidden = false;
    $("empty").innerHTML = filtering
      ? "<p>No bookmarks match your filter.<br/>Try a different word or tag.</p>"
      : state.view === "later"
        ? "<p>Your read-later list is empty.<br/>Use “Read later” on a bookmark to add it here.</p>"
        : state.view === "archived"
          ? "<p>No archived bookmarks.<br/>Use “Archive” to keep a link here without cluttering your main list.</p>"
          : "<p>No bookmarks yet.<br/>Paste a web address above to save your first one.</p>";
  } else {
    $("empty").hidden = true;
    for (const b of shown) {
      const li = document.createElement("li");
      li.className = "bm-item";
      li.dataset.id = b.id;
      if (b.id === state.editingId) { li.classList.add("editing"); li.innerHTML = cardEditForm(b); }
      else li.innerHTML = cardView(b);
      list.appendChild(li);
    }
  }
  wireImageFallbacks();
}

// ---------- save form ----------
function refreshSaveState() {
  $("saveBtn").disabled = !($("url").value.trim() && $("title").value.trim());
}
function clearSaveForm() {
  ["url", "title", "desc", "tags", "note"].forEach((id) => ($(id).value = ""));
  $("fetchNote").textContent = ""; $("fetchNote").className = "fetch-note";
  $("auto").hidden = true; state.pendingMeta = null;
  refreshSaveState();
}
function showAuto(meta, unreadable) {
  $("auto").hidden = false;
  $("autoFavicon").innerHTML = faviconHtml(meta.host, meta.icon, 18);
  $("autoSite").textContent = meta.site || meta.host;
  if (unreadable) {
    $("autoPreview").innerHTML = '<div class="preview-none">Details couldn\'t be read</div>';
  } else if (meta.image) {
    $("autoPreview").innerHTML = '<img class="preview" data-fallback="1" src="' + esc(meta.image) + '" alt="preview" />';
  } else {
    $("autoPreview").innerHTML = '<div class="preview-none">No preview image on this page</div>';
  }
  wireImageFallbacks();
}

async function onGetDetails() {
  const url = $("url").value.trim();
  const note = $("fetchNote");
  if (!url) { note.textContent = "Paste a web address first."; note.className = "fetch-note"; return; }
  note.textContent = "Reading the page…"; note.className = "fetch-note";
  const { status, data } = await api("POST", "/api/fetch-metadata", { url });
  if (status === 400) {
    $("auto").hidden = true; state.pendingMeta = null;
    $("title").value = ""; $("desc").value = "";
    note.textContent = "That doesn't look like a web address. Please check it and try again.";
    note.className = "fetch-note error"; refreshSaveState(); return;
  }
  if (data && data.url) $("url").value = data.url; // normalised (https:// added)
  if (data && data.ok) {
    $("title").value = data.title || "";
    $("desc").value = data.description || "";
    state.pendingMeta = { site: data.site || data.host, host: data.host, image: data.image || null, icon: data.icon || null };
    showAuto(state.pendingMeta, false);
    note.textContent = "Details filled in automatically — edit the title, description, tags or note as you like.";
    note.className = "fetch-note filled";
  } else {
    const host = (data && data.host) || "";
    $("title").value = ""; $("desc").value = "";
    state.pendingMeta = { site: host, host: host, image: null, icon: null };
    showAuto(state.pendingMeta, true);
    note.textContent = "We couldn't read this page's details automatically. You can still type a title and save it.";
    note.className = "fetch-note error";
  }
  refreshSaveState();
}

async function onSave() {
  const url = $("url").value.trim();
  const meta = state.pendingMeta || {};
  const payload = {
    url,
    title: $("title").value.trim(),
    description: $("desc").value.trim(),
    tags: $("tags").value,
    note: $("note").value.trim(),
    site: meta.site,
    image: meta.image || null,
    icon: meta.icon || null,
  };
  const { status, data } = await api("POST", "/api/bookmarks", payload);
  if (status === 201) {
    state.items.unshift(data.bookmark);
    clearSaveForm();
    render();
    flash("Saved. It's now at the top of your list.");
    return;
  }
  if (status === 409) {
    goToExisting(data.existing);
    return;
  }
  if (status === 400) {
    const note = $("fetchNote");
    note.textContent = "That doesn't look like a web address. Please check it and try again.";
    note.className = "fetch-note error";
  }
}

function goToExisting(existing) {
  // Make sure our copy matches the server's authoritative record.
  const idx = state.items.findIndex((b) => b.id === existing.id);
  if (idx >= 0) state.items[idx] = existing; else state.items.unshift(existing);
  state.view = existing.archived ? "archived" : existing.readLater ? "later" : "all";
  state.query = ""; state.activeTag = null; $("search").value = "";
  state.editingId = existing.id;
  clearSaveForm();
  render();
  const where = existing.archived ? " (it's in your Archived items)"
    : existing.readLater ? " (it's in your Read later list)" : "";
  flash("You already saved this link" + where + ". Here it is — edit it below instead of saving a copy.", 6000);
  const el = document.querySelector('li.bm-item[data-id="' + existing.id + '"]');
  if (el) { el.classList.add("flash-highlight"); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
}

// ---------- tag suggestions (dropdown, click to add) ----------
function segmentInfo() {
  const val = $("tags").value;
  const lastComma = val.lastIndexOf(",");
  const prefix = lastComma >= 0 ? val.slice(0, lastComma + 1) + " " : "";
  const seg = (lastComma >= 0 ? val.slice(lastComma + 1) : val).trim();
  const already = val.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  return { prefix, seg, already };
}
function showSuggest() {
  const box = $("tagSuggest");
  const { seg, already } = segmentInfo();
  if (!seg) { box.hidden = true; return; }
  const s = seg.toLowerCase();
  const opts = existingTags().filter((t) => t.toLowerCase().includes(s) && !already.includes(t.toLowerCase())).slice(0, 6);
  if (!opts.length) { box.hidden = true; return; }
  box.dataset.active = "-1";
  box.innerHTML = opts.map((t) =>
    '<div class="opt" data-tag="' + esc(t) + '"><span class="dot"></span>' + esc(t) + "<small>existing tag</small></div>"
  ).join("");
  box.hidden = false;
  box.querySelectorAll(".opt").forEach((el) =>
    el.addEventListener("mousedown", (e) => { e.preventDefault(); addSuggestedTag(el.getAttribute("data-tag")); }));
}
function addSuggestedTag(tag) {
  const { prefix } = segmentInfo();
  $("tags").value = prefix + tag + ", ";
  $("tagSuggest").hidden = true;
  $("tags").focus();
}

// ---------- list interactions ----------
async function toggle(id, field) {
  const b = state.items.find((x) => x.id === id);
  if (!b) return;
  const { status, data } = await api("PATCH", "/api/bookmarks/" + id, { [field]: !b[field] });
  if (status === 200) {
    const idx = state.items.findIndex((x) => x.id === id);
    state.items[idx] = data.bookmark;
    render();
  }
}
async function saveEdit(li, id) {
  const b = state.items.find((x) => x.id === id);
  if (!b) return;
  const err = li.querySelector(".ed-error");
  const changes = {
    url: li.querySelector(".ed-url").value.trim(),
    title: li.querySelector(".ed-title").value.trim(),
    description: li.querySelector(".ed-desc").value.trim(),
    tags: li.querySelector(".ed-tags").value,
    note: li.querySelector(".ed-note").value.trim(),
  };
  if (!changes.url) { err.textContent = "A web address is required."; return; }
  const { status, data } = await api("PATCH", "/api/bookmarks/" + id, changes);
  if (status === 200) {
    const idx = state.items.findIndex((x) => x.id === id);
    state.items[idx] = data.bookmark;
    state.editingId = null;
    render();
    flash("Changes saved.");
  } else if (status === 409) {
    const e = data.existing;
    err.textContent = "Another bookmark already uses that address" +
      (e && e.archived ? " (in Archived)" : e && e.readLater ? " (in Read later)" : "") + ".";
  } else if (status === 400) {
    err.textContent = "That doesn't look like a web address.";
  }
}

function onListClick(e) {
  const chip = e.target.closest(".tag.clickable");
  if (chip) { state.activeTag = chip.getAttribute("data-tag"); render(); return; }
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = Number(btn.getAttribute("data-id"));
  const act = btn.getAttribute("data-act");
  if (act === "later") return void toggle(id, "readLater");
  if (act === "archive") return void toggle(id, "archived");
  if (act === "edit") {
    state.editingId = id; render();
    const el = document.querySelector('li.bm-item[data-id="' + id + '"]');
    if (el) el.scrollIntoView({ block: "center" });
    return;
  }
  if (act === "edit-cancel") { state.editingId = null; render(); return; }
  if (act === "edit-save") { saveEdit(btn.closest("li"), id); return; }
}

// ---------- init ----------
async function init() {
  $("fetchBtn").addEventListener("click", onGetDetails);
  $("saveBtn").addEventListener("click", onSave);
  ["url", "title"].forEach((id) => $(id).addEventListener("input", refreshSaveState));
  $("tags").addEventListener("input", showSuggest);
  $("tags").addEventListener("keydown", (e) => {
    const box = $("tagSuggest");
    if (box.hidden) return;
    const opts = [...box.querySelectorAll(".opt")];
    let ai = parseInt(box.dataset.active || "-1", 10);
    if (e.key === "ArrowDown") { e.preventDefault(); ai = (ai + 1) % opts.length; }
    else if (e.key === "ArrowUp") { e.preventDefault(); ai = (ai - 1 + opts.length) % opts.length; }
    else if (e.key === "Enter" && ai >= 0) { e.preventDefault(); addSuggestedTag(opts[ai].getAttribute("data-tag")); return; }
    else return;
    box.dataset.active = ai;
    opts.forEach((o, i) => o.classList.toggle("active", i === ai));
  });
  $("tags").addEventListener("blur", () => setTimeout(() => { $("tagSuggest").hidden = true; }, 120));
  $("search").addEventListener("input", () => { state.query = $("search").value.trim().toLowerCase(); render(); });
  $("sort").addEventListener("change", () => { state.sortMode = $("sort").value; render(); });
  $("viewTabs").querySelectorAll("[data-view]").forEach((btn) =>
    btn.addEventListener("click", () => { state.view = btn.getAttribute("data-view"); render(); }));
  $("list").addEventListener("click", onListClick);

  const { data } = await api("GET", "/api/bookmarks");
  state.items = (data && data.items) || [];
  render();
  document.body.setAttribute("data-harness-ready", "true");
}

init();
