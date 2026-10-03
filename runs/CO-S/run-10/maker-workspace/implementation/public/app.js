import { matchesQuery, inView, normalizeTag } from "./lib.js";

// ---- API ------------------------------------------------------------------
const api = {
  async list() {
    const r = await fetch("/api/bookmarks");
    return (await r.json()).bookmarks;
  },
  async create(url) {
    const r = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  },
  async patch(id, patch) {
    const r = await fetch(`/api/bookmarks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    return (await r.json()).bookmark;
  },
  async remove(id) {
    await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
  },
};

// ---- State ----------------------------------------------------------------
const state = {
  items: [],
  query: "",
  view: "all",
  editingId: null,
  draft: { title: "", description: "", note: "", tags: [] },
  sugIndex: -1,
  confirmDeleteId: null,
  flashId: null,
};

// ---- Elements -------------------------------------------------------------
const el = {
  url: document.getElementById("url"),
  saveBtn: document.getElementById("saveBtn"),
  status: document.getElementById("status"),
  statusAction: document.getElementById("statusAction"),
  searchBox: document.getElementById("searchBox"),
  search: document.getElementById("search"),
  clearSearch: document.getElementById("clearSearch"),
  tabs: document.getElementById("tabs"),
  countAll: document.getElementById("countAll"),
  countToread: document.getElementById("countToread"),
  countArchived: document.getElementById("countArchived"),
  listLabel: document.getElementById("listLabel"),
  list: document.getElementById("list"),
  stateEmpty: document.getElementById("stateEmpty"),
  stateEmptyMsg: document.getElementById("stateEmptyMsg"),
  welcome: document.getElementById("welcome"),
  loading: document.getElementById("loading"),
};

// ---- Helpers --------------------------------------------------------------
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function highlight(text, q) {
  const out = escapeHtml(text);
  const terms = q.split(/\s+/).filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return out;
  return out.replace(new RegExp("(" + terms.join("|") + ")", "gi"), "<mark>$1</mark>");
}

// Render a note's light formatting: bullet lists ("- ") and [text](url) links.
function renderNote(src, q) {
  const lines = String(src || "").split(/\r?\n/);
  let html = "";
  let i = 0;
  const inline = (t) =>
    highlight(t, q).replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_, label, url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${label}</a>`
    );
  while (i < lines.length) {
    if (/^\s*-\s+/.test(lines[i])) {
      html += "<ul>";
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        html += "<li>" + inline(lines[i].replace(/^\s*-\s+/, "")) + "</li>";
        i++;
      }
      html += "</ul>";
    } else if (lines[i].trim() === "") {
      i++;
    } else {
      html += "<p>" + inline(lines[i]) + "</p>";
      i++;
    }
  }
  return html;
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " h ago";
  return Math.floor(h / 24) + " d ago";
}

function allTags() {
  const set = new Set();
  state.items.forEach((b) => (b.tags || []).forEach((t) => set.add(t)));
  return [...set].sort();
}

function setStatus(msg, cls) {
  el.status.textContent = msg;
  el.status.className = "status " + (cls || "");
  el.statusAction.hidden = true;
  el.statusAction.onclick = null;
}

async function reload() {
  state.items = await api.list();
}

// ---- Rendering ------------------------------------------------------------
function render() {
  const q = state.query.trim().toLowerCase();
  el.loading.hidden = true;

  el.countAll.textContent = state.items.filter((b) => !b.archived).length;
  el.countToread.textContent = state.items.filter((b) => !b.archived && b.toRead).length;
  el.countArchived.textContent = state.items.filter((b) => b.archived).length;

  // No bookmarks at all -> welcome state; hide search & tabs (SCN-010).
  if (state.items.length === 0) {
    el.list.innerHTML = "";
    el.welcome.hidden = false;
    el.stateEmpty.hidden = true;
    el.searchBox.hidden = true;
    el.tabs.hidden = true;
    el.listLabel.hidden = true;
    return;
  }

  el.welcome.hidden = true;
  el.searchBox.hidden = false;
  el.tabs.hidden = false;
  el.clearSearch.hidden = !q;
  [...el.tabs.querySelectorAll("button")].forEach((b) =>
    b.classList.toggle("on", b.dataset.view === state.view)
  );

  const visible = state.items.filter((b) => inView(b, state.view) && (q ? matchesQuery(b, q) : true));

  if (visible.length === 0) {
    el.list.innerHTML = "";
    el.listLabel.hidden = true;
    el.stateEmpty.hidden = false;
    if (q) {
      el.stateEmpty.querySelector(".big").textContent = "No matching links";
      el.stateEmptyMsg.textContent = `Nothing matched “${state.query.trim()}”.`;
    } else {
      el.stateEmpty.querySelector(".big").textContent =
        state.view === "toread" ? "Nothing to read" : state.view === "archived" ? "Nothing archived" : "No links here";
      el.stateEmptyMsg.textContent =
        state.view === "toread" ? "Nothing marked to read right now."
        : state.view === "archived" ? "Nothing archived yet."
        : "No links here yet.";
    }
    return;
  }

  el.stateEmpty.hidden = true;
  el.listLabel.hidden = false;
  const base = state.view === "toread" ? "To read" : state.view === "archived" ? "Archived links" : "Saved links";
  el.listLabel.textContent = q ? `${visible.length} matching link${visible.length > 1 ? "s" : ""}` : base;

  el.list.innerHTML = "";
  visible.forEach((b) => el.list.appendChild(renderItem(b, q)));
  wireItems();
}

function renderItem(b, q) {
  const li = document.createElement("li");
  li.className =
    "item" + (b.toRead && !b.archived ? " is-toread" : "") + (b.archived ? " is-archived" : "") + (state.flashId === b.id ? " flash" : "");

  const initial = (b.site || b.host || "?").charAt(0).toUpperCase();
  const tagsHtml = b.tags && b.tags.length
    ? `<div class="tags">${b.tags.map((t) => `<span class="tag">${highlight(t, q)}</span>`).join("")}</div>`
    : "";
  const noteHtml = b.note ? `<div class="note">${renderNote(b.note, q)}</div>` : "";

  let body = `
    <p class="title"><a href="${escapeHtml(b.url)}" target="_blank" rel="noopener">${highlight(b.title, q)}</a></p>
    <div class="meta">
      <span class="favicon">${escapeHtml(initial)}</span>
      <span>${highlight(b.site || b.host, q)}</span><span>·</span>
      <span>${highlight(b.host, q)}</span><span>·</span>
      <span>saved ${timeAgo(b.savedAt)}</span>
    </div>
    ${b.description ? `<p class="desc">${highlight(b.description, q)}</p>` : ""}
    ${tagsHtml}${noteHtml}`;

  if (state.editingId === b.id) {
    body += editorHtml(b);
  } else if (state.confirmDeleteId === b.id) {
    body += `<div class="confirm">
      <span>Delete this link permanently? This can't be undone.</span>
      <button class="danger-btn" data-delete-confirm="${b.id}">Delete</button>
      <button class="muted-btn" data-delete-cancel="1">Cancel</button>
    </div>`;
  } else if (b.archived) {
    body += `<div class="item-actions">
      <button class="muted-btn" data-restore="${b.id}">↩ Restore</button>
      <button class="danger-btn" data-delete="${b.id}">🗑 Delete</button>
    </div>`;
  } else {
    body += `<div class="item-actions">
      <button class="link-btn" data-edit="${b.id}">${(b.tags && b.tags.length) || b.note ? "Edit tags & note" : "＋ Add tags & note"}</button>
      <button class="toread-btn ${b.toRead ? "on" : ""}" data-toread="${b.id}">${b.toRead ? "★ Marked to read" : "☆ Read later"}</button>
      <button class="muted-btn" data-archive="${b.id}">🗄 Archive</button>
      <button class="danger-btn" data-delete="${b.id}">🗑 Delete</button>
      ${b.toRead ? `<span class="toread-flag">To read</span>` : ""}
    </div>`;
  }
  li.innerHTML = body;
  return li;
}

function editorHtml(b) {
  const d = state.draft;
  const chips = d.tags
    .map((t) => `<span class="editable-tag">${escapeHtml(t)}<button type="button" data-remove="${escapeHtml(t)}">✕</button></span>`)
    .join("");
  return `<div class="editor">
    <div class="field"><label>Title</label>
      <input class="text-input" id="titleEntry" value="${escapeHtml(d.title)}" placeholder="Name this link so you'll recognise it"></div>
    <div class="field"><label>Description</label>
      <textarea id="descEntry" rows="2" placeholder="A short summary (optional)">${escapeHtml(d.description)}</textarea></div>
    <div class="field"><label>Tags</label>
      <div class="chip-input" id="chipInput">${chips}<input id="chipEntry" placeholder="Type a tag, press Enter" autocomplete="off"></div>
      <div class="suggest" id="suggest" hidden></div>
      <div class="hint">Press Enter or comma to add. Tags you've used before are suggested.</div></div>
    <div class="field"><label>Note</label>
      <textarea id="noteEntry" rows="3" placeholder="Add a note…">${escapeHtml(d.note)}</textarea>
      <div class="hint">Formatting: start a line with “- ” for a bullet list; write a link as [text](https://…).</div></div>
    <div class="editor-actions">
      <button class="save-edit" data-save="${b.id}">Save</button>
      <button class="cancel-edit" data-cancel="1">Cancel</button>
    </div>
  </div>`;
}

// ---- Editor behaviour -----------------------------------------------------
function openEditor(id) {
  const b = state.items.find((x) => x.id === id);
  if (!b) return;
  state.editingId = id;
  state.confirmDeleteId = null;
  state.draft = { title: b.title || "", description: b.description || "", note: b.note || "", tags: (b.tags || []).slice() };
  state.sugIndex = -1;
  render();
  const t = document.getElementById("titleEntry");
  if (t) { t.focus(); t.select(); }
}

function closeEditor() {
  state.editingId = null;
  state.sugIndex = -1;
  render();
}

function syncDrafts() {
  const t = document.getElementById("titleEntry");
  const d = document.getElementById("descEntry");
  const n = document.getElementById("noteEntry");
  if (t) state.draft.title = t.value;
  if (d) state.draft.description = d.value;
  if (n) state.draft.note = n.value;
}

function addDraftTag(raw) {
  const t = normalizeTag(raw);
  if (t && !state.draft.tags.includes(t)) state.draft.tags.push(t);
}

function suggestions(prefix) {
  const p = normalizeTag(prefix);
  if (!p) return [];
  return allTags().filter((t) => t.includes(p) && !state.draft.tags.includes(t)).slice(0, 6);
}

function renderSuggest() {
  const box = document.getElementById("suggest");
  const entry = document.getElementById("chipEntry");
  if (!box || !entry) return;
  const list = suggestions(entry.value);
  if (list.length === 0) { box.hidden = true; state.sugIndex = -1; return; }
  box.hidden = false;
  box.innerHTML = list
    .map((t, i) => `<button type="button" data-sug="${escapeHtml(t)}" class="${i === state.sugIndex ? "active" : ""}">${escapeHtml(t)}</button>`)
    .join("");
  box.querySelectorAll("[data-sug]").forEach((btnEl) => {
    btnEl.onmousedown = (e) => {
      e.preventDefault();
      syncDrafts();
      const en = document.getElementById("chipEntry");
      if (en) en.value = "";
      addDraftTag(btnEl.dataset.sug);
      render();
      focusChip();
    };
  });
}

function focusChip() {
  setTimeout(() => { const en = document.getElementById("chipEntry"); if (en) en.focus(); }, 0);
}

async function saveEditor(id) {
  syncDrafts();
  const entry = document.getElementById("chipEntry");
  if (entry && entry.value.trim()) addDraftTag(entry.value);
  await api.patch(id, {
    title: state.draft.title,
    description: state.draft.description,
    note: state.draft.note,
    tags: state.draft.tags,
  });
  state.editingId = null;
  await reload();
  render();
}

// ---- Event wiring ---------------------------------------------------------
function wireItems() {
  el.list.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => openEditor(Number(b.dataset.edit))));
  el.list.querySelectorAll("[data-cancel]").forEach((b) => (b.onclick = closeEditor));
  el.list.querySelectorAll("[data-save]").forEach((b) => (b.onclick = () => saveEditor(Number(b.dataset.save))));
  el.list.querySelectorAll("[data-remove]").forEach((b) => (b.onclick = () => { syncDrafts(); state.draft.tags = state.draft.tags.filter((t) => t !== b.dataset.remove); render(); focusChip(); }));

  el.list.querySelectorAll("[data-toread]").forEach((b) => (b.onclick = async () => {
    const item = state.items.find((x) => x.id === Number(b.dataset.toread));
    await api.patch(item.id, { toRead: !item.toRead });
    await reload();
    render();
  }));
  el.list.querySelectorAll("[data-archive]").forEach((b) => (b.onclick = async () => {
    await api.patch(Number(b.dataset.archive), { archived: true });
    await reload();
    render();
  }));
  el.list.querySelectorAll("[data-restore]").forEach((b) => (b.onclick = async () => {
    await api.patch(Number(b.dataset.restore), { archived: false });
    await reload();
    render();
  }));
  el.list.querySelectorAll("[data-delete]").forEach((b) => (b.onclick = () => { state.confirmDeleteId = Number(b.dataset.delete); render(); }));
  el.list.querySelectorAll("[data-delete-cancel]").forEach((b) => (b.onclick = () => { state.confirmDeleteId = null; render(); }));
  el.list.querySelectorAll("[data-delete-confirm]").forEach((b) => (b.onclick = async () => {
    await api.remove(Number(b.dataset.deleteConfirm));
    state.confirmDeleteId = null;
    await reload();
    render();
  }));

  if (state.editingId != null) {
    const entry = document.getElementById("chipEntry");
    if (entry) {
      entry.oninput = () => { state.sugIndex = -1; renderSuggest(); };
      entry.onkeydown = (e) => {
        const list = suggestions(entry.value);
        if (e.key === "ArrowDown" && list.length) { e.preventDefault(); state.sugIndex = (state.sugIndex + 1) % list.length; renderSuggest(); }
        else if (e.key === "ArrowUp" && list.length) { e.preventDefault(); state.sugIndex = (state.sugIndex - 1 + list.length) % list.length; renderSuggest(); }
        else if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          syncDrafts();
          if (state.sugIndex >= 0 && list[state.sugIndex]) addDraftTag(list[state.sugIndex]);
          else if (entry.value.trim()) addDraftTag(entry.value);
          entry.value = "";
          state.sugIndex = -1;
          render();
          focusChip();
        } else if (e.key === "Backspace" && !entry.value && state.draft.tags.length) {
          syncDrafts();
          state.draft.tags.pop();
          render();
          focusChip();
        } else if (e.key === "Escape") {
          const box = document.getElementById("suggest");
          if (box) box.hidden = true;
          state.sugIndex = -1;
        }
      };
    }
  }
}

// ---- Save (create) --------------------------------------------------------
async function save() {
  const raw = el.url.value.trim();
  if (!raw) { setStatus("Please paste a link first.", "error"); return; }
  el.saveBtn.disabled = true;
  setStatus("Fetching details…", "saving");
  try {
    const { status, body } = await api.create(raw);
    if (status === 201) {
      await reload();
      state.view = "all";
      state.query = ""; el.search.value = "";
      el.url.value = "";
      render();
      setStatus("Saved — details filled in automatically.", "saved");
      setTimeout(() => { if (el.status.classList.contains("saved")) setStatus("", ""); }, 2500);
      el.url.focus();
    } else if (status === 400) {
      setStatus(body.message || "That doesn't look like a valid link.", "error");
    } else if (status === 409) {
      await reload();
      const existing = body.existing;
      state.query = ""; el.search.value = "";
      state.view = body.archived ? "archived" : "all";
      state.flashId = existing ? existing.id : null;
      el.url.value = "";
      render();
      if (body.archived) {
        setStatus("You already saved this — it's in your Archived list.", "error");
      } else {
        setStatus("You already saved this link.", "error");
        el.statusAction.hidden = false;
        el.statusAction.textContent = "Edit this bookmark →";
        el.statusAction.onclick = () => { setStatus("", ""); if (existing) openEditor(existing.id); };
      }
      setTimeout(() => { state.flashId = null; render(); }, 1700);
    } else {
      setStatus("Something went wrong saving that link.", "error");
    }
  } catch {
    setStatus("Couldn't reach the server. Please try again.", "error");
  } finally {
    el.saveBtn.disabled = false;
  }
}

// ---- Global wiring & init -------------------------------------------------
el.saveBtn.onclick = save;
el.url.onkeydown = (e) => { if (e.key === "Enter") save(); };
el.search.oninput = (e) => { state.query = e.target.value; render(); };
el.clearSearch.onclick = () => { state.query = ""; el.search.value = ""; el.search.focus(); render(); };
el.tabs.querySelectorAll("button").forEach((b) => (b.onclick = () => { state.view = b.dataset.view; render(); }));

(async function init() {
  try {
    await reload();
  } catch {
    setStatus("Couldn't load your bookmarks. Please refresh.", "error");
  }
  render();
  document.body.setAttribute("data-harness-ready", "true");
})();
