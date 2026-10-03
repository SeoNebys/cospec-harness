const form = document.getElementById("bookmark-form");
const listEl = document.getElementById("bookmark-list");
const emptyEl = document.getElementById("empty");
const searchEl = document.getElementById("search");
const countEl = document.getElementById("count");
const tagFiltersEl = document.getElementById("tag-filters");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const editIdEl = document.getElementById("edit-id");

let bookmarks = [];
let activeTag = null;

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Request failed");
  }
  return res.status === 204 ? null : res.json();
}

async function loadBookmarks() {
  bookmarks = await api("GET", "/api/bookmarks");
  render();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function render() {
  const q = searchEl.value.trim().toLowerCase();
  let filtered = bookmarks.filter((b) => {
    const matchesQuery =
      !q ||
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q) ||
      b.tags.some((t) => t.toLowerCase().includes(q));
    const matchesTag = !activeTag || b.tags.includes(activeTag);
    return matchesQuery && matchesTag;
  });

  renderTagFilters();

  countEl.textContent =
    `${filtered.length} of ${bookmarks.length} bookmark${bookmarks.length === 1 ? "" : "s"}`;

  emptyEl.hidden = filtered.length !== 0;
  listEl.innerHTML = filtered.map(bookmarkHtml).join("");

  listEl.querySelectorAll(".del").forEach((btn) =>
    btn.addEventListener("click", () => remove(btn.dataset.id))
  );
  listEl.querySelectorAll(".edit").forEach((btn) =>
    btn.addEventListener("click", () => startEdit(btn.dataset.id))
  );
}

function renderTagFilters() {
  const tags = [...new Set(bookmarks.flatMap((b) => b.tags))].sort();
  tagFiltersEl.innerHTML = tags
    .map(
      (t) =>
        `<span class="tag-chip ${t === activeTag ? "active" : ""}" data-tag="${esc(t)}">${esc(t)}</span>`
    )
    .join("");
  tagFiltersEl.querySelectorAll(".tag-chip").forEach((chip) =>
    chip.addEventListener("click", () => {
      activeTag = activeTag === chip.dataset.tag ? null : chip.dataset.tag;
      render();
    })
  );
}

function bookmarkHtml(b) {
  const tags = b.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  return `
    <li class="bookmark">
      <div class="bookmark-title"><a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title)}</a></div>
      <div class="bookmark-url">${esc(b.url)}</div>
      ${b.description ? `<p class="bookmark-desc">${esc(b.description)}</p>` : ""}
      ${tags ? `<div class="bookmark-tags">${tags}</div>` : ""}
      <div class="bookmark-actions">
        <button class="edit" data-id="${b.id}">Edit</button>
        <button class="del" data-id="${b.id}">Delete</button>
      </div>
    </li>`;
}

function startEdit(id) {
  const b = bookmarks.find((x) => x.id === id);
  if (!b) return;
  editIdEl.value = b.id;
  document.getElementById("url").value = b.url;
  document.getElementById("title").value = b.title;
  document.getElementById("description").value = b.description;
  document.getElementById("tags").value = b.tags.join(", ");
  formTitle.textContent = "Edit bookmark";
  submitBtn.textContent = "Update";
  cancelBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  form.reset();
  editIdEl.value = "";
  formTitle.textContent = "Add bookmark";
  submitBtn.textContent = "Save";
  cancelBtn.hidden = true;
}

async function remove(id) {
  if (!confirm("Delete this bookmark?")) return;
  await api("DELETE", `/api/bookmarks/${id}`);
  await loadBookmarks();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    url: document.getElementById("url").value,
    title: document.getElementById("title").value,
    description: document.getElementById("description").value,
    tags: document.getElementById("tags").value,
  };
  try {
    const id = editIdEl.value;
    if (id) await api("PUT", `/api/bookmarks/${id}`, payload);
    else await api("POST", "/api/bookmarks", payload);
    resetForm();
    await loadBookmarks();
  } catch (err) {
    alert(err.message);
  }
});

cancelBtn.addEventListener("click", resetForm);
searchEl.addEventListener("input", render);

loadBookmarks()
  .catch((err) => alert(err.message))
  .finally(() => document.body.setAttribute("data-harness-ready", "true"));
