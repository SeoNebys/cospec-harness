const api = {
  list: (q = "", tag = "") =>
    fetch(`/api/bookmarks?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}`).then((r) => r.json()),
  add: (body) =>
    fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()),
  update: (id, body) =>
    fetch(`/api/bookmarks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()),
  remove: (id) => fetch(`/api/bookmarks/${id}`, { method: "DELETE" }),
  tags: () => fetch("/api/tags").then((r) => r.json()),
  import: (items) =>
    fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items),
    }).then((r) => r.json()),
};

let activeTag = "";

const $ = (sel) => document.querySelector(sel);
const listEl = $("#list");
const emptyEl = $("#empty");
const searchEl = $("#search");

function splitTags(str) {
  return (str || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function tagPill(name, active = false) {
  const el = document.createElement("span");
  el.className = "tag-pill" + (active ? " active" : "");
  el.textContent = name;
  el.dataset.tag = name;
  return el;
}

async function renderTags() {
  const tags = await api.tags();
  const cloud = $("#tag-cloud");
  cloud.innerHTML = "";
  if (activeTag) {
    const clear = tagPill("✕ clear filter", false);
    clear.dataset.tag = "";
    cloud.appendChild(clear);
  }
  for (const t of tags) {
    const pill = tagPill(`${t.name} (${t.count})`, t.name === activeTag);
    pill.dataset.tag = t.name;
    cloud.appendChild(pill);
  }
}

function bookmarkItem(b) {
  const li = document.createElement("li");
  li.className = "item";
  li.dataset.id = b.id;

  const img = document.createElement("img");
  img.className = "favicon";
  img.alt = "";
  img.src = b.favicon || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
  img.onerror = () => { img.style.visibility = "hidden"; };

  const body = document.createElement("div");
  body.className = "item-body";

  const a = document.createElement("a");
  a.className = "item-title";
  a.href = b.url;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = b.title || b.url;

  const url = document.createElement("div");
  url.className = "item-url";
  url.textContent = b.url;

  body.append(a, url);

  if (b.description) {
    const desc = document.createElement("p");
    desc.className = "item-desc";
    desc.textContent = b.description;
    body.appendChild(desc);
  }

  if (b.tags && b.tags.length) {
    const tagWrap = document.createElement("div");
    tagWrap.className = "item-tags";
    for (const t of b.tags) tagWrap.appendChild(tagPill(t));
    body.appendChild(tagWrap);
  }

  const actions = document.createElement("div");
  actions.className = "item-actions";
  const editBtn = document.createElement("button");
  editBtn.className = "icon-btn";
  editBtn.textContent = "Edit";
  editBtn.onclick = () => editBookmark(b);
  const delBtn = document.createElement("button");
  delBtn.className = "icon-btn danger";
  delBtn.textContent = "Delete";
  delBtn.onclick = () => deleteBookmark(b.id);
  actions.append(editBtn, delBtn);

  li.append(img, body, actions);
  return li;
}

async function refresh() {
  const items = await api.list(searchEl.value.trim(), activeTag);
  listEl.innerHTML = "";
  emptyEl.hidden = items.length > 0;
  for (const b of items) listEl.appendChild(bookmarkItem(b));
  await renderTags();
}

async function editBookmark(b) {
  const title = prompt("Title:", b.title);
  if (title === null) return;
  const description = prompt("Notes:", b.description || "");
  if (description === null) return;
  const tags = prompt("Tags (comma separated):", (b.tags || []).join(", "));
  if (tags === null) return;
  await api.update(b.id, { title, description, tags: splitTags(tags) });
  refresh();
}

async function deleteBookmark(id) {
  if (!confirm("Delete this bookmark?")) return;
  await api.remove(id);
  refresh();
}

$("#add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = $("#url").value.trim();
  if (!url) return;
  await api.add({
    url,
    title: $("#title").value.trim(),
    description: $("#description").value.trim(),
    tags: splitTags($("#tags").value),
  });
  e.target.reset();
  refresh();
});

let searchTimer;
searchEl.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refresh, 200);
});

$("#tag-cloud").addEventListener("click", (e) => {
  const pill = e.target.closest(".tag-pill");
  if (!pill) return;
  activeTag = pill.dataset.tag === activeTag ? "" : pill.dataset.tag;
  refresh();
});

listEl.addEventListener("click", (e) => {
  const pill = e.target.closest(".item-tags .tag-pill");
  if (!pill) return;
  activeTag = pill.dataset.tag;
  refresh();
});

$("#export-btn").addEventListener("click", () => {
  window.location.href = "/api/export";
});

$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const items = (Array.isArray(data) ? data : []).map((d) => ({
      url: d.url,
      title: d.title,
      description: d.description,
      tags: d.tags || [],
    }));
    const res = await api.import(items);
    alert(`Imported ${res.imported} bookmarks.`);
    refresh();
  } catch (err) {
    alert("Could not import: invalid JSON file.");
  }
  e.target.value = "";
});

refresh();
