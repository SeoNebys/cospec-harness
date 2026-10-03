// Bookmark manager — client. Loads the full collection once, holds it in memory,
// does browsing/search/filtering locally, and sends mutations to the server
// (which persists them and fetches real titles).

// ---- API ------------------------------------------------------------------
const api = {
  async all() {
    const r = await fetch('/api/bookmarks');
    if (!r.ok) throw new Error('load failed');
    return r.json();
  },
  async create(url, tags) {
    const r = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, tags }),
    });
    const body = await r.json().catch(() => ({}));
    return { status: r.status, body };
  },
  async patch(id, patch) {
    const r = await fetch('/api/bookmarks/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error('update failed');
    return r.json();
  },
  async remove(id) {
    const r = await fetch('/api/bookmarks/' + id, { method: 'DELETE' });
    if (!r.ok && r.status !== 204) throw new Error('delete failed');
  },
};

// ---- URL rules (mirror of server, for instant feedback) -------------------
function normalizeUrl(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : 'https://' + t;
}
function looksLikeUrl(url) {
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.') && !/\s/.test(u.hostname);
  } catch { return false; }
}
function canonical(url) {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./i, '') + u.pathname.replace(/\/+$/, '') + u.search).toLowerCase();
  } catch { return String(url || '').toLowerCase(); }
}

// ---- State ----------------------------------------------------------------
let items = [];
let view = 'all';
let activeTag = null;
let query = '';
let flashUrl = null;

// ---- Elements -------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const listEl = $('list'), emptyEl = $('empty'), emptyBig = $('emptyBig'), emptySub = $('emptySub');
const tagbarEl = $('tagbar'), sectionLabel = $('sectionLabel');
const form = $('saver'), urlInput = $('urlInput'), tagInput = $('tagInput'), saveSuggest = $('saveSuggest');
const saveMsg = $('saveMsg'), searchInput = $('searchInput'), searchClear = $('searchClear');
const tabsEl = $('tabs'), cntAll = $('cntAll'), cntToread = $('cntToread'), cntArchive = $('cntArchive');
const delOverlay = $('delOverlay'), delTarget = $('delTarget');

// ---- Helpers --------------------------------------------------------------
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function hl(text) {
  const safe = esc(text);
  if (!query) return safe;
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp('(' + q + ')', 'ig'), '<mark>$1</mark>');
}
function matches(it) {
  if (!query) return true;
  const q = query.toLowerCase();
  return it.title.toLowerCase().includes(q) || it.url.toLowerCase().includes(q) || it.tags.some((t) => t.includes(q));
}
function inView(it) {
  if (it._optimistic && view !== 'all') return false;
  if (view === 'archive') return it.archived;
  if (view === 'toread') return it.toRead && !it.archived;
  return !it.archived;
}
function allTags() {
  const c = {};
  items.forEach((i) => i.tags.forEach((t) => { c[t] = (c[t] || 0) + 1; }));
  return c;
}
function relTime(iso) {
  const d = new Date(iso), now = new Date(), ms = now - d;
  if (isNaN(ms)) return '';
  const min = Math.floor(ms / 60000), hr = Math.floor(ms / 3600000), day = Math.floor(ms / 86400000);
  if (min < 1) return 'just now';
  if (min < 60) return min + (min === 1 ? ' minute ago' : ' minutes ago');
  if (hr < 24) return hr + (hr === 1 ? ' hour ago' : ' hours ago');
  if (day === 1) return 'yesterday';
  if (day < 7) return day + ' days ago';
  return d.toLocaleDateString();
}

// ---- Save-box messages ----------------------------------------------------
function showMsg(kind, html) { saveMsg.className = 'savemsg show ' + kind; saveMsg.innerHTML = html; }
function clearMsg() { saveMsg.className = 'savemsg'; saveMsg.innerHTML = ''; }

// ---- Rendering ------------------------------------------------------------
const viewName = { all: '', toread: ' · To read', archive: ' · Archived' };

function updateCounts() {
  cntAll.textContent = items.filter((i) => !i.archived).length;
  cntToread.textContent = items.filter((i) => i.toRead && !i.archived).length;
  cntArchive.textContent = items.filter((i) => i.archived).length;
  [...tabsEl.querySelectorAll('button')].forEach((b) => b.classList.toggle('active', b.dataset.view === view));
}

function renderTagbar() {
  tagbarEl.innerHTML = '<span class="lbl">Browse:</span>';
  const allb = document.createElement('button');
  allb.className = 'tag' + (activeTag === null ? ' active' : '');
  allb.type = 'button';
  allb.innerHTML = `All`;
  allb.onclick = () => { activeTag = null; renderAll(); };
  tagbarEl.appendChild(allb);
  const c = allTags();
  Object.keys(c).sort().forEach((t) => {
    const b = document.createElement('button');
    b.className = 'tag' + (activeTag === t ? ' active' : '');
    b.type = 'button';
    b.innerHTML = `#${t} <span class="count">${c[t]}</span>`;
    b.onclick = () => { activeTag = t; renderAll(); };
    tagbarEl.appendChild(b);
  });
}

function render() {
  const base = view === 'toread' ? 'To read' : (view === 'archive' ? 'Archived' : 'Recent');
  if (query) sectionLabel.textContent = 'Results for “' + query + '”' + (activeTag ? ' in #' + activeTag : '') + viewName[view];
  else sectionLabel.textContent = activeTag ? 'Tagged #' + activeTag + viewName[view] : base;
  updateCounts();

  listEl.innerHTML = '';
  const shown = items.filter((it) => inView(it) && (activeTag === null || it.tags.includes(activeTag)) && matches(it));
  if (shown.length === 0) {
    emptyEl.hidden = false;
    if (items.length === 0) { emptyBig.textContent = 'Nothing saved yet'; emptySub.textContent = 'Save your first link above and it will show up here.'; }
    else if (query) { emptyBig.textContent = 'No matches'; emptySub.textContent = 'Nothing matches “' + query + '”' + (activeTag ? ' in #' + activeTag : '') + (view === 'toread' ? ' in your reading queue' : (view === 'archive' ? ' in your archive' : '')) + '. Try different words or clear the search.'; }
    else if (view === 'toread') { emptyBig.textContent = 'Your reading queue is empty'; emptySub.textContent = 'Mark a link “Read later” and it will wait for you here.'; }
    else if (view === 'archive') { emptyBig.textContent = 'Nothing archived'; emptySub.textContent = 'Archive a link to tuck it away here without deleting it. You can restore it anytime.'; }
    else { emptyBig.textContent = 'No links with this tag'; emptySub.textContent = 'Nothing is tagged this way yet.'; }
    return;
  }
  emptyEl.hidden = true;

  shown.forEach((it) => {
    const li = document.createElement('li');
    li.className = 'item';
    if (it._editing) renderEditForm(li, it);
    else if (it._optimistic) {
      li.innerHTML = `<div class="titlerow"><span class="title fetching"><span class="shimmer"></span></span></div><div class="url">${esc(it.url)}</div><div class="meta">Reading the page’s title…</div>`;
    } else {
      const chips = it.tags.map((t) => `<button class="chip" data-t="${esc(t)}" type="button">#${hl(t)}</button>`).join('');
      let action;
      if (view === 'archive') action = `<button class="restorebtn" type="button">↩ Restore</button>`;
      else if (view === 'toread') action = `<button class="markread" type="button">✓ Mark read</button><button class="archivebtn" type="button">Archive</button>`;
      else action = `<button class="readbtn${it.toRead ? ' on' : ''}" type="button">${it.toRead ? '★ In reading queue' : '☆ Read later'}</button><button class="archivebtn" type="button">Archive</button>`;
      li.innerHTML = `<div class="titlerow"><a class="title" href="${esc(it.url)}" target="_blank" rel="noopener">${hl(it.title)}</a><button class="pencil" title="Edit" type="button">✎</button></div><div class="url">${hl(it.url)}</div><div class="chips">${chips}</div><div class="meta">Saved ${relTime(it.createdAt)}</div><div class="toolrow">${action}</div>`;
      li.querySelector('.pencil').onclick = () => { items.forEach((x) => (x._editing = false)); it._editing = true; render(); };
      li.querySelectorAll('.chip').forEach((ch) => (ch.onclick = () => { activeTag = ch.dataset.t; renderAll(); }));
      const rb = li.querySelector('.readbtn'); if (rb) rb.onclick = () => toggleRead(it, !it.toRead);
      const mr = li.querySelector('.markread'); if (mr) mr.onclick = () => toggleRead(it, false);
      const ab = li.querySelector('.archivebtn'); if (ab) ab.onclick = () => setArchived(it, true);
      const sb = li.querySelector('.restorebtn'); if (sb) sb.onclick = () => setArchived(it, false);
    }
    if (flashUrl && it.url === flashUrl) { li.classList.add('flash'); setTimeout(() => li.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); flashUrl = null; }
    listEl.appendChild(li);
  });
}
function renderAll() { renderTagbar(); render(); }

// ---- Edit form (title + tags + delete) ------------------------------------
function renderEditForm(li, it) {
  li.innerHTML = `<div class="editform">
      <div><label>Title</label><input class="ftitle" value="${esc(it.title)}" /></div>
      <div class="tagfield"><label>Tags (comma-separated)</label><input class="ftags" value="${esc(it.tags.join(', '))}" autocomplete="off" /><div class="suggest"></div></div>
      <div class="actions"><button class="save" type="button">Save</button><button class="cancel" type="button">Cancel</button><button class="delete" type="button">Delete</button></div>
    </div><div class="url" style="margin-top:8px">${esc(it.url)}</div>`;
  const ftitle = li.querySelector('.ftitle'), ftags = li.querySelector('.ftags'), sug = li.querySelector('.suggest');
  const finish = () => { it._editing = false; render(); };
  const commit = async () => {
    const title = ftitle.value.trim();
    const tags = ftags.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const patch = { title, tags };
    const prev = { title: it.title, tags: it.tags };
    it.title = title || it.title; it.tags = [...new Set(tags)]; it._editing = false; render();
    try { const updated = await api.patch(it.id, patch); Object.assign(it, updated); render(); }
    catch { it.title = prev.title; it.tags = prev.tags; render(); }
  };
  li.querySelector('.save').onclick = commit;
  li.querySelector('.cancel').onclick = finish;
  li.querySelector('.delete').onclick = () => askDelete(it);
  ftitle.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(); });
  ftags.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(); });
  attachSuggest(ftags, sug);
  setTimeout(() => { ftitle.focus(); ftitle.select(); }, 0);
}

// ---- Tag autocomplete (shared by save box and edit form) ------------------
function attachSuggest(inputEl, sugEl) {
  let hi = -1;
  function show() {
    const parts = inputEl.value.split(',');
    const frag = parts[parts.length - 1].trim().toLowerCase();
    const already = inputEl.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const committed = already.slice(0, -1);
    const c = allTags();
    let opts = Object.keys(c).filter((t) => t.includes(frag) && !committed.includes(t));
    if (frag === '') opts = Object.keys(c).filter((t) => !committed.includes(t));
    opts = opts.sort((a, b) => c[b] - c[a]).slice(0, 6);
    if (!opts.length) { sugEl.classList.remove('open'); return; }
    hi = -1;
    sugEl.innerHTML = opts.map((t) => `<div class="opt" data-t="${esc(t)}" role="option">#${esc(t)}<span class="cnt">${c[t]} saved</span></div>`).join('');
    sugEl.querySelectorAll('.opt').forEach((o) => (o.onmousedown = (e) => { e.preventDefault(); apply(o.dataset.t); }));
    sugEl.classList.add('open');
  }
  function apply(name) {
    const parts = inputEl.value.split(',');
    parts[parts.length - 1] = name;
    inputEl.value = parts.map((p) => p.trim()).filter(Boolean).join(', ') + ', ';
    sugEl.classList.remove('open');
    inputEl.focus();
  }
  inputEl.addEventListener('input', show);
  inputEl.addEventListener('focus', show);
  inputEl.addEventListener('blur', () => setTimeout(() => sugEl.classList.remove('open'), 150));
  inputEl.addEventListener('keydown', (e) => {
    const opts = [...sugEl.querySelectorAll('.opt')];
    if (!sugEl.classList.contains('open') || !opts.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); hi = (hi + 1) % opts.length; opts.forEach((o, i) => o.classList.toggle('hi', i === hi)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hi = (hi - 1 + opts.length) % opts.length; opts.forEach((o, i) => o.classList.toggle('hi', i === hi)); }
    else if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); apply(opts[hi].dataset.t); }
    else if (e.key === 'Escape') sugEl.classList.remove('open');
  });
}

// ---- Mutations ------------------------------------------------------------
async function toggleRead(it, value) {
  const prev = it.toRead; it.toRead = value; render();
  try { const u = await api.patch(it.id, { toRead: value }); Object.assign(it, u); render(); }
  catch { it.toRead = prev; render(); }
}
async function setArchived(it, value) {
  const prev = it.archived; it.archived = value; render();
  try { const u = await api.patch(it.id, { archived: value }); Object.assign(it, u); render(); }
  catch { it.archived = prev; render(); }
}

// ---- Delete confirmation --------------------------------------------------
let pendingDelete = null;
function askDelete(it) { pendingDelete = it; delTarget.textContent = it.title || it.url; delOverlay.hidden = false; }
function closeDelete() { delOverlay.hidden = true; pendingDelete = null; }
$('delConfirm').onclick = async () => {
  const it = pendingDelete; closeDelete();
  if (!it) return;
  const idx = items.indexOf(it); if (idx >= 0) items.splice(idx, 1); renderAll();
  try { await api.remove(it.id); } catch { items.splice(Math.min(idx, items.length), 0, it); renderAll(); }
};
$('delCancel').onclick = closeDelete;
delOverlay.addEventListener('click', (e) => { if (e.target === delOverlay) closeDelete(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !delOverlay.hidden) closeDelete(); });

// ---- Save flow ------------------------------------------------------------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = urlInput.value.trim();
  if (!raw) { showMsg('err', 'Please paste a web address first.'); return; }
  const url = normalizeUrl(raw);
  if (!looksLikeUrl(url)) { showMsg('err', 'That doesn’t look like a web address. Try something like <strong>example.com/article</strong>.'); return; }
  const dup = items.find((i) => !i._optimistic && canonical(i.url) === canonical(url));
  if (dup) { showDuplicate(dup); return; }

  clearMsg();
  const tags = tagInput.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const temp = { id: 'tmp-' + Math.random().toString(36).slice(2), url, title: url, tags: [...new Set(tags)], toRead: false, archived: false, createdAt: new Date().toISOString(), _optimistic: true };
  items.unshift(temp);
  urlInput.value = ''; tagInput.value = ''; saveSuggest.classList.remove('open');
  activeTag = null; query = ''; searchInput.value = ''; searchClear.classList.remove('show'); view = 'all';
  urlInput.focus(); renderAll();

  const { status, body } = await api.create(url, tags).catch(() => ({ status: 0, body: {} }));
  const i = items.indexOf(temp);
  if (status === 201) { if (i >= 0) items.splice(i, 1, body); renderAll(); }
  else { if (i >= 0) items.splice(i, 1); renderAll();
    if (status === 409 && body.bookmark) { if (!items.find((x) => x.id === body.bookmark.id)) items.push(body.bookmark); showDuplicate(body.bookmark); }
    else if (status === 400) showMsg('err', (body.message || 'That address could not be saved.'));
    else showMsg('err', 'Could not reach the server. Please try again.');
  }
});
function showDuplicate(existing) {
  const where = existing.archived ? ' It’s in your <strong>Archived</strong> tab.' : '';
  showMsg('info', 'You’ve already saved this.' + where + ' <a id="jumpExisting">Show it</a>');
  const jump = $('jumpExisting');
  if (jump) jump.onclick = () => {
    view = existing.archived ? 'archive' : 'all'; activeTag = null; query = '';
    searchInput.value = ''; searchClear.classList.remove('show'); flashUrl = existing.url; renderAll(); clearMsg();
  };
}
urlInput.addEventListener('input', () => { if (saveMsg.classList.contains('show')) clearMsg(); });
attachSuggest(tagInput, saveSuggest);

// ---- Search & tabs --------------------------------------------------------
searchInput.addEventListener('input', () => { query = searchInput.value.trim(); searchClear.classList.toggle('show', query.length > 0); render(); });
searchClear.addEventListener('click', () => { searchInput.value = ''; query = ''; searchClear.classList.remove('show'); searchInput.focus(); render(); });
tabsEl.querySelectorAll('button').forEach((b) => (b.onclick = () => { view = b.dataset.view; render(); }));

// ---- Init -----------------------------------------------------------------
async function init() {
  try { items = await api.all(); } catch { items = []; }
  renderAll();
  document.body.setAttribute('data-harness-ready', 'true');
}
init();
