const $ = (sel) => document.querySelector(sel);

const state = {
  search: "",
  tag: "",
};

// --- API helpers ----------------------------------------------------------
async function api(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

// --- Rendering -------------------------------------------------------------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderBookmarks(items) {
  const list = $("#bookmark-list");
  list.innerHTML = "";
  $("#empty").hidden = items.length > 0;

  for (const b of items) {
    const li = document.createElement("li");
    li.className = "card";
    renderView(li, b);
    list.appendChild(li);
  }
}

// Read-only card view.
function renderView(li, b) {
  const tagsHtml = b.tags
    .map((t) => `<span data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`)
    .join("");

  li.innerHTML = `
    ${b.favicon ? `<img class="favicon" src="${escapeHtml(b.favicon)}" alt="" onerror="this.style.display='none'" />` : ""}
    <div class="body">
      <a class="title" href="${escapeHtml(b.url)}" target="_blank" rel="noopener">${escapeHtml(b.title || b.url)}</a>
      <div class="url">${escapeHtml(b.url)}</div>
      ${b.description ? `<p class="desc">${escapeHtml(b.description)}</p>` : ""}
      <div class="card-tags">${tagsHtml}</div>
    </div>
    <div class="card-actions">
      <button class="edit" title="Edit">✎</button>
      <button class="delete" title="Delete">✕</button>
    </div>
  `;

  li.querySelector(".edit").addEventListener("click", () => renderEdit(li, b));

  li.querySelector(".delete").addEventListener("click", async () => {
    await api(`/api/bookmarks/${b.id}`, { method: "DELETE" });
    await refresh();
  });

  li.querySelectorAll(".card-tags span").forEach((el) =>
    el.addEventListener("click", () => setTag(el.dataset.tag))
  );
}

// Editable card view.
function renderEdit(li, b) {
  li.innerHTML = `
    <form class="edit-form">
      <input class="edit-title" type="text" placeholder="Title" value="${escapeHtml(b.title)}" />
      <div class="url">${escapeHtml(b.url)}</div>
      <input class="edit-tags" type="text" placeholder="Tags (comma separated)" value="${escapeHtml(b.tags.join(", "))}" />
      <textarea class="edit-desc" rows="2" placeholder="Notes">${escapeHtml(b.description)}</textarea>
      <div class="edit-buttons">
        <button type="submit" class="save">Save</button>
        <button type="button" class="cancel">Cancel</button>
      </div>
      <p class="status edit-status"></p>
    </form>
  `;

  const form = li.querySelector(".edit-form");
  const title = li.querySelector(".edit-title");
  title.focus();

  li.querySelector(".cancel").addEventListener("click", () => renderView(li, b));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = li.querySelector(".edit-status");
    const payload = {
      title: title.value.trim(),
      description: li.querySelector(".edit-desc").value.trim(),
      tags: li.querySelector(".edit-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      await api(`/api/bookmarks/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await refresh();
    } catch (err) {
      status.className = "status error edit-status";
      status.textContent = err.message;
    }
  });
}

function renderTags(tags) {
  const list = $("#tag-list");
  list.innerHTML = "";
  for (const t of tags) {
    const li = document.createElement("li");
    if (t.name === state.tag) li.classList.add("active");
    li.innerHTML = `${escapeHtml(t.name)}<span class="count">${t.count}</span>`;
    li.addEventListener("click", () => setTag(t.name === state.tag ? "" : t.name));
    list.appendChild(li);
  }
}

function renderActiveFilter() {
  const el = $("#active-filter");
  if (state.tag) {
    el.innerHTML = `Filtering by tag: <strong>${escapeHtml(state.tag)}</strong>`;
    const btn = document.createElement("button");
    btn.textContent = "Clear";
    btn.addEventListener("click", () => setTag(""));
    el.appendChild(btn);
  } else {
    el.textContent = "";
  }
}

// --- Actions ---------------------------------------------------------------
function setTag(tag) {
  state.tag = tag;
  refresh();
}

async function refresh() {
  const params = new URLSearchParams();
  if (state.search) params.set("search", state.search);
  if (state.tag) params.set("tag", state.tag);

  const [bookmarks, tags] = await Promise.all([
    api(`/api/bookmarks?${params}`),
    api(`/api/tags`),
  ]);
  renderBookmarks(bookmarks);
  renderTags(tags);
  renderActiveFilter();
}

// --- Events ----------------------------------------------------------------
$("#add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("#add-status");
  const button = $("#add-form button");
  const payload = {
    url: $("#url").value.trim(),
    title: $("#title").value.trim() || null,
    description: $("#description").value.trim(),
    tags: $("#tags").value.split(",").map((t) => t.trim()).filter(Boolean),
  };
  if (!payload.url) return;

  button.disabled = true;
  status.className = "status";
  status.textContent = "Fetching page details…";
  try {
    await api("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    e.target.reset();
    status.textContent = "Saved!";
    setTimeout(() => (status.textContent = ""), 1500);
    await refresh();
  } catch (err) {
    status.className = "status error";
    status.textContent = err.message;
  } finally {
    button.disabled = false;
  }
});

$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const status = $("#import-status");
  status.className = "status";
  status.textContent = `Importing ${file.name}…`;
  try {
    const html = await file.text();
    const result = await api("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html,
        folders_as_tags: $("#import-folders").checked,
      }),
    });
    status.textContent = `Imported ${result.imported}, skipped ${result.skipped} (duplicates/non-web).`;
    await refresh();
  } catch (err) {
    status.className = "status error";
    status.textContent = err.message;
  } finally {
    e.target.value = ""; // allow re-importing the same file
  }
});

let searchTimer;
$("#search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  const value = e.target.value;
  searchTimer = setTimeout(() => {
    state.search = value.trim();
    refresh();
  }, 200);
});

refresh();
