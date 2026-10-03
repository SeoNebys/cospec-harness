'use strict';
/* Bookmark manager client. Implements SCN-001..016 against the JSON API.
   Search/sort/filter run client-side over the loaded collection via Query. */

const state = {
  bookmarks: [], collections: [], settings: { defaultSort: 'newest', density: 'comfortable', fontSize: 'medium' },
  view: 'all', search: '', sort: 'newest',
  selectionMode: false, selected: new Set(), activeCollection: null,
  editingId: null, draftTags: [], deleteTarget: null, bulkTagMode: 'add',
};

// ---------- API ----------
async function api(path, opts) {
  const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
  if (res.status === 401) { window.location.href = '/login'; throw new Error('unauthorized'); }
  return res;
}
const apiJson = async (path, opts) => (await api(path, opts)).json();

// ---------- utilities ----------
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function openHref(url) { return /^https?:\/\//i.test(url) ? url : 'https://' + url; }
function fmtDate(ts) { try { return new Date(ts).toLocaleString(); } catch (e) { return String(ts); } }
function ts(b) { return b.createdAt != null ? b.createdAt : b.seq; }

let toastTimer;
function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function renderMarkdown(src) {
  const lines = String(src || '').split(/\r?\n/);
  let html = '', inList = false;
  const inline = (t) => {
    t = esc(t);
    t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, url) => /^https?:\/\//i.test(url.trim()) ? `<a href="${esc(url.trim())}" target="_blank" rel="noopener">${txt}</a>` : txt);
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    return t;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(li[1])}</li>`; }
    else { if (inList) { html += '</ul>'; inList = false; } if (line.trim()) html += `<p>${inline(line)}</p>`; }
  }
  if (inList) html += '</ul>';
  return html;
}

function allKnownTags() {
  const m = new Map();
  for (const b of state.bookmarks) for (const t of (b.tags || [])) { const k = t.toLowerCase(); if (!m.has(k)) m.set(k, t); }
  return [...m.values()];
}

// ---------- data loading ----------
async function loadAll() {
  const me = await apiJson('/api/me');
  state.settings = me.settings || state.settings;
  state.sort = state.settings.defaultSort;
  applyPrefs();
  document.getElementById('sortSelect').value = state.sort;
  await Promise.all([refreshBookmarks(), refreshCollections()]);
  render();
}
async function refreshBookmarks() {
  const data = await apiJson('/api/bookmarks');
  state.bookmarks = data.bookmarks || [];
  // Drop selection entries that no longer exist.
  for (const id of [...state.selected]) if (!state.bookmarks.some((b) => b.id === id)) state.selected.delete(id);
}
async function refreshCollections() {
  const data = await apiJson('/api/collections');
  state.collections = data.collections || [];
}

// ---------- filtering / sorting ----------
function inView(b) {
  if (state.view === 'archived') return b.archived;
  if (state.view === 'toread') return !b.archived && b.readLater;
  return !b.archived;
}
function visible() {
  const filtered = state.bookmarks.filter((b) => inView(b) && window.Query.matches(state.search, b));
  const a = filtered.slice();
  if (state.sort === 'newest') a.sort((x, y) => ts(y) - ts(x) || y.seq - x.seq);
  else if (state.sort === 'oldest') a.sort((x, y) => ts(x) - ts(y) || x.seq - y.seq);
  else if (state.sort === 'az') a.sort((x, y) => (x.title || '').localeCompare(y.title || '', undefined, { sensitivity: 'base' }));
  else if (state.sort === 'za') a.sort((x, y) => (y.title || '').localeCompare(x.title || '', undefined, { sensitivity: 'base' }));
  return a;
}

// ---------- rendering ----------
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');

function faviconHtml(b) {
  const initial = (b.title || b.url || '?').trim().charAt(0).toUpperCase();
  if (b.favicon) return `<img src="${esc(b.favicon)}" alt="" onerror="this.replaceWith(document.createTextNode('${initial}'))" />`;
  return initial;
}
function snapBadge(b) {
  if (b.snapshotStatus === 'pending') return `<div><span class="snap-badge pending">⏳ Saving copy…</span></div>`;
  if (b.snapshotStatus === 'failed') return `<div><span class="snap-badge failed" data-snap="retry" title="Retry from Edit">⚠ Copy failed — retry in Edit</span></div>`;
  if (b.snapshotStatus === 'saved') return `<div><span class="snap-badge" data-snap="view" title="Open the preserved copy">${b.snapshotIsPdf ? '📄 Saved PDF' : '🗎 Saved copy'}</span></div>`;
  return '';
}

function render() {
  // counts
  document.getElementById('toreadCount').textContent = state.bookmarks.filter((b) => b.readLater && !b.archived).length || '';
  document.getElementById('archivedCount').textContent = state.bookmarks.filter((b) => b.archived).length || '';
  const shown = visible();
  listEl.innerHTML = '';
  emptyEl.hidden = shown.length > 0;
  if (shown.length === 0) emptyEl.textContent = emptyMessage();

  for (const b of shown) {
    const card = document.createElement('div');
    const selectable = state.selectionMode;
    card.className = 'card' + (selectable ? '' : ' clickable') + (state.selected.has(b.id) ? ' selected' : '');
    card.dataset.id = b.id;
    const href = openHref(b.url);
    const check = selectable ? `<div class="checkcol"><input type="checkbox" ${state.selected.has(b.id) ? 'checked' : ''} aria-label="Select"></div>` : '';
    const preview = (!selectable || true) && b.previewImage ? `<img class="preview" src="${esc(b.previewImage)}" alt="Page preview" onerror="this.remove()">` : '';
    const flag = b.readLater ? '<span class="toread-flag">To read</span><br>' : '';
    const warn = b.fetchFailed ? `<div class="fetch-warn">⚠ Couldn't fetch page details — click Edit to add a title and description.</div>` : '';
    const note = b.note ? `<div class="note">${renderMarkdown(b.note)}</div>` : '';
    const tags = (b.tags && b.tags.length) ? `<div class="tags">${b.tags.map((t) => `<button class="tag" type="button" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : '';
    const archived = b.archived;
    const actions = selectable ? '' : `<div class="col-actions">
        ${archived ? '' : `<button class="readlater-btn ${b.readLater ? 'on' : ''}" data-act="readlater" type="button">${b.readLater ? '✓ To read' : 'Read later'}</button>`}
        <button class="edit-btn" data-act="edit" type="button">Edit</button>
        ${archived ? '<button class="restore-btn" data-act="restore" type="button">Restore</button>' : '<button class="archive-btn" data-act="archive" type="button">Archive</button>'}
        <button class="delete-btn" data-act="delete" type="button">Delete</button>
      </div>`;
    card.innerHTML = `${check}
      <div class="favicon">${faviconHtml(b)}</div>
      <div class="body">
        ${preview}${flag}
        <p class="title"><a href="${esc(href)}" target="_blank" rel="noopener">${esc(b.title || b.url)}</a></p>
        ${warn}
        <p class="desc">${esc(b.description || '')}</p>
        <span class="site">${esc(b.url)}</span>
        ${note}${tags}${snapBadge(b)}
      </div>${actions}`;
    listEl.appendChild(card);
  }
  updateBulkBar();
  updateSaveSearchBtn();
  renderCollections();
}

function emptyMessage() {
  if (state.bookmarks.length === 0) return 'No bookmarks yet. Paste a link above to save your first one.';
  if (state.search) return `No bookmarks match “${state.search}”. Try a different word.`;
  if (state.view === 'toread') return 'Nothing marked to read later. Use “Read later” on any bookmark to add it here.';
  if (state.view === 'archived') return 'Nothing archived. Use “Archive” to move older links out of the way — they stay here, not deleted.';
  return 'No bookmarks yet. Paste a link above to save your first one.';
}

// ---------- list interactions (event delegation) ----------
listEl.addEventListener('click', (e) => {
  const card = e.target.closest('.card'); if (!card) return;
  const id = Number(card.dataset.id);
  const b = state.bookmarks.find((x) => x.id === id); if (!b) return;
  if (state.selectionMode) {
    if (e.target.closest('a')) return;
    toggleSelected(id); return;
  }
  const tagBtn = e.target.closest('.tag');
  if (tagBtn) { e.preventDefault(); filterByTag(tagBtn.dataset.tag); return; }
  const snap = e.target.closest('[data-snap]');
  if (snap) { e.preventDefault(); if (snap.dataset.snap === 'view') window.open('/snapshots/' + id, '_blank', 'noopener'); else openEditor(id); return; }
  const actBtn = e.target.closest('[data-act]');
  if (actBtn) {
    e.preventDefault();
    const act = actBtn.dataset.act;
    if (act === 'edit') openEditor(id);
    else if (act === 'readlater') patchBookmark(id, { readLater: !b.readLater }).then(() => { if (!b.readLater) showToast('Added to “To read”.'); });
    else if (act === 'archive') patchBookmark(id, { archived: true }).then(() => showToast('Archived — find it under “Archived”, it\'s not deleted.'));
    else if (act === 'restore') patchBookmark(id, { archived: false }).then(() => showToast('Restored to your bookmarks.'));
    else if (act === 'delete') askDelete(id);
    return;
  }
  if (e.target.closest('a')) return; // title link opens page
  window.open(openHref(b.url), '_blank', 'noopener');
});

function flashCard(id) {
  const el = listEl.querySelector(`.card[data-id="${id}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

// ---------- save (create) ----------
const urlInput = document.getElementById('url');
const saveBtn = document.getElementById('saveBtn');
const saveError = document.getElementById('saveError');
function showSaveError(m) { saveError.textContent = m; saveError.hidden = false; }
urlInput.addEventListener('input', () => { saveError.hidden = true; });

document.getElementById('saver').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) { showSaveError('Please paste a web address to save.'); return; }
  saveBtn.disabled = true;
  try {
    const res = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url }) });
    const data = await res.json();
    if (!res.ok) { showSaveError(data.message || "That doesn't look like a web address."); saveBtn.disabled = false; return; }
    urlInput.value = '';
    if (data.duplicate) {
      await refreshBookmarks();
      if (data.bookmark.archived) { setView('archived'); showToast('This link is archived. Opening it — use Restore to bring it back.'); }
      else showToast('You already saved this — opening it so you can update it.');
      render();
      openEditor(data.bookmark.id);
    } else {
      await refreshBookmarks(); render();
      flashCard(data.bookmark.id);
      pollUntilSettled();
    }
  } catch (err) { showSaveError('Could not save. Please try again.'); }
  saveBtn.disabled = false;
});

// ---------- snapshot / archive polling ----------
let pollTimer = null;
function anyPending() { return state.bookmarks.some((b) => b.snapshotStatus === 'pending' || b.archiveorgStatus === 'pending'); }
function pollUntilSettled() {
  if (pollTimer) return;
  let attempts = 0;
  pollTimer = setInterval(async () => {
    attempts++;
    await refreshBookmarks();
    render();
    if (state.editingId != null) { const b = state.bookmarks.find((x) => x.id === state.editingId); if (b) renderSnapshotArea(b); }
    if (!anyPending() || attempts > 40) { clearInterval(pollTimer); pollTimer = null; }
  }, 1500);
}

// ---------- generic mutations ----------
async function patchBookmark(id, fields) {
  const res = await api('/api/bookmarks/' + id, { method: 'PATCH', body: JSON.stringify(fields) });
  const data = await res.json();
  if (!res.ok) { showToast(data.message || 'Update failed.'); return null; }
  await refreshBookmarks(); render();
  return data.bookmark;
}

// ---------- tabs / search / sort ----------
document.getElementById('tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab'); if (!tab) return;
  setView(tab.dataset.view);
});
function setView(v) {
  state.view = v;
  document.querySelectorAll('#tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.view === v));
  render();
}
const searchEl = document.getElementById('search');
const searchClear = document.getElementById('searchClear');
searchEl.addEventListener('input', () => { state.search = searchEl.value.trim(); searchClear.hidden = !searchEl.value; render(); });
searchClear.addEventListener('click', () => { searchEl.value = ''; state.search = ''; searchClear.hidden = true; render(); searchEl.focus(); });
document.getElementById('sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
function filterByTag(tag) {
  const q = '#' + tag;
  searchEl.value = q; state.search = q; searchClear.hidden = false;
  render(); window.scrollTo({ top: 0, behavior: 'smooth' }); showToast('Showing bookmarks tagged “' + tag + '”.');
}

// ---------- editor ----------
const backdrop = document.getElementById('backdrop');
const editAddr = document.getElementById('editAddr');
const editTitle = document.getElementById('editTitle');
const editDesc = document.getElementById('editDesc');
const editNote = document.getElementById('editNote');
const chipbox = document.getElementById('chipbox');
const tagInput = document.getElementById('tagInput');
const suggestions = document.getElementById('suggestions');
let activeSuggestion = -1;

function renderChips() {
  chipbox.querySelectorAll('.chip').forEach((c) => c.remove());
  state.draftTags.forEach((t, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `${esc(t)} <button type="button" aria-label="Remove tag">×</button>`;
    chip.querySelector('button').addEventListener('click', () => { state.draftTags.splice(i, 1); renderChips(); });
    chipbox.insertBefore(chip, tagInput);
  });
}
function addTag(v) {
  const raw = (v || '').trim().replace(/,$/, '').trim();
  if (!raw) return;
  if (!state.draftTags.some((t) => t.toLowerCase() === raw.toLowerCase())) state.draftTags.push(raw);
  tagInput.value = ''; renderChips(); renderSuggestions();
}
function currentSuggestions() {
  const q = tagInput.value.trim().toLowerCase();
  if (!q) return [];
  return allKnownTags().filter((t) => !state.draftTags.some((d) => d.toLowerCase() === t.toLowerCase()) && t.toLowerCase().includes(q)).slice(0, 6);
}
function renderSuggestions() {
  const opts = currentSuggestions(); activeSuggestion = -1;
  if (!opts.length) { suggestions.classList.remove('open'); suggestions.innerHTML = ''; return; }
  suggestions.innerHTML = opts.map((t, i) => `<div class="opt" data-i="${i}">${esc(t)}</div>`).join('');
  suggestions.querySelectorAll('.opt').forEach((el) => el.addEventListener('mousedown', (e) => { e.preventDefault(); addTag(opts[+el.dataset.i]); }));
  suggestions.classList.add('open');
}
tagInput.addEventListener('input', renderSuggestions);
tagInput.addEventListener('keydown', (e) => {
  const opts = currentSuggestions();
  if (e.key === 'ArrowDown' && opts.length) { e.preventDefault(); activeSuggestion = Math.min(activeSuggestion + 1, opts.length - 1); hi(); }
  else if (e.key === 'ArrowUp' && opts.length) { e.preventDefault(); activeSuggestion = Math.max(activeSuggestion - 1, 0); hi(); }
  else if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (activeSuggestion >= 0 && opts[activeSuggestion]) addTag(opts[activeSuggestion]); else addTag(tagInput.value); }
  else if (e.key === 'Backspace' && !tagInput.value && state.draftTags.length) { state.draftTags.pop(); renderChips(); renderSuggestions(); }
});
function hi() { suggestions.querySelectorAll('.opt').forEach((el, i) => el.classList.toggle('active', i === activeSuggestion)); }
tagInput.addEventListener('blur', () => { addTag(tagInput.value); suggestions.classList.remove('open'); });

const snapshotArea = document.getElementById('snapshotArea');
const archiveOrgChk = document.getElementById('archiveOrgChk');
const archiveOrgArea = document.getElementById('archiveOrgArea');

function openEditor(id) {
  const b = state.bookmarks.find((x) => x.id === id); if (!b) return;
  state.editingId = id;
  editAddr.value = b.url; editTitle.value = b.title || ''; editDesc.value = b.description || ''; editNote.value = b.note || '';
  state.draftTags = (b.tags || []).slice(); tagInput.value = '';
  renderChips(); renderSuggestions(); renderSnapshotArea(b);
  backdrop.classList.add('open'); editTitle.focus();
}
function closeEditor() { backdrop.classList.remove('open'); state.editingId = null; }
document.getElementById('cancelEdit').addEventListener('click', closeEditor);
backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeEditor(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && backdrop.classList.contains('open')) closeEditor(); });

document.getElementById('saveEdit').addEventListener('click', async () => {
  addTag(tagInput.value);
  const id = state.editingId;
  const fields = { url: editAddr.value.trim(), title: editTitle.value.trim(), description: editDesc.value.trim(), note: editNote.value.trim(), tags: state.draftTags.slice() };
  const res = await api('/api/bookmarks/' + id, { method: 'PATCH', body: JSON.stringify(fields) });
  const data = await res.json();
  if (!res.ok) { showToast(data.message || 'Could not save changes.'); return; }
  closeEditor(); await refreshBookmarks(); render(); flashCard(id); showToast('Saved your changes.');
});

function renderSnapshotArea(b) {
  const pdf = b.snapshotIsPdf || /\.pdf($|[?#])/i.test(b.url);
  if (b.snapshotStatus === 'pending') {
    snapshotArea.innerHTML = `<p class="fieldhint"><span class="spinner"></span> Saving a copy of ${pdf ? 'the PDF' : 'the page'}…</p>`;
  } else if (b.snapshotStatus === 'failed') {
    snapshotArea.innerHTML = `<div class="fetch-warn" style="color:#c0392b;">⚠ Automatic copy failed. Your bookmark is safe, but the preserved copy wasn't captured.</div>
      <button class="btn primary" id="retrySnap" type="button">Retry preserving ${pdf ? 'the PDF' : 'a copy'}</button>`;
    snapshotArea.querySelector('#retrySnap').addEventListener('click', () => retrySnapshot(b.id));
  } else if (b.snapshotStatus === 'saved') {
    snapshotArea.innerHTML = `<p class="fieldhint">${pdf ? '📄 Preserved PDF' : '🗎 Preserved copy'} saved on <b>${fmtDate(b.snapshotAt)}</b> (captured automatically). You can revisit it even if the original changes or disappears.</p>
      <button class="btn" id="viewSnap" type="button">View saved copy</button>
      <button class="btn" id="reSnap" type="button">Refresh copy</button>`;
    snapshotArea.querySelector('#viewSnap').addEventListener('click', () => window.open('/snapshots/' + b.id, '_blank', 'noopener'));
    snapshotArea.querySelector('#reSnap').addEventListener('click', () => retrySnapshot(b.id));
  } else {
    snapshotArea.innerHTML = `<p class="fieldhint">No preserved copy yet.</p><button class="btn primary" id="makeSnap" type="button">${pdf ? 'Preserve the PDF' : 'Save a copy of this page'}</button>`;
    snapshotArea.querySelector('#makeSnap').addEventListener('click', () => retrySnapshot(b.id));
  }
  archiveOrgChk.checked = b.archiveorgStatus === 'saved' || b.archiveorgStatus === 'pending';
  renderArchiveOrgArea(b);
}
async function retrySnapshot(id) {
  await api('/api/bookmarks/' + id + '/snapshot', { method: 'POST' });
  await refreshBookmarks(); render();
  const b = state.bookmarks.find((x) => x.id === id); if (b && state.editingId === id) renderSnapshotArea(b);
  pollUntilSettled();
}
function renderArchiveOrgArea(b) {
  if (b.archiveorgStatus === 'pending') archiveOrgArea.innerHTML = `<span class="fieldhint"><span class="spinner"></span> Requesting a copy in the Internet Archive…</span>`;
  else if (b.archiveorgStatus === 'saved') archiveOrgArea.innerHTML = `Saved to the Internet Archive: <a href="${esc(b.archiveorgUrl)}" target="_blank" rel="noopener">${esc(b.archiveorgUrl)}</a>`;
  else if (b.archiveorgStatus === 'failed') archiveOrgArea.innerHTML = `<span class="fetch-warn" style="color:#c0392b;">⚠ Couldn't reach the Internet Archive. Untick and tick again to retry.</span>`;
  else archiveOrgArea.innerHTML = '';
}
archiveOrgChk.addEventListener('change', async () => {
  const id = state.editingId; if (id == null) return;
  await api('/api/bookmarks/' + id + '/archiveorg', { method: 'POST', body: JSON.stringify({ enabled: archiveOrgChk.checked }) });
  await refreshBookmarks(); render();
  const b = state.bookmarks.find((x) => x.id === id); if (b) renderSnapshotArea(b);
  if (archiveOrgChk.checked) { showToast('Requested a copy in the Internet Archive.'); pollUntilSettled(); }
});

// ---------- delete confirm ----------
const confirmBackdrop = document.getElementById('confirmBackdrop');
const confirmTarget = document.getElementById('confirmTarget');
const confirmTitle = document.getElementById('confirmTitle');
function askDelete(id) {
  const b = state.bookmarks.find((x) => x.id === id); if (!b) return;
  state.deleteTarget = { type: 'single', id };
  confirmTitle.textContent = 'Delete this bookmark?';
  confirmTarget.textContent = b.title || b.url;
  confirmBackdrop.classList.add('open');
}
function askBulkDelete() {
  state.deleteTarget = { type: 'bulk' };
  confirmTitle.textContent = 'Delete these bookmarks?';
  confirmTarget.textContent = state.selected.size + ' selected bookmark' + (state.selected.size === 1 ? '' : 's');
  confirmBackdrop.classList.add('open');
}
function closeConfirm() { confirmBackdrop.classList.remove('open'); state.deleteTarget = null; }
document.getElementById('cancelDelete').addEventListener('click', closeConfirm);
confirmBackdrop.addEventListener('click', (e) => { if (e.target === confirmBackdrop) closeConfirm(); });
document.getElementById('confirmDelete').addEventListener('click', async () => {
  const t = state.deleteTarget; if (!t) return;
  if (t.type === 'single') { await api('/api/bookmarks/' + t.id, { method: 'DELETE' }); showToast('Bookmark deleted permanently.'); }
  else { const ids = [...state.selected]; await api('/api/bookmarks/bulk', { method: 'POST', body: JSON.stringify({ ids, action: 'delete' }) }); state.selected.clear(); showToast(`Deleted ${ids.length} bookmark(s) permanently.`); }
  closeConfirm(); await refreshBookmarks(); render();
});

// ---------- selection & bulk ----------
const selectBtn = document.getElementById('selectBtn');
const bulkbar = document.getElementById('bulkbar');
function toggleSelected(id) { if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id); render(); }
selectBtn.addEventListener('click', () => {
  state.selectionMode = !state.selectionMode;
  selectBtn.classList.toggle('active', state.selectionMode);
  selectBtn.textContent = state.selectionMode ? 'Cancel select' : 'Select';
  if (!state.selectionMode) state.selected.clear();
  render();
});
function updateBulkBar() {
  bulkbar.hidden = !state.selectionMode;
  document.body.style.paddingBottom = state.selectionMode ? '64px' : '';
  if (!state.selectionMode) return;
  document.getElementById('bulkCount').textContent = state.selected.size + ' selected';
  document.getElementById('selectAllBtn').textContent = `Select all ${visible().length} matching`;
  document.getElementById('bulkArchive').hidden = state.view === 'archived';
  document.getElementById('bulkRestore').hidden = state.view !== 'archived';
}
document.querySelector('#bulkbar .bulkbar-inner').addEventListener('click', async (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  const act = btn.dataset.act;
  if (act === 'done') { state.selectionMode = false; state.selected.clear(); selectBtn.classList.remove('active'); selectBtn.textContent = 'Select'; render(); return; }
  if (act === 'clear') { state.selected.clear(); render(); return; }
  if (act === 'selectAll') { visible().forEach((b) => state.selected.add(b.id)); render(); return; }
  if (state.selected.size === 0) { showToast('Select some bookmarks first.'); return; }
  if (act === 'delete') { askBulkDelete(); return; }
  if (act === 'addTag') { openBulkTag('add'); return; }
  if (act === 'removeTag') { openBulkTag('remove'); return; }
  const ids = [...state.selected];
  const map = { readlater: 'readLater', read: 'read', archive: 'archive', restore: 'restore' };
  if (map[act]) {
    await api('/api/bookmarks/bulk', { method: 'POST', body: JSON.stringify({ ids, action: map[act] }) });
    if (act === 'archive' || act === 'restore') state.selected.clear();
    await refreshBookmarks(); render();
    showToast(`Updated ${ids.length} bookmark(s).`);
  }
});

// bulk tag modal
const bulkTagBackdrop = document.getElementById('bulkTagBackdrop');
const bulkTagBody = document.getElementById('bulkTagBody');
function selectedList() { return state.bookmarks.filter((b) => state.selected.has(b.id)); }
function openBulkTag(mode) {
  state.bulkTagMode = mode;
  const applyBtn = document.getElementById('bulkTagApply');
  document.getElementById('bulkTagSub').textContent = state.selected.size + ' bookmark(s) selected';
  if (mode === 'add') {
    document.getElementById('bulkTagTitle').textContent = 'Add a tag to selected';
    const known = allKnownTags();
    bulkTagBody.innerHTML = `<input type="text" id="bulkTagInput" list="bulkTagList" placeholder="Type a tag" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;"><datalist id="bulkTagList">${known.map((t) => `<option value="${esc(t)}"></option>`).join('')}</datalist>`;
    applyBtn.hidden = false; applyBtn.textContent = 'Add tag';
  } else {
    document.getElementById('bulkTagTitle').textContent = 'Remove a tag from selected';
    renderBulkRemoveTags(); applyBtn.hidden = true;
  }
  bulkTagBackdrop.classList.add('open');
  const inp = document.getElementById('bulkTagInput'); if (inp) inp.focus();
}
function renderBulkRemoveTags() {
  const union = new Map();
  selectedList().forEach((b) => (b.tags || []).forEach((t) => union.set(t.toLowerCase(), t)));
  const tags = [...union.values()];
  bulkTagBody.innerHTML = tags.length
    ? `<p class="fieldhint">Click a tag to remove it from all selected:</p>` + tags.map((t) => `<button class="bulk-remove-tag" data-t="${esc(t)}" type="button">${esc(t)} ✕</button>`).join('')
    : `<p class="fieldhint">The selected bookmarks have no tags.</p>`;
  bulkTagBody.querySelectorAll('.bulk-remove-tag').forEach((btn) => btn.addEventListener('click', async () => {
    await api('/api/bookmarks/bulk', { method: 'POST', body: JSON.stringify({ ids: [...state.selected], action: 'removeTag', value: btn.dataset.t }) });
    await refreshBookmarks(); renderBulkRemoveTags(); render();
  }));
}
document.getElementById('bulkTagCancel').addEventListener('click', () => bulkTagBackdrop.classList.remove('open'));
bulkTagBackdrop.addEventListener('click', (e) => { if (e.target === bulkTagBackdrop) bulkTagBackdrop.classList.remove('open'); });
document.getElementById('bulkTagApply').addEventListener('click', async () => {
  if (state.bulkTagMode === 'add') {
    const val = (document.getElementById('bulkTagInput').value || '').trim();
    if (!val) { bulkTagBackdrop.classList.remove('open'); return; }
    await api('/api/bookmarks/bulk', { method: 'POST', body: JSON.stringify({ ids: [...state.selected], action: 'addTag', value: val }) });
    bulkTagBackdrop.classList.remove('open'); await refreshBookmarks(); render(); showToast(`Added “${val}” to selected.`);
  }
});

// ---------- collections ----------
const collectionsEl = document.getElementById('collections');
const saveSearchBtn = document.getElementById('saveSearchBtn');
const collBackdrop = document.getElementById('collBackdrop');
function renderCollections() {
  collectionsEl.innerHTML = state.collections.length
    ? state.collections.map((c) => `<span class="coll-chip ${state.activeCollection === c.id ? 'active' : ''}" data-id="${c.id}"><button class="open" type="button">${esc(c.name)}</button><button class="del" type="button" title="Remove collection">×</button></span>`).join('')
    : `<span class="coll-none">none yet — run a search and save it</span>`;
  collectionsEl.querySelectorAll('.coll-chip').forEach((chip) => {
    const id = Number(chip.dataset.id);
    chip.querySelector('.open').addEventListener('click', () => openCollection(id));
    chip.querySelector('.del').addEventListener('click', async () => { await api('/api/collections/' + id, { method: 'DELETE' }); if (state.activeCollection === id) state.activeCollection = null; await refreshCollections(); render(); showToast('Collection removed.'); });
  });
}
function openCollection(id) {
  const c = state.collections.find((x) => x.id === id); if (!c) return;
  state.activeCollection = id; setView('all');
  searchEl.value = c.query; state.search = c.query; searchClear.hidden = !c.query;
  render(); window.scrollTo({ top: 0, behavior: 'smooth' }); showToast(`Showing “${c.name}” — live matches.`);
}
saveSearchBtn.addEventListener('click', () => {
  document.getElementById('collName').value = ''; document.getElementById('collQuery').value = state.search;
  collBackdrop.classList.add('open'); document.getElementById('collName').focus();
});
document.getElementById('collCancel').addEventListener('click', () => collBackdrop.classList.remove('open'));
collBackdrop.addEventListener('click', (e) => { if (e.target === collBackdrop) collBackdrop.classList.remove('open'); });
document.getElementById('collSave').addEventListener('click', async () => {
  const name = document.getElementById('collName').value.trim();
  const query = document.getElementById('collQuery').value.trim();
  if (!name) { showToast('Give the collection a name.'); return; }
  if (!query) { showToast('A collection needs a search to run.'); return; }
  await api('/api/collections', { method: 'POST', body: JSON.stringify({ name, query }) });
  collBackdrop.classList.remove('open'); await refreshCollections(); render(); showToast(`Saved collection “${name}”.`);
});
function updateSaveSearchBtn() {
  saveSearchBtn.disabled = !state.search;
  if (state.activeCollection) { const c = state.collections.find((x) => x.id === state.activeCollection); if (!c || c.query !== state.search) state.activeCollection = null; }
}

// ---------- import / export / settings / logout ----------
const importFile = document.getElementById('importFile');
document.getElementById('importBtn').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const f = importFile.files && importFile.files[0]; if (!f) return;
  const text = await f.text();
  const res = await api('/api/import', { method: 'POST', headers: { 'Content-Type': 'text/html' }, body: text });
  const data = await res.json();
  importFile.value = '';
  await refreshBookmarks(); render();
  showToast(`Imported ${data.added} bookmark(s)${data.skipped ? `, skipped ${data.skipped} already saved` : ''}.`);
  pollUntilSettled();
});
document.getElementById('exportBtn').addEventListener('click', () => { window.location.href = '/api/export'; });
document.getElementById('logoutBtn').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); window.location.href = '/login'; });

// settings
const settingsBackdrop = document.getElementById('settingsBackdrop');
function applyPrefs() {
  document.body.classList.remove('density-comfortable', 'density-cozy', 'density-compact');
  document.body.classList.add('density-' + state.settings.density);
  document.body.classList.remove('font-small', 'font-medium', 'font-large');
  document.body.classList.add('font-' + state.settings.fontSize);
}
function markSeg(container, value) { container.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === value)); }
async function saveSettings() {
  await api('/api/settings', { method: 'PUT', body: JSON.stringify(state.settings) });
}
document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('setSort').value = state.settings.defaultSort;
  markSeg(document.getElementById('setDensity'), state.settings.density);
  markSeg(document.getElementById('setFont'), state.settings.fontSize);
  settingsBackdrop.classList.add('open');
});
document.getElementById('setSort').addEventListener('change', (e) => {
  state.settings.defaultSort = e.target.value; state.sort = e.target.value;
  document.getElementById('sortSelect').value = e.target.value; render(); saveSettings();
});
document.getElementById('setDensity').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.settings.density = b.dataset.v; markSeg(e.currentTarget, b.dataset.v); applyPrefs(); saveSettings(); });
document.getElementById('setFont').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.settings.fontSize = b.dataset.v; markSeg(e.currentTarget, b.dataset.v); applyPrefs(); saveSettings(); });
document.getElementById('settingsClose').addEventListener('click', () => { settingsBackdrop.classList.remove('open'); showToast('Settings saved.'); });
settingsBackdrop.addEventListener('click', (e) => { if (e.target === settingsBackdrop) settingsBackdrop.classList.remove('open'); });

// ---------- boot ----------
loadAll()
  .then(() => { document.body.setAttribute('data-harness-ready', 'true'); if (anyPending()) pollUntilSettled(); })
  .catch((e) => { if (String(e.message) !== 'unauthorized') { console.error(e); document.body.setAttribute('data-harness-ready', 'true'); } });
