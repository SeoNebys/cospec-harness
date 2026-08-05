const form = document.getElementById("add-form");
const urlInput = document.getElementById("url-input");
const titleInput = document.getElementById("title-input");
const tagsInput = document.getElementById("tags-input");
const noteInput = document.getElementById("note-input");
const listEl = document.getElementById("bookmark-list");
const emptyEl = document.getElementById("empty-state");
const noResultsEl = document.getElementById("no-results");
const messageEl = document.getElementById("message");
const searchInput = document.getElementById("search-input");
const tagFilter = document.getElementById("tag-filter");

const editDialog = document.getElementById("edit-dialog");
const editForm = document.getElementById("edit-form");
const editUrl = document.getElementById("edit-url");
const editTitle = document.getElementById("edit-title");
const editTags = document.getElementById("edit-tags");
const editNote = document.getElementById("edit-note");
const editMessage = document.getElementById("edit-message");
const editCancel = document.getElementById("edit-cancel");

let editingId = null;

function showMessage(text, kind) {
  messageEl.textContent = text;
  messageEl.className = `message ${kind}`;
  messageEl.hidden = false;
}

function clearMessage() {
  messageEl.hidden = true;
  messageEl.textContent = "";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseTags(value) {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function renderBookmarks(bookmarks) {
  const searching = Boolean(searchInput.value.trim() || tagFilter.value);
  listEl.innerHTML = "";
  emptyEl.hidden = bookmarks.length > 0 || searching;
  noResultsEl.hidden = !(bookmarks.length === 0 && searching);

  for (const b of bookmarks) {
    const li = document.createElement("li");
    li.className = "bookmark";

    const tagsHtml = (b.tags || [])
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");
    const noteHtml = b.note ? `<p class="note">${escapeHtml(b.note)}</p>` : "";

    li.innerHTML = `
      <div class="bookmark-main">
        <a class="title" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          b.title
        )}</a>
        <span class="url">${escapeHtml(b.url)}</span>
        ${noteHtml}
        <div class="tags">${tagsHtml}</div>
      </div>
      <div class="bookmark-actions">
        <button class="edit-btn" type="button">Edit</button>
        <button class="delete-btn" type="button">Delete</button>
      </div>
    `;

    li.querySelector(".edit-btn").addEventListener("click", () => openEdit(b));
    li.querySelector(".delete-btn").addEventListener("click", () => deleteBookmark(b));
    listEl.appendChild(li);
  }
}

async function loadTags() {
  const res = await fetch("/api/tags");
  const data = await res.json();
  const current = tagFilter.value;
  tagFilter.innerHTML = '<option value="">All tags</option>';
  for (const name of data.tags || []) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    tagFilter.appendChild(opt);
  }
  tagFilter.value = current;
}

async function loadBookmarks() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
  if (tagFilter.value) params.set("tag", tagFilter.value);
  const res = await fetch(`/api/bookmarks?${params.toString()}`);
  const data = await res.json();
  renderBookmarks(data.bookmarks || []);
}

async function refresh() {
  await Promise.all([loadBookmarks(), loadTags()]);
}

async function saveBookmark({ confirmDuplicate = false } = {}) {
  const payload = {
    url: urlInput.value.trim(),
    title: titleInput.value.trim(),
    tags: parseTags(tagsInput.value),
    note: noteInput.value.trim(),
    confirmDuplicate,
  };

  const res = await fetch("/api/bookmarks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.status === 201) {
    clearMessage();
    form.reset();
    showMessage("Bookmark saved.", "success");
    await refresh();
    return;
  }
  if (res.status === 400) {
    showMessage("That doesn't look like a valid web address (use http:// or https://).", "error");
    return;
  }
  if (res.status === 409) {
    const data = await res.json();
    const existingTitle = data.existing ? data.existing.title : "this address";
    if (window.confirm(`You've already saved "${existingTitle}". Save it again anyway?`)) {
      await saveBookmark({ confirmDuplicate: true });
    } else {
      showMessage("Already saved — not added again.", "warn");
    }
    return;
  }
  showMessage("Something went wrong saving that bookmark.", "error");
}

function openEdit(b) {
  editingId = b.id;
  editUrl.value = b.url;
  editTitle.value = b.title;
  editTags.value = (b.tags || []).join(", ");
  editNote.value = b.note || "";
  editMessage.hidden = true;
  editDialog.showModal();
}

async function submitEdit() {
  const res = await fetch(`/api/bookmarks/${editingId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: editUrl.value.trim(),
      title: editTitle.value.trim(),
      tags: parseTags(editTags.value),
      note: editNote.value.trim(),
    }),
  });

  if (res.ok) {
    editDialog.close();
    await refresh();
    return;
  }
  editMessage.textContent =
    res.status === 400
      ? "That doesn't look like a valid web address."
      : "Could not save changes.";
  editMessage.hidden = false;
}

async function deleteBookmark(b) {
  if (!window.confirm(`Delete "${b.title}"? This cannot be undone.`)) return;
  const res = await fetch(`/api/bookmarks/${b.id}`, { method: "DELETE" });
  if (res.status === 204) {
    await refresh();
  } else {
    showMessage("Could not delete that bookmark.", "error");
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  saveBookmark();
});
searchInput.addEventListener("input", loadBookmarks);
tagFilter.addEventListener("change", loadBookmarks);
editForm.addEventListener("submit", (e) => {
  e.preventDefault();
  submitEdit();
});
editCancel.addEventListener("click", () => editDialog.close());

refresh();
