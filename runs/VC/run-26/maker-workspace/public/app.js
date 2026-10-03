const state = {
  q: "",
  tag: "",
  editingId: null,
};

const el = {
  search: document.getElementById("search"),
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  status: document.getElementById("status"),
  tagList: document.getElementById("tag-list"),
  countAll: document.getElementById("count-all"),
  addBtn: document.getElementById("add-btn"),
  dialog: document.getElementById("dialog"),
  dialogTitle: document.getElementById("dialog-title"),
  form: document.getElementById("form"),
  fUrl: document.getElementById("f-url"),
  fTitle: document.getElementById("f-title"),
  fDescription: document.getElementById("f-description"),
  fTags: document.getElementById("f-tags"),
  formError: document.getElementById("form-error"),
  cancelBtn: document.getElementById("cancel-btn"),
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

function showStatus(msg) {
  if (!msg) {
    el.status.hidden = true;
    return;
  }
  el.status.textContent = msg;
  el.status.hidden = false;
}

function faviconFor(url) {
  try {
    const host = new URL(url).hostname;
    return `https://icons.duckduckgo.com/ip3/${host}.ico`;
  } catch {
    return "";
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function renderCards(bookmarks) {
  el.grid.innerHTML = "";
  el.empty.hidden = bookmarks.length > 0;
  for (const b of bookmarks) {
    const card = document.createElement("div");
    card.className = "card";
    const tagsHtml = b.tags
      .map((t) => `<span class="card-tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`)
      .join("");
    card.innerHTML = `
      <div class="card-head">
        <img class="favicon" src="${escapeHtml(faviconFor(b.url))}" alt="" loading="lazy"
             onerror="this.style.visibility='hidden'" />
        <a class="card-title" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer"
           title="${escapeHtml(b.title)}">${escapeHtml(b.title)}</a>
      </div>
      <div class="card-url">${escapeHtml(b.url)}</div>
      ${b.description ? `<p class="card-desc">${escapeHtml(b.description)}</p>` : ""}
      ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ""}
      <div class="card-actions">
        <button class="icon-btn" data-edit="${b.id}">✎ Edit</button>
        <button class="icon-btn danger" data-delete="${b.id}">🗑 Delete</button>
      </div>
    `;
    el.grid.appendChild(card);
  }
}

function renderTags(tags, total) {
  el.countAll.textContent = total;
  // Remove all but the "All" item.
  el.tagList.querySelectorAll("li:not(:first-child)").forEach((n) => n.remove());
  const allChip = el.tagList.querySelector('[data-tag=""]');
  allChip.classList.toggle("active", state.tag === "");
  for (const t of tags) {
    const li = document.createElement("li");
    li.innerHTML = `<button class="tag-chip ${state.tag === t.name ? "active" : ""}" data-tag="${escapeHtml(t.name)}">
      #${escapeHtml(t.name)} <span class="tag-count">${t.count}</span></button>`;
    el.tagList.appendChild(li);
  }
}

async function refresh() {
  try {
    showStatus("");
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.tag) params.set("tag", state.tag);
    const [{ bookmarks }, { tags }] = await Promise.all([
      api(`/api/bookmarks?${params}`),
      api(`/api/tags`),
    ]);
    renderCards(bookmarks);
    renderTags(tags, await totalCount());
  } catch (err) {
    showStatus(err.message);
  } finally {
    document.body.setAttribute("data-harness-ready", "true");
  }
}

async function totalCount() {
  const { bookmarks } = await api(`/api/bookmarks`);
  return bookmarks.length;
}

function openDialog(bookmark) {
  el.formError.hidden = true;
  if (bookmark) {
    state.editingId = bookmark.id;
    el.dialogTitle.textContent = "Edit bookmark";
    el.fUrl.value = bookmark.url;
    el.fTitle.value = bookmark.title;
    el.fDescription.value = bookmark.description;
    el.fTags.value = bookmark.tags.join(", ");
  } else {
    state.editingId = null;
    el.dialogTitle.textContent = "Add bookmark";
    el.form.reset();
  }
  el.dialog.showModal();
  el.fUrl.focus();
}

// --- Events ---

let searchTimer;
el.search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = el.search.value;
    refresh();
  }, 200);
});

el.addBtn.addEventListener("click", () => openDialog(null));
el.cancelBtn.addEventListener("click", () => el.dialog.close());

el.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    url: el.fUrl.value,
    title: el.fTitle.value,
    description: el.fDescription.value,
    tags: el.fTags.value,
  };
  try {
    if (state.editingId) {
      await api(`/api/bookmarks/${state.editingId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await api(`/api/bookmarks`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    el.dialog.close();
    await refresh();
  } catch (err) {
    el.formError.textContent = err.message;
    el.formError.hidden = false;
  }
});

// Delegated clicks for cards.
el.grid.addEventListener("click", async (e) => {
  const editId = e.target.getAttribute?.("data-edit");
  const delId = e.target.getAttribute?.("data-delete");
  const tag = e.target.getAttribute?.("data-tag");
  if (editId) {
    const { bookmarks } = await api(`/api/bookmarks`);
    const b = bookmarks.find((x) => x.id === editId);
    if (b) openDialog(b);
  } else if (delId) {
    if (confirm("Delete this bookmark?")) {
      await api(`/api/bookmarks/${delId}`, { method: "DELETE" });
      await refresh();
    }
  } else if (tag) {
    state.tag = tag;
    refresh();
  }
});

// Delegated clicks for tag sidebar.
el.tagList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tag]");
  if (!btn) return;
  state.tag = btn.getAttribute("data-tag");
  refresh();
});

refresh();
