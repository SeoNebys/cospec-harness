"use strict";

const state = {
  q: "",
  tag: "",
  editingId: null, // null = creating, number = editing
};

const $ = (sel) => document.querySelector(sel);

const els = {
  search: $("#search"),
  tagList: $("#tag-list"),
  bookmarkList: $("#bookmark-list"),
  empty: $("#empty"),
  activeFilter: $("#active-filter"),
  addBtn: $("#add-btn"),
  dialog: $("#editor"),
  form: $("#editor-form"),
  editorTitle: $("#editor-title"),
  url: $("#f-url"),
  title: $("#f-title"),
  description: $("#f-description"),
  tags: $("#f-tags"),
  cancelBtn: $("#cancel-btn"),
  saveBtn: $("#save-btn"),
};

// --------------------------------------------------------------------------- //
// API
// --------------------------------------------------------------------------- //
async function api(path, opts = {}) {
  const resp = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      detail = (await resp.json()).detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return resp.status === 204 ? null : resp.json();
}

const parseTags = (str) =>
  str
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

// --------------------------------------------------------------------------- //
// Rendering
// --------------------------------------------------------------------------- //
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c) node.append(c);
  });
  return node;
}

function renderBookmark(b) {
  const titleLink = el("a", {
    class: "title",
    href: b.url,
    target: "_blank",
    rel: "noopener noreferrer",
    text: b.title || b.url,
  });

  const url = el("span", { class: "url", text: b.url });

  const actions = el("div", { class: "row-actions" }, [
    el("button", { text: "Edit", onclick: () => openEditor(b) }),
    el("button", {
      class: "del",
      text: "Delete",
      onclick: () => removeBookmark(b),
    }),
  ]);

  const top = el("div", { class: "top" }, [
    el("div", {}, [titleLink, url]),
    actions,
  ]);

  const children = [top];
  if (b.description) {
    children.push(el("p", { class: "desc", text: b.description }));
  }
  if (b.tags.length) {
    const tags = el(
      "div",
      { class: "tags" },
      b.tags.map((t) =>
        el("span", { class: "tag", text: "#" + t, onclick: () => selectTag(t) })
      )
    );
    children.push(tags);
  }
  return el("li", { class: "bookmark" }, children);
}

async function loadBookmarks() {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.tag) params.set("tag", state.tag);
  const items = await api("/api/bookmarks?" + params.toString());

  els.bookmarkList.replaceChildren(...items.map(renderBookmark));
  const nothing = items.length === 0;
  els.empty.classList.toggle("hidden", !nothing);
  if (nothing && (state.q || state.tag)) {
    els.empty.textContent = "No bookmarks match your filters.";
  } else {
    els.empty.textContent = "No bookmarks yet. Add your first one!";
  }

  renderActiveFilter();
}

async function loadTags() {
  const tags = await api("/api/tags");
  els.tagList.replaceChildren(
    ...tags.map((t) =>
      el(
        "li",
        {
          class: t.name === state.tag ? "active" : "",
          onclick: () => selectTag(t.name),
        },
        [el("span", { text: "#" + t.name }), el("span", { class: "count", text: t.count })]
      )
    )
  );
}

function renderActiveFilter() {
  if (!state.tag) {
    els.activeFilter.classList.add("hidden");
    return;
  }
  els.activeFilter.classList.remove("hidden");
  els.activeFilter.replaceChildren(
    el("span", { text: `Filtering by #${state.tag}` }),
    el("button", { text: "Clear", onclick: () => selectTag(state.tag) })
  );
}

// --------------------------------------------------------------------------- //
// Actions
// --------------------------------------------------------------------------- //
function selectTag(tag) {
  // clicking the active tag clears it (toggle)
  state.tag = state.tag === tag ? "" : tag;
  refresh();
}

async function removeBookmark(b) {
  if (!confirm(`Delete "${b.title || b.url}"?`)) return;
  await api(`/api/bookmarks/${b.id}`, { method: "DELETE" });
  await refresh();
}

function openEditor(bookmark = null) {
  state.editingId = bookmark ? bookmark.id : null;
  els.editorTitle.textContent = bookmark ? "Edit bookmark" : "Add bookmark";
  els.url.value = bookmark ? bookmark.url : "";
  els.title.value = bookmark ? bookmark.title : "";
  els.description.value = bookmark ? bookmark.description : "";
  els.tags.value = bookmark ? bookmark.tags.join(", ") : "";
  els.dialog.showModal();
  els.url.focus();
}

async function submitEditor(evt) {
  evt.preventDefault();
  const payload = {
    url: els.url.value,
    title: els.title.value,
    description: els.description.value,
    tags: parseTags(els.tags.value),
  };
  if (!payload.url.trim()) {
    els.url.focus();
    return;
  }

  els.saveBtn.disabled = true;
  els.saveBtn.textContent = "Saving…";
  try {
    if (state.editingId === null) {
      await api("/api/bookmarks", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } else {
      await api(`/api/bookmarks/${state.editingId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    }
    els.dialog.close();
    await refresh();
  } catch (err) {
    alert("Could not save: " + err.message);
  } finally {
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = "Save";
  }
}

async function refresh() {
  await Promise.all([loadBookmarks(), loadTags()]);
}

// --------------------------------------------------------------------------- //
// Wiring
// --------------------------------------------------------------------------- //
let searchTimer;
els.search.addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  const value = e.target.value;
  searchTimer = setTimeout(() => {
    state.q = value.trim();
    loadBookmarks();
  }, 200);
});

els.addBtn.addEventListener("click", () => openEditor());
els.cancelBtn.addEventListener("click", () => els.dialog.close());
els.form.addEventListener("submit", submitEditor);

refresh();
