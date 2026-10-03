const state = {
  bookmarks: [],
  search: "",
  activeTag: null,
};

const els = {
  list: document.getElementById("list"),
  empty: document.getElementById("empty"),
  count: document.getElementById("count"),
  tagBar: document.getElementById("tag-bar"),
  search: document.getElementById("search"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modal-title"),
  form: document.getElementById("form"),
  fId: document.getElementById("f-id"),
  fUrl: document.getElementById("f-url"),
  fTitle: document.getElementById("f-title"),
  fDescription: document.getElementById("f-description"),
  fTags: document.getElementById("f-tags"),
  formError: document.getElementById("form-error"),
  newBtn: document.getElementById("new-btn"),
  cancelBtn: document.getElementById("cancel-btn"),
};

// --- Utils -----------------------------------------------------------------

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// --- Rendering -------------------------------------------------------------

function allTags() {
  const counts = new Map();
  for (const b of state.bookmarks) {
    for (const t of b.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function filtered() {
  const q = state.search.trim().toLowerCase();
  return state.bookmarks.filter((b) => {
    if (state.activeTag && !(b.tags || []).includes(state.activeTag)) return false;
    if (!q) return true;
    const hay = [b.title, b.url, b.description, ...(b.tags || [])].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

function renderTagBar() {
  const tags = allTags();
  if (!tags.length) {
    els.tagBar.hidden = true;
    return;
  }
  els.tagBar.hidden = false;
  els.tagBar.innerHTML = tags
    .map(([tag, n]) => {
      const active = state.activeTag === tag ? " active" : "";
      return `<button class="tag-chip${active}" data-tag="${esc(tag)}">#${esc(tag)} <span>${n}</span></button>`;
    })
    .join("");
}

function renderList() {
  const items = filtered();
  const total = state.bookmarks.length;

  if (total === 0) {
    els.empty.hidden = false;
    els.list.innerHTML = "";
    els.count.textContent = "";
  } else {
    els.empty.hidden = true;
    const suffix = state.activeTag ? ` tagged #${state.activeTag}` : state.search ? " matching your search" : "";
    els.count.textContent = `${items.length} of ${total} bookmark${total === 1 ? "" : "s"}${suffix}`;
    els.list.innerHTML = items.map(cardHtml).join("") ||
      `<p class="empty-sub" style="grid-column:1/-1;text-align:center;padding:40px 0;">Nothing matches your filters.</p>`;
  }

  for (const btn of els.list.querySelectorAll("[data-edit]")) {
    btn.addEventListener("click", () => openModal(btn.dataset.edit));
  }
  for (const btn of els.list.querySelectorAll("[data-delete]")) {
    btn.addEventListener("click", () => remove(btn.dataset.delete));
  }
  for (const btn of els.list.querySelectorAll("[data-filter-tag]")) {
    btn.addEventListener("click", () => setTag(btn.dataset.filterTag));
  }
}

function cardHtml(b) {
  const tags = (b.tags || [])
    .map((t) => `<span class="card-tag" data-filter-tag="${esc(t)}">#${esc(t)}</span>`)
    .join("");
  return `
    <article class="card">
      <h3 class="card-title"><a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${esc(b.title)}</a></h3>
      <a class="card-url" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${esc(hostname(b.url))}</a>
      ${b.description ? `<p class="card-desc">${esc(b.description)}</p>` : ""}
      ${tags ? `<div class="card-tags">${tags}</div>` : ""}
      <div class="card-actions">
        <button class="link-btn" data-edit="${b.id}">Edit</button>
        <button class="link-btn danger" data-delete="${b.id}">Delete</button>
      </div>
    </article>`;
}

function render() {
  renderTagBar();
  renderList();
}

// --- Actions ---------------------------------------------------------------

function setTag(tag) {
  state.activeTag = state.activeTag === tag ? null : tag;
  render();
}

async function load() {
  state.bookmarks = await api("GET", "/api/bookmarks");
  render();
}

function openModal(id) {
  els.formError.hidden = true;
  if (id) {
    const b = state.bookmarks.find((x) => x.id === id);
    if (!b) return;
    els.modalTitle.textContent = "Edit bookmark";
    els.fId.value = b.id;
    els.fUrl.value = b.url;
    els.fTitle.value = b.title;
    els.fDescription.value = b.description || "";
    els.fTags.value = (b.tags || []).join(", ");
  } else {
    els.modalTitle.textContent = "New bookmark";
    els.form.reset();
    els.fId.value = "";
  }
  els.modal.hidden = false;
  els.fUrl.focus();
}

function closeModal() {
  els.modal.hidden = true;
}

async function submit(e) {
  e.preventDefault();
  const payload = {
    url: els.fUrl.value,
    title: els.fTitle.value,
    description: els.fDescription.value,
    tags: els.fTags.value,
  };
  const id = els.fId.value;
  try {
    if (id) {
      await api("PUT", `/api/bookmarks/${id}`, payload);
    } else {
      await api("POST", "/api/bookmarks", payload);
    }
    closeModal();
    await load();
  } catch (err) {
    els.formError.textContent = err.message;
    els.formError.hidden = false;
  }
}

async function remove(id) {
  const b = state.bookmarks.find((x) => x.id === id);
  if (!confirm(`Delete "${b ? b.title : "this bookmark"}"?`)) return;
  await api("DELETE", `/api/bookmarks/${id}`);
  await load();
}

// --- Wiring ----------------------------------------------------------------

els.newBtn.addEventListener("click", () => openModal());
els.cancelBtn.addEventListener("click", closeModal);
els.form.addEventListener("submit", submit);
els.search.addEventListener("input", () => {
  state.search = els.search.value;
  render();
});
els.tagBar.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-tag]");
  if (chip) setTag(chip.dataset.tag);
});
els.modal.addEventListener("click", (e) => {
  if (e.target === els.modal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !els.modal.hidden) closeModal();
});

load()
  .catch((err) => {
    els.count.textContent = "Failed to load bookmarks: " + err.message;
  })
  .finally(() => {
    document.body.setAttribute("data-harness-ready", "true");
  });
