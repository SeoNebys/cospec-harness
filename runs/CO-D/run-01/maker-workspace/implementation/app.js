// App wiring: connects the DOM to the tested core domain (src/core) and the
// page-service seam (src/services). All the tricky rules live in the core; this
// file is presentation + event handling + persistence.

import { Store, defaultToday } from './src/core/store.js';
import { hostOf, ensureScheme, isUrlLike } from './src/core/url.js';
import { canonicalLabel, hasLabel, addLabel, removeLabel, allLabels } from './src/core/labels.js';
import { search, terms, wordMatchesTerm } from './src/core/search.js';
import { sortBookmarks } from './src/core/sort.js';
import { parseImport, importEntries, exportText } from './src/core/imports.js';
import { clickOpens, savedCopyView } from './src/core/copy.js';
import { fetchMetadata } from './src/services/pageService.js';

// ---------- persistence ----------
const STORAGE_KEY = 'bookmarks.v1';
const store = new Store();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bookmarks: store.bookmarks, id: store._id }));
  } catch { /* ignore quota/availability in prototype */ }
}
function load() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
  if (raw) {
    try {
      const data = JSON.parse(raw);
      store.bookmarks = data.bookmarks || [];
      store._id = data.id || store.bookmarks.reduce((m, b) => Math.max(m, b.id), 0);
      return true;
    } catch { /* fall through to seed */ }
  }
  return false;
}
function seedFirstRun() {
  const seeds = [
    ['https://en.wikipedia.org/wiki/Ancient_Rome', 'Ancient Rome - Wikipedia', 'The Roman civilization that grew from a city-state on the Italian Peninsula into an empire ruling the Mediterranean world for centuries.', ['history'], true, '2026-06-20', { kind: 'text', dead: false }],
    ['https://cooking.example.com/spaghetti-carbonara', 'Classic Spaghetti Carbonara', 'A traditional Roman pasta dish made with eggs, pecorino cheese, guanciale and black pepper.', ['cooking', 'italian'], false, '2025-11-15', { kind: 'text', dead: false }],
    ['https://history.example.com/colosseum', 'How the Colosseum Was Built', 'The largest amphitheatre ever built, standing in the heart of Rome and completed around 80 AD.', ['history', 'travel'], false, '2024-03-08', { kind: 'text', dead: true }],
    ['https://arxiv.example.com/papers/transformers.pdf', 'Attention Is All You Need (PDF)', 'A research paper introducing the Transformer architecture.', ['coding'], true, '2026-06-28', { kind: 'pdf', dead: false }],
  ];
  seeds.forEach(([url, title, summary, labels, toRead, savedAt, copy]) => {
    const r = store.save(url, { title, summary, labels, toRead, savedAt, copy });
    if (r.status === 'added' && title.includes('Carbonara')) r.bookmark.note = 'Mum loved this one — use guanciale, never bacon.';
  });
  persist();
}

// ---------- ui state ----------
let query = '', labelFilter = null, view = 'all', sortMode = 'newest';
let renamingId = null, flashId = null, justSavedId = null, bannerTimer = null;
let editingLabelsId = null, labelDraft = '';
let selectMode = false, bulkLabelOpen = false, bulkUnlabelOpen = false, bulkDeleteConfirm = false, lastShown = [];
const selected = new Set();

// ---------- dom helpers ----------
const $ = (id) => document.getElementById(id);
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(s) { if (!s) return ''; const p = s.split('-').map(Number); if (!p[0]) return s; return p[2] + ' ' + MONTHS[(p[1] || 1) - 1] + ' ' + p[0]; }

function faviconMarkup(url) {
  const host = hostOf(url), letter = (host[0] || '?').toUpperCase();
  const colors = ['#2f6df6', '#e0663f', '#3f9f56', '#8b5cf6', '#d9a441', '#d6457f'];
  const color = colors[host.length % colors.length];
  return `<img class="favicon" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64" onerror="favFail(this,'${letter}','${color}')" alt="" />`;
}
window.favFail = function (img, letter, color) {
  const d = document.createElement('div');
  d.className = 'favicon fallback'; d.style.background = color; d.textContent = letter; img.replaceWith(d);
};

function highlight(text) {
  const ts = terms(query);
  return escapeHtml(text).replace(/[A-Za-z0-9]+/g, (w) => (ts.some((t) => wordMatchesTerm(w, t)) ? '<mark>' + w + '</mark>' : w));
}
function showBanner(text) {
  const el = $('banner');
  el.innerHTML = '<div class="banner">' + escapeHtml(text) + '</div>';
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { el.innerHTML = ''; }, 4200);
}
function commit() { persist(); render(); }

// ---------- render ----------
function renderLabelBar() {
  const labels = allLabels(store.bookmarks);
  const bar = $('labelBar');
  if (!labels.length) { bar.innerHTML = ''; return; }
  bar.innerHTML = '<span class="lead">Labels</span>' +
    labels.map((l) => `<span class="chip ${l === labelFilter ? 'active' : ''}" data-label="${escapeHtml(l)}" data-role="labelbar">${escapeHtml(l)}</span>`).join('');
}
function renderTabs() {
  const pile = store.bookmarks.filter((b) => b.toRead).length;
  document.querySelectorAll('#tabs .tab').forEach((t) => {
    const v = t.dataset.view;
    t.classList.toggle('active', v === view);
    t.textContent = v === 'toread' ? 'To read' + (pile ? ' (' + pile + ')' : '') : 'All links';
  });
}

function render() {
  renderLabelBar();
  renderTabs();
  renderBulk();

  const q = query.trim();
  let shown = search(store.bookmarks, q);
  if (labelFilter) shown = shown.filter((b) => (b.labels || []).includes(labelFilter));
  if (view === 'toread') shown = shown.filter((b) => b.toRead);
  shown = sortBookmarks(shown, sortMode);
  lastShown = shown.map((b) => b.id);

  const filtering = q || labelFilter;
  $('listLabel').textContent = view === 'toread' ? 'To read' : (filtering ? 'Results' : 'Saved');
  $('count').textContent = view === 'toread'
    ? shown.length + ' to read'
    : (filtering ? shown.length + (shown.length === 1 ? ' match' : ' matches')
      : (store.bookmarks.length ? store.bookmarks.length + (store.bookmarks.length === 1 ? ' link' : ' links') : ''));
  $('clearBtn').style.display = q ? 'block' : 'none';

  const list = $('list');
  if (!store.bookmarks.length) {
    list.innerHTML = '<div class="empty"><strong>Nothing saved yet</strong>Paste your first link above, or use Import to bring your pile in.</div>';
    return;
  }
  if (!shown.length) {
    if (view === 'toread' && !filtering) {
      list.innerHTML = '<div class="empty"><strong>Nothing left to read — nice!</strong>Flag a link with “Read later” and it lands here.</div>';
    } else {
      const what = q ? '“' + escapeHtml(q) + '”' : 'label “' + escapeHtml(labelFilter) + '”';
      list.innerHTML = '<div class="empty"><strong>No matches for ' + what + '</strong>Try a different word or label.</div>';
    }
    return;
  }
  list.innerHTML = shown.map(cardMarkup).join('');
  if (renamingId) { const el = $('rename-' + renamingId); if (el) { el.focus(); el.select(); } }
  if (editingLabelsId) { const el = $('labelInput'); if (el) { const v = el.value; el.focus(); el.setSelectionRange(v.length, v.length); } }
}

function cardMarkup(b) {
  const q = query.trim();
  if (b.loading) {
    return `<div class="card" id="card-${b.id}">${faviconMarkup(b.url)}<div class="body"><div class="title fetching">Fetching page details…</div><div class="url">${escapeHtml(b.url)}</div></div></div>`;
  }
  const renaming = b.id === renamingId;
  const titleBlock = renaming
    ? `<div class="renamebox"><input id="rename-${b.id}" value="${escapeHtml(b.title)}" /><button class="iconbtn" data-role="rename-save" data-id="${b.id}">Save</button></div>`
    : `<div class="title">${q ? highlight(b.title) : escapeHtml(b.title)}</div>`;

  const labelChips = (b.labels || []).map((l) => `<span class="chip ${l === labelFilter ? 'active' : ''}" data-role="chip" data-label="${escapeHtml(l)}">${escapeHtml(l)}</span>`).join('');
  const flag = (view === 'all' && b.toRead) ? '<span class="flagchip">🕮 To read</span>' : '';
  const c = b.copy || {};
  const dead = c.dead ? '<span class="deadchip">⚠ Original unavailable</span>' : '';
  const nocopy = c.kind === 'none' ? '<span class="warnchip">⚠ No saved copy</span>' : '';
  const chips = (flag || dead || nocopy || labelChips) ? `<div class="chips">${dead}${nocopy}${flag}${labelChips}</div>` : '';
  const warnNote = c.kind === 'none'
    ? '<div class="note" style="background:#fff3e0;border-left-color:#f2d19b;color:#8a5a00;">⚠ Couldn’t read this page, so there’s no summary or saved copy — it may need a login. The link itself is saved.</div>' : '';

  const check = selectMode
    ? `<label class="checkwrap" data-role="stop"><input type="checkbox" ${selected.has(b.id) ? 'checked' : ''} data-role="select" data-id="${b.id}" /></label>`
    : (view === 'toread'
      ? `<label class="checkwrap" title="Mark as read" data-role="stop"><input type="checkbox" data-role="markread" data-id="${b.id}" /></label>` : '');

  const cls = ['card', b.id === justSavedId ? 'justsaved' : '', b.id === flashId ? 'flash' : '', (selectMode && selected.has(b.id)) ? 'selected' : '', renaming ? '' : 'clickable'].join(' ').trim();
  const actions = (renaming || selectMode) ? '' : `
    <button class="iconbtn" data-role="edit" data-id="${b.id}">Edit</button>
    <button class="iconbtn" data-role="copy" data-id="${b.id}">Saved copy</button>
    <button class="iconbtn ${b.toRead ? 'on' : ''}" data-role="toread" data-id="${b.id}">${b.toRead ? '✓ Reading list' : 'Read later'}</button>
    <button class="iconbtn" data-role="rename" data-id="${b.id}">Rename</button>
    <button class="iconbtn" data-role="labels" data-id="${b.id}">Labels</button>`;

  return `<div class="${cls}" id="card-${b.id}" data-role="card" data-id="${b.id}">
    ${check}
    ${faviconMarkup(b.url)}
    <div class="body">
      ${titleBlock}
      <div class="url">${escapeHtml(b.url)}</div>
      ${b.summary ? `<div class="desc">${q ? highlight(b.summary) : escapeHtml(b.summary)}</div>` : ''}
      ${b.note ? `<div class="note">📝 ${q ? highlight(b.note) : escapeHtml(b.note)}</div>` : ''}
      ${warnNote}
      ${chips}
      <div class="when">${b.sessionNew ? 'Saved just now' : 'Saved ' + fmtDate(b.savedAt)}</div>
      ${b.id === editingLabelsId ? labelEditorMarkup(b) : ''}
    </div>
    <div class="actions">${actions}</div>
  </div>`;
}

// ---------- label editor (the "Both" adder, SCN-006) ----------
function labelEditorMarkup(b) {
  const cur = b.labels || [];
  const curBlock = cur.length
    ? '<div class="cur">' + cur.map((l) => `<span class="chip">${escapeHtml(l)}<span class="x" data-role="lbl-remove" data-id="${b.id}" data-label="${escapeHtml(l)}">×</span></span>`).join('') + '</div>'
    : '<div class="cur empty-cur">No labels on this link yet.</div>';
  const draft = labelDraft.trim();
  const universe = allLabels(store.bookmarks);
  const matching = universe.filter((l) => !hasLabel(b, l) && (!draft || l.toLowerCase().includes(draft.toLowerCase())));
  const exactExists = universe.some((l) => l.toLowerCase() === draft.toLowerCase());
  const palette = matching.map((l) => `<span class="addchip" data-role="lbl-add" data-id="${b.id}" data-label="${escapeHtml(l)}">${escapeHtml(l)}</span>`).join('');
  const create = (draft && !exactExists) ? `<span class="createchip" data-role="lbl-add" data-id="${b.id}" data-label="${escapeHtml(draft)}">＋ Create “${escapeHtml(draft)}”</span>` : '';
  return `<div class="leditor" data-role="stop">
    <div class="sec">Labels on this link</div>
    ${curBlock}
    <div class="sec">Add a label — your labels are below; type to filter</div>
    <input id="labelInput" placeholder="Filter or create…" value="${escapeHtml(labelDraft)}" data-role="lbl-input" data-id="${b.id}" autocomplete="off" />
    <div class="palette">${palette || '<span class="empty-cur">No matches.</span>'}${create}</div>
    <button class="done" data-role="lbl-done">Done</button>
  </div>`;
}

// ---------- bulk bar (SCN-016) ----------
function renderBulk() {
  const btn = $('selBtn');
  if (btn) { btn.textContent = selectMode ? 'Cancel' : 'Select'; btn.classList.toggle('on', selectMode); }
  const bar = $('bulkbar');
  if (!selectMode) { bar.innerHTML = ''; return; }
  const n = selected.size;
  const universe = allLabels(store.bookmarks);
  const onSel = []; selected.forEach((id) => { const b = store.get(id); (b && b.labels || []).forEach((l) => { if (!onSel.includes(l)) onSel.push(l); }); });
  const sub = bulkLabelOpen ? `<div class="sub">
      <div style="margin-bottom:6px;">Add a label to ${n} selected — tap an existing one or type a new one:</div>
      <input id="bulkLabelInput" placeholder="Label…" data-role="bulk-label-input" />
      <button data-role="bulk-label-add" style="margin-left:6px;">Add</button>
      <div class="palette">${universe.map((l) => `<span class="addchip" data-role="bulk-label-chip" data-label="${escapeHtml(l)}">${escapeHtml(l)}</span>`).join('') || '<span style="color:#8a94a3;">No labels yet — type one above.</span>'}</div>
    </div>` : '';
  const unsub = bulkUnlabelOpen ? `<div class="sub">
      <div style="margin-bottom:6px;">Remove a label from the ${n} selected — tap one to strip it off all of them:</div>
      <div class="palette">${onSel.sort().map((l) => `<span class="addchip" data-role="bulk-unlabel-chip" data-label="${escapeHtml(l)}">${escapeHtml(l)} ✕</span>`).join('') || '<span style="color:#8a94a3;">The selected links have no labels.</span>'}</div>
    </div>` : '';
  const confirm = bulkDeleteConfirm ? `<div class="sub">Delete ${n} link${n === 1 ? '' : 's'} for good, saved copies and all?
      <button class="danger" style="margin-left:8px;" data-role="bulk-delete-do">Yes, delete ${n}</button>
      <button data-role="bulk-clear">Cancel</button></div>` : '';
  bar.innerHTML = `<div class="inner">
      <b>${n} selected</b>
      <button class="ghost" data-role="bulk-selectall">Select all shown</button>
      <span class="spacer"></span>
      <button ${n ? '' : 'disabled'} data-role="bulk-label">Label…</button>
      <button ${n ? '' : 'disabled'} data-role="bulk-unlabel">Unlabel…</button>
      <button ${n ? '' : 'disabled'} data-role="bulk-readlater">Read later</button>
      <button ${n ? '' : 'disabled'} data-role="bulk-markread">Mark read</button>
      <button class="danger" ${n ? '' : 'disabled'} data-role="bulk-delete">Delete</button>
      <button class="ghost" data-role="bulk-done">Done</button>
      ${sub}${unsub}${confirm}
    </div>`;
}

// ---------- actions ----------
function saveNew() {
  const raw = $('urlInput').value;
  const url = ensureScheme(raw);
  if (!raw.trim()) return;
  if (!isUrlLike(url)) { const e = $('saverErr'); e.textContent = 'That doesn’t look like a web link — check the address and try again.'; e.hidden = false; return; }
  $('saverErr').hidden = true;
  $('urlInput').value = '';
  query = ''; $('searchInput').value = '';

  const res = store.save(url);
  if (res.status === 'duplicate') {
    // SCN-004: no copy — go to the one we have, open it ready to edit.
    persist();
    showBanner('You already saved this one — opened it so you can tweak it.');
    openEdit(res.bookmark.id);
    return;
  }
  const b = res.bookmark;
  b.loading = true; b.sessionNew = true; justSavedId = b.id;
  commit();
  fetchMetadata(url).then((meta) => {
    b.title = meta.title; b.summary = meta.summary; b.copy = meta.copy; b.loading = false;
    commit();
  });
}

window.__open = function (url) { window.open(url, '_blank', 'noopener'); };

function openBookmarkCard(id) {
  const b = store.get(id); if (!b) return;
  const target = clickOpens(b);
  if (target === 'original') window.open(b.url, '_blank', 'noopener');
  else openSavedCopy(id); // dead → fall back to copy (or the no-copy notice)
}

function toggleToRead(id) { const b = store.get(id); if (b) { b.toRead = !b.toRead; commit(); } }
function markRead(id) { const b = store.get(id); if (b) { b.toRead = false; showBanner('Ticked off — one less thing to read.'); commit(); } }

function startRename(id) { renamingId = id; editingLabelsId = null; render(); }
function commitRename(id) { const el = $('rename-' + id), b = store.get(id); if (el && b) { const v = el.value.trim(); if (v) b.title = v; } renamingId = null; commit(); }

function startEditLabels(id) { editingLabelsId = id; renamingId = null; labelDraft = ''; render(); }
function closeLabels() { editingLabelsId = null; labelDraft = ''; render(); }
function doAddLabel(id, raw) {
  const b = store.get(id); if (!b) return;
  addLabel(b, allLabels(store.bookmarks), raw);
  labelDraft = ''; commit();
}
function doRemoveLabel(id, label) { const b = store.get(id); if (b) { removeLabel(b, label); commit(); } }

// ---------- saved copy + edit modals ----------
function closeModal() { $('modal').innerHTML = ''; }
window.__closeModal = closeModal;

function openSavedCopy(id) {
  const b = store.get(id); if (!b) return;
  const v = savedCopyView(b);
  const archClass = (v.state === 'no-copy' || v.dead) ? 'arch gone' : 'arch';
  let body;
  if (v.state === 'no-copy') {
    body = '';
  } else if (v.state === 'pdf') {
    const fn = (() => { try { return new URL(b.url).pathname.split('/').pop(); } catch { return 'document.pdf'; } })();
    body = `<div class="pdfbox"><div class="doc">📕</div><div class="fn">${escapeHtml(fn)}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:6px;">Kept as the original PDF file — not converted to text.</div>
      <button class="openpdf" data-role="open-orig" data-url="${escapeHtml(b.url)}">Open PDF</button></div>`;
  } else {
    const paras = (b.summary ? [b.summary] : []).concat(['(In the finished app, the full saved copy of the page text is stored here, captured when you bookmarked it.)']);
    body = '<div class="content">' + paras.map((p) => '<p>' + escapeHtml(p) + '</p>').join('') + '</div>';
  }
  const origBtn = v.canOpenOriginal
    ? `<button class="btn orig" data-role="open-orig" data-url="${escapeHtml(b.url)}">Open the original</button>`
    : `<button class="btn orig" disabled title="The original is no longer reachable">Open the original</button>`;
  $('modal').innerHTML = `<div class="overlay" data-role="overlay"><div class="reader">
      <h2>${escapeHtml(b.title)}</h2>
      <div class="meta">${escapeHtml(b.url)}</div>
      <div class="${archClass}">${escapeHtml(v.message)}</div>
      ${body}
      <div class="rowbtns">${origBtn}<button class="btn" data-role="close-modal">Close</button></div>
    </div></div>`;
}

let editDeleteConfirm = false;
function openEdit(id) { editDeleteConfirm = false; renderEdit(id); }
function renderEdit(id) {
  const b = store.get(id); if (!b) return;
  const confirmBlock = editDeleteConfirm ? `<div class="confirm">
      <span>Delete this link for good? Your saved copy goes too.</span><span class="spacer"></span>
      <button class="btn danger" data-role="edit-delete-do" data-id="${b.id}">Yes, delete</button>
      <button class="btn" data-role="edit-delete-cancel" data-id="${b.id}">Keep it</button></div>` : '';
  $('modal').innerHTML = `<div class="overlay" data-role="overlay"><div class="reader">
      <h2>Edit link</h2>
      <label class="f">Title</label>
      <input class="field" id="eTitle" value="${escapeHtml(b.title)}" />
      <label class="f">Your note (searchable)</label>
      <textarea class="field" id="eNote" placeholder="Jot anything — why you saved it, what to remember…">${escapeHtml(b.note || '')}</textarea>
      <label class="f">Summary (auto-filled — edit if it's off)</label>
      <textarea class="field" id="eDesc">${escapeHtml(b.summary || '')}</textarea>
      <label class="f">Address</label>
      <input class="field" id="eUrl" value="${escapeHtml(b.url)}" />
      <div class="rowbtns">
        <button class="btn primary" data-role="edit-save" data-id="${b.id}">Save</button>
        <button class="btn" data-role="close-modal">Cancel</button>
        <span class="spacer"></span>
        <button class="btn danger" data-role="edit-delete-ask" data-id="${b.id}">Delete link</button>
      </div>
      ${confirmBlock}
    </div></div>`;
}
function saveEdit(id) {
  const b = store.get(id); if (!b) return;
  const t = $('eTitle').value.trim(); const u = $('eUrl').value.trim();
  if (t) b.title = t;
  b.note = $('eNote').value.trim();
  b.summary = $('eDesc').value.trim();
  if (u) b.url = ensureScheme(u);
  closeModal(); commit();
}

// ---------- import / export ----------
const SAMPLE_IMPORT = [
  'Ancient Rome - Wikipedia | https://en.wikipedia.org/wiki/Ancient_Rome | History | 2020-01-14',
  'Best Neapolitan Pizza Dough | https://cooking.example.com/pizza-dough | Recipes/Italian | 2019-08-03',
  'Tax Filing Guide 2026 | https://gov.example.com/tax-guide | Work/Reference | 2023-04-11',
  'Kyoto 5-Day Itinerary | https://travel.example.com/kyoto | Travel/Japan | 2018-05-22',
  'Rust Ownership Explained | https://devblog.example.com/rust-ownership | Coding | 2022-09-30',
].join('\n');

function openImport() {
  $('modal').innerHTML = `<div class="overlay" data-role="overlay"><div class="reader">
      <h2>Bring in your bookmarks</h2>
      <div class="arch">Paste your browser's exported bookmarks (or load a sample). We'll <b>skip any you already have</b>, turn each bookmark's <b>folder into labels</b>, and keep each one's <b>original date</b>.</div>
      <label class="f">Bookmarks — one per line: <code>Title | https://… | Folder/Subfolder | YYYY-MM-DD</code></label>
      <textarea class="field" id="importText" style="min-height:130px;"></textarea>
      <div class="rowbtns"><button class="btn" data-role="import-sample">Load a sample browser export</button></div>
      <div class="rowbtns"><button class="btn primary" data-role="import-run">Import</button><button class="btn" data-role="close-modal">Cancel</button></div>
    </div></div>`;
}
function runImport() {
  const text = ($('importText') || {}).value || '';
  const res = importEntries(store, parseImport(text));
  closeModal();
  let msg = 'Imported ' + res.added + ' link' + (res.added === 1 ? '' : 's');
  if (res.skippedDuplicate) msg += ', skipped ' + res.skippedDuplicate + ' you already had';
  if (res.skippedInvalid) msg += ', ignored ' + res.skippedInvalid + " that weren't links";
  msg += '. Folders became labels.';
  showBanner(msg);
  // Fetch metadata/copies for the freshly imported links in the background.
  store.bookmarks.filter((b) => b.imported && b.copy && b.copy.kind === 'pending').forEach((b) => {
    fetchMetadata(b.url, { delay: 300 }).then((meta) => {
      if (!b.summary) b.summary = meta.summary;
      if (b.title === hostOf(b.url) && meta.title) b.title = meta.title;
      b.copy = meta.copy; persist(); render();
    });
  });
  commit();
}
function openExport() {
  const text = exportText(store.bookmarks);
  $('modal').innerHTML = `<div class="overlay" data-role="overlay"><div class="reader">
      <h2>Export your links</h2>
      <div class="arch">Your links, yours to take anywhere — nothing locked in.</div>
      <textarea class="field" style="min-height:200px;" readonly>${escapeHtml(text)}</textarea>
      <div class="rowbtns"><button class="btn primary" data-role="export-download">Download file</button><button class="btn" data-role="close-modal">Done</button></div>
    </div></div>`;
}
function downloadExport() {
  const text = exportText(store.bookmarks);
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my-bookmarks.txt';
  document.body.appendChild(a); a.click(); a.remove();
  showBanner('Exported your links to a file.');
}

// ---------- bulk handlers ----------
function resetBulkSubs() { bulkLabelOpen = false; bulkUnlabelOpen = false; bulkDeleteConfirm = false; }
function toggleSelectMode() { selectMode = !selectMode; selected.clear(); resetBulkSubs(); render(); }
function toggleSelect(id) { if (selected.has(id)) selected.delete(id); else selected.add(id); bulkDeleteConfirm = false; render(); }
function bulkSelectAll() { lastShown.forEach((id) => selected.add(id)); render(); }
function bulkClear() { selected.clear(); resetBulkSubs(); render(); }
function bulkReadLater() { selected.forEach((id) => { const b = store.get(id); if (b) b.toRead = true; }); showBanner('Flagged ' + selected.size + ' to read.'); commit(); }
function bulkMarkRead() { let n = 0; selected.forEach((id) => { const b = store.get(id); if (b && b.toRead) { b.toRead = false; n++; } }); showBanner('Ticked off ' + n + ' link' + (n === 1 ? '' : 's') + '.'); commit(); }
function bulkApplyLabel(raw) {
  const label = canonicalLabel(allLabels(store.bookmarks), raw); if (!label) return;
  let n = 0; selected.forEach((id) => { const b = store.get(id); if (b && addLabel(b, allLabels(store.bookmarks), label)) n++; });
  bulkLabelOpen = false; showBanner('Added “' + label + '” to ' + n + ' link' + (n === 1 ? '' : 's') + '.'); commit();
}
function bulkRemoveLabel(label) {
  let n = 0; selected.forEach((id) => { const b = store.get(id); if (b && removeLabel(b, label)) n++; });
  showBanner('Removed “' + label + '” from ' + n + ' link' + (n === 1 ? '' : 's') + '.'); commit();
}
function bulkDeleteDo() { const n = selected.size; store.removeMany([...selected]); selected.clear(); bulkDeleteConfirm = false; showBanner('Deleted ' + n + ' link' + (n === 1 ? '' : 's') + '.'); commit(); }

// ---------- event wiring (delegated) ----------
$('saveBtn').addEventListener('click', saveNew);
$('urlInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveNew(); });
$('searchInput').addEventListener('input', (e) => { query = e.target.value; render(); });
$('clearBtn').addEventListener('click', () => { query = ''; $('searchInput').value = ''; render(); $('searchInput').focus(); });
$('sortSel').addEventListener('change', (e) => { sortMode = e.target.value; render(); });
$('selBtn').addEventListener('click', toggleSelectMode);
$('importBtn').addEventListener('click', openImport);
$('exportBtn').addEventListener('click', openExport);
document.querySelectorAll('#tabs .tab').forEach((t) => t.addEventListener('click', () => { view = t.dataset.view; render(); }));

// A single delegated click handler for the dynamic content.
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-role]');
  if (!t) return;
  const role = t.dataset.role;
  const id = t.dataset.id ? Number(t.dataset.id) : null;
  switch (role) {
    case 'stop': e.stopPropagation(); return;
    case 'card': { if (renamingId === id) return; e.stopPropagation(); if (selectMode) toggleSelect(id); else openBookmarkCard(id); return; }
    case 'chip': e.stopPropagation(); labelFilter = (labelFilter === t.dataset.label ? null : t.dataset.label); render(); return;
    case 'labelbar': labelFilter = (labelFilter === t.dataset.label ? null : t.dataset.label); render(); return;
    case 'edit': e.stopPropagation(); openEdit(id); return;
    case 'copy': e.stopPropagation(); openSavedCopy(id); return;
    case 'toread': e.stopPropagation(); toggleToRead(id); return;
    case 'rename': e.stopPropagation(); startRename(id); return;
    case 'rename-save': e.stopPropagation(); commitRename(id); return;
    case 'labels': e.stopPropagation(); startEditLabels(id); return;
    case 'lbl-add': e.stopPropagation(); doAddLabel(id, t.dataset.label); return;
    case 'lbl-remove': e.stopPropagation(); doRemoveLabel(id, t.dataset.label); return;
    case 'lbl-done': e.stopPropagation(); closeLabels(); return;
    case 'overlay': if (e.target === t) closeModal(); return;
    case 'close-modal': closeModal(); return;
    case 'open-orig': window.open(t.dataset.url, '_blank', 'noopener'); return;
    case 'edit-save': saveEdit(id); return;
    case 'edit-delete-ask': editDeleteConfirm = true; renderEdit(id); return;
    case 'edit-delete-cancel': editDeleteConfirm = false; renderEdit(id); return;
    case 'edit-delete-do': store.remove(id); closeModal(); showBanner('Deleted the link.'); commit(); return;
    case 'import-sample': { const el = $('importText'); if (el) el.value = SAMPLE_IMPORT; return; }
    case 'import-run': runImport(); return;
    case 'export-download': downloadExport(); return;
    case 'bulk-selectall': bulkSelectAll(); return;
    case 'bulk-label': { const o = bulkLabelOpen; resetBulkSubs(); bulkLabelOpen = !o; render(); return; }
    case 'bulk-unlabel': { const o = bulkUnlabelOpen; resetBulkSubs(); bulkUnlabelOpen = !o; render(); return; }
    case 'bulk-readlater': bulkReadLater(); return;
    case 'bulk-markread': bulkMarkRead(); return;
    case 'bulk-delete': bulkDeleteConfirm = true; bulkLabelOpen = false; bulkUnlabelOpen = false; render(); return;
    case 'bulk-delete-do': bulkDeleteDo(); return;
    case 'bulk-clear': bulkClear(); return;
    case 'bulk-done': toggleSelectMode(); return;
    case 'bulk-label-chip': bulkApplyLabel(t.dataset.label); return;
    case 'bulk-unlabel-chip': bulkRemoveLabel(t.dataset.label); return;
    case 'bulk-label-add': { const el = $('bulkLabelInput'); if (el && el.value.trim()) bulkApplyLabel(el.value); return; }
  }
});

// Live-typing handlers for the label editor / bulk label input (delegated 'input').
document.addEventListener('input', (e) => {
  const t = e.target.closest('[data-role]');
  if (!t) return;
  if (t.dataset.role === 'lbl-input') { labelDraft = t.value; render(); }
});
document.addEventListener('keydown', (e) => {
  const t = e.target.closest('[data-role]');
  if (!t) return;
  if (t.dataset.role === 'lbl-input') { if (e.key === 'Enter') { e.preventDefault(); if (labelDraft.trim()) doAddLabel(Number(t.dataset.id), labelDraft); } else if (e.key === 'Escape') closeLabels(); }
  if (t.dataset.role === 'bulk-label-input' && e.key === 'Enter') { if (t.value.trim()) bulkApplyLabel(t.value); }
});

// ---------- boot ----------
if (!load()) seedFirstRun();
render();
