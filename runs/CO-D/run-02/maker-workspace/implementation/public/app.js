'use strict';
/* Calm Bookmarks — production frontend. Talks to the JSON API in src/server.js.
 * Implements the approved scenarios SCN-001..SCN-020. See context/scenario-code-map.md. */

// ---- API ----------------------------------------------------------------
async function api(method, url, body) {
  const opt = { method, headers: {} };
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const res = await fetch(url, opt);
  let data = {};
  try { const t = await res.text(); data = t ? JSON.parse(t) : {}; } catch (e) {}
  return { status: res.status, data };
}

// ---- State --------------------------------------------------------------
let bookmarks = [], savedSearches = [], prefs = { defaultSort: 'added-desc', pageSize: 25, textSize: 'normal' };
let currentView = 'all', currentSort = 'added-desc', renderLimit = 25;
let selected = new Set(), openCopyId = null, bulkTagFormOpen = false, editingId = null;
let ioOpen = false, prefOpen = false;

const $ = id => document.getElementById(id);
const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const cleanTag = t => (t || '').trim().replace(/^#/, '').replace(/\s+/g, ' ').toLowerCase();
const uniq = a => { const o = []; (a || []).forEach(x => { if (x && o.indexOf(x) === -1) o.push(x); }); return o; };
function allTags() { const s = []; bookmarks.forEach(b => (b.tags || []).forEach(t => { if (!s.includes(t)) s.push(t); })); return s.sort(); }
function fmtDate(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function resetLimit() { renderLimit = prefs.pageSize === 'all' ? Infinity : prefs.pageSize; }
function applyTextSize() { $('wrap').style.zoom = prefs.textSize === 'small' ? '0.9' : prefs.textSize === 'large' ? '1.18' : '1'; }
function isPdf(u) { return /\.pdf($|[?#])/i.test(u || ''); }

async function reload() {
  const { data } = await api('GET', '/api/state');
  bookmarks = data.bookmarks || []; savedSearches = data.savedSearches || []; prefs = data.preferences || prefs;
}

// ---- Note rendering (safe subset: bold, italic, bullets, links) ---------
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function renderNote(md) {
  if (!md || !md.trim()) return '';
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let html = '', listOpen = false, para = [];
  const inline = t => esc(t)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, x, u) => '<a href="' + u + '" target="_blank" rel="noopener">' + x + '</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const flush = () => { if (para.length) { html += '<p>' + para.join('<br>') + '</p>'; para = []; } };
  lines.forEach(ln => {
    if (/^\s*[-*]\s+/.test(ln)) { flush(); if (!listOpen) { html += '<ul>'; listOpen = true; } html += '<li>' + inline(ln.replace(/^\s*[-*]\s+/, '')) + '</li>'; }
    else if (ln.trim() === '') { if (listOpen) { html += '</ul>'; listOpen = false; } flush(); }
    else { if (listOpen) { html += '</ul>'; listOpen = false; } para.push(inline(ln)); }
  });
  if (listOpen) html += '</ul>'; flush();
  return html;
}

function favEl(b) {
  const span = el('span', 'fav'); span.textContent = (b.host || '?').charAt(0).toUpperCase();
  if (b.favicon) { const img = new Image(); img.onload = () => { span.textContent = ''; span.appendChild(img); }; img.src = b.favicon; }
  return span;
}

// ---- Elements -----------------------------------------------------------
const saver = $('saver'), urlInput = $('url'), hint = $('hint'), reviewMount = $('reviewMount');
const views = $('views'), searchbar = $('searchbar'), search = $('search'), clearSearch = $('clearSearch');
const saveSearchBtn = $('saveSearch'), savedMount = $('savedMount'), sortbar = $('sortbar'), sortSel = $('sort');
const bulkMount = $('bulkMount'), list = $('list');

// ---- Filtering / view ---------------------------------------------------
function inView(b) {
  if (currentView === 'archive') return b.archived;
  if (currentView === 'reading') return !b.archived && b.toRead;
  return !b.archived;
}
function currentVisible() {
  const f = window.Query.makeFilter(search.value.trim());
  return bookmarks.filter(inView).filter(f.test);
}
function sortCmp() {
  switch (currentSort) {
    case 'added-asc': return (a, b) => a.created - b.created;
    case 'updated-desc': return (a, b) => b.updated - a.updated;
    case 'title-asc': return (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
    case 'title-desc': return (a, b) => (b.title || '').localeCompare(a.title || '', undefined, { sensitivity: 'base' });
    default: return (a, b) => b.created - a.created;
  }
}

// ---- Render -------------------------------------------------------------
function emptyEl(text) { const e = el('div', 'empty'); e.textContent = text; return e; }

function render() {
  list.innerHTML = '';
  const has = bookmarks.length > 0;
  views.hidden = !has; searchbar.hidden = !has; sortbar.hidden = !has;
  clearSearch.classList.toggle('show', !!search.value);
  views.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('on', t.dataset.view === currentView));
  sortSel.value = currentSort;
  renderSaved();

  if (!has) { list.appendChild(emptyEl('Nothing saved yet. Paste a link above to begin.')); return; }

  const f = window.Query.makeFilter(search.value.trim());
  const q = search.value.trim();
  const visible = bookmarks.filter(inView).filter(f.test);

  // prune selection to visible
  const vis = new Set(visible.map(b => b.id));
  selected.forEach(id => { if (!vis.has(id)) selected.delete(id); });
  renderBulkBar(visible);

  const scope = currentView === 'reading' ? 'your reading list' : currentView === 'archive' ? 'the archive' : 'your collection';
  if (q) {
    const c = el('div', 'search-count');
    c.textContent = visible.length + (visible.length === 1 ? ' match' : ' matches') + ' for “' + q + '” in ' + scope +
      (f.error ? ' · couldn’t understand the search operators, so showing matches on the words instead' : '');
    list.appendChild(c);
  }
  if (visible.length === 0) {
    let msg;
    if (q) msg = 'No bookmarks match “' + q + '” in ' + scope + '.';
    else if (currentView === 'reading') msg = 'Your reading list is empty. Add a bookmark from your collection to read it later.';
    else if (currentView === 'archive') msg = 'Nothing archived. Archived bookmarks are kept here, out of your collection and searches.';
    else msg = 'Your collection is empty. Everything you have is archived.';
    list.appendChild(emptyEl(msg));
    return;
  }
  const ordered = visible.slice().sort(sortCmp());
  const limit = Math.min(renderLimit, ordered.length);
  ordered.slice(0, limit).forEach(b => list.appendChild(renderCard(b)));
  if (limit < ordered.length) {
    const remaining = ordered.length - limit;
    const step = prefs.pageSize === 'all' ? remaining : Math.min(prefs.pageSize, remaining);
    const more = el('button', 'show-more');
    more.textContent = 'Show ' + step + ' more (' + remaining + ' more matching)';
    more.addEventListener('click', () => { renderLimit = limit + (prefs.pageSize === 'all' ? remaining : prefs.pageSize); render(); });
    list.appendChild(more);
  }
}

function actBtn(label, cls, fn) { const b = el('button', 'act' + (cls ? ' ' + cls : '')); b.textContent = label; b.addEventListener('click', fn); return b; }

function renderCard(b) {
  const card = el('div', 'item' + (selected.has(b.id) ? ' selected' : '')); card.id = 'item-' + b.id;

  const sel = el('label', 'sel'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = selected.has(b.id);
  cb.addEventListener('change', () => { if (cb.checked) selected.add(b.id); else selected.delete(b.id); card.classList.toggle('selected', cb.checked); renderBulkBar(currentVisible()); });
  sel.appendChild(cb); card.appendChild(sel);

  if (b.previewImage) {
    const pv = el('div', 'card-preview'); pv.style.backgroundImage = 'url("' + b.previewImage.replace(/"/g, '&quot;') + '")';
    pv.title = 'Open the original page'; pv.addEventListener('click', () => window.open(b.url, '_blank', 'noopener'));
    card.appendChild(pv);
  }
  if (currentView === 'all' && b.toRead) { const c = el('span', 'status-chip read'); c.textContent = 'In reading list'; card.appendChild(c); }
  if (currentView === 'archive') { const c = el('span', 'status-chip archived'); c.textContent = 'Archived'; card.appendChild(c); }

  const title = el('a', 'title'); title.textContent = b.title; title.href = b.url; title.target = '_blank'; title.rel = 'noopener'; title.title = 'Open the original page';
  card.appendChild(title);
  if (b.description) { const d = el('div', 'desc'); d.textContent = b.description; card.appendChild(d); }
  const noteHtml = renderNote(b.note);
  if (noteHtml) { const n = el('div', 'note'); n.innerHTML = noteHtml; card.appendChild(n); }
  if (b.tags && b.tags.length) {
    const tg = el('div', 'tags');
    b.tags.forEach(t => { const s = el('span', 'tag'); s.textContent = t; s.title = 'Filter by “' + t + '”'; s.addEventListener('click', () => filterByTag(t)); tg.appendChild(s); });
    card.appendChild(tg);
  }
  const a = el('a', 'url'); a.textContent = b.url; a.href = b.url; a.target = '_blank'; a.rel = 'noopener'; card.appendChild(a);

  const foot = el('div', 'foot'); const sl = el('span', 'source-line'); sl.appendChild(favEl(b));
  const hs = el('span'); hs.textContent = b.host; sl.appendChild(hs); foot.appendChild(sl); card.appendChild(foot);

  const dates = el('div', 'card-dates');
  let dt = 'Saved ' + fmtDate(b.created);
  if (b.updated && new Date(b.updated).toDateString() !== new Date(b.created).toDateString()) dt += ' · Updated ' + fmtDate(b.updated);
  dates.textContent = dt; card.appendChild(dates);

  const copies = b.copies || {};
  if ((copies.local && copies.local.status === 'ok') || copies.ia) {
    const cl = el('div', 'copies-line'); const lead = el('span'); lead.textContent = 'Saved copies:'; cl.appendChild(lead);
    if (copies.local && copies.local.status === 'ok') { const x = el('a'); x.href = '/snapshots/' + copies.local.file; x.target = '_blank'; x.rel = 'noopener'; x.textContent = copies.local.kind === 'pdf' ? 'Saved PDF' : 'Saved page'; cl.appendChild(x); }
    if (copies.ia) { const x = el('a'); x.href = copies.ia.url; x.target = '_blank'; x.rel = 'noopener'; x.textContent = 'Internet Archive'; cl.appendChild(x); }
    card.appendChild(cl);
  }

  const acts = el('div', 'card-actions');
  if (currentView === 'archive') {
    acts.appendChild(actBtn('Restore to collection', '', () => setStatus(b.id, { archived: false })));
  } else if (currentView === 'reading') {
    acts.appendChild(actBtn('Mark as read', 'primary', () => setStatus(b.id, { toRead: false })));
    acts.appendChild(actBtn('Archive', '', () => setStatus(b.id, { archived: true })));
  } else {
    if (b.toRead) acts.appendChild(actBtn('Mark as read', '', () => setStatus(b.id, { toRead: false })));
    else acts.appendChild(actBtn('Add to reading list', 'primary', () => setStatus(b.id, { toRead: true })));
    acts.appendChild(actBtn('Archive', '', () => setStatus(b.id, { archived: true })));
  }
  const hasCopies = (copies.local && copies.local.status === 'ok') || copies.ia;
  acts.appendChild(actBtn(hasCopies ? 'Copies ✓' : 'Save a copy…', '', () => { openCopyId = openCopyId === b.id ? null : b.id; render(); }));
  acts.appendChild(actBtn('Edit', '', () => openReview(draftFrom(b), true)));
  acts.appendChild(actBtn('Delete', 'danger-text', () => {
    acts.innerHTML = '';
    const w = el('span', 'confirm-text'); w.textContent = 'Delete for good? This can’t be undone.'; acts.appendChild(w);
    acts.appendChild(actBtn('Delete permanently', 'danger', async () => { await api('DELETE', '/api/bookmarks/' + b.id); await reload(); render(); }));
    acts.appendChild(actBtn('Cancel', '', () => render()));
  }));
  card.appendChild(acts);

  if (openCopyId === b.id) card.appendChild(copyPanel(b));
  return card;
}

function copyPanel(b) {
  const copies = b.copies || {};
  const wrap = el('div', 'copy-panel'); const pdf = isPdf(b.url);
  const r1 = el('div', 'cp-row'); const l1 = el('span', 'cp-label'); l1.textContent = pdf ? 'Kept PDF (in-app)' : 'In-app copy'; r1.appendChild(l1);
  const loc = copies.local;
  if (loc && loc.status === 'ok') {
    const st = el('span', 'cp-status'); st.textContent = (loc.kind === 'pdf' ? 'PDF kept ' : 'Saved automatically ') + fmtDate(loc.when) + ' · ';
    const v = el('a'); v.href = '/snapshots/' + loc.file; v.target = '_blank'; v.rel = 'noopener'; v.textContent = 'View'; st.appendChild(v); r1.appendChild(st);
    r1.appendChild(actBtn('Refresh', '', () => makeCopy(b.id, 'local')));
  } else if (loc && loc.status === 'pending') {
    const st = el('span', 'cp-status'); st.textContent = 'Making the copy…'; r1.appendChild(st);
    r1.appendChild(actBtn('Refresh', '', () => makeCopy(b.id, 'local')));
  } else {
    const st = el('span', 'cp-status'); st.textContent = 'The automatic copy did not succeed. '; r1.appendChild(st);
    r1.appendChild(actBtn(pdf ? 'Keep the PDF (retry)' : 'Save a copy here (retry)', 'primary', () => makeCopy(b.id, 'local')));
  }
  const r2 = el('div', 'cp-row'); const l2 = el('span', 'cp-label'); l2.textContent = 'Internet Archive'; r2.appendChild(l2);
  if (copies.ia) {
    const st = el('span', 'cp-status'); st.textContent = 'Submitted ' + fmtDate(copies.ia.when) + ' · ';
    const o = el('a'); o.href = copies.ia.url; o.target = '_blank'; o.rel = 'noopener'; o.textContent = 'Open at archive.org'; st.appendChild(o); r2.appendChild(st);
  } else {
    r2.appendChild(actBtn('Save to Internet Archive', '', () => makeCopy(b.id, 'ia')));
  }
  const note = el('div', 'cp-note'); note.textContent = 'The in-app copy is made automatically when you save; the Internet Archive is a manual submission to an outside service.';
  wrap.appendChild(r1); wrap.appendChild(r2); wrap.appendChild(note);
  return wrap;
}

async function makeCopy(id, which) {
  const p = document.querySelector('#item-' + id + ' .copy-panel');
  if (p) p.querySelectorAll('.act').forEach(x => { x.disabled = true; x.textContent = 'Working…'; });
  await api('POST', '/api/bookmarks/' + id + '/copy', { which });
  await reload(); render();
}

async function setStatus(id, patch) { await api('POST', '/api/bookmarks/' + id + '/status', patch); await reload(); render(); }

function flash(id) {
  const e = $('item-' + id); if (!e) return;
  e.scrollIntoView({ behavior: 'smooth', block: 'center' }); e.classList.add('flash');
  setTimeout(() => e.classList.remove('flash'), 1600);
}

// ---- Review / edit panel ------------------------------------------------
function draftFrom(b) { return { id: b.id, url: b.url, host: b.host, title: b.title, description: b.description, note: b.note, tags: (b.tags || []).slice(), toRead: b.toRead, previewImage: b.previewImage, favicon: b.favicon }; }

function openReview(draft, isEdit) {
  reviewMount.innerHTML = ''; editingId = isEdit ? draft.id : null;
  const p = el('div', 'review');
  p.innerHTML =
    '<div class="cap">' + (isEdit ? 'Edit bookmark' : 'Review before saving') + '</div>' +
    (draft.previewImage ? '<div class="preview-img" style="background-image:url(\'' + draft.previewImage.replace(/'/g, "%27") + '\')"><span class="pv-title"></span></div>' : '') +
    '<div class="source" id="src"></div>' +
    '<div class="field"><label>Address</label><input id="fAddr" type="text"></div>' +
    '<div class="field"><label>Title</label><input id="fTitle" type="text"></div>' +
    '<div class="field"><label>Description (from the page)</label><textarea id="fDesc" rows="2"></textarea></div>' +
    '<div class="field"><label>Your note</label>' +
      '<div class="md-toolbar"><button type="button" class="md-btn" data-md="bold">Bold</button><button type="button" class="md-btn" data-md="italic">Italic</button><button type="button" class="md-btn" data-md="list">• List</button></div>' +
      '<textarea id="fNote" rows="3" placeholder="Your own note — separate from the page description"></textarea>' +
      '<div class="note-hint">Select text and use the buttons to format it.</div>' +
      '<div class="note-preview" id="notePrev"></div></div>' +
    '<div class="field"><label>Tags</label><div id="fTags"></div></div>' +
    '<label class="chk"><input type="checkbox" id="fRead"> Add to reading list</label>' +
    '<div class="actions"><button class="btn-primary" id="doSave">' + (isEdit ? 'Save changes' : 'Save bookmark') + '</button>' +
    '<button class="btn-ghost" id="doCancel">Cancel</button></div>';
  reviewMount.appendChild(p);
  if (draft.previewImage) p.querySelector('.pv-title').textContent = draft.title || draft.host;
  const src = p.querySelector('#src'); src.appendChild(favEl(draft)); const ss = el('span'); ss.textContent = draft.host + '  ·  ' + draft.url; src.appendChild(ss);
  const fAddr = p.querySelector('#fAddr'), fTitle = p.querySelector('#fTitle'), fDesc = p.querySelector('#fDesc'), fNote = p.querySelector('#fNote'), fRead = p.querySelector('#fRead'), notePrev = p.querySelector('#notePrev');
  fAddr.value = draft.url || ''; fTitle.value = draft.title || ''; fDesc.value = draft.description || ''; fNote.value = draft.note || ''; fRead.checked = !!draft.toRead;
  const paintNote = () => { const h = renderNote(fNote.value); notePrev.innerHTML = h ? '<span class="pv-label">Preview</span>' + h : ''; };
  fNote.addEventListener('input', paintNote); paintNote();
  p.querySelectorAll('.md-btn').forEach(btn => btn.addEventListener('click', () => {
    const s = fNote.selectionStart, e = fNote.selectionEnd, v = fNote.value, selTxt = v.slice(s, e) || (btn.dataset.md === 'list' ? 'item' : 'text');
    let out = btn.dataset.md === 'bold' ? '**' + selTxt + '**' : btn.dataset.md === 'italic' ? '*' + selTxt + '*' : (s > 0 && v[s - 1] !== '\n' ? '\n' : '') + '- ' + selTxt;
    fNote.value = v.slice(0, s) + out + v.slice(e); fNote.focus(); paintNote();
  }));
  const getTags = buildTagInput(p.querySelector('#fTags'), (draft.tags || []).slice());
  fTitle.focus(); fTitle.select();
  p.querySelector('#doCancel').addEventListener('click', () => { reviewMount.innerHTML = ''; editingId = null; urlInput.focus(); });
  p.querySelector('#doSave').addEventListener('click', () => saveReview(draft, {
    address: fAddr.value.trim() || draft.url, title: fTitle.value.trim(), description: fDesc.value.trim(),
    note: fNote.value.trim(), tags: getTags(), toRead: fRead.checked
  }));
  reviewMount.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveReview(draft, f) {
  if (editingId) {
    const { data } = await api('PUT', '/api/bookmarks/' + editingId, { url: f.address, title: f.title, description: f.description, note: f.note, tags: f.tags, toRead: f.toRead });
    reviewMount.innerHTML = ''; const id = editingId; editingId = null; await reload(); render(); flash(id);
  } else {
    const { status, data } = await api('POST', '/api/bookmarks', { url: f.address, title: f.title, description: f.description, note: f.note, tags: f.tags, toRead: f.toRead, previewImage: draft.previewImage, favicon: draft.favicon });
    if (status === 409 && data.duplicate) { reviewMount.innerHTML = ''; editingId = null; jumpToExisting(data.duplicate); return; }
    reviewMount.innerHTML = ''; editingId = null; const newId = data.id; currentView = 'all'; search.value = ''; resetLimit(); await reload(); render();
    hint.className = 'hint'; hint.textContent = 'Saved.'; setTimeout(() => { if (hint.textContent === 'Saved.') hint.textContent = ''; }, 1800);
    if (newId) flash(newId);
  }
  urlInput.value = ''; urlInput.focus();
}

function jumpToExisting(dup) {
  hint.className = 'hint warn'; hint.textContent = "You've already saved this — here it is. You can update it.";
  currentView = dup.archived ? 'archive' : 'all'; search.value = ''; resetLimit(); render();
  const existing = bookmarks.find(b => b.id === dup.id);
  if (existing) { flash(existing.id); openReview(draftFrom(existing), true); }
  urlInput.value = '';
}

// ---- Tag input (pick existing + type-to-filter + create) ----------------
function buildTagInput(mount, current) {
  mount.innerHTML = ''; let chosen = current.slice();
  const pick = el('div', 'tag-pick'); const inp = el('input', 'tag-input'); inp.placeholder = 'Tap a tag, or type to filter / add a new one';
  const hintEl = el('div', 'note-hint');
  function paint() {
    pick.innerHTML = ''; const q = cleanTag(inp.value); const universe = uniq(allTags().concat(chosen));
    const shown = universe.filter(t => chosen.includes(t) || !q || t.includes(q));
    shown.forEach(t => { const btn = el('button', 'tag-toggle' + (chosen.includes(t) ? ' on' : '')); btn.type = 'button'; btn.textContent = t;
      btn.addEventListener('click', () => { if (chosen.includes(t)) chosen = chosen.filter(x => x !== t); else chosen.push(t); inp.value = ''; paint(); inp.focus(); }); pick.appendChild(btn); });
    const exact = universe.includes(q);
    hintEl.textContent = universe.length === 0 ? 'No tags yet — type one and press Enter to create it.'
      : (q && !exact) ? 'Press Enter to create the new tag “' + q + '”.'
      : 'Tap an existing tag to apply it, or type to filter / add a new one.';
  }
  inp.addEventListener('input', paint);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const t = cleanTag(inp.value); if (t && !chosen.includes(t)) chosen.push(t); inp.value = ''; paint(); } });
  mount.appendChild(pick); mount.appendChild(inp); mount.appendChild(hintEl); paint();
  return () => uniq(chosen.map(cleanTag).filter(Boolean));
}

// ---- Add flow -----------------------------------------------------------
saver.addEventListener('submit', async e => {
  e.preventDefault(); const val = urlInput.value.trim(); if (!val) return;
  hint.className = 'hint'; hint.textContent = 'Looking up the page…';
  const { status, data } = await api('POST', '/api/metadata', { url: val });
  if (status === 400) { hint.className = 'hint warn'; hint.textContent = "Hmm, that doesn't look like a link yet."; return; }
  hint.textContent = '';
  if (data.duplicate) { jumpToExisting(data.duplicate); return; }
  openReview({ url: data.url, host: data.host, title: data.title, description: data.description, note: '', tags: [], toRead: false, previewImage: data.previewImage, favicon: data.favicon }, false);
});

// ---- Tag filter, sort, search, views ------------------------------------
function filterByTag(t) { search.value = /\s/.test(t) ? '#"' + t + '"' : '#' + t; resetLimit(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
search.addEventListener('input', () => { resetLimit(); render(); });
clearSearch.addEventListener('click', () => { search.value = ''; resetLimit(); render(); search.focus(); });
sortSel.addEventListener('change', () => { currentSort = sortSel.value; resetLimit(); render(); });
views.addEventListener('click', e => { const t = e.target.closest('.view-tab'); if (!t) return; currentView = t.dataset.view; resetLimit(); render(); });

// ---- Saved searches -----------------------------------------------------
const viewName = v => v === 'reading' ? 'Reading list' : v === 'archive' ? 'Archive' : 'Collection';
function renderSaved() {
  if (savedMount.querySelector('.save-form')) return;
  savedMount.innerHTML = ''; if (!savedSearches.length) return;
  const strip = el('div', 'saved-strip'); const lead = el('span', 'lead'); lead.textContent = 'Saved searches:'; strip.appendChild(lead);
  savedSearches.forEach(s => {
    const chip = el('span', 'saved-chip'); const nm = el('span', 'name'); nm.textContent = s.name; nm.title = 'Apply: ' + (s.query || '(all)') + ' — in ' + viewName(s.view);
    nm.addEventListener('click', () => { currentView = s.view; search.value = s.query; resetLimit(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    const rm = el('button', 'rm'); rm.textContent = '×'; rm.title = 'Remove'; rm.addEventListener('click', async () => { await api('DELETE', '/api/saved/' + s.id); await reload(); render(); });
    chip.appendChild(nm); chip.appendChild(rm); strip.appendChild(chip);
  });
  savedMount.appendChild(strip);
}
saveSearchBtn.addEventListener('click', () => {
  const q = search.value.trim(); if (!q) { hint.className = 'hint warn'; hint.textContent = 'Type a search first, then save it.'; return; }
  savedMount.innerHTML = ''; const form = el('div', 'save-form');
  const lbl = el('span', 'lbl'); lbl.textContent = 'Save “' + q + '” in ' + viewName(currentView) + ' as:'; const inp = el('input'); inp.value = q;
  const ok = el('button', 'ok'); ok.textContent = 'Save search'; const no = el('button', 'no'); no.textContent = 'Cancel';
  ok.addEventListener('click', async () => { await api('POST', '/api/saved', { name: inp.value.trim() || q, query: q, view: currentView }); savedMount.innerHTML = ''; await reload(); render(); });
  no.addEventListener('click', () => { savedMount.innerHTML = ''; render(); });
  form.appendChild(lbl); form.appendChild(inp); form.appendChild(ok); form.appendChild(no); savedMount.appendChild(form); inp.focus(); inp.select();
});

// ---- Bulk ---------------------------------------------------------------
function renderBulkBar(visible) {
  bulkMount.innerHTML = ''; if (selected.size === 0) { bulkTagFormOpen = false; return; }
  const bar = el('div', 'bulkbar');
  const r1 = el('div', 'bulk-row1'); const count = el('span'); count.textContent = selected.size + ' selected'; r1.appendChild(count);
  const allSel = visible.length > 0 && visible.every(b => selected.has(b.id));
  const selAll = el('button', 'link'); selAll.textContent = allSel ? 'Clear selection' : ('Select all ' + visible.length + (visible.length === 1 ? ' matching bookmark' : ' matching bookmarks'));
  selAll.addEventListener('click', () => { if (allSel) selected.clear(); else visible.forEach(b => selected.add(b.id)); render(); });
  r1.appendChild(selAll);
  if (!allSel) { const clr = el('button', 'link'); clr.textContent = 'Clear'; clr.addEventListener('click', () => { selected.clear(); render(); }); r1.appendChild(clr); }
  bar.appendChild(r1);

  const acts = el('div', 'bulk-actions');
  const mk = (label, cls, fn) => { const b = el('button', 'bulk-btn' + (cls ? ' ' + cls : '')); b.textContent = label; b.addEventListener('click', fn); return b; };
  acts.appendChild(mk('Tag / untag…', '', () => { bulkTagFormOpen = !bulkTagFormOpen; renderBulkBar(currentVisible()); }));
  if (currentView !== 'archive') {
    acts.appendChild(mk('Mark as read', '', () => bulk('markRead')));
    acts.appendChild(mk('Mark as unread', '', () => bulk('markUnread')));
    acts.appendChild(mk('Archive', '', () => bulk('archive')));
  } else { acts.appendChild(mk('Restore to collection', '', () => bulk('restore'))); }
  acts.appendChild(mk('Delete', 'danger', () => showBulkDelete(bar)));
  bar.appendChild(acts);

  if (bulkTagFormOpen) {
    const form = el('div', 'bulk-form'); const inp = el('input'); inp.placeholder = 'Tag name (e.g. reading)'; inp.setAttribute('list', 'bulk-tags');
    const dl = el('datalist'); dl.id = 'bulk-tags'; allTags().forEach(t => { const o = el('option'); o.value = t; dl.appendChild(o); });
    const add = el('button', 'bulk-btn'); add.textContent = 'Add to selected'; const rem = el('button', 'bulk-btn'); rem.textContent = 'Remove from selected';
    add.addEventListener('click', () => { const t = cleanTag(inp.value); if (t) bulk('addTag', t); });
    rem.addEventListener('click', () => { const t = cleanTag(inp.value); if (t) bulk('removeTag', t); });
    form.appendChild(inp); form.appendChild(dl); form.appendChild(add); form.appendChild(rem); bar.appendChild(form); setTimeout(() => inp.focus(), 0);
  }
  bulkMount.appendChild(bar);
}
function showBulkDelete(bar) {
  if (bar.querySelector('.bulk-delete')) return;
  const box = el('div', 'bulk-form bulk-delete'); const msg = el('span', 'bulk-note');
  msg.textContent = 'Delete ' + selected.size + (selected.size === 1 ? ' bookmark' : ' bookmarks') + ' for good? This can’t be undone.';
  const del = el('button', 'bulk-btn danger'); del.textContent = 'Delete permanently'; const cancel = el('button', 'bulk-btn'); cancel.textContent = 'Cancel';
  del.addEventListener('click', () => bulk('delete')); cancel.addEventListener('click', () => box.remove());
  box.appendChild(msg); box.appendChild(del); box.appendChild(cancel); bar.appendChild(box);
}
async function bulk(action, tag) {
  await api('POST', '/api/bulk', { ids: Array.from(selected), action, tag });
  if (action === 'delete') selected.clear();
  await reload(); render();
}

// ---- Import / Export ----------------------------------------------------
$('ioBtn').addEventListener('click', () => { ioOpen = !ioOpen; prefOpen = false; renderPref(); renderIo(); });
function renderIo() {
  const mount = $('ioMount'); mount.innerHTML = ''; if (!ioOpen) return;
  const p = el('div', 'panel');
  p.innerHTML =
    '<button class="close" id="ioClose">×</button>' +
    '<div class="io-sec"><h2>Import bookmarks</h2><p class="io-sub">Bring in your existing browser bookmarks (an exported .html file) or a backup (.json). Titles, tags (folders become tags), and original saved dates are preserved; anything already saved is skipped.</p>' +
    '<div class="io-controls"><label>Choose a file…<input id="ioFile" type="file" accept=".html,.htm,.json" hidden></label></div>' +
    '<div class="io-result" id="ioImport"></div></div>' +
    '<div class="io-sec"><h2>Export bookmarks</h2><p class="io-sub">Save all your bookmarks — titles, tags, and original saved dates preserved. The bookmarks file re-imports into browsers; the full backup also keeps notes, descriptions, and read/archive state.</p>' +
    '<div class="io-controls"><button class="primary" id="expHtml">Export bookmarks file (HTML)</button><button id="expJson">Export full backup (JSON)</button></div>' +
    '<div class="io-result" id="ioExport"></div></div>';
  mount.appendChild(p);
  p.querySelector('#ioClose').addEventListener('click', () => { ioOpen = false; renderIo(); });
  const importRes = p.querySelector('#ioImport');
  p.querySelector('#ioFile').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = async () => {
      const { data } = await api('POST', '/api/import', { text: reader.result, commit: false });
      showImportPreview(importRes, reader.result, data, file.name);
    };
    reader.readAsText(file);
  });
  p.querySelector('#expHtml').addEventListener('click', () => { window.location = '/api/export?format=html'; showExportNote(p.querySelector('#ioExport'), 'bookmarks.html'); });
  p.querySelector('#expJson').addEventListener('click', () => { window.location = '/api/export?format=json'; showExportNote(p.querySelector('#ioExport'), 'bookmarks-backup.json'); });
}
function showImportPreview(mount, text, data, name) {
  mount.innerHTML = '';
  const sum = el('div'); sum.textContent = 'Found ' + data.found + ' bookmark' + (data.found === 1 ? '' : 's') + ' in ' + name + ' — ' + data.new + ' new, ' + data.duplicates + ' already saved.'; mount.appendChild(sum);
  const listEl = el('div', 'io-list');
  (data.sample || []).forEach(r => { const row = el('div', 'r'); const dt = fmtDate(r.created);
    row.innerHTML = '<strong></strong><span class="meta"></span>'; row.querySelector('strong').textContent = r.title;
    row.querySelector('.meta').textContent = ' — saved ' + dt + (r.tags && r.tags.length ? ' · ' + r.tags.join(', ') : ''); listEl.appendChild(row); });
  mount.appendChild(listEl);
  const go = el('div', 'io-controls'); go.style.marginTop = '10px';
  const btn = el('button', 'primary'); btn.textContent = 'Import ' + data.new + ' new bookmark' + (data.new === 1 ? '' : 's'); btn.disabled = data.new === 0;
  btn.addEventListener('click', async () => {
    const { data: r } = await api('POST', '/api/import', { text, commit: true });
    mount.innerHTML = 'Imported ' + r.added + ' new bookmark' + (r.added === 1 ? '' : 's') + (r.duplicates ? ' (' + r.duplicates + ' already saved, skipped)' : '') + '.';
    currentView = 'all'; search.value = ''; resetLimit(); await reload(); render();
  });
  go.appendChild(btn); mount.appendChild(go);
}
function showExportNote(mount, name) { mount.innerHTML = 'Downloading <strong>' + name + '</strong> (' + bookmarks.length + ' bookmarks).'; }

// ---- Preferences --------------------------------------------------------
$('prefBtn').addEventListener('click', () => { prefOpen = !prefOpen; ioOpen = false; renderIo(); renderPref(); });
function renderPref() {
  const mount = $('prefMount'); mount.innerHTML = ''; if (!prefOpen) return;
  const p = el('div', 'panel');
  p.innerHTML =
    '<button class="close" id="prefClose">×</button><h2>Display preferences</h2><div class="pref-grid">' +
    '<div class="pref-row"><span><label>Default sort order</label><div class="desc">How new views are ordered until you change the sort.</div></span>' +
    '<select id="prefSort"><option value="added-desc">Newest first</option><option value="added-asc">Oldest first</option><option value="updated-desc">Recently updated</option><option value="title-asc">Title A–Z</option><option value="title-desc">Title Z–A</option></select></div>' +
    '<div class="pref-row"><span><label>How many to show at once</label><div class="desc">More load with a “Show more” button; searches and Select all still cover everything.</div></span>' +
    '<select id="prefPage"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option><option value="all">All</option></select></div>' +
    '<div class="pref-row"><span><label>Text size</label><div class="desc">Comfortable reading size for the whole app.</div></span>' +
    '<select id="prefText"><option value="small">Small</option><option value="normal">Normal</option><option value="large">Large</option></select></div></div>';
  mount.appendChild(p);
  p.querySelector('#prefSort').value = prefs.defaultSort; p.querySelector('#prefPage').value = String(prefs.pageSize); p.querySelector('#prefText').value = prefs.textSize;
  p.querySelector('#prefClose').addEventListener('click', () => { prefOpen = false; renderPref(); });
  p.querySelector('#prefSort').addEventListener('change', async e => { prefs.defaultSort = e.target.value; currentSort = prefs.defaultSort; await api('PUT', '/api/preferences', { defaultSort: prefs.defaultSort }); resetLimit(); render(); });
  p.querySelector('#prefPage').addEventListener('change', async e => { prefs.pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10); await api('PUT', '/api/preferences', { pageSize: e.target.value }); resetLimit(); render(); });
  p.querySelector('#prefText').addEventListener('change', async e => { prefs.textSize = e.target.value; await api('PUT', '/api/preferences', { textSize: prefs.textSize }); applyTextSize(); });
}

// ---- Init ---------------------------------------------------------------
(async function init() {
  await reload();
  currentSort = prefs.defaultSort || 'added-desc'; resetLimit(); applyTextSize();
  render();
  document.body.setAttribute('data-harness-ready', 'true');
})();
