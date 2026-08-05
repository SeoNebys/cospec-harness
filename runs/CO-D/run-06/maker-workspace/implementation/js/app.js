// app.js — UI orchestration for the bookmarks app (Cycle 1, v1: SCN-001..016).
import {
  Store, applyFilter, sortBookmarks, displayName, findByUrl,
  looksLikeUrl, hostOf, normalizeUrl, copyMatchSnippet
} from './store.js';
import { readPage, faviconFor } from './pageReader.js';
import { capturePage, archiveUrlFor } from './capture.js';
import { parseNetscapeBookmarks, parseLinkList, summarize } from './import.js';
import { createLabelInput } from './labelInput.js';

const store = new Store();

const state = {
  view: 'all',                 // 'all' | 'toread' | 'aside'
  include: new Set(),
  exclude: new Set(),
  mode: 'all',                 // 'all' | 'any'
  query: '',
  sort: 'new',
  includeAside: false,         // search opt-in for set-aside items (SCN-009)
  selecting: false,
  selected: new Set(),
  activeView: null,            // name of the saved view currently applied (SCN-017)
};

const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function highlight(text, q) {
  if (!q) return esc(text);
  let out = esc(text);
  q.trim().split(/\s+/).filter(Boolean).forEach(term => {
    const re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    out = out.replace(re, '<mark>$1</mark>');
  });
  return out;
}

// ---------------------------------------------------------------------------
// Derived list for the current view + filter + sort
// ---------------------------------------------------------------------------
function baseForView() {
  if (state.view === 'aside') return store.bookmarks.filter(b => b.archived);
  if (state.view === 'toread') return store.bookmarks.filter(b => !b.archived && b.unread);
  // main list: not archived; include archived only if opted in AND searching (SCN-009)
  return store.bookmarks.filter(b => !b.archived || (state.query.trim() && state.includeAside && b.archived));
}
function currentList() {
  const filtered = applyFilter(baseForView(), state);
  return sortBookmarks(filtered, state.sort);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render() {
  renderTabs();
  renderViews();
  renderSidebar();
  renderFilterBar();
  renderList();
  renderSelectionBar();
}

// A filter edit invalidates "this is the saved view X" state (SCN-017).
function dirtyView() { state.activeView = null; }
function currentCriteria() {
  return { include: [...state.include], exclude: [...state.exclude], mode: state.mode, query: state.query.trim() };
}

function renderViews() {
  const section = document.querySelector('#viewsSection');
  const host = $('#views'); host.innerHTML = '';
  if (!store.views.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  store.views.forEach(v => {
    const row = el('div', 'view' + (state.activeView === v.name ? ' on' : ''));
    const star = el('span', 'vstar', '★');
    const name = el('span', 'vname'); name.textContent = v.name;
    const rm = el('button', 'vrm', '×'); rm.title = 'remove view';
    const apply = () => applyView(v);
    star.addEventListener('click', apply); name.addEventListener('click', apply);
    rm.addEventListener('click', e => { e.stopPropagation(); store.removeView(v.name); if (state.activeView === v.name) state.activeView = null; render(); });
    row.appendChild(star); row.appendChild(name); row.appendChild(rm);
    host.appendChild(row);
  });
}
function applyView(v) {
  state.include = new Set(v.include); state.exclude = new Set(v.exclude);
  state.mode = v.mode || 'all'; state.query = v.query || '';
  $('#search').value = state.query; state.activeView = v.name;
  render();
}

function renderTabs() {
  const counts = {
    all: store.bookmarks.filter(b => !b.archived).length,
    toread: store.bookmarks.filter(b => !b.archived && b.unread).length,
    aside: store.bookmarks.filter(b => b.archived).length,
  };
  $('#tabAll .pill').textContent = counts.all;
  $('#tabToRead .pill').textContent = counts.toread;
  $('#tabAside .pill').textContent = counts.aside;
  for (const [id, v] of [['tabAll', 'all'], ['tabToRead', 'toread'], ['tabAside', 'aside']])
    $('#' + id).classList.toggle('on', state.view === v);
  $('#asideOptRow').style.display = (state.view !== 'aside') ? 'flex' : 'none';
}

function renderSidebar() {
  const counts = store.labelCounts();
  const labels = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  const host = $('#labels'); host.innerHTML = '';
  if (!labels.length) { host.appendChild(el('div', 'noviews', 'Labels you use will appear here.')); return; }
  labels.forEach(l => {
    const inc = state.include.has(l), exc = state.exclude.has(l);
    const row = el('div', 'lbl' + (inc ? ' inc' : '') + (exc ? ' exc' : ''));
    const name = el('span', 'name'); name.textContent = l;
    const n = el('span', 'n'); n.textContent = counts[l];
    const ex = el('button', 'ex'); ex.title = 'Exclude — hide bookmarks with this label';
    name.addEventListener('click', () => { toggleSetMember(state.include, l, state.exclude); dirtyView(); render(); });
    ex.addEventListener('click', e => { e.stopPropagation(); toggleSetMember(state.exclude, l, state.include); dirtyView(); render(); });
    row.appendChild(name); row.appendChild(n); row.appendChild(ex);
    host.appendChild(row);
  });
}
function toggleSetMember(set, l, other) { if (set.has(l)) set.delete(l); else { set.add(l); other.delete(l); } }

function renderFilterBar() {
  const bar = $('#activeRow'); bar.innerHTML = '';
  const active = state.include.size || state.exclude.size || state.query.trim();
  if (!active) { bar.appendChild(el('span', 'muted', 'Showing everything.')); return; }
  state.include.forEach(l => bar.appendChild(chip(l, 'inc', () => { state.include.delete(l); dirtyView(); render(); })));
  if (state.include.size >= 2) {
    const ms = el('span', 'modeSwitch');
    ['all', 'any'].forEach(m => {
      const b = el('button', state.mode === m ? 'on' : '', m === 'all' ? 'all of these' : 'any of these');
      b.addEventListener('click', () => { state.mode = m; dirtyView(); render(); }); ms.appendChild(b);
    });
    bar.appendChild(ms);
  }
  state.exclude.forEach(l => bar.appendChild(chip('not ' + l, 'exc', () => { state.exclude.delete(l); dirtyView(); render(); })));
  if (state.query.trim())
    bar.appendChild(chip('“' + state.query.trim() + '”', 'inc', () => { state.query = ''; $('#search').value = ''; dirtyView(); render(); }));

  // Save this view — appears only once a filter is built (SCN-017)
  if (state.activeView) {
    bar.appendChild(el('span', 'saveView saved', '★ Saved as “' + esc(state.activeView) + '”'));
  } else {
    const sv = el('button', 'saveView', '☆ Save this view');
    sv.addEventListener('click', () => {
      const suggested = [...state.include].join(', ') +
        ([...state.exclude].length ? (state.include.size ? ', ' : '') + [...state.exclude].map(x => 'not ' + x).join(', ') : '') +
        (state.query.trim() ? (state.include.size || state.exclude.size ? ', ' : '') + '“' + state.query.trim() + '”' : '');
      const name = prompt('Name this view:', suggested);
      if (name && name.trim()) { store.addView(name.trim(), currentCriteria()); state.activeView = name.trim(); render(); }
    });
    bar.appendChild(sv);
  }

  const clr = el('button', 'clear', 'clear all');
  clr.addEventListener('click', () => { state.include.clear(); state.exclude.clear(); state.query = ''; $('#search').value = ''; dirtyView(); render(); });
  bar.appendChild(clr);
}
function chip(text, kind, onRemove) {
  const c = el('span', 'fchip ' + kind); c.appendChild(document.createTextNode(text + ' '));
  const x = el('button', '', '×'); x.addEventListener('click', onRemove); c.appendChild(x); return c;
}

function renderList() {
  const list = currentList();
  const q = state.query.trim().toLowerCase();
  const count = $('#count');
  const active = state.include.size || state.exclude.size || q;
  count.textContent = list.length + (list.length === 1 ? ' bookmark' : ' bookmarks') + (active ? ' match' : '') +
    (state.selecting ? ' · tap to pick' : '');

  const cards = $('#cards'); cards.innerHTML = '';
  if (!list.length) { cards.appendChild(emptyState()); return; }
  list.forEach(b => cards.appendChild(renderCard(b, q)));
}

function emptyState() {
  // First run vs empty view (SCN-015)
  if (store.bookmarks.length === 0) {
    return el('div', 'empty big-empty',
      '<div class="big">🔖</div><h2>Nothing saved yet</h2>' +
      '<p>Paste a link in the box above and press Add. The title and a short description fill in for you — it takes a second.</p>' +
      '<p class="arrow">↑ start with your first link, or import the ones you already have</p>');
  }
  const msg = state.view === 'toread' ? 'Your To-read pile is clear.'
    : state.view === 'aside' ? 'Nothing set aside.'
    : (state.query.trim() || state.include.size || state.exclude.size) ? 'Nothing matches that.<br>Try removing a label or a search word.'
    : 'Nothing here.';
  return el('div', 'empty', msg);
}

function renderCard(b, q) {
  const card = el('div', 'card' + (b.unread && !b.archived ? ' unread' : '') + (b.archived ? ' aside' : '') + (state.selected.has(b.id) ? ' sel' : ''));

  // selection checkbox (SCN-012) — only in selection mode
  const chk = el('div', 'chk' + (state.selecting ? ' show' : ''), state.selected.has(b.id) ? '✓' : '');

  const body = el('div', 'body');
  const titleLine = el('div', 'titleline');
  titleLine.appendChild(favicon(b));
  const title = el('p', 'title'); title.innerHTML = highlight(displayName(b), q); titleLine.appendChild(title);
  if (b.unread && !b.archived) titleLine.appendChild(el('span', 'toread-tag', 'to read'));
  if (b.archived && state.view !== 'aside') titleLine.appendChild(el('span', 'aside-flag', 'set aside'));
  body.appendChild(titleLine);
  const url = el('div', 'url'); url.innerHTML = highlight(b.url, q); body.appendChild(url);
  if (b.description) { const d = el('p', 'desc'); d.innerHTML = highlight(b.description, q); body.appendChild(d); }
  if (b.note) { const nt = el('div', 'note'); nt.innerHTML = '<b>My note:</b> ' + highlight(b.note, q); body.appendChild(nt); }
  // "why did this match?" — a snippet from the saved copy when the match is only there (SCN-018)
  const snip = copyMatchSnippet(b, q);
  if (snip) { const s = el('div', 'copysnip'); s.innerHTML = '<span class="from">from your saved copy:</span> ' + highlight(snip, q); body.appendChild(s); }
  body.appendChild(labelRow(b, q));
  // copy status + view-anytime (SCN-018)
  const cmeta = el('div', 'copymeta');
  cmeta.appendChild(copyChip(b));
  const vc = el('button', 'viewcopy', (b.copy && b.copy.status === 'none') ? 'Find an archived copy' : 'View saved copy');
  vc.addEventListener('click', e => { e.stopPropagation(); openCopyReader(b); });
  cmeta.appendChild(vc);
  body.appendChild(cmeta);

  const thumb = b.thumbnail
    ? el('div', 'thumb', '') : el('div', 'thumb ph', '<span class="mono">' + esc((hostOf(b.url) || '?')[0].toUpperCase()) + '</span>');
  if (b.thumbnail) thumb.style.backgroundImage = 'url(' + b.thumbnail + ')';

  // controls
  const controls = el('div', 'controls');
  if (state.view === 'aside') {
    const pb = el('button', 'mini', 'Put back');
    pb.addEventListener('click', e => { e.stopPropagation(); doUndoable(store.putBack([b.id]), 'Put back in your list'); });
    controls.appendChild(pb);
  } else {
    const pencil = el('button', 'mini pencil', '✎'); pencil.title = 'Edit';
    pencil.addEventListener('click', e => { e.stopPropagation(); openEditor(b); });
    controls.appendChild(pencil);
  }

  card.appendChild(chk); card.appendChild(body); card.appendChild(thumb); card.appendChild(controls);
  card.addEventListener('click', () => {
    if (state.selecting) { toggleSelect(b.id); render(); }
    else visit(b);           // click = go (SCN-006). Peek only; never marks read (SCN-011)
  });
  return card;
}

function favicon(b) {
  const src = b.favicon || faviconFor(b.url);
  if (!src) return el('span', 'fav ph2', esc((hostOf(b.url) || '?')[0].toUpperCase()));
  const img = document.createElement('img'); img.className = 'fav'; img.src = src; img.alt = '';
  img.addEventListener('error', () => { const s = el('span', 'fav ph2', esc((hostOf(b.url) || '?')[0].toUpperCase())); img.replaceWith(s); });
  return img;
}

function labelRow(b, q) {
  const row = el('div', 'lbls');
  const labels = b.labels || [];
  const CAP = 5;
  labels.slice(0, CAP).forEach(l => { const s = el('span'); s.innerHTML = highlight(l, q); row.appendChild(s); });
  if (labels.length > CAP) {
    const more = el('span', 'more', '+' + (labels.length - CAP) + ' more');   // reveals the rest (SCN-015)
    more.addEventListener('click', e => {
      e.stopPropagation();
      more.remove();
      labels.slice(CAP).forEach(l => { const s = el('span'); s.textContent = l; row.appendChild(s); });
    });
    row.appendChild(more);
  }
  return row;
}

function visit(b) {
  window.open(b.url.startsWith('http') ? b.url : 'https://' + b.url, '_blank', 'noopener');
}

// ---------------------------------------------------------------------------
// Keep a copy (SCN-018): capture quietly at save; view any time; honest fallback
// ---------------------------------------------------------------------------
function captureInBackground(b) {
  capturePage(b.url).then(copy => { store.setCopy(b.id, copy); render(); });
}

function copyChip(b) {
  const st = (b.copy && b.copy.status) || 'pending';
  if (st === 'kept') return el('span', 'copychip kept', '✓ copy kept');
  if (st === 'none') return el('span', 'copychip none', "no copy — couldn't capture");
  return el('span', 'copychip pending', 'keeping a copy…');
}

function openCopyReader(b) {
  const st = (b.copy && b.copy.status) || 'pending';
  if (st === 'pending') {                     // capture lazily if not done yet (e.g. imported)
    captureInBackground(b);
    return openCopyReaderPanel(b, '<p class="muted">Keeping a copy now… reopen in a moment.</p>');
  }
  if (st === 'kept') {
    const imgs = (b.copy.images || []).length ? '<div class="hero">[ saved image ]</div>' : '';
    return openCopyReaderPanel(b, imgs + '<h2>' + esc(displayName(b)) + '</h2><p>' + esc(b.copy.body) + '</p>');
  }
  // no copy — honest fallback (flavour C): keep the note, offer a public archive
  openCopyReaderPanel(b,
    '<div class="ext"><div class="big">🌐</div>' +
    "<p>This one couldn't be copied (it may need a login). Your note is kept, and you can look for a public archive:</p>" +
    '<p><a href="' + archiveUrlFor(b.url) + '" target="_blank" rel="noopener">Search the Internet Archive →</a></p>' +
    "<p class=\"disc\">That copy lives on someone else's service and may not exist.</p></div>", true);
}
function openCopyReaderPanel(b, inner, none) {
  const back = $('#copyBack'); back.classList.add('show');
  const r = $('#copyReader');
  r.innerHTML =
    '<div class="rhead"><span>' + (none ? 'No copy stored' : 'Your saved copy') + '</span><button class="x">×</button></div>' +
    (b.note ? '<div class="rnote"><b>My note:</b> ' + esc(b.note) + '</div>' : '') +
    '<div class="rbody' + (none ? ' ext-wrap' : '') + '">' + inner + '</div>';
  r.querySelector('.x').addEventListener('click', () => back.classList.remove('show'));
}

// ---------------------------------------------------------------------------
// Add composer + editor (shared modal)  (SCN-001, SCN-005, SCN-006, SCN-014)
// ---------------------------------------------------------------------------
let labelWidget = null;

function openComposer(prefill, url, limited) {
  openModal({
    heading: 'Save new bookmark',
    banner: limited ? { kind: 'warn', text: "Couldn't fully read this page — you can fill in the details yourself. The link is saved either way." } : null,
    url,
    title: prefill.title, description: prefill.description, note: '',
    labels: [], saveLabel: 'Save bookmark',
    onSave: fields => {
      const b = store.addBookmark({ url, ...fields, favicon: prefill.favicon, thumbnail: prefill.thumbnail, unread: true });
      closeModal(); render();
      captureInBackground(b);   // SCN-018: keep a copy, quietly, at save
    },
    showDanger: false,
  });
}

function openEditor(b, dup) {
  openModal({
    heading: 'Edit bookmark',
    banner: dup ? { kind: 'ok', text: "You've already saved this link — here it is. Edit and it stays one bookmark, not a copy." } : null,
    url: b.url,
    title: b.title, description: b.description, note: b.note, labels: [...(b.labels || [])],
    saveLabel: 'Save changes',
    onSave: fields => { store.updateBookmark(b.id, fields); closeModal(); render(); },
    showDanger: true,
    onSetAside: () => { closeModal(); doUndoable(store.setAside([b.id]), 'Set aside'); },
    onDelete: () => { closeModal(); doUndoable(store.deleteBookmarks([b.id]), 'Deleted'); },
  });
}

function openModal(cfg) {
  const back = $('#modalBack'); back.classList.add('show');
  const m = $('#modal');
  m.innerHTML = '';
  if (cfg.banner) m.appendChild(el('div', 'banner ' + cfg.banner.kind, esc(cfg.banner.text)));
  m.appendChild(el('h3', '', esc(cfg.heading)));
  m.appendChild(el('div', 'murl', esc(cfg.url)));

  m.appendChild(fieldLabel('Title', '— from the page'));
  const title = input(cfg.title); m.appendChild(title);
  m.appendChild(fieldLabel('Description', "— the page's own words"));
  const desc = textarea(cfg.description); m.appendChild(desc);
  m.appendChild(fieldLabel('My notes', '— your words (optional)'));
  const note = textarea(cfg.note); note.className = 'noteField'; m.appendChild(note);
  m.appendChild(fieldLabel('Labels', ''));
  const labelMount = el('div'); m.appendChild(labelMount);
  labelWidget = createLabelInput(labelMount, { initial: cfg.labels, getExisting: () => store.labels });

  const actions = el('div', 'modal-actions');
  const save = el('button', 'primary', cfg.saveLabel);
  save.addEventListener('click', () => cfg.onSave({
    title: title.value.trim(), description: desc.value.trim(), note: note.value.trim(), labels: labelWidget.getValue()
  }));
  const cancel = el('button', 'ghost', 'Cancel'); cancel.addEventListener('click', closeModal);
  actions.appendChild(save); actions.appendChild(cancel);
  m.appendChild(actions);

  if (cfg.showDanger) {
    const zone = el('div', 'danger-zone');
    const aside = el('button', 'aside-btn', 'Set aside'); aside.addEventListener('click', cfg.onSetAside);
    const del = el('button', 'del-link', 'Delete forever'); del.addEventListener('click', cfg.onDelete);
    zone.appendChild(aside); zone.appendChild(del); m.appendChild(zone);
  }
  title.focus(); title.select();
}
function closeModal() { $('#modalBack').classList.remove('show'); $('#modal').innerHTML = ''; }
function fieldLabel(main, side) { const l = el('label', 'fld'); l.innerHTML = esc(main) + ' <span class="side">' + esc(side) + '</span>'; return l; }
function input(v) { const i = document.createElement('input'); i.type = 'text'; i.value = v || ''; return i; }
function textarea(v) { const t = document.createElement('textarea'); t.value = v || ''; return t; }

// ---------------------------------------------------------------------------
// Add flow  (SCN-001, SCN-007, SCN-014)
// ---------------------------------------------------------------------------
async function onAdd() {
  const raw = $('#urlInput').value.trim();
  const err = $('#inlineErr');
  err.classList.remove('show');
  if (!raw) return;
  if (!looksLikeUrl(raw)) {                                   // SCN-014: block a non-link (red)
    $('#urlInput').classList.add('bad');
    err.textContent = "That doesn't look like a web address. A link usually looks like example.com/page.";
    err.classList.add('show');
    return;
  }
  $('#urlInput').classList.remove('bad');
  const existing = findByUrl(store.bookmarks, raw);            // SCN-007: duplicate -> open existing
  if (existing) { $('#urlInput').value = ''; openEditor(existing, true); return; }
  $('#addBtn').disabled = true; $('#addBtn').textContent = 'Reading…';
  let meta;
  try { meta = await readPage(raw); }
  catch (e) { meta = { title: hostOf(raw), description: '', favicon: faviconFor(raw), thumbnail: null, limited: true }; }
  $('#addBtn').disabled = false; $('#addBtn').textContent = 'Add';
  $('#urlInput').value = '';
  openComposer(meta, normalizeUrl(raw), meta.limited);
}

// ---------------------------------------------------------------------------
// Selection + bulk actions  (SCN-012)
// ---------------------------------------------------------------------------
function toggleSelect(id) { if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id); }

function renderSelectionBar() {
  $('#selectBtn').classList.toggle('on', state.selecting);
  $('#selectBtn').textContent = state.selecting ? 'Done' : 'Select';
  $('#selectAll').style.display = state.selecting ? 'inline-block' : 'none';
  if (state.selecting) {
    const list = currentList();
    const allSel = list.length && list.every(b => state.selected.has(b.id));
    $('#selectAll').textContent = allSel ? 'Clear all' : 'Select all (' + list.length + ')';
  }
  const bar = $('#actionBar');
  const show = state.selecting && state.selected.size > 0;
  bar.classList.toggle('show', show);
  if (show) $('#abCount').textContent = state.selected.size + ' selected';
}

function ids() { return [...state.selected]; }
function afterBulk(undo, msg) { state.selected.clear(); state.selecting = false; render(); showUndo(msg, undo); }

function wireBulk() {
  $('#selectBtn').addEventListener('click', () => { state.selecting = !state.selecting; if (!state.selecting) state.selected.clear(); render(); });
  $('#selectAll').addEventListener('click', () => {
    const list = currentList();
    const allSel = list.every(b => state.selected.has(b.id));
    if (allSel) list.forEach(b => state.selected.delete(b.id)); else list.forEach(b => state.selected.add(b.id));
    render();
  });
  $('#abCancel').addEventListener('click', () => { state.selected.clear(); render(); });
  document.querySelectorAll('#actionBar [data-act]').forEach(btn => btn.addEventListener('click', () => {
    const n = state.selected.size; if (!n) return; const sel = ids();
    switch (btn.dataset.act) {
      case 'read': afterBulk(store.markRead(sel), 'Marked ' + n + ' read'); break;
      case 'toread': afterBulk(store.markToRead(sel), 'Moved ' + n + ' to To-read'); break;
      case 'aside': afterBulk(store.setAside(sel), 'Set ' + n + ' aside'); break;
      case 'addlabel': {
        const name = prompt('Add which label to the ' + n + ' selected?'); if (!name || !name.trim()) return;
        afterBulk(store.addLabelTo(sel, name.trim()), 'Added “' + name.trim() + '” to ' + n); break;
      }
      case 'rmlabel': {
        const present = store.labelsPresentIn(sel);
        if (!present.length) { showUndo('No labels on the selected bookmarks', null); return; }
        const name = prompt('Remove which label from the ' + n + ' selected?\nLabels present: ' + present.join(', ')); if (!name || !name.trim()) return;
        afterBulk(store.removeLabelFrom(sel, name.trim()), 'Removed “' + name.trim() + '” from selected'); break;
      }
      case 'delete': confirmBulkDelete(sel); break;    // guarded (SCN-012)
    }
  }));
}

function confirmBulkDelete(sel) {
  const n = sel.length;
  const back = $('#confirmBack'); back.classList.add('show');
  $('#confirmText').textContent = 'You\'re about to permanently delete ' + n + ' bookmark' + (n === 1 ? '' : 's') + '. This can\'t be undone from here.';
  const yes = $('#confirmYes'), no = $('#confirmNo');
  const cleanup = () => { back.classList.remove('show'); yes.onclick = null; no.onclick = null; };
  yes.onclick = () => { cleanup(); afterBulk(store.deleteBookmarks(sel), 'Deleted ' + n); };
  no.onclick = cleanup;
}

// ---------------------------------------------------------------------------
// Undo toast  (single slot; DD-8)
// ---------------------------------------------------------------------------
let undoTimer = null;
function doUndoable(undoFn, msg) { render(); showUndo(msg, undoFn); }
function showUndo(msg, undoFn) {
  const t = $('#toast'); t.innerHTML = '';
  t.appendChild(el('span', '', msg));
  if (undoFn) { const b = el('button', '', 'Undo'); b.addEventListener('click', () => { undoFn(); render(); hideToast(); }); t.appendChild(b); }
  t.classList.add('show'); clearTimeout(undoTimer); undoTimer = setTimeout(hideToast, 5000);
}
function hideToast() { $('#toast').classList.remove('show'); }

// ---------------------------------------------------------------------------
// Import  (SCN-016)
// ---------------------------------------------------------------------------
let parsedEntries = [];
function openImport() { $('#importBack').classList.add('show'); showImportStep('start'); }
function closeImport() { $('#importBack').classList.remove('show'); parsedEntries = []; }
function showImportStep(step) {
  ['start', 'preview', 'result'].forEach(s => $('#imp-' + s).style.display = s === step ? 'block' : 'none');
}
function wireImport() {
  $('#openImport').addEventListener('click', openImport);
  $('#impCancel').addEventListener('click', closeImport);
  $('#impClose').addEventListener('click', () => { closeImport(); render(); });
  $('#importBack').addEventListener('click', e => { if (e.target === $('#importBack')) closeImport(); });

  $('#fileInput').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { parsedEntries = parseNetscapeBookmarks(String(r.result)); showPreview(); };
    r.readAsText(f);
  });
  $('#pasteBtn').addEventListener('click', () => {
    parsedEntries = parseLinkList($('#pasteBox').value); if (!parsedEntries.length) { alert('No links found in the pasted text.'); return; }
    showPreview();
  });
  $('#impRun').addEventListener('click', () => {
    const foldersAsLabels = $('#optFolders').checked;
    const readMode = document.querySelector('input[name="readMode"]:checked').value;
    const res = store.importBookmarks(parsedEntries, { foldersAsLabels, readMode });
    $('#impResult').innerHTML = '✓ Brought in <b>' + res.imported + '</b> bookmarks, created <b>' + res.labelsCreated +
      '</b> labels, skipped <b>' + res.skipped + '</b> you already had.';
    showImportStep('result');
  });
}
function showPreview() {
  const s = summarize(parsedEntries);
  const folders = Object.entries(s.folders).sort((a, b) => b[1] - a[1]);
  $('#impFound').innerHTML = 'Found <b>' + s.count + '</b> bookmarks' + (folders.length > 1 ? ' in ' + folders.length + ' folders' : '');
  $('#impFolders').innerHTML = folders.slice(0, 8).map(([f, c]) => '<span>' + esc(f) + ' <span class="c">· ' + c + '</span></span>').join('') +
    (folders.length > 8 ? '<span>+' + (folders.length - 8) + ' more</span>' : '');
  const dupes = parsedEntries.filter(e => findByUrl(store.bookmarks, e.url)).length;
  $('#impDupes').textContent = dupes;
  $('#impRun').textContent = 'Bring in ' + (s.count - dupes) + ' bookmarks';
  showImportStep('preview');
}

// ---------------------------------------------------------------------------
// Wire up
// ---------------------------------------------------------------------------
function wire() {
  $('#addBtn').addEventListener('click', onAdd);
  $('#urlInput').addEventListener('keydown', e => { if (e.key === 'Enter') onAdd(); });
  $('#urlInput').addEventListener('input', () => { $('#urlInput').classList.remove('bad'); $('#inlineErr').classList.remove('show'); });

  $('#search').addEventListener('input', e => { state.query = e.target.value; dirtyView(); render(); });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
  $('#inclAside').addEventListener('change', e => { state.includeAside = e.target.checked; render(); });

  for (const [id, v] of [['tabAll', 'all'], ['tabToRead', 'toread'], ['tabAside', 'aside']])
    $('#' + id).addEventListener('click', () => { state.view = v; state.selecting = false; state.selected.clear(); render(); });

  $('#modalBack').addEventListener('click', e => { if (e.target === $('#modalBack')) closeModal(); });
  $('#copyBack').addEventListener('click', e => { if (e.target === $('#copyBack')) $('#copyBack').classList.remove('show'); });

  wireBulk();
  wireImport();
  render();
}

document.addEventListener('DOMContentLoaded', wire);
