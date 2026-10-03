/* Bookmarks app — browser logic. Talks to the JSON API; all data lives in the
 * durable server store. View concerns (search, sort, paging, text size) are
 * computed client-side over the loaded collection. */
'use strict';

// ---- API helpers ----------------------------------------------------------
async function api(method, url, body, asText) {
  const opts = { method, headers: {} };
  if (body != null) {
    if (asText) { opts.headers['Content-Type'] = 'text/html'; opts.body = body; }
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(url, opts);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// ---- state ----------------------------------------------------------------
let bookmarks = [], prefs = { sortKey: 'added_desc', pageSize: 10, textSize: 'm' }, savedSearches = [];
let currentTab = 'toread', query = '', predicate = () => true, queryError = false;
let page = 1, selected = new Set(), editingId = null, currentMeta = { favicon: null, image: null };
let lastFiltered = [], lastPageItems = [];

const $ = (id) => document.getElementById(id);

function normAddress(u) {
  try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, '') + x.search).toLowerCase(); }
  catch (e) { return String(u).trim().toLowerCase(); }
}
function findSaved(u) { const k = normAddress(u); return bookmarks.find(b => normAddress(b.url) === k); }
function isValidUrl(v) { try { new URL(v); return true; } catch (e) { return false; } }
function isPdf(u) { return /\.pdf($|\?|#)/i.test(u); }

async function reload() {
  const s = await api('GET', '/api/state');
  bookmarks = s.bookmarks; prefs = s.prefs; savedSearches = s.savedSearches;
  render();
}

// ---- safe Markdown for notes (SCN-018) ------------------------------------
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function mdInline(s) {
  return s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function renderMarkdown(src) {
  if (!src) return '';
  const lines = escapeHtml(src).split(/\r?\n/);
  let html = '', inList = false;
  for (const line of lines) {
    if (/^\s*[-*]\s+/.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + mdInline(line.replace(/^\s*[-*]\s+/, '')) + '</li>'; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    const h = line.match(/^\s*(#{1,3})\s+(.*)$/);
    if (h) html += `<h${h[1].length}>` + mdInline(h[2]) + `</h${h[1].length}>`;
    else if (line.trim() !== '') html += '<p>' + mdInline(line) + '</p>';
  }
  if (inList) html += '</ul>';
  return html;
}

// ---- icon / preview (SCN-015) ---------------------------------------------
function favHtml(b) {
  const letter = (b.site && b.site[0] || '?').toUpperCase();
  if (b.favicon) return `<div class="fav"><img class="favimg" src="${b.favicon}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="favletter" style="display:none">${letter}</span></div>`;
  return `<div class="fav"><span class="favletter" style="display:flex">${letter}</span></div>`;
}

// ---- save form ------------------------------------------------------------
const urlEl = $('url'), fetching = $('fetching'), badurl = $('badurl'), dupmsg = $('dupmsg');
const fetchbox = $('fetchbox'), warnmsg = $('warnmsg'), autofilled = $('autofilled');
const pTitle = $('p-title'), pDesc = $('p-desc'), pSite = $('p-site'), favSlot = $('fav-slot'), previewImgEl = $('preview-img');
const saveBtn = $('save'), noteEl = $('note'), notePreview = $('note-preview');
const keepcopyEl = $('keepcopy'), iacopyEl = $('iacopy'), keepcopyLabel = $('keepcopy-label');
let tags = [], timer = null;

function refreshSave() { saveBtn.disabled = !isValidUrl(urlEl.value.trim()); }
function updateCopyLabel() {
  keepcopyLabel.textContent = isPdf(urlEl.value.trim())
    ? 'Keep a copy of this PDF I can revisit if the original changes or disappears'
    : 'Keep a copy of this page I can revisit if the original changes or disappears';
}
function showMeta(m) {
  currentMeta = { favicon: m.favicon || null, image: m.image || null };
  favSlot.innerHTML = favHtml({ site: m.site, favicon: m.favicon });
  previewImgEl.innerHTML = m.image ? `<img src="${m.image}" alt="preview">` : `<div class="noimg">No preview image available for this page.</div>`;
}
function updateNotePreview() {
  const v = noteEl.value.trim();
  if (v) { notePreview.innerHTML = renderMarkdown(v); notePreview.classList.remove('hidden'); }
  else { notePreview.classList.add('hidden'); notePreview.innerHTML = ''; }
}
function resetForm() {
  urlEl.value = ''; pTitle.value = ''; pDesc.value = ''; noteEl.value = ''; updateNotePreview();
  tags = []; renderTags(); editingId = null; currentMeta = { favicon: null, image: null };
  fetchbox.classList.add('hidden'); dupmsg.classList.add('hidden'); badurl.classList.add('hidden');
  keepcopyEl.checked = true; iacopyEl.checked = false; updateCopyLabel();
  saveBtn.textContent = 'Save bookmark'; refreshSave();
}
function loadIntoForm(b, dup) {
  editingId = b.id;
  urlEl.value = b.url; pTitle.value = b.title; pDesc.value = b.desc || '';
  pSite.textContent = b.site; showMeta(b);
  tags = [...(b.tags || [])]; renderTags();
  noteEl.value = b.note || ''; updateNotePreview();
  keepcopyEl.checked = b.keepCopy !== false; iacopyEl.checked = !!b.ia; updateCopyLabel();
  fetchbox.classList.remove('hidden', 'failed'); warnmsg.classList.add('hidden'); autofilled.classList.add('hidden');
  dupmsg.classList.toggle('hidden', !dup);
  saveBtn.textContent = 'Update bookmark'; refreshSave();
}

urlEl.addEventListener('input', () => {
  clearTimeout(timer);
  const val = urlEl.value.trim();
  fetchbox.classList.add('hidden'); dupmsg.classList.add('hidden'); badurl.classList.add('hidden');
  editingId = null; saveBtn.textContent = 'Save bookmark'; refreshSave(); updateCopyLabel();
  if (!val) { fetching.classList.add('hidden'); return; }
  if (!isValidUrl(val)) { fetching.classList.add('hidden'); badurl.classList.remove('hidden'); return; } // SCN-012
  const existing = findSaved(val);
  if (existing) { fetching.classList.add('hidden'); loadIntoForm(existing, true); return; } // SCN-003
  fetching.classList.remove('hidden');
  timer = setTimeout(async () => {
    const data = await api('POST', '/api/metadata', { url: val });
    fetching.classList.add('hidden');
    fetchbox.classList.remove('hidden');
    if (data && data.ok) {
      fetchbox.classList.remove('failed'); warnmsg.classList.add('hidden'); autofilled.classList.remove('hidden');
      pTitle.value = data.title || ''; pDesc.value = data.desc || ''; pSite.textContent = data.site || '';
      showMeta(data);
    } else { // SCN-002
      fetchbox.classList.add('failed'); warnmsg.classList.remove('hidden'); autofilled.classList.add('hidden');
      pTitle.value = ''; pDesc.value = ''; pSite.textContent = (data && data.site) || '';
      showMeta({ site: (data && data.site) || '', favicon: (data && data.favicon) || null, image: null });
    }
    refreshSave();
  }, 400);
});
noteEl.addEventListener('input', updateNotePreview);

saveBtn.addEventListener('click', async () => {
  const url = urlEl.value.trim();
  if (!isValidUrl(url)) return;
  const payload = {
    url, title: pTitle.value.trim(), desc: pDesc.value.trim(),
    tags: [...tags], note: noteEl.value.trim(),
    favicon: currentMeta.favicon, image: currentMeta.image,
    keepCopy: keepcopyEl.checked, ia: iacopyEl.checked,
  };
  saveBtn.disabled = true;
  if (editingId) await api('PUT', '/api/bookmarks/' + editingId, payload);
  else await api('POST', '/api/bookmarks', payload);
  resetForm(); currentTab = 'toread'; page = 1; setActiveTab();
  await reload();
});

// ---- tags with suggestions (SCN-016) --------------------------------------
const tagEntry = $('tag-entry'), tagsInput = $('tags-input'), tagSuggest = $('tag-suggest');
let sugList = [], sugActive = -1;
function tagCounts() { const m = new Map(); bookmarks.forEach(b => (b.tags || []).forEach(t => m.set(t, (m.get(t) || 0) + 1))); return m; }
function renderTags() {
  [...tagsInput.querySelectorAll('.chip')].forEach(c => c.remove());
  tags.forEach((t, i) => {
    const chip = document.createElement('span'); chip.className = 'chip';
    chip.innerHTML = `${t} <button aria-label="remove">×</button>`;
    chip.querySelector('button').onclick = () => { tags.splice(i, 1); renderTags(); };
    tagsInput.insertBefore(chip, tagEntry);
  });
}
function renderSuggest() {
  const q = tagEntry.value.trim().toLowerCase();
  const counts = tagCounts();
  let all = [...counts.keys()].filter(t => !tags.includes(t));
  if (q) all = all.filter(t => t.toLowerCase().includes(q));
  all.sort((a, b) => (counts.get(b) - counts.get(a)) || a.localeCompare(b));
  sugList = all.slice(0, 6).map(t => ({ t, n: counts.get(t) }));
  const raw = tagEntry.value.trim();
  const exact = sugList.some(s => s.t.toLowerCase() === raw.toLowerCase());
  if (!sugList.length && !(raw && !exact)) { tagSuggest.classList.add('hidden'); return; }
  sugActive = -1;
  let html = sugList.map((s, i) => `<div class="sug" data-i="${i}">${s.t}<span class="used">used ${s.n}×</span></div>`).join('');
  if (raw && !exact) html += `<div class="newnote">Press Enter to add “${escapeHtml(raw)}” as a new tag</div>`;
  tagSuggest.innerHTML = html; tagSuggest.classList.remove('hidden');
  tagSuggest.querySelectorAll('.sug').forEach(el => el.onmousedown = e => { e.preventDefault(); addTag(sugList[+el.dataset.i].t); });
}
function addTag(t) { t = t.trim(); if (t && !tags.includes(t)) { tags.push(t); renderTags(); } tagEntry.value = ''; renderSuggest(); }
function highlight() { tagSuggest.querySelectorAll('.sug').forEach((el, i) => el.classList.toggle('active', i === sugActive)); }
tagEntry.addEventListener('input', renderSuggest);
tagEntry.addEventListener('focus', renderSuggest);
tagEntry.addEventListener('blur', () => setTimeout(() => tagSuggest.classList.add('hidden'), 120));
tagEntry.addEventListener('keydown', e => {
  const open = !tagSuggest.classList.contains('hidden');
  if (e.key === 'ArrowDown' && open) { e.preventDefault(); sugActive = Math.min(sugActive + 1, sugList.length - 1); highlight(); }
  else if (e.key === 'ArrowUp' && open) { e.preventDefault(); sugActive = Math.max(sugActive - 1, 0); highlight(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (open && sugActive >= 0) addTag(sugList[sugActive].t); else if (tagEntry.value.trim()) addTag(tagEntry.value); }
  else if (e.key === 'Escape' && open) tagSuggest.classList.add('hidden');
  else if (e.key === 'Backspace' && !tagEntry.value && tags.length) { tags.pop(); renderTags(); renderSuggest(); }
});

// ---- tabs, search, controls ----------------------------------------------
const TAB_LABEL = { toread: 'To read', done: 'Done', archived: 'Archived' };
const STATUS_LABEL = { toread: 'To read', done: 'Done' };
const EMPTY = {
  toread: 'Nothing to read right now. Saved links land here.',
  done: 'Nothing marked done yet.',
  archived: 'Nothing archived. Links you keep but tuck out of the way appear here.',
};
const tabs = $('tabs');
tabs.addEventListener('click', e => { const t = e.target.closest('.tab'); if (!t) return; currentTab = t.dataset.state; page = 1; setActiveTab(); render(); });
function setActiveTab() { [...tabs.querySelectorAll('.tab')].forEach(t => t.classList.toggle('active', t.dataset.state === currentTab)); }
function inTab(b, tab) { return tab === 'archived' ? b.archived : (!b.archived && b.status === tab); }

const searchEl = $('search'), clearBtn = $('clear-search'), searchHint = $('searchhint');
function compileQuery() { queryError = false; try { predicate = BookmarkSearch.compile(query); } catch (e) { queryError = true; predicate = () => false; } }
searchEl.addEventListener('input', () => { query = searchEl.value; page = 1; clearBtn.classList.toggle('hidden', !query.trim()); compileQuery(); render(); });
clearBtn.addEventListener('click', () => { searchEl.value = ''; query = ''; clearBtn.classList.add('hidden'); compileQuery(); searchEl.focus(); render(); });

const sortEl = $('sort'), sizeEl = $('pagesize'), textEl = $('textsize');
async function savePrefs() { prefs = (await api('PUT', '/api/prefs', prefs)).prefs; }
sortEl.addEventListener('change', () => { prefs.sortKey = sortEl.value; page = 1; savePrefs(); render(); });
sizeEl.addEventListener('change', () => { prefs.pageSize = +sizeEl.value; page = 1; savePrefs(); render(); });
textEl.addEventListener('change', () => { prefs.textSize = textEl.value; document.body.dataset.ts = prefs.textSize; savePrefs(); });

function sortItems(arr) {
  const a = [...arr];
  switch (prefs.sortKey) {
    case 'added_asc': a.sort((x, y) => x.createdAt - y.createdAt || x.id - y.id); break;
    case 'title_asc': a.sort((x, y) => x.title.localeCompare(y.title, undefined, { sensitivity: 'base' })); break;
    case 'title_desc': a.sort((x, y) => y.title.localeCompare(x.title, undefined, { sensitivity: 'base' })); break;
    default: a.sort((x, y) => y.createdAt - x.createdAt || y.id - x.id);
  }
  return a;
}

// ---- saved searches (SCN-020) ---------------------------------------------
const ssRow = $('savedsearches');
function applySavedSearch(s) {
  currentTab = s.view; setActiveTab();
  searchEl.value = s.query; query = s.query; compileQuery();
  clearBtn.classList.toggle('hidden', !s.query.trim()); page = 1; render();
}
function renderSavedSearches() {
  let html = savedSearches.length ? `<span class="sslabel">Saved searches:</span>` : '';
  html += savedSearches.map(s => `<span class="sschip" data-id="${s.id}"><button class="ssapply" title="${escapeHtml(s.query)} · in ${TAB_LABEL[s.view]}">${escapeHtml(s.name)}</button><button class="ssdel" aria-label="remove">×</button></span>`).join('');
  const q = query.trim();
  const canSave = q !== '' && !queryError && !savedSearches.some(s => s.query === q && s.view === currentTab);
  if (canSave) html += `<button class="ssadd" id="ssadd">＋ Save this search</button>`;
  ssRow.innerHTML = html; ssRow.style.display = html ? 'flex' : 'none';
  ssRow.querySelectorAll('.sschip').forEach(chip => {
    const id = +chip.dataset.id;
    chip.querySelector('.ssapply').onclick = () => applySavedSearch(savedSearches.find(s => s.id === id));
    chip.querySelector('.ssdel').onclick = async () => { await api('DELETE', '/api/searches/' + id); await reload(); };
  });
  const add = $('ssadd'); if (add) add.onclick = promptSaveSearch;
}
function promptSaveSearch() {
  const old = ssRow.querySelector('.bulkform'); if (old) old.remove();
  const form = document.createElement('div'); form.className = 'bulkform';
  form.innerHTML = `<input type="text" placeholder="Name this search" value="${escapeHtml(query.trim().slice(0, 40))}"><button class="act" data-ok>Save</button><button class="act" data-cancel>Cancel</button>`;
  ssRow.appendChild(form);
  const inp = form.querySelector('input'); inp.focus(); inp.select();
  const ok = async () => { const name = inp.value.trim(); if (!name) { form.remove(); return; } await api('POST', '/api/searches', { name, query: query.trim(), view: currentTab }); await reload(); };
  form.querySelector('[data-ok]').onclick = ok;
  form.querySelector('[data-cancel]').onclick = () => form.remove();
  inp.onkeydown = e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') form.remove(); };
}

// ---- item actions ---------------------------------------------------------
async function setStatus(id, s) { await api('PATCH', '/api/bookmarks/' + id, { status: s }); await reload(); }
async function setArchived(id, v) { await api('PATCH', '/api/bookmarks/' + id, { archived: v }); await reload(); }
async function deleteSaved(id) { await api('DELETE', '/api/bookmarks/' + id); selected.delete(id); await reload(); }
function editSaved(id) { const b = bookmarks.find(x => x.id === id); if (b) { loadIntoForm(b, true); window.scrollTo({ top: 0, behavior: 'smooth' }); } }

// ---- preserved-copy modal (SCN-019) ---------------------------------------
const snapModal = $('snap-modal'), snapBody = $('snap-body');
$('snap-close').onclick = () => snapModal.classList.add('hidden');
snapModal.onclick = e => { if (e.target === snapModal) snapModal.classList.add('hidden'); };
function openSnapshot(b) {
  $('snap-title').textContent = b.isPdf ? 'Preserved PDF' : 'Preserved copy';
  $('snap-sub').textContent = `${b.site} · kept copy`;
  const src = '/api/bookmarks/' + b.id + '/copy';
  snapBody.innerHTML = `<div class="snap-note">This is the copy the app kept of the page. It stays available even if the original changes or disappears.</div>
    <div class="snap-actions"><a class="act" href="${src}" target="_blank" rel="noopener">Open in a new tab ↗</a>
    <a class="act" href="${b.url}" target="_blank" rel="noopener">Visit original ↗</a></div>
    <iframe src="${src}" style="width:100%;height:420px;border:1px solid var(--line);border-radius:8px;margin-top:12px"></iframe>`;
  snapModal.classList.remove('hidden');
}

// ---- bulk actions (SCN-017) -----------------------------------------------
const selpage = $('selpage'), bulkbar = $('bulkbar'), list = $('list'), pager = $('pager');
selpage.addEventListener('change', () => {
  const ids = lastPageItems.map(b => b.id);
  if (selpage.checked) ids.forEach(id => selected.add(id)); else ids.forEach(id => selected.delete(id));
  render();
});
function syncSelPage() {
  const ids = lastPageItems.map(b => b.id);
  const all = ids.length > 0 && ids.every(id => selected.has(id));
  selpage.checked = all; selpage.indeterminate = !all && ids.some(id => selected.has(id));
}
function renderBulkBar() {
  if (!selected.size) { bulkbar.classList.add('hidden'); bulkbar.innerHTML = ''; return; }
  bulkbar.classList.remove('hidden');
  const matching = lastFiltered.length;
  const canAll = matching > 0 && lastFiltered.some(b => !selected.has(b.id));
  const archived = currentTab === 'archived';
  bulkbar.innerHTML = `<span class="bcount">${selected.size} selected</span>
    ${canAll ? `<button class="blink" data-b="all">Select all ${matching} in this view</button>` : ''}
    <button class="blink" data-b="clear">Clear</button><span class="sep"></span>
    <button class="act" data-b="addtag">Add tag…</button><button class="act" data-b="removetag">Remove tag…</button>
    <button class="act" data-b="toread">Mark unread</button><button class="act" data-b="done">Mark read</button>
    ${archived ? `<button class="act" data-b="restore">Restore</button>` : `<button class="act" data-b="archive">Archive</button>`}
    <button class="act danger" data-b="delete">Delete</button>`;
  bulkbar.querySelectorAll('[data-b]').forEach(btn => btn.onclick = () => bulkAction(btn.dataset.b));
}
async function bulkAction(a) {
  const ids = [...selected];
  if (a === 'all') { lastFiltered.forEach(b => selected.add(b.id)); render(); return; }
  if (a === 'clear') { selected.clear(); render(); return; }
  if (a === 'addtag' || a === 'removetag') return promptBulkTag(a === 'addtag' ? 'addTag' : 'removeTag');
  if (a === 'delete' && !confirm(`Delete ${ids.length} bookmark${ids.length === 1 ? '' : 's'} permanently?`)) return;
  const map = { toread: ['status', 'toread'], done: ['status', 'done'], archive: ['archive'], restore: ['restore'], delete: ['delete'] };
  const [action, value] = map[a];
  await api('POST', '/api/bookmarks/bulk', { ids, action, value });
  selected.clear(); await reload();
}
function promptBulkTag(action) {
  const old = bulkbar.parentElement.querySelector('.bulkform'); if (old) old.remove();
  const ids = [...selected];
  const form = document.createElement('div'); form.className = 'bulkform';
  form.innerHTML = `<input type="text" placeholder="${action === 'addTag' ? 'Tag to add to' : 'Tag to remove from'} ${ids.length} selected"><button class="act" data-ok>${action === 'addTag' ? 'Add' : 'Remove'}</button><button class="act" data-cancel>Cancel</button>`;
  bulkbar.parentElement.appendChild(form);
  const inp = form.querySelector('input'); inp.focus();
  const ok = async () => { const t = inp.value.trim(); if (!t) { form.remove(); return; } await api('POST', '/api/bookmarks/bulk', { ids, action, value: t }); selected.clear(); await reload(); };
  form.querySelector('[data-ok]').onclick = ok;
  form.querySelector('[data-cancel]').onclick = () => form.remove();
  inp.onkeydown = e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') form.remove(); };
}

// ---- render ---------------------------------------------------------------
function updateCounts() { ['toread', 'done', 'archived'].forEach(s => { $('c-' + s).textContent = bookmarks.filter(b => inTab(b, s)).length; }); }
function renderPager(total, totalPages, start, shown) {
  if (total <= prefs.pageSize) { pager.classList.add('hidden'); return; }
  pager.classList.remove('hidden');
  pager.innerHTML = `<button class="act" ${page <= 1 ? 'disabled' : ''} data-nav="prev">‹ Previous</button>
    <span class="pinfo">Showing ${start + 1}–${start + shown} of ${total} · page ${page} of ${totalPages}</span>
    <button class="act" ${page >= totalPages ? 'disabled' : ''} data-nav="next">Next ›</button>`;
  pager.querySelectorAll('button').forEach(btn => btn.onclick = () => { page += btn.dataset.nav === 'next' ? 1 : -1; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
}

function render() {
  // reflect prefs into controls
  sortEl.value = prefs.sortKey; sizeEl.value = String(prefs.pageSize); textEl.value = prefs.textSize;
  document.body.dataset.ts = prefs.textSize;
  updateCounts(); renderSavedSearches();

  const inView = bookmarks.filter(b => inTab(b, currentTab));
  const searching = !!query.trim();
  let items = inView;
  if (searching) {
    searchHint.classList.remove('hidden');
    if (queryError) { searchHint.textContent = 'Couldn’t read that search. Check quotes and parentheses.'; list.innerHTML = ''; pager.classList.add('hidden'); lastFiltered = []; lastPageItems = []; syncSelPage(); renderBulkBar(); return; }
    items = inView.filter(predicate);
    searchHint.textContent = items.length ? `${items.length} match${items.length === 1 ? '' : 'es'} in ${TAB_LABEL[currentTab]}` : `No matches in ${TAB_LABEL[currentTab]}.`;
  } else {
    searchHint.classList.add('hidden');
    if (!items.length) { list.innerHTML = `<div class="empty">${EMPTY[currentTab]}</div>`; pager.classList.add('hidden'); lastFiltered = []; lastPageItems = []; syncSelPage(); renderBulkBar(); return; }
  }
  items = sortItems(items);
  const totalPages = Math.max(1, Math.ceil(items.length / prefs.pageSize));
  if (page > totalPages) page = totalPages;
  const start = (page - 1) * prefs.pageSize;
  const pageItems = items.slice(start, start + prefs.pageSize);
  lastFiltered = items; lastPageItems = pageItems;
  renderPager(items.length, totalPages, start, pageItems.length);

  if (searching && !items.length) { list.innerHTML = ''; syncSelPage(); renderBulkBar(); return; }
  list.innerHTML = '';
  pageItems.forEach(b => {
    const el = document.createElement('div'); el.className = 'list-item';
    const tagsHtml = (b.tags || []).map(t => `<span class="chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('');
    let moves = '';
    if (currentTab === 'archived') {
      moves += `<span class="chip" style="background:#f4f4f5;color:#71717a">${STATUS_LABEL[b.status]}</span><button class="act" data-act="restore">Restore</button>`;
    } else {
      if (b.status !== 'done') moves += `<button class="act" data-act="done">Mark done</button>`;
      if (b.status !== 'toread') moves += `<button class="act" data-act="toread">Move to To read</button>`;
      moves += `<button class="act" data-act="archive">Archive</button>`;
    }
    el.innerHTML = `<input type="checkbox" class="selbox" ${selected.has(b.id) ? 'checked' : ''}>
      ${favHtml(b)}
      <div style="flex:1">
        <div class="title"><a href="${b.url}" target="_blank" rel="noopener">${escapeHtml(b.title)}</a></div>
        <div class="site">${escapeHtml(b.site || '')}</div>
        ${b.note ? `<div class="note md">${renderMarkdown(b.note)}</div>` : ''}
        <div class="meta">${tagsHtml}</div>
        <div class="item-actions">
          ${moves}
          ${b.keepCopy && b.hasSnapshot ? `<button class="act" data-act="copy">${b.isPdf ? 'Saved PDF' : 'Saved copy'}</button>` : ''}
          ${b.ia && b.iaUrl ? `<a class="act" href="${b.iaUrl}" target="_blank" rel="noopener">Internet Archive ↗</a>` : ''}
          <button class="act" data-act="edit">Edit</button>
          <button class="act danger" data-act="delete">Delete</button>
        </div>
      </div>
      ${b.image ? `<div class="thumb"><img src="${b.image}" alt=""></div>` : ''}`;
    el.querySelector('.selbox').onchange = e => { if (e.target.checked) selected.add(b.id); else selected.delete(b.id); renderBulkBar(); syncSelPage(); };
    el.querySelectorAll('.act[data-act]').forEach(btn => btn.onclick = () => {
      const a = btn.dataset.act;
      if (a === 'edit') editSaved(b.id);
      else if (a === 'delete') deleteSaved(b.id);
      else if (a === 'copy') openSnapshot(b);
      else if (a === 'archive') setArchived(b.id, true);
      else if (a === 'restore') setArchived(b.id, false);
      else setStatus(b.id, a);
    });
    el.querySelectorAll('.meta .chip[data-tag]').forEach(chip => chip.onclick = () => {
      searchEl.value = '#' + chip.dataset.tag; query = searchEl.value; clearBtn.classList.remove('hidden'); compileQuery(); page = 1; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    list.appendChild(el);
  });
  syncSelPage(); renderBulkBar();
}

// ---- import / export (SCN-021) --------------------------------------------
$('import-btn').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const r = await api('POST', '/api/import', reader.result, true);
    currentTab = 'toread'; page = 1; setActiveTab(); await reload();
    $('ie-msg').textContent = `Imported ${r.added} bookmark${r.added === 1 ? '' : 's'}` + (r.skipped ? `, skipped ${r.skipped} already saved.` : '.');
  };
  reader.readAsText(file); e.target.value = '';
});

// ---- init -----------------------------------------------------------------
resetForm();
reload().then(() => document.body.setAttribute('data-harness-ready', 'true'));
