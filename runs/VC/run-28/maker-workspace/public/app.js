// Bookmark manager — single-page frontend.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const api = {
  async req(method, url, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const err = new Error(data.error || res.statusText);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },
  get: (u) => api.req('GET', u),
  post: (u, b) => api.req('POST', u, b),
  patch: (u, b) => api.req('PATCH', u, b),
  del: (u) => api.req('DELETE', u),
};

const state = {
  scope: 'active',
  query: '',
  sort: 'created_desc',
  view: 'grid',
  density: 'comfortable',
  showPreviews: true,
  theme: 'auto',
  bookmarks: [],
  selected: new Set(),
  prefs: {},
};

// ---- Utilities ------------------------------------------------------------

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function relTime(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function toast(msg, { type = '', action, onAction, timeout = 4000 } = {}) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = action;
    btn.onclick = () => { onAction?.(); el.remove(); };
    el.appendChild(btn);
  }
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), timeout);
}

// ---- Modal helper ---------------------------------------------------------

function openModal(html, { wide = false } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="modal${wide ? ' wide' : ''}">${html}</div>`;
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  $$('.close-x, [data-close]', overlay).forEach((b) => (b.onclick = close));
  $('#modal-root').appendChild(overlay);
  return { overlay, close };
}

// ---- Rendering ------------------------------------------------------------

function faviconImg(bm) {
  if (!bm.favicon) {
    return `<span class="card-favicon" style="display:inline-flex;align-items:center;justify-content:center;background:var(--surface-2);font-size:9px;">${esc((bm.domain || '?')[0].toUpperCase())}</span>`;
  }
  return `<img class="card-favicon" src="${esc(bm.favicon)}" alt="" onerror="this.style.visibility='hidden'" />`;
}

function cardHtml(bm) {
  const selected = state.selected.has(bm.id);
  const preview = state.showPreviews && bm.preview_image
    ? `<img class="card-preview" src="${esc(bm.preview_image)}" alt="" loading="lazy" onerror="this.classList.add('placeholder');this.removeAttribute('src');this.textContent='${esc((bm.domain || '?')[0].toUpperCase())}'" />`
    : (state.showPreviews ? `<div class="card-preview placeholder">${esc((bm.domain || '?')[0].toUpperCase())}</div>` : '');

  const tags = bm.tags.map((t) => `<span class="card-tag" data-tag="${esc(t)}">${esc(t)}</span>`).join('');
  const badges = [
    bm.read_later ? '<span class="badge read">Read later</span>' : '',
    bm.snapshot_count ? `<span class="badge snap">◉ ${bm.snapshot_count}</span>` : '',
  ].join('');

  return `
  <article class="card${selected ? ' selected' : ''}" data-id="${bm.id}">
    <div class="card-select"><input type="checkbox" ${selected ? 'checked' : ''} data-select="${bm.id}" /></div>
    ${preview}
    <div class="card-body">
      <div class="card-site">${faviconImg(bm)}<span>${esc(bm.domain || '')}</span><span>· ${relTime(bm.created_at)}</span></div>
      <div class="card-title"><a href="${esc(bm.url)}" target="_blank" rel="noopener">${esc(bm.title || bm.url)}</a></div>
      ${bm.description ? `<div class="card-desc">${esc(bm.description)}</div>` : ''}
      ${bm.notes ? `<div class="card-note">${esc(bm.notes)}</div>` : ''}
      ${tags ? `<div class="card-tags">${tags}</div>` : ''}
      <div class="card-foot">
        <div class="card-badges">${badges}</div>
        <button class="icon-btn ${bm.read_later ? 'on' : ''}" title="Toggle read later" data-act="read_later" data-id="${bm.id}">◔</button>
        <button class="icon-btn ${bm.archived ? 'on' : ''}" title="${bm.archived ? 'Unarchive' : 'Archive'}" data-act="archive" data-id="${bm.id}">▤</button>
        <button class="icon-btn" title="Edit" data-act="edit" data-id="${bm.id}">✎</button>
      </div>
    </div>
  </article>`;
}

function render() {
  const cards = $('#cards');
  cards.className = `cards ${state.view === 'list' ? 'list' : ''} ${state.density === 'compact' ? 'compact' : ''}`;
  if (!state.bookmarks.length) {
    cards.innerHTML = '';
    const empty = $('#empty');
    empty.classList.remove('hidden');
    empty.innerHTML = state.query
      ? `<h3>No matches</h3><p>Nothing matches “${esc(state.query)}”. Try broadening your search.</p>`
      : `<h3>No bookmarks yet</h3><p>Click <strong>Add bookmark</strong> to save your first link.</p>`;
  } else {
    $('#empty').classList.add('hidden');
    cards.innerHTML = state.bookmarks.map(cardHtml).join('');
  }
  updateBulkBar();
  $('#result-count').textContent = `${state.bookmarks.length} shown`;
  const all = $('#select-all');
  all.checked = state.bookmarks.length > 0 && state.bookmarks.every((b) => state.selected.has(b.id));
}

function updateBulkBar() {
  const bar = $('#bulk-bar');
  const n = state.selected.size;
  if (n === 0) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  $('#bulk-count').textContent = `${n} selected`;
}

function renderCounts(counts) {
  for (const [key, val] of Object.entries(counts)) {
    const el = $(`[data-count="${key}"]`);
    if (el) el.textContent = val;
  }
}

async function renderSidebar() {
  const [tags, filters] = await Promise.all([api.get('/api/tags'), api.get('/api/filters')]);
  $('#tag-cloud').innerHTML = tags.length
    ? tags.map((t) => `<button class="tag-chip" data-tag="${esc(t.name)}">${esc(t.name)}<span class="c">${t.count}</span></button>`).join('')
    : '<span class="muted" style="padding:0 4px;font-size:12px;">No tags yet</span>';

  $('#saved-filters').innerHTML = filters.length
    ? filters.map((f) => `<div class="saved-filter" data-filter='${esc(JSON.stringify(f))}'>
        <span class="apply">${esc(f.name)}</span>
        <button class="del" data-del-filter="${f.id}" title="Delete">×</button>
      </div>`).join('')
    : '<span class="muted" style="padding:0 4px;font-size:12px;">Save a search to reuse it</span>';
}

// ---- Data loading ---------------------------------------------------------

async function load() {
  const params = new URLSearchParams({ q: state.query, scope: state.scope, sort: state.sort });
  const data = await api.get('/api/bookmarks?' + params);
  state.bookmarks = data.bookmarks;
  // Drop selections for bookmarks no longer visible.
  const visible = new Set(data.bookmarks.map((b) => b.id));
  for (const id of [...state.selected]) if (!visible.has(id)) state.selected.delete(id);
  renderCounts(data.counts);
  render();
}

// ---- Add / edit modal -----------------------------------------------------

function bookmarkFormHtml(bm = {}, isEdit = false) {
  return `
  <div class="modal-head">
    <h2>${isEdit ? 'Edit bookmark' : 'Add bookmark'}</h2>
    <button class="close-x">×</button>
  </div>
  <div class="modal-body">
    <div class="field">
      <label>URL</label>
      <input type="url" id="f-url" placeholder="https://example.com/article" value="${esc(bm.url || '')}" ${isEdit ? '' : 'autofocus'} />
      <span class="hint" id="fetch-hint"></span>
    </div>
    <div class="meta-preview hidden" id="meta-prev">
      <img id="mp-img" alt="" />
      <div class="mp-body">
        <div class="mp-title" id="mp-title"></div>
        <div class="mp-desc" id="mp-desc"></div>
      </div>
    </div>
    <div class="field">
      <label>Title</label>
      <input type="text" id="f-title" value="${esc(bm.title || '')}" />
    </div>
    <div class="field">
      <label>Description</label>
      <textarea id="f-desc">${esc(bm.description || '')}</textarea>
    </div>
    <div class="row-2">
      <div class="field">
        <label>Favicon URL</label>
        <input type="text" id="f-favicon" value="${esc(bm.favicon || '')}" />
      </div>
      <div class="field">
        <label>Preview image URL</label>
        <input type="text" id="f-preview" value="${esc(bm.preview_image || '')}" />
      </div>
    </div>
    <div class="field">
      <label>Tags <span class="hint">(comma separated)</span></label>
      <input type="text" id="f-tags" value="${esc((bm.tags || []).join(', '))}" placeholder="design, reading, tools" />
    </div>
    <div class="field">
      <label>Notes</label>
      <textarea id="f-notes" placeholder="Your private notes about this bookmark…">${esc(bm.notes || '')}</textarea>
    </div>
    <div class="check-row">
      <label><input type="checkbox" id="f-read" ${bm.read_later ? 'checked' : ''} /> Read later</label>
      ${isEdit ? `<label><input type="checkbox" id="f-arch" ${bm.archived ? 'checked' : ''} /> Archived</label>` : ''}
    </div>
    ${isEdit ? `<div class="field" id="snap-section">
      <label>Snapshots</label>
      <div class="snap-grid" id="snap-grid"></div>
      <button class="btn btn-ghost" id="snap-btn" style="margin-top:8px;align-self:flex-start;">◉ Capture snapshot</button>
    </div>` : ''}
  </div>
  <div class="modal-foot">
    ${isEdit ? '<button class="btn btn-ghost" id="refetch-btn">↻ Re-fetch metadata</button>' : ''}
    ${isEdit ? '<button class="btn btn-danger" data-delete style="margin-right:auto;">Delete</button>' : ''}
    <button class="btn btn-ghost" data-close>Cancel</button>
    <button class="btn btn-primary" id="save-btn">${isEdit ? 'Save changes' : 'Save bookmark'}</button>
  </div>`;
}

function readForm(overlay) {
  return {
    url: $('#f-url', overlay).value.trim(),
    title: $('#f-title', overlay).value,
    description: $('#f-desc', overlay).value,
    favicon: $('#f-favicon', overlay).value.trim(),
    preview_image: $('#f-preview', overlay).value.trim(),
    tags: $('#f-tags', overlay).value,
    notes: $('#f-notes', overlay).value,
    read_later: $('#f-read', overlay).checked,
    archived: $('#f-arch', overlay) ? $('#f-arch', overlay).checked : undefined,
  };
}

function applyMetaToForm(overlay, meta, { onlyEmpty = true } = {}) {
  const set = (id, val) => {
    const el = $(id, overlay);
    if (val && (!onlyEmpty || !el.value.trim())) el.value = val;
  };
  set('#f-title', meta.title);
  set('#f-desc', meta.description);
  set('#f-favicon', meta.favicon);
  set('#f-preview', meta.preview_image);
  showMetaPreview(overlay);
}

function showMetaPreview(overlay) {
  const img = $('#f-preview', overlay).value.trim();
  const title = $('#f-title', overlay).value.trim();
  const desc = $('#f-desc', overlay).value.trim();
  if (!img && !title && !desc) { $('#meta-prev', overlay).classList.add('hidden'); return; }
  const prev = $('#meta-prev', overlay);
  prev.classList.remove('hidden');
  const mpImg = $('#mp-img', overlay);
  if (img) { mpImg.src = img; mpImg.style.display = ''; mpImg.onerror = () => (mpImg.style.display = 'none'); }
  else mpImg.style.display = 'none';
  $('#mp-title', overlay).textContent = title;
  $('#mp-desc', overlay).textContent = desc;
}

function openAddModal(prefillUrl = '') {
  const { overlay, close } = openModal(bookmarkFormHtml({ url: prefillUrl }, false));
  const urlInput = $('#f-url', overlay);
  const hint = $('#fetch-hint', overlay);
  let lastFetched = '';

  async function autoFetch() {
    const url = urlInput.value.trim();
    if (!url || url === lastFetched) return;
    lastFetched = url;
    // Check for an existing bookmark first (dedup).
    hint.innerHTML = '<span class="spinner"></span> Fetching page details…';
    try {
      const meta = await api.post('/api/fetch-metadata', { url });
      applyMetaToForm(overlay, meta);
      hint.textContent = meta.fetched ? 'Details loaded — edit anything below.' : 'Could not read the page; enter details manually.';
    } catch {
      hint.textContent = 'Could not fetch details; enter them manually.';
    }
  }

  urlInput.addEventListener('blur', autoFetch);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); autoFetch(); } });
  ['#f-title', '#f-desc', '#f-preview'].forEach((id) => $(id, overlay).addEventListener('input', () => showMetaPreview(overlay)));

  $('#save-btn', overlay).onclick = async () => {
    const form = readForm(overlay);
    if (!form.url) { toast('Enter a URL first.', { type: 'error' }); urlInput.focus(); return; }
    try {
      const { bookmark, duplicate } = await api.post('/api/bookmarks', { ...form, autofetch: true });
      close();
      if (duplicate) {
        toast('Already saved — opening the existing bookmark.', { type: 'success' });
        await load();
        openEditModal(bookmark.id);
      } else {
        toast('Bookmark saved.', { type: 'success' });
        await Promise.all([load(), renderSidebar()]);
      }
    } catch (e) {
      toast(e.message || 'Could not save.', { type: 'error' });
    }
  };

  if (prefillUrl) autoFetch();
}

async function openEditModal(id) {
  let bm;
  try { bm = await api.get(`/api/bookmarks/${id}`); }
  catch { toast('Bookmark not found.', { type: 'error' }); return; }

  const { overlay, close } = openModal(bookmarkFormHtml(bm, true));
  showMetaPreview(overlay);
  renderSnapshots(overlay, bm.snapshots || []);
  ['#f-title', '#f-desc', '#f-preview'].forEach((id2) => $(id2, overlay).addEventListener('input', () => showMetaPreview(overlay)));

  $('#save-btn', overlay).onclick = async () => {
    const form = readForm(overlay);
    if (!form.url) { toast('URL cannot be empty.', { type: 'error' }); return; }
    try {
      await api.patch(`/api/bookmarks/${id}`, form);
      close();
      toast('Changes saved.', { type: 'success' });
      await Promise.all([load(), renderSidebar()]);
    } catch (e) {
      if (e.status === 409) toast(e.message, { type: 'error' });
      else toast(e.message || 'Could not save.', { type: 'error' });
    }
  };

  $('#refetch-btn', overlay).onclick = async () => {
    const btn = $('#refetch-btn', overlay);
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Fetching…';
    try {
      const meta = await api.post(`/api/bookmarks/${id}/refetch`);
      applyMetaToForm(overlay, meta, { onlyEmpty: false });
      toast('Metadata refreshed — review and save.', { type: 'success' });
    } catch { toast('Could not re-fetch.', { type: 'error' }); }
    btn.disabled = false; btn.textContent = '↻ Re-fetch metadata';
  };

  $('[data-delete]', overlay).onclick = async () => {
    if (!confirm('Delete this bookmark permanently?')) return;
    await api.del(`/api/bookmarks/${id}`);
    close();
    toast('Bookmark deleted.');
    await Promise.all([load(), renderSidebar()]);
  };

  $('#snap-btn', overlay).onclick = async () => {
    const btn = $('#snap-btn', overlay);
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Capturing page…';
    try {
      await api.post(`/api/bookmarks/${id}/snapshots`);
      const snaps = await api.get(`/api/bookmarks/${id}/snapshots`);
      renderSnapshots(overlay, snaps);
      toast('Snapshot captured.', { type: 'success' });
      load();
    } catch (e) { toast('Snapshot failed: ' + (e.message || ''), { type: 'error' }); }
    btn.disabled = false; btn.innerHTML = '◉ Capture snapshot';
  };
}

function renderSnapshots(overlay, snaps) {
  const grid = $('#snap-grid', overlay);
  if (!grid) return;
  grid.innerHTML = snaps.length
    ? snaps.map((s) => `<div class="snap-item">
        <a href="/snapshots/${esc(s.image_file)}" target="_blank"><img src="/snapshots/${esc(s.image_file)}" alt="snapshot" /></a>
        <div class="snap-meta">
          <span>${relTime(s.created_at)}</span>
          <span>
            ${s.html_file ? `<a href="/snapshots/${esc(s.html_file)}" target="_blank">HTML</a> · ` : ''}
            <a href="#" data-del-snap="${s.id}">delete</a>
          </span>
        </div>
      </div>`).join('')
    : '<span class="muted">No snapshots yet.</span>';
  $$('[data-del-snap]', grid).forEach((a) => a.onclick = async (e) => {
    e.preventDefault();
    await api.del(`/api/snapshots/${a.dataset.delSnap}`);
    a.closest('.snap-item').remove();
    load();
  });
}

// ---- Preferences modal ----------------------------------------------------

function openPrefsModal() {
  const p = state.prefs;
  const { overlay, close } = openModal(`
    <div class="modal-head"><h2>Preferences</h2><button class="close-x">×</button></div>
    <div class="modal-body">
      <div class="field">
        <label>Theme</label>
        <select id="p-theme">
          <option value="auto"${p.theme==='auto'?' selected':''}>Auto (match system)</option>
          <option value="light"${p.theme==='light'?' selected':''}>Light</option>
          <option value="dark"${p.theme==='dark'?' selected':''}>Dark</option>
        </select>
      </div>
      <div class="row-2">
        <div class="field">
          <label>Default view</label>
          <select id="p-view">
            <option value="grid"${p.view==='grid'?' selected':''}>Grid</option>
            <option value="list"${p.view==='list'?' selected':''}>List</option>
          </select>
        </div>
        <div class="field">
          <label>Density</label>
          <select id="p-density">
            <option value="comfortable"${p.density==='comfortable'?' selected':''}>Comfortable</option>
            <option value="compact"${p.density==='compact'?' selected':''}>Compact</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>Default sort</label>
        <select id="p-sort">
          <option value="created_desc"${p.default_sort==='created_desc'?' selected':''}>Newest first</option>
          <option value="created_asc"${p.default_sort==='created_asc'?' selected':''}>Oldest first</option>
          <option value="updated_desc"${p.default_sort==='updated_desc'?' selected':''}>Recently updated</option>
          <option value="title_asc"${p.default_sort==='title_asc'?' selected':''}>Title A→Z</option>
          <option value="domain_asc"${p.default_sort==='domain_asc'?' selected':''}>Domain</option>
        </select>
      </div>
      <div class="check-row">
        <label><input type="checkbox" id="p-prev" ${p.show_previews?'checked':''} /> Show preview images</label>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="p-save">Save preferences</button>
    </div>`);

  $('#p-save', overlay).onclick = async () => {
    const patch = {
      theme: $('#p-theme', overlay).value,
      view: $('#p-view', overlay).value,
      density: $('#p-density', overlay).value,
      default_sort: $('#p-sort', overlay).value,
      show_previews: $('#p-prev', overlay).checked,
    };
    state.prefs = await api.patch('/api/preferences', patch);
    applyPrefs();
    close();
    await load();
    toast('Preferences saved.', { type: 'success' });
  };
}

function applyPrefs() {
  const p = state.prefs;
  state.theme = p.theme; state.view = p.view; state.density = p.density; state.showPreviews = p.show_previews;
  document.documentElement.setAttribute('data-theme', p.theme || 'auto');
  $$('#view-toggle button').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
  if (!state.sortTouched) { state.sort = p.default_sort || 'created_desc'; $('#sort').value = state.sort; }
}

// ---- Import / export modal ------------------------------------------------

function openIoModal() {
  const { overlay, close } = openModal(`
    <div class="modal-head"><h2>Import / Export</h2><button class="close-x">×</button></div>
    <div class="modal-body">
      <div class="field">
        <label>Export</label>
        <span class="hint">Download all bookmarks (and saved filters).</span>
        <div style="display:flex;gap:10px;margin-top:6px;">
          <a class="btn" href="/api/export.json" download>⬇ JSON (full)</a>
          <a class="btn" href="/api/export.html" download>⬇ Browser HTML</a>
        </div>
      </div>
      <div class="field">
        <label>Import</label>
        <span class="hint">Select a JSON export or a browser bookmarks HTML file. Duplicates are skipped.</span>
        <input type="file" id="import-file" accept=".json,.html,.htm,application/json,text/html" style="margin-top:6px;" />
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-close>Close</button>
      <button class="btn btn-primary" id="import-btn">Import file</button>
    </div>`, { wide: false });

  $('#import-btn', overlay).onclick = async () => {
    const file = $('#import-file', overlay).files[0];
    if (!file) { toast('Choose a file first.', { type: 'error' }); return; }
    const text = await file.text();
    const isHtml = /\.html?$/i.test(file.name) || /<a\s/i.test(text.slice(0, 4000));
    try {
      let result;
      if (isHtml) {
        const r = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'text/html' }, body: text });
        if (!r.ok) throw new Error('server rejected the file');
        result = await r.json();
      } else {
        result = await api.post('/api/import', JSON.parse(text));
      }
      close();
      toast(`Imported ${result.imported}, skipped ${result.skipped} duplicate(s).`, { type: 'success', timeout: 6000 });
      await Promise.all([load(), renderSidebar()]);
    } catch (e) {
      toast('Import failed: ' + (e.message || 'invalid file'), { type: 'error' });
    }
  };
}

// ---- Bulk / tag prompts ---------------------------------------------------

async function runBulk(action) {
  const ids = [...state.selected];
  if (!ids.length) return;
  let value;
  if (action === 'add_tag' || action === 'remove_tag') {
    value = prompt(action === 'add_tag' ? 'Tag(s) to add (comma separated):' : 'Tag(s) to remove (comma separated):');
    if (!value) return;
  }
  if (action === 'delete' && !confirm(`Delete ${ids.length} bookmark(s) permanently?`)) return;
  const res = await api.post('/api/bulk', { ids, action, value });
  if (action === 'delete') state.selected.clear();
  toast(`Updated ${res.affected} bookmark(s).`, { type: 'success' });
  await Promise.all([load(), renderSidebar()]);
}

// ---- Saved filters --------------------------------------------------------

function openSaveFilterModal() {
  const { overlay, close } = openModal(`
    <div class="modal-head"><h2>Save current filter</h2><button class="close-x">×</button></div>
    <div class="modal-body">
      <div class="field">
        <label>Name</label>
        <input type="text" id="filter-name" placeholder="e.g. Design reading" autofocus />
      </div>
      <div class="field">
        <span class="hint">Query: <code>${esc(state.query || '(none)')}</code> · Scope: ${esc(state.scope)} · Sort: ${esc(state.sort)}</span>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-primary" id="save-filter">Save filter</button>
    </div>`);
  $('#save-filter', overlay).onclick = async () => {
    const name = $('#filter-name', overlay).value.trim();
    if (!name) { toast('Name the filter first.', { type: 'error' }); return; }
    await api.post('/api/filters', { name, query: state.query, scope: state.scope, sort: state.sort });
    close();
    toast('Filter saved.', { type: 'success' });
    renderSidebar();
  };
}

function applySavedFilter(f) {
  state.query = f.query; state.scope = f.scope; state.sort = f.sort; state.sortTouched = true;
  $('#search').value = f.query;
  $('#sort').value = f.sort;
  setActiveScope();
  load();
}

// ---- Scope nav ------------------------------------------------------------

function setActiveScope() {
  $$('#scope-nav .nav-item').forEach((b) => b.classList.toggle('active', b.dataset.scope === state.scope));
}

// ---- Event wiring ---------------------------------------------------------

function wire() {
  $('#add-btn').onclick = () => openAddModal();
  $('#prefs-btn').onclick = openPrefsModal;
  $('#io-btn').onclick = openIoModal;
  $('#save-filter-btn').onclick = openSaveFilterModal;

  const doSearch = debounce(() => { state.query = $('#search').value.trim(); load(); }, 250);
  $('#search').addEventListener('input', doSearch);

  $('#sort').addEventListener('change', () => { state.sort = $('#sort').value; state.sortTouched = true; load(); });

  $('#view-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    state.view = btn.dataset.view;
    $$('#view-toggle button').forEach((b) => b.classList.toggle('active', b === btn));
    render();
  });

  $('#scope-nav').addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item'); if (!item) return;
    state.scope = item.dataset.scope;
    setActiveScope();
    load();
  });

  // Delegate card interactions.
  $('#cards').addEventListener('click', async (e) => {
    const tagEl = e.target.closest('[data-tag]');
    if (tagEl) { applyTagSearch(tagEl.dataset.tag); return; }

    const selBox = e.target.closest('[data-select]');
    if (selBox) {
      const id = Number(selBox.dataset.select);
      if (selBox.checked) state.selected.add(id); else state.selected.delete(id);
      e.target.closest('.card').classList.toggle('selected', selBox.checked);
      updateBulkBar();
      $('#select-all').checked = state.bookmarks.every((b) => state.selected.has(b.id));
      return;
    }

    const actBtn = e.target.closest('[data-act]');
    if (actBtn) {
      const id = Number(actBtn.dataset.id);
      const act = actBtn.dataset.act;
      const bm = state.bookmarks.find((b) => b.id === id);
      if (act === 'edit') { openEditModal(id); return; }
      if (act === 'read_later') await api.patch(`/api/bookmarks/${id}`, { read_later: !bm.read_later });
      if (act === 'archive') {
        await api.patch(`/api/bookmarks/${id}`, { archived: !bm.archived });
        toast(bm.archived ? 'Unarchived.' : 'Archived.', {
          type: 'success', action: 'Undo',
          onAction: async () => { await api.patch(`/api/bookmarks/${id}`, { archived: bm.archived }); load(); },
        });
      }
      await load();
      return;
    }
  });

  $('#select-all').addEventListener('change', (e) => {
    if (e.target.checked) state.bookmarks.forEach((b) => state.selected.add(b.id));
    else state.bookmarks.forEach((b) => state.selected.delete(b.id));
    render();
  });

  $('#bulk-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-bulk]'); if (!btn) return;
    runBulk(btn.dataset.bulk);
  });
  $('#bulk-clear').onclick = () => { state.selected.clear(); render(); };

  // Sidebar: tags + saved filters (delegated).
  $('#tag-cloud').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-tag]');
    if (chip) applyTagSearch(chip.dataset.tag);
  });
  $('#saved-filters').addEventListener('click', (e) => {
    const del = e.target.closest('[data-del-filter]');
    if (del) { api.del(`/api/filters/${del.dataset.delFilter}`).then(renderSidebar); return; }
    const row = e.target.closest('.saved-filter');
    if (row) applySavedFilter(JSON.parse(row.dataset.filter));
  });

  // Keyboard: press "n" to add, "/" to focus search.
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
    if (e.key === 'n') { e.preventDefault(); openAddModal(); }
  });
}

function applyTagSearch(tag) {
  const token = /\s/.test(tag) ? `tag:"${tag}"` : `tag:${tag}`;
  const cur = $('#search').value.trim();
  if (cur.includes(token)) return;
  $('#search').value = (cur ? cur + ' ' : '') + token;
  state.query = $('#search').value.trim();
  load();
}

// ---- Boot -----------------------------------------------------------------

async function boot() {
  wire();
  try {
    state.prefs = await api.get('/api/preferences');
  } catch { state.prefs = { theme: 'auto', view: 'grid', density: 'comfortable', show_previews: true, default_sort: 'created_desc' }; }
  applyPrefs();
  setActiveScope();
  await Promise.all([load(), renderSidebar()]);
  document.getElementById('app').setAttribute('data-harness-ready', 'true');
}

boot();
