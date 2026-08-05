// Library UI — Slices 1–4.
// 1: save/recognise/list/open/dedupe (SCN-001,002,003,004,022)
// 2: edit/notes/labels (SCN-005,006,007,019)
// 3: search/topics/sort/exclude (SCN-008,009,014,021)
// 4: read-later lens + drain, tidy/bulk, delete+undo, set-aside (SCN-010,011,012,013)

import {
  normalizeUrl, toFullUrl, hostOf, isProbablyUrl, makeLink,
  normalizeTag, addTag, suggestTags, sanitizeNote, findDuplicateElsewhere, statusOf, isAside,
} from './src/core.js';
import {
  parseTerms, matchesQuery, whereMatched, filterByTopics, tagCounts, sortLinks,
  poolForView, unreadCount, asideCount, savedViewKey,
} from './src/query.js';
import { allLinks, putLink, findByNorm, deleteLink, allSearches, putSearch, deleteSearch, deleteCopy, allCopies } from './src/db.js';
import { parseBookmarksHtml, buildNetscapeHtml, buildBackup, importDate } from './src/porting.js';
import { DEFAULTS, normalizeTheme, normalizeSize } from './src/settings.js';

const $ = (id) => document.getElementById(id);
const input = $('url'), btn = $('save'), listEl = $('list'), countEl = $('count'), flash = $('flash'),
  backdrop = $('backdrop'), dialog = $('dialog'), qEl = $('q'), clearq = $('clearq'),
  barEl = $('bar'), activeEl = $('active'), sortSel = $('sortsel'), lensEl = $('lens'),
  selbtn = $('selbtn'), lenshint = $('lenshint'), trbadge = $('trbadge'), asbadge = $('asbadge'),
  batch = $('batch'), toast = $('toast'), savedbar = $('savedbar');

let items = [];
let q = '', sortBy = 'new', view = 'all';
let topicState = {};
let picked = new Set(), selectMode = false, openMenu = null, addingLabel = false;
let editing = null, draftTags = [];
let undoStash = null, toastTimer = null;
let savedSearches = [], naming = false;
let capturing = new Set(); // link ids whose copy is being fetched right now

const escapeHtml = (s) => String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const escapeAttr = (s) => escapeHtml(s).replace(/"/g, '&quot;');
const favLetter = (u) => (hostOf(u)[0] || '•').toUpperCase();
const byId = (id) => items.find((x) => x.id === id);
const includesT = () => Object.keys(topicState).filter((t) => topicState[t] === 'inc');
const excludesT = () => Object.keys(topicState).filter((t) => topicState[t] === 'exc');
const selecting = () => view === 'toread' || selectMode; // pile always selectable

function hl(text, terms) {
  let s = escapeHtml(text);
  if (!terms.length) return s;
  const pat = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|');
  try { return s.replace(new RegExp('(' + pat + ')', 'ig'), '<mark>$1</mark>'); } catch { return s; }
}

async function refresh(freshUrl, pulseNorm) { items = await allLinks(); render(freshUrl, pulseNorm); }

function poolTags() { const s = new Set(); poolForView(items, view).forEach((it) => (it.tags || []).forEach((t) => s.add(t))); return [...s].sort(); }
function computeShown() {
  let shown = poolForView(items, view);
  shown = filterByTopics(shown, includesT(), excludesT());
  if (q) shown = shown.filter((l) => matchesQuery(l, q));
  return sortLinks(shown, sortBy);
}

// ---------- saved searches (SCN-020) ----------
async function loadSearches() { savedSearches = await allSearches(); }
const currentIsFiltered = () => view !== 'all' || Object.keys(topicState).length > 0 || q.trim() !== '';
const keyNow = () => savedViewKey(view, includesT(), excludesT(), q);
const savedKey = (s) => savedViewKey(s.view, s.topics.inc || [], s.topics.exc || [], s.q);
function activeSavedId() { const k = keyNow(); const m = savedSearches.find((s) => savedKey(s) === k); return m ? m.id : null; }
function defaultViewName() {
  const parts = [];
  const I = includesT(), E = excludesT();
  if (I.length) parts.push(I.join(' + '));
  if (E.length) parts.push('not ' + E.join('/'));
  if (view === 'toread') parts.push('to read'); else if (view === 'aside') parts.push('set aside');
  if (q.trim()) parts.push('“' + q.trim() + '”');
  return parts.join(' · ') || 'My view';
}
function applySaved(s) {
  view = s.view; topicState = {};
  (s.topics.inc || []).forEach((t) => { topicState[t] = 'inc'; });
  (s.topics.exc || []).forEach((t) => { topicState[t] = 'exc'; });
  q = s.q || ''; qEl.value = q; clearq.classList.toggle('show', !!q);
  picked = new Set(); selectMode = false; openMenu = null; naming = false;
  syncLens(); render();
}
async function commitName() {
  const el = $('sv-name'); const name = (el && el.value.trim()) || defaultViewName();
  await putSearch({ name, view, topics: { inc: includesT(), exc: excludesT() }, q });
  naming = false; await loadSearches(); render();
}
async function removeSearch(id) { await deleteSearch(id); await loadSearches(); render(); }
function renderSaved() {
  const activeId = activeSavedId();
  let html = '<span class="lead">★ Saved</span>';
  if (savedSearches.length) {
    html += savedSearches.map((s) => `<span class="schip ${s.id === activeId ? 'on' : ''}" data-apply="${s.id}"><span class="star">★</span>${escapeHtml(s.name)}<button class="rm" data-rm="${s.id}" title="Remove this saved view">×</button></span>`).join('');
  } else html += '<span style="color:#9ca3af;font-size:12px">No saved views yet — filter, then “Save this view”.</span>';
  if (naming) {
    html += `<span class="nameform"><input id="sv-name" value="${escapeAttr(defaultViewName())}" autocomplete="off"><button class="ok" id="sv-ok">Save view</button><button class="no" id="sv-no">Cancel</button></span>`;
  } else if (currentIsFiltered() && !activeId) {
    html += `<button class="savebtn" id="sv-new">★ Save this view</button>`;
  }
  savedbar.innerHTML = html;
  savedbar.querySelectorAll('[data-apply]').forEach((el) => el.addEventListener('click', (e) => { if (e.target.closest('[data-rm]')) return; applySaved(savedSearches.find((s) => s.id === +el.dataset.apply)); }));
  savedbar.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); removeSearch(+b.dataset.rm); }));
  const nw = $('sv-new'); if (nw) nw.addEventListener('click', () => { naming = true; render(); });
  const ok = $('sv-ok'); if (ok) ok.addEventListener('click', commitName);
  const no = $('sv-no'); if (no) no.addEventListener('click', () => { naming = false; render(); });
  const nm = $('sv-name'); if (nm) { nm.focus(); nm.select(); nm.addEventListener('keydown', (e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { naming = false; render(); } }); }
}

// ---------- controls per view ----------
function menuBtn(it) {
  const capLabel = it.copy && it.copy.kind !== 'failed' ? '🔄 Refresh saved copy' : '📄 Keep a copy now';
  const arch = it.publicArchive
    ? `<button class="menuitem" data-viewarch="${it.id}">🌐 View public copy</button>`
    : `<button class="menuitem" data-arch="${it.id}">🌐 Keep a public copy…</button>`;
  return `<div class="menuwrap">
    <button class="btn more" title="More…" data-more="${it.id}">⋯</button>
    ${openMenu === it.id ? `<div class="menu">
      <button class="menuitem" data-capnow="${it.id}">${capLabel}</button>
      ${it.copy ? `<button class="menuitem" data-rmcopy="${it.id}">🚫 Remove saved copy</button>` : ''}
      ${arch}
      <button class="menuitem del" data-del="${it.id}">🗑 Delete for good</button></div>` : ''}
  </div>`;
}
function statusControls(it) {
  if (view === 'toread') {
    return `<div class="status">
      <button class="btn done" title="Mark as read" data-done="${it.id}">✓ Read</button>
      <button class="btn ghost" title="Give up — keeps it in the library, no read mark" data-drop="${it.id}">Not going to read</button></div>`;
  }
  if (view === 'aside') {
    return `<div class="status">
      <button class="btn back" title="Bring back to the everyday library" data-back="${it.id}">↩ Bring back</button>${menuBtn(it)}</div>`;
  }
  const aside = `<button class="btn aside" title="Set aside — keep it, out of the everyday library" data-aside="${it.id}">🗄</button>`;
  if (statusOf(it) === 'unread') return `<div class="status"><button class="btn flag on" title="In your read-later pile — click to remove" data-flag="${it.id}">📖 To read</button>${aside}${menuBtn(it)}</div>`;
  if (statusOf(it) === 'read') return `<div class="status"><span class="read-badge">✓ Read</span>${aside}${menuBtn(it)}</div>`;
  return `<div class="status"><button class="btn flag" title="Add to your read-later pile" data-flag="${it.id}">＋ Read later</button>${aside}${menuBtn(it)}</div>`;
}

function cardHtml(it, cls) {
  const terms = parseTerms(q);
  const sel = selecting();
  const titleLine = it.unreadable
    ? `${escapeHtml(hostOf(it.url))}<span class="ext">· couldn't read the page name</span>`
    : `${hl(it.title, terms)}<span class="ext">↗ open</span>`;
  const desc = it.unreadable
    ? `<p class="desc faded">We couldn't read this page's name. It's saved and will still open — you can rename it.</p>`
    : (it.description ? `<p class="desc">${hl(it.description, terms)}</p>` : '');
  const note = it.note ? `<div class="note"><span class="lbl">Note to self</span>${sanitizeNote(it.note)}</div>` : '';
  const tags = (it.tags && it.tags.length) ? `<div class="tags">${it.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : '';
  const where = q ? whereMatched(it, q) : [];
  const whereTag = where.length ? `<span class="where">Found in ${where.join(' & ')}</span>` : '';
  const copyRow = copyRowHtml(it);
  const classes = [cls, statusOf(it) === 'unread' && view !== 'aside' ? 'unread' : '', it.aside ? 'aside' : '', sel ? 'sel-mode' : '', picked.has(it.id) ? 'picked' : '', openMenu === it.id ? 'menu-open' : ''].filter(Boolean).join(' ');
  return `<li class="card ${classes}" data-id="${it.id}">
    ${sel ? `<input type="checkbox" class="checkbox" data-sel="${it.id}" ${picked.has(it.id) ? 'checked' : ''}>` : ''}
    ${statusControls(it)}
    <p class="title">${titleLine}</p>${desc}${note}
    <div class="url"><span class="fav">${favLetter(it.url)}</span>${hl(hostOf(it.url), terms)}</div>${tags}${copyRow}${whereTag}
  </li>`;
}

function fmtCopyDate(ts) {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return 'today'; if (d === 1) return 'yesterday'; if (d < 7) return d + ' days ago';
  try { return new Date(ts).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return new Date(ts).toDateString(); }
}
// SCN-016/017: the saved-copy line on a card.
function copyRowHtml(it) {
  const c = it.copy;
  if (!c) {
    return capturing.has(it.id)
      ? `<div class="copyrow muted">Keeping a copy…</div>`
      : `<div class="copyrow muted">No saved copy yet <button class="viewcopy" data-capnow="${it.id}">📄 Keep a copy now</button></div>`;
  }
  if (c.kind === 'failed') return `<div class="copyrow warn">⚠ Couldn't keep a copy — your link still opens</div>`;
  const label = c.kind === 'pdf' ? `the PDF file${c.size ? ' (' + Math.max(1, Math.round(c.size / 1024)) + ' KB)' : ''}`
    : c.kind === 'partial' ? 'a partial copy' : 'a readable copy';
  const pub = it.publicArchive ? ` · <span class="pubtag">🌐 public copy</span>` : '';
  return `<div class="copyrow"><span class="ok">✓ Saved copy kept</span> · ${label} from ${fmtCopyDate(c.capturedAt)}${pub}
    <button class="viewcopy" data-copy="${it.id}">📄 View saved copy</button></div>`;
}

function renderTopics() {
  const counts = tagCounts(poolForView(items, view));
  const tags = poolTags();
  if (!tags.length) { barEl.innerHTML = `<span class="none">No labels here yet.</span>`; return; }
  barEl.innerHTML = tags.map((t) => {
    const st = topicState[t] || '';
    return `<span class="t ${st}" data-inc="${escapeAttr(t)}">${escapeHtml(t)}<span class="c">${counts[t]}</span>
      <button class="minus" data-exc="${escapeAttr(t)}" title="Show everything except ${escapeHtml(t)}">−</button></span>`;
  }).join('');
  barEl.querySelectorAll('[data-inc]').forEach((el) => el.addEventListener('click', (e) => {
    if (e.target.closest('[data-exc]')) return;
    const t = el.dataset.inc; topicState[t] = topicState[t] === 'inc' ? undefined : 'inc'; if (!topicState[t]) delete topicState[t]; render();
  }));
  barEl.querySelectorAll('[data-exc]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation(); const t = b.dataset.exc; topicState[t] = topicState[t] === 'exc' ? undefined : 'exc'; if (!topicState[t]) delete topicState[t]; render();
  }));
}
function renderActive() {
  const I = includesT(), E = excludesT();
  if (!I.length && !E.length) { activeEl.className = 'active'; return; }
  activeEl.className = 'active show';
  const parts = [];
  if (I.length) parts.push(`showing <span class="inb">${I.map(escapeHtml).join(' + ')}</span>`);
  if (E.length) parts.push(`${I.length ? 'but ' : 'showing everything but '}<span class="exb">not ${E.map(escapeHtml).join(', ')}</span>`);
  activeEl.innerHTML = `${parts.join(' ')} <button class="clr" id="clr">Clear</button>`;
  $('clr').addEventListener('click', () => { topicState = {}; render(); });
}

function render(freshUrl, pulseNorm, loadingUrl) {
  renderSaved();
  trbadge.textContent = unreadCount(items);
  asbadge.textContent = asideCount(items);
  selbtn.style.display = view === 'toread' ? 'none' : '';
  selbtn.classList.toggle('on', selectMode);
  renderTopics();
  renderActive();

  const showHint = view === 'toread' || view === 'aside' || selectMode;
  lenshint.className = 'lenshint' + (showHint ? ' show ' : ' ') + (view === 'aside' ? 'grey' : 'blue');
  const shown = computeShown();
  const selallLabel = (picked.size && picked.size === shown.length) ? 'Unselect all' : 'Select all';
  if (view === 'toread') lenshint.innerHTML = `Your read-later pile — tick a few to sweep, or handle one at a time. <button class="selall" id="selall">${selallLabel}</button>`;
  else if (view === 'aside') lenshint.innerHTML = `Set aside — kept, out of your everyday library. Bring one back whenever you want it. <button class="selall" id="selall">${selallLabel}</button>`;
  else if (selectMode) lenshint.innerHTML = `Tidy mode — tick links to label, flag, set aside, or delete in a batch. <button class="selall" id="selall">${selallLabel}</button>`;

  const filtering = q || includesT().length || excludesT().length;
  countEl.textContent = view === 'toread' ? `${shown.length} still to read` : (view === 'aside' ? `${shown.length} set aside` : (filtering ? `${shown.length} shown` : `${items.length ? items.length + ' link' + (items.length > 1 ? 's' : '') : ''}`));

  const rows = [];
  if (loadingUrl) rows.push(`<li class="card fresh"><p class="loading">Reading the page to get its name…</p><div class="url"><span class="fav">${favLetter(loadingUrl)}</span>${escapeHtml(hostOf(loadingUrl))}</div></li>`);
  for (const it of shown) rows.push(cardHtml(it, it.url === freshUrl ? 'fresh' : (it.norm === pulseNorm ? 'pulse' : '')));

  if (!items.length && !loadingUrl) {
    listEl.innerHTML = `<div class="empty"><div class="art">📚</div><h2>Your library starts here</h2><div>Paste your first link in the box above — it'll fetch the page's name for you.</div></div>`;
  } else if (!shown.length && !loadingUrl) {
    listEl.innerHTML = view === 'toread' ? `<div class="empty"><div class="cheer">All caught up 🎉</div>Nothing left in your read-later pile.</div>`
      : view === 'aside' ? `<div class="empty">Nothing set aside. Tuck a link here to keep it without cluttering your library.</div>`
      : `<div class="empty">Nothing matches${q ? ' “' + escapeHtml(q) + '”' : ''}.<br>Try fewer words, or clear a topic.</div>`;
  } else listEl.innerHTML = rows.join('');

  wireCards();
  renderBatch();
  const sa = $('selall'); if (sa) sa.addEventListener('click', () => {
    const all = picked.size === shown.length && shown.length > 0;
    picked = all ? new Set() : new Set(shown.map((it) => it.id)); render();
  });
  if (pulseNorm) { const el = [...listEl.querySelectorAll('.card')].find((c) => c.classList.contains('pulse')); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}

function wireCards() {
  listEl.querySelectorAll('.card[data-id]').forEach((el) => el.addEventListener('click', (e) => {
    if (e.target.closest('[data-edit],[data-flag],[data-done],[data-drop],[data-aside],[data-back],[data-del],[data-more],[data-sel],[data-copy],[data-capnow],[data-arch],[data-viewarch],[data-rmcopy]')) return;
    openLink(el.dataset.id);
  }));
  listEl.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openCopy(+b.dataset.copy); }));
  listEl.querySelectorAll('[data-capnow]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openMenu = null; const it = byId(+b.dataset.capnow); requestCapture(it.id, it.url); toastMsg('Keeping a copy…'); render(); }));
  listEl.querySelectorAll('[data-arch]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openMenu = null; openArchiveConfirm(+b.dataset.arch); }));
  listEl.querySelectorAll('[data-viewarch]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openMenu = null; const it = byId(+b.dataset.viewarch); const u = it.publicArchive && it.publicArchive.viewUrl; if (u) { typeof chrome !== 'undefined' && chrome.tabs ? chrome.tabs.create({ url: u }) : window.open(u, '_blank'); } }));
  listEl.querySelectorAll('[data-rmcopy]').forEach((b) => b.addEventListener('click', async (e) => { e.stopPropagation(); openMenu = null; const it = byId(+b.dataset.rmcopy); await deleteCopy(it.id); delete it.copy; await putLink(it); toastMsg('Saved copy removed'); await refresh(); }));
  listEl.querySelectorAll('[data-sel]').forEach((cb) => cb.addEventListener('change', (e) => { e.stopPropagation(); const id = +cb.dataset.sel; cb.checked ? picked.add(id) : picked.delete(id); render(); }));
  listEl.querySelectorAll('[data-more]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openMenu = openMenu === +b.dataset.more ? null : +b.dataset.more; render(); }));
  listEl.querySelectorAll('[data-flag]').forEach((b) => b.addEventListener('click', async (e) => { e.stopPropagation(); const it = byId(+b.dataset.flag); it.status = statusOf(it) === 'unread' ? 'none' : 'unread'; await putLink(it); await refresh(); }));
  listEl.querySelectorAll('[data-done]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); mutateOut([+b.dataset.done], (it) => { it.status = 'read'; }); }));
  listEl.querySelectorAll('[data-drop]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); mutateOut([+b.dataset.drop], (it) => { it.status = 'none'; }); }));
  listEl.querySelectorAll('[data-aside]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); mutateOut([+b.dataset.aside], (it) => { it.aside = true; }); }));
  listEl.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); mutateOut([+b.dataset.back], (it) => { it.aside = false; }); }));
  listEl.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openMenu = null; deleteIds([+b.dataset.del]); }));
  listEl.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openEditor(+b.dataset.edit); }));
}

function openLink(id) {
  const it = byId(+id) || items.find((x) => String(x.id) === String(id)); if (!it) return;
  const full = toFullUrl(it.url);
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url: full });
  else window.open(full, '_blank');
}
function openCopy(id) { // SCN-016: view the saved copy
  const url = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome.runtime.getURL('viewer.html?id=' + id) : 'viewer.html?id=' + id;
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url });
  else window.open(url, '_blank');
}
function requestCapture(linkId, url) { // ask the background worker to keep a copy
  capturing.add(linkId); // so the card can honestly show "Keeping a copy…"
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try { chrome.runtime.sendMessage({ type: 'captureCopy', linkId, url: toFullUrl(url) }); } catch { capturing.delete(linkId); }
  } else capturing.delete(linkId);
}

// animate the given ids out, apply a mutation, persist, refresh
function mutateOut(ids, mut) {
  ids.forEach((id) => { const el = listEl.querySelector(`.card[data-id="${id}"]`); if (el) el.classList.add('leaving'); });
  setTimeout(async () => {
    for (const id of ids) { const it = byId(id); if (it) { mut(it); await putLink(it); } picked.delete(id); }
    render();
  }, 320);
}
function deleteIds(ids) {
  const removed = ids.map((id) => byId(id)).filter(Boolean).map((it) => ({ ...it }));
  ids.forEach((id) => { const el = listEl.querySelector(`.card[data-id="${id}"]`); if (el) el.classList.add('leaving'); });
  setTimeout(async () => {
    for (const id of ids) { await deleteLink(id); await deleteCopy(id); picked.delete(id); }
    undoStash = removed;
    showToast(`${removed.length} link${removed.length > 1 ? 's' : ''} deleted`);
    await refresh();
  }, 320);
}
function showToast(msg) {
  toast.innerHTML = `${msg} <button id="undo">Undo</button>`;
  toast.className = 'toast show';
  $('undo').addEventListener('click', undoDelete);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.className = 'toast'; undoStash = null; }, 6000);
}
async function undoDelete() {
  if (!undoStash) return;
  for (const rec of undoStash) { await putLink(rec); requestCapture(rec.id, rec.url); } // restore + re-keep a copy
  undoStash = null; toast.className = 'toast'; clearTimeout(toastTimer); await refresh();
}

// ---------- batch bar ----------
function renderBatch() {
  if (!selecting() || picked.size === 0) { batch.className = 'batch'; addingLabel = false; return; }
  batch.className = 'batch show';
  let actions;
  if (view === 'toread') {
    actions = `<button class="b-read" data-bulk="read">✓ Mark as read</button><button data-bulk="drop">Remove from pile</button><button data-bulk="aside">🗄 Set aside</button><button class="b-del" data-bulk="del">🗑 Delete</button>`;
  } else if (view === 'aside') {
    actions = `<button class="b-back" data-bulk="back">↩ Bring back</button><button class="b-del" data-bulk="del">🗑 Delete</button>`;
  } else {
    const labelUI = addingLabel ? `<span class="lblbox"><input id="b-lblin" placeholder="label…" autocomplete="off"><span class="sugg" id="b-sugg"></span></span>` : `<button data-bulk="label">🏷 Add label</button>`;
    actions = `${labelUI}<button data-bulk="later">📖 Read later</button><button data-bulk="capnow">📄 Keep a copy</button><button data-bulk="aside">🗄 Set aside</button><button class="b-del" data-bulk="del">🗑 Delete</button>`;
  }
  batch.innerHTML = `<b>${picked.size} selected</b> ${actions} <button class="b-clear" data-bulk="clear">Clear</button>`;
  batch.querySelectorAll('[data-bulk]').forEach((b) => b.addEventListener('click', () => bulk(b.dataset.bulk)));
  if (addingLabel) {
    const inp = $('b-lblin'); inp.focus();
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && inp.value.trim()) applyBulkLabel(inp.value); });
    inp.addEventListener('input', drawBulkSugg); drawBulkSugg();
  }
}
function drawBulkSugg() {
  const box = $('b-sugg'); if (!box) return;
  const raw = ($('b-lblin').value || '').trim();
  const all = (() => { const s = new Set(); items.forEach((it) => (it.tags || []).forEach((t) => s.add(t))); return [...s].sort(); })();
  const pool = suggestTags(all, raw, []).slice(0, 4);
  let html = pool.map((t) => `<button data-sg="${escapeAttr(t)}">${escapeHtml(t)}</button>`).join('');
  const nq = normalizeTag(raw); if (nq && !all.includes(nq)) html += `<button data-sg="${escapeAttr(nq)}">+ "${escapeHtml(nq)}"</button>`;
  box.innerHTML = html; box.querySelectorAll('[data-sg]').forEach((b) => b.addEventListener('click', () => applyBulkLabel(b.dataset.sg)));
}
async function applyBulkLabel(raw) {
  const t = normalizeTag(raw); if (!t) return;
  for (const id of picked) { const it = byId(id); if (it) { it.tags = addTag(it.tags || [], t); await putLink(it); } }
  addingLabel = false; await refresh();
}
function bulk(kind) {
  if (kind === 'clear') { picked = new Set(); addingLabel = false; render(); return; }
  if (kind === 'label') { addingLabel = true; renderBatch(); return; }
  const ids = [...picked];
  if (kind === 'read') return mutateOut(ids, (it) => { it.status = 'read'; });
  if (kind === 'drop') return mutateOut(ids, (it) => { it.status = 'none'; });
  if (kind === 'aside') return mutateOut(ids, (it) => { it.aside = true; });
  if (kind === 'back') return mutateOut(ids, (it) => { it.aside = false; });
  if (kind === 'later') { (async () => { for (const id of ids) { const it = byId(id); if (it) { it.status = 'unread'; await putLink(it); } } picked = new Set(); await refresh(); })(); return; }
  if (kind === 'capnow') { for (const id of ids) { const it = byId(id); if (it) requestCapture(it.id, it.url); } picked = new Set(); toastMsg('Keeping copies of the selected links…'); render(); return; }
  if (kind === 'del') return deleteIds(ids);
}

// ---------- add + edit (Slices 1–3) ----------
const showFlash = (m) => { flash.textContent = m; flash.classList.add('show'); };
const hideFlash = () => flash.classList.remove('show');
async function save() {
  const raw = input.value.trim(); if (!raw) return;
  if (!isProbablyUrl(raw)) { input.classList.add('bad'); showFlash(`That doesn't look like a web address — nothing was saved. Check it and try again.`); return; }
  input.classList.remove('bad');
  const dup = await findByNorm(normalizeUrl(raw));
  if (dup) { input.value = ''; btn.disabled = true; showFlash('You already saved this one — here it is. (No duplicate was made.)'); if (view !== 'all') { view = 'all'; syncLens(); } await refresh(null, dup.norm); return; }
  hideFlash();
  const url = toFullUrl(raw); input.value = ''; btn.disabled = true;
  if (view !== 'all') { view = 'all'; syncLens(); }
  render(null, null, url);
  const meta = await fetchMeta(url);
  const id = await putLink(makeLink(url, meta, Date.now()));
  if (keepCopiesOn()) requestCapture(id, url); // SCN-016: keep a copy automatically (unless off)
  await refresh(url);
}
function fetchMeta(url) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try { chrome.runtime.sendMessage({ type: 'fetchMeta', url: toFullUrl(url) }, (r) => resolve(chrome.runtime.lastError || !r ? { ok: false } : r)); return; } catch { /* */ }
    }
    resolve({ ok: false });
  });
}
function openEditor(id) {
  editing = byId(id); if (!editing) return;
  draftTags = [...(editing.tags || [])];
  dialog.innerHTML = `
    <h3>Edit this link</h3><div class="did">${escapeHtml(hostOf(editing.url))}</div>
    <label class="f">Name</label><input class="f" id="e-title" value="${escapeAttr(editing.title || '')}">
    <label class="f">Description <span style="text-transform:none;font-weight:400">(the page's own — plain)</span></label>
    <textarea class="f" id="e-desc">${escapeHtml(editing.description || '')}</textarea>
    <label class="f">My note (why I saved this)</label>
    <div class="noteToolbar"><button class="bb" data-cmd="bold" title="Bold">B</button><button data-cmd="insertUnorderedList" title="Bulleted list">•—</button></div>
    <div class="editor" id="e-note" contenteditable="true" data-ph="A line — or a little list — to your future self…">${sanitizeNote(editing.note || '')}</div>
    <div class="hintline">Keep it quick: bold a word, or add a bullet or two.</div>
    <label class="f">Web address</label><input class="f" id="e-url" value="${escapeAttr(editing.url || '')}">
    <div id="e-tagwrap"></div><div class="dwarn" id="e-warn"></div>
    <div class="row"><button class="ghost" id="e-cancel">Cancel</button><button class="primary" id="e-save">Save</button></div>`;
  renderTagSection();
  dialog.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('mousedown', (e) => { e.preventDefault(); $('e-note').focus(); document.execCommand(b.dataset.cmd, false, null); }));
  $('e-cancel').addEventListener('click', closeEditor);
  $('e-save').addEventListener('click', saveEditor);
  backdrop.classList.add('show'); $('e-title').focus();
}
function renderTagSection() {
  const chips = draftTags.map((t, k) => `<span class="chip">${escapeHtml(t)}<button data-del="${k}">×</button></span>`).join('');
  $('e-tagwrap').innerHTML = `<label class="f">Labels</label><div class="chipbox">${chips}<input id="e-taginput" placeholder="${draftTags.length ? 'add another…' : 'type a label…'}" autocomplete="off"></div><div class="hintline">Press Enter to add, or click a suggestion below.</div><div class="suggest" id="e-suggest"></div>`;
  const inp = $('e-taginput');
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (inp.value.trim()) { draftTags = addTag(draftTags, inp.value); renderTagSection(); $('e-taginput').focus(); } } });
  inp.addEventListener('input', drawSuggest); drawSuggest();
  $('e-tagwrap').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { draftTags.splice(+b.dataset.del, 1); renderTagSection(); }));
}
function drawSuggest() {
  const box = $('e-suggest'); if (!box) return;
  const all = (() => { const s = new Set(); items.forEach((it) => (it.tags || []).forEach((t) => s.add(t))); return [...s].sort(); })();
  const raw = ($('e-taginput').value || '').trim();
  const pool = suggestTags(all, raw, draftTags).slice(0, 6);
  let html = pool.map((t) => `<button data-sg="${escapeAttr(t)}">${escapeHtml(t)}</button>`).join('');
  const nq = normalizeTag(raw); if (nq && !all.includes(nq) && !draftTags.includes(nq)) html += `<button class="new" data-sg="${escapeAttr(nq)}">+ create "${escapeHtml(nq)}"</button>`;
  box.innerHTML = html;
  box.querySelectorAll('[data-sg]').forEach((b) => b.addEventListener('click', () => { draftTags = addTag(draftTags, b.dataset.sg); renderTagSection(); $('e-taginput').focus(); }));
}
function closeEditor() { backdrop.classList.remove('show'); editing = null; }
async function saveEditor() {
  if (!editing) return;
  const pending = $('e-taginput'); if (pending && pending.value.trim()) draftTags = addTag(draftTags, pending.value);
  const newUrl = toFullUrl($('e-url').value.trim() || editing.url);
  const clash = findDuplicateElsewhere(items, editing.id, newUrl);
  if (clash) { const w = $('e-warn'); w.className = 'dwarn show'; w.textContent = `You already have that address saved (“${clash.title}”). The change wasn't made, so no duplicate was created.`; return; }
  const updated = { ...editing, title: $('e-title').value.trim() || editing.title, description: $('e-desc').value, note: sanitizeNote($('e-note').innerHTML), url: newUrl, norm: normalizeUrl(newUrl), tags: [...draftTags], unreadable: false };
  await putLink(updated); closeEditor(); await refresh();
}

// ---------- trust layer: capture-now toast, public archive, import/export ----------
function toastMsg(text, ms = 2500) { toast.innerHTML = escapeHtml(text); toast.className = 'toast show'; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.className = 'toast'; }, ms); }

// ---------- Slice 7: comfort + capture settings ----------
function getPref(key, def) { try { const v = localStorage.getItem('set.' + key); return v === null ? def : v; } catch { return def; } }
function setPref(key, val) { try { localStorage.setItem('set.' + key, val); } catch { /* */ } }
const keepCopiesOn = () => getPref('keepCopies', '1') !== '0';
function applyAppearance() {
  document.documentElement.dataset.theme = normalizeTheme(getPref('theme', DEFAULTS.theme));
  document.documentElement.dataset.textsize = normalizeSize(getPref('textSize', DEFAULTS.textSize));
}
function openSettings() {
  const theme = normalizeTheme(getPref('theme', DEFAULTS.theme));
  const size = normalizeSize(getPref('textSize', DEFAULTS.textSize));
  const seg = (name, val, opts) => `<span class="seg">${opts.map(([v, l]) => `<button data-set="${name}" data-val="${v}" class="${val === v ? 'on' : ''}">${l}</button>`).join('')}</span>`;
  dialog.innerHTML = `<h3>Settings</h3>
    <div class="setrow"><span class="lab">Text size</span>${seg('textSize', size, [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']])}</div>
    <div class="setrow"><span class="lab">Appearance</span>${seg('theme', theme, [['light', 'Light'], ['dark', 'Dark']])}</div>
    <div class="setrow"><span class="lab">Saved copies</span>
      <label class="toggle"><input type="checkbox" id="set-keep" ${keepCopiesOn() ? 'checked' : ''}> Keep a copy of each page I save</label></div>
    <div class="hintline" style="margin-left:120px">When off, new saves won't be copied automatically — you can still “Keep a copy now” per link (via ⋯).</div>
    <div class="row"><button class="primary" id="set-done">Done</button></div>`;
  dialog.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
    setPref(b.dataset.set, b.dataset.val); applyAppearance();
    dialog.querySelectorAll(`[data-set="${b.dataset.set}"]`).forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('set-keep').addEventListener('change', (e) => setPref('keepCopies', e.target.checked ? '1' : '0'));
  $('set-done').addEventListener('click', () => backdrop.classList.remove('show'));
  backdrop.classList.add('show');
}

function openArchiveConfirm(id) {
  const it = byId(id); if (!it) return;
  let first = true; try { first = !localStorage.getItem('archiveExplained'); } catch { /* */ }
  const explain = first
    ? `This sends <b>${escapeHtml(hostOf(it.url))}</b> to an independent public web archive and makes a <b>public</b> copy that lives outside this app and outside your computer — belt &amp; braces for something you can't lose. It only ever happens for links you choose, one at a time.`
    : `Make a public archive copy of <b>${escapeHtml(hostOf(it.url))}</b>?`;
  dialog.innerHTML = `<h3>Keep a public copy</h3><p class="lead">${explain}</p>
    <div class="row"><button class="ghost" id="a-no">Cancel</button><button class="primary" id="a-yes">Yes, archive it publicly</button></div>`;
  $('a-no').addEventListener('click', () => backdrop.classList.remove('show'));
  $('a-yes').addEventListener('click', async () => {
    try { localStorage.setItem('archiveExplained', '1'); } catch { /* */ }
    it.publicArchive = { at: Date.now(), viewUrl: 'https://web.archive.org/web/2/' + toFullUrl(it.url) };
    await putLink(it);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) { try { chrome.runtime.sendMessage({ type: 'publicArchive', url: toFullUrl(it.url) }); } catch { /* */ } }
    backdrop.classList.remove('show'); toastMsg('Sent to the public web archive'); await refresh();
  });
  backdrop.classList.add('show');
}

const SAMPLE_BOOKMARKS = `<!DOCTYPE NETSCAPE-Bookmark-file-1><TITLE>Bookmarks</TITLE><H1>Bookmarks</H1>
<DL><p>
  <DT><H3>Cooking</H3><DL><p>
    <DT><A HREF="https://seriouseats.com/tempering" ADD_DATE="1583020800">How to Temper Chocolate</A>
    <DT><A HREF="https://cooking.example.com/ramen" ADD_DATE="1590000000">Weeknight Ramen</A>
  </DL><p>
  <DT><H3>Work</H3><DL><p>
    <DT><A HREF="https://12factor.net" ADD_DATE="1490000000">The Twelve-Factor App</A>
  </DL><p>
  <DT><A HREF="https://oldblog.example.com/2016/post" ADD_DATE="1460000000">An old post from 2016</A>
</DL><p>`;

function openImport() {
  dialog.innerHTML = `<h3>Bring in your existing bookmarks</h3>
    <p class="lead">Most browsers save all bookmarks to a file (Bookmarks → Export → an <b>.html</b> file). Choose it here — nothing is added until you confirm.</p>
    <div class="drop" id="imp-drop"><div class="big">Choose your bookmarks file</div><div class="small">.html exported from any browser</div></div>
    <input type="file" id="imp-file" accept=".html,.htm,text/html" style="display:none">
    <div class="try" id="imp-sample">▶ I don't have a file handy — try a sample</div>
    <div class="row"><button class="ghost" id="imp-cancel">Cancel</button></div>`;
  $('imp-drop').addEventListener('click', () => $('imp-file').click());
  $('imp-file').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; importPreview(parseBookmarksHtml(await f.text())); });
  $('imp-sample').addEventListener('click', () => importPreview(parseBookmarksHtml(SAMPLE_BOOKMARKS)));
  $('imp-cancel').addEventListener('click', () => backdrop.classList.remove('show'));
  backdrop.classList.add('show');
}
function importPreview(parsed) {
  const existing = new Set(items.map((i) => normalizeUrl(i.url)));
  const fresh = parsed.filter((p) => !existing.has(normalizeUrl(p.url)));
  const skip = parsed.length - fresh.length;
  const folders = {}; parsed.forEach((p) => { if (p.folder) folders[p.folder] = (folders[p.folder] || 0) + 1; });
  const folderList = Object.entries(folders).sort((a, b) => b[1] - a[1]).slice(0, 8);
  dialog.innerHTML = `<h3>Found ${parsed.length} bookmark${parsed.length !== 1 ? 's' : ''}</h3>
    <p class="lead">Here's what's in your file. Nothing's added until you say so.</p>
    <div class="summary"><div class="n">${parsed.length} bookmarks${Object.keys(folders).length ? ` across ${Object.keys(folders).length} folders` : ''}</div>
      ${folderList.length ? `<ul>${folderList.map(([f, n]) => `<li>📁 ${escapeHtml(f)} — ${n}</li>`).join('')}</ul>` : ''}</div>
    ${Object.keys(folders).length ? `<label class="opt"><input type="checkbox" id="imp-fal" checked><span>Turn folders into labels — so your topics work from day one.</span></label>` : ''}
    ${skip ? `<div class="skipnote">🔁 ${skip} already in your library — I'll skip those (no duplicates).</div>` : ''}
    <div class="skipnote">Original dates are kept, so “Oldest first” still reflects your real history. Copies aren't made automatically on import — use “Keep a copy now” (via ⋯) on the ones you care about.</div>
    <div class="row"><button class="ghost" id="imp-back">Cancel</button><button class="primary" id="imp-go">Import ${fresh.length} link${fresh.length !== 1 ? 's' : ''}</button></div>`;
  $('imp-back').addEventListener('click', () => backdrop.classList.remove('show'));
  $('imp-go').addEventListener('click', async () => {
    const fal = $('imp-fal'); const useFolders = fal ? fal.checked : false; const now = Date.now();
    for (const p of fresh) {
      const rec = makeLink(toFullUrl(p.url), { ok: !!p.title, title: p.title || '', description: '' }, importDate(p.addDate, now));
      if (useFolders && p.folder) rec.tags = addTag([], p.folder);
      await putLink(rec);
    }
    backdrop.classList.remove('show'); toastMsg(`Imported ${fresh.length} link${fresh.length !== 1 ? 's' : ''}`); await refresh();
  });
}
function openExport() {
  dialog.innerHTML = `<h3>Export your links</h3>
    <p class="lead">Your links are yours — take them anytime, so you're never locked in.</p>
    <div class="choice" id="exp-html"><div class="em">🌐</div><div><div class="ct">Bookmarks file (.html)</div><div class="cd">Opens in any browser. The universal format — your links live on even without this app.</div></div></div>
    <div class="choice" id="exp-json"><div class="em">🗄️</div><div><div class="ct">Full backup (.json)</div><div class="cd">Everything: links, notes, labels, read-later, shelf, saved views, and your readable saved copies. (Large PDF copies aren't included.)</div></div></div>
    <div class="row"><button class="ghost" id="exp-cancel">Close</button></div>`;
  $('exp-cancel').addEventListener('click', () => backdrop.classList.remove('show'));
  $('exp-html').addEventListener('click', () => download('my-links.html', buildNetscapeHtml(items), 'text/html'));
  $('exp-json').addEventListener('click', async () => {
    const copies = (await allCopies()).filter((c) => c.kind !== 'pdf').map(({ blob, ...rest }) => rest);
    download('my-links-backup.json', buildBackup(items, savedSearches, copies), 'application/json');
  });
}
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  dialog.innerHTML = `<div class="done2"><div class="big">✓ Downloading ${escapeHtml(name)}</div><p class="lead" style="margin-top:8px">Saved to your computer — keep it as a backup, or load it elsewhere.</p></div><div class="row"><button class="primary" id="dl-ok">Done</button></div>`;
  $('dl-ok').addEventListener('click', () => backdrop.classList.remove('show'));
}

// ---------- lens + wiring ----------
function syncLens() { lensEl.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === view)); }
lensEl.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; view = b.dataset.v; picked = new Set(); selectMode = false; addingLabel = false; openMenu = null; topicState = {}; syncLens(); render(); });
selbtn.addEventListener('click', () => { selectMode = !selectMode; if (!selectMode) picked = new Set(); render(); });
backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeEditor(); });
document.addEventListener('click', (e) => { if (openMenu !== null && !e.target.closest('.menu') && !e.target.closest('[data-more]')) { openMenu = null; render(); } });
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => { if (msg && msg.type === 'copyDone') { capturing.delete(msg.linkId); refresh(); } }); // a saved copy finished
}
input.addEventListener('input', () => { btn.disabled = input.value.trim().length < 4; input.classList.remove('bad'); if (flash.classList.contains('show')) hideFlash(); });
btn.addEventListener('click', save);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
qEl.addEventListener('input', () => { q = qEl.value.trim(); clearq.classList.toggle('show', !!q); render(); });
clearq.addEventListener('click', () => { q = ''; qEl.value = ''; clearq.classList.remove('show'); qEl.focus(); render(); });
sortSel.addEventListener('change', () => { sortBy = sortSel.value; render(); });
$('importBtn').addEventListener('click', openImport);
$('exportBtn').addEventListener('click', openExport);
$('settingsBtn').addEventListener('click', openSettings);

applyAppearance();
(async () => { await loadSearches(); await refresh(); })();
