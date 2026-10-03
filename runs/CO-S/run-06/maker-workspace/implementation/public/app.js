// Frontend for the bookmark manager. Talks to the JSON API in src/app.js.
// Behaviour follows the approved scenarios SCN-001..SCN-007.

const $ = (id) => document.getElementById(id);
const api = {
  async metadata(url) {
    return fetchJson("/api/metadata", { method: "POST", body: { url } });
  },
  async list(view, q, tag) {
    const p = new URLSearchParams({ view });
    if (q) p.set("q", q);
    if (tag) p.set("tag", tag);
    return fetchJson("/api/bookmarks?" + p.toString());
  },
  async create(data) {
    return fetchJson("/api/bookmarks", { method: "POST", body: data });
  },
  async update(id, data) {
    return fetchJson("/api/bookmarks/" + id, { method: "PUT", body: data });
  },
  async setLater(id, later) {
    return fetchJson(`/api/bookmarks/${id}/later`, { method: "POST", body: { later } });
  },
  async setArchived(id, archived) {
    return fetchJson(`/api/bookmarks/${id}/archive`, { method: "POST", body: { archived } });
  },
};

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, ok: res.ok, data };
}

// ---- client state ----
let view = "all";
let activeTag = "";
let editingId = null;
let draftTags = [];
let currentUrl = "";

const EMPTY_MSG = {
  all: "No bookmarks yet — paste a link above to save your first one.",
  later: 'Nothing in your read-later list. Mark a bookmark "Read later" to add it.',
  archive: "Your archive is empty. Archive a bookmark to keep it here without cluttering the main list.",
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
function domainOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1700);
}

// ---- save / edit editor ----
function openEditor({ url, title, note, tags, editing, failed }) {
  currentUrl = url || "";
  editingId = editing || null;
  draftTags = Array.isArray(tags) ? [...tags] : [];
  $("title").value = title || "";
  $("note").value = note || "";
  $("tagInput").value = "";
  renderDraftTags();
  $("editBanner").hidden = !editing;
  $("failBanner").hidden = !failed;
  $("saveBtn").textContent = editing ? "Update bookmark" : "Save bookmark";
  $("editor").hidden = false;
  $("dupWarn").hidden = true;
}
function closeEditor() {
  editingId = null;
  draftTags = [];
  currentUrl = "";
  $("editor").hidden = true;
  $("dupWarn").hidden = true;
  $("url").value = "";
}
function renderDraftTags() {
  const el = $("tagChips");
  el.innerHTML = "";
  draftTags.forEach((t, i) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = esc(t) + ' <button type="button" class="x" aria-label="remove tag">×</button>';
    chip.querySelector(".x").onclick = () => { draftTags.splice(i, 1); renderDraftTags(); };
    el.appendChild(chip);
  });
}

async function onFetch() {
  const raw = $("url").value.trim();
  if (!raw) { toast("Paste a link first"); return; }
  const { status, data } = await api.metadata(raw);
  if (status === 400) { toast("That doesn't look like a valid link"); return; }
  if (!data) { toast("Something went wrong"); return; }
  if (data.duplicate) {
    showDuplicate(data.duplicate);
    return;
  }
  openEditor({
    url: data.url,
    title: data.title,
    note: "",
    tags: [],
    editing: null,
    failed: !data.fetched,
  });
}

function showDuplicate(dup) {
  const where = dup.location === "archive" ? "your Archive"
    : dup.location === "later" ? "your Read later list" : "your bookmarks";
  $("dupMsg").innerHTML =
    "You've already saved <b>" + esc(dup.title) + "</b> (" + where +
    "). Rather than making a copy, you can edit the existing one.";
  $("dupWarn").dataset.id = dup.id;
  $("editor").hidden = true;
  $("dupWarn").hidden = false;
}

async function onSave(e) {
  e.preventDefault();
  const payload = {
    title: $("title").value,
    note: $("note").value,
    tags: draftTags,
  };
  if (editingId) {
    const { ok } = await api.update(editingId, payload);
    if (ok) { toast("Updated"); closeEditor(); refresh(); }
    return;
  }
  const { status, data } = await api.create({ url: currentUrl, ...payload });
  if (status === 201) { toast("Saved"); closeEditor(); refresh(); return; }
  if (status === 409 && data && data.existing) { showDuplicate(data.existing); return; }
  toast("Couldn't save that");
}

function startEditExisting(item) {
  openEditor({
    url: item.url,
    title: item.title,
    note: item.note,
    tags: item.tags,
    editing: item.id,
    failed: false,
  });
  $("saveCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---- list rendering ----
async function refresh() {
  const q = $("search").value.trim();
  const { data } = await api.list(view, q, activeTag);
  renderTabs();
  renderFilterChips(data ? data.tags : []);
  renderItems(data ? data.items : [], q);
}

function renderTabs() {
  document.querySelectorAll(".tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view)
  );
}

function renderFilterChips(tags) {
  const el = $("filterChips");
  el.innerHTML = "";
  tags.forEach((t) => {
    const chip = document.createElement("span");
    chip.className = "chip" + (activeTag === t ? " active" : "");
    chip.textContent = "#" + t;
    chip.onclick = () => { activeTag = activeTag === t ? "" : t; refresh(); };
    el.appendChild(chip);
  });
  const af = $("activeFilter");
  if (activeTag) {
    af.hidden = false;
    af.innerHTML = "Filtering by <b>#" + esc(activeTag) + "</b> — click the tag again to clear.";
  } else {
    af.hidden = true;
  }
}

const VIEW_LABEL = { all: "Saved", later: "Read later", archive: "Archive" };

function renderItems(items, q) {
  const el = $("items");
  const filtering = !!(q || activeTag);
  $("listHeading").textContent = filtering ? "Results (" + items.length + ")" : VIEW_LABEL[view];
  if (items.length === 0) {
    el.innerHTML = '<div class="empty">' +
      (filtering ? "No bookmarks match your search." : EMPTY_MSG[view]) + "</div>";
    return;
  }
  el.innerHTML = "";
  items.forEach((it) => el.appendChild(renderItem(it)));
}

function renderItem(it) {
  const d = domainOf(it.url);
  const div = document.createElement("div");
  div.className = "item";
  const badge = it.later && !it.archived && view !== "later"
    ? '<span class="badge">Read later</span>' : "";
  div.innerHTML =
    '<div class="fav">' + (d.charAt(0).toUpperCase() || "?") + "</div>" +
    '<div class="body">' +
      '<div class="title"><a href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
        esc(it.title) + "</a>" + badge + "</div>" +
      '<div class="url">' + esc(it.url) + "</div>" +
      (it.note ? '<div class="note">' + esc(it.note) + "</div>" : "") +
      (it.tags.length ? '<div class="chips itemtags">' +
        it.tags.map((t) => '<span class="chip">' + esc(t) + "</span>").join("") + "</div>" : "") +
      '<div class="itemactions"></div>' +
    "</div>";
  const acts = div.querySelector(".itemactions");
  if (it.archived) {
    acts.appendChild(button("Restore to All", async () => {
      await api.setArchived(it.id, false); toast("Restored"); refresh();
    }));
  } else {
    const lb = button(it.later ? "★ In read later" : "☆ Read later", async () => {
      await api.setLater(it.id, !it.later); refresh();
    }, it.later ? "small on" : "small");
    acts.appendChild(lb);
    acts.appendChild(button("Edit", () => startEditExisting(it), "small"));
    acts.appendChild(button("Archive", async () => {
      await api.setArchived(it.id, true); toast("Archived"); refresh();
    }, "small"));
  }
  return div;
}

function button(label, fn, cls = "small") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn " + cls;
  b.textContent = label;
  b.onclick = fn;
  return b;
}

// ---- wire up ----
$("fetchBtn").onclick = onFetch;
$("url").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); onFetch(); } });
$("editor").addEventListener("submit", onSave);
$("cancelBtn").onclick = closeEditor;
$("dupCancelBtn").onclick = () => { $("dupWarn").hidden = true; $("url").value = ""; };
$("dupEditBtn").onclick = async () => {
  const id = Number($("dupWarn").dataset.id);
  const { data } = await api.list("all");
  // fetch across all views to locate the item
  let item = (data && data.items || []).find((x) => x.id === id);
  for (const v of ["later", "archive"]) {
    if (item) break;
    const r = await api.list(v);
    item = (r.data && r.data.items || []).find((x) => x.id === id);
  }
  if (item) startEditExisting(item);
};
$("tagInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const v = e.target.value.trim().replace(/,$/, "").replace(/^#/, "");
    if (v && !draftTags.some((t) => t.toLowerCase() === v.toLowerCase())) {
      draftTags.push(v); renderDraftTags();
    }
    e.target.value = "";
  }
});
$("search").addEventListener("input", () => refresh());
document.querySelectorAll(".tab").forEach((b) => {
  b.onclick = () => { view = b.dataset.view; activeTag = ""; $("search").value = ""; refresh(); };
});

// initial load
refresh().then(() => {
  document.body.setAttribute("data-harness-ready", "true");
});
