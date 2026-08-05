'use strict';
// Browser app. All data comes from the backend API; this file is presentation + wiring.

const $ = (id) => document.getElementById(id);
const state = { view: 'all', label: null, query: '' };
let current = { items: [], counts: { all: 0, toread: 0, archived: 0 }, labels: [] };
let editingId = null, draftLabels = [], justSavedId = null, flashId = null;
let currentOpen = null;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function highlight(text, terms) {
  let safe = esc(text);
  (terms || []).forEach((t) => { if (!t) return; const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); safe = safe.replace(re, '<mark>$1</mark>'); });
  return safe;
}
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return 'saved ' + d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
async function api(path, opts) {
  const res = await fetch(path, opts);
  const body = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  if (!res.ok) throw Object.assign(new Error((body && body.error) || res.statusText), { status: res.status, body });
  return body;
}

function toast(msg, undo) {
  const t = $('toast');
  t.innerHTML = esc(msg) + (undo ? ' <button id="undoBtn">Undo</button>' : '');
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), undo ? 6000 : 2600);
  if (undo) $('undoBtn').onclick = () => { t.classList.remove('show'); undo(); };
}

// ---------- data + render ----------
async function refresh() {
  const p = new URLSearchParams({ view: state.view });
  if (state.label) p.set('label', state.label);
  if (state.query.trim()) {
    p.set('q', state.query.trim());
    current = await api('/api/search?' + p.toString());
  } else {
    current = await api('/api/bookmarks?' + p.toString());
    current.interpretation = { chips: [], special: false };
  }
  render();
}

function termsForHighlight() {
  const chips = (current.interpretation && current.interpretation.chips) || [];
  const terms = [];
  chips.forEach((c) => { if (c.kind === 'without') return; if (c.kind === 'either') terms.push(...c.text.split(' / ')); else terms.push(c.text); });
  return terms;
}

function render() {
  renderViews();
  renderLabels();
  renderScope();
  renderInterp();
  renderList();
}

function renderViews() {
  const c = current.counts;
  $('views').innerHTML =
    `<span class="view ${state.view === 'all' ? 'active' : ''}" data-view="all">All bookmarks <span class="n">${c.all}</span></span>` +
    `<span class="view toread ${state.view === 'toread' ? 'active' : ''}" data-view="toread">📖 To read <span class="n">${c.toread}</span></span>` +
    `<span class="view archived ${state.view === 'archived' ? 'active' : ''}" data-view="archived">🗄 Archived <span class="n">${c.archived}</span></span>`;
}
function renderLabels() {
  if (state.view === 'archived' || (current.labels || []).length === 0) { $('labelbar').innerHTML = ''; return; }
  $('labelbar').innerHTML = `<span class="lead">Labels:</span><span class="pill ${state.label === null ? 'active' : ''}" data-label="__all">All</span>` +
    current.labels.map((l) => `<span class="pill ${state.label === l ? 'active' : ''}" data-label="${esc(l)}">${esc(l)}</span>`).join('');
}
function renderScope() {
  const el = $('scope');
  const parts = [];
  if (state.view === 'toread') parts.push('your 📖 To read pile');
  if (state.view === 'archived') parts.push('your 🗄 Archive');
  if (state.label) parts.push('label “' + esc(state.label) + '”');
  if (state.query.trim() && parts.length) { el.classList.add('show'); el.innerHTML = `Searching within ${parts.join(' · ')}. <a id="searchAll">Search all bookmarks instead →</a>`; }
  else el.classList.remove('show');
}
function renderInterp() {
  const it = current.interpretation;
  if (!it || !it.special) { $('interp').innerHTML = ''; return; }
  const chips = it.chips.map((c) => {
    if (c.kind === 'either') return `<span class="icap either">either: ${esc(c.text)}</span>`;
    if (c.kind === 'phrase') return `<span class="icap phrase">exact phrase: “${esc(c.text)}”</span>`;
    if (c.kind === 'without') return `<span class="icap without">without: ${esc(c.text)}</span>`;
    return `<span class="icap word">${esc(c.text)}</span>`;
  }).join('');
  $('interp').innerHTML = `<span class="lab">Reading your search as:</span>` + chips;
}

function renderList() {
  const items = current.items || [];
  const searching = !!state.query.trim();
  if (!searching && state.view === 'all' && !state.label && items.length === 0) {
    $('count').textContent = '';
    $('list').innerHTML = `<div class="welcome"><div class="big">🔖</div><h2>Your bookmarks live here</h2>
      <p>Coming from a messy pile in your browser? <b>Move it all in at once</b> — every link, with its date and your folders as labels. Or paste a link up top whenever you find one.</p>
      <button class="cta" id="welcomeImport">⇪ Import my existing bookmarks</button>
      <span class="alt">or just paste your first link above</span></div>`;
    $('welcomeImport').onclick = openImport;
    return;
  }
  if (items.length === 0) {
    $('count').textContent = '';
    const w = searching ? 'Nothing matched your search here.' : state.view === 'toread' ? 'Your to-read pile is empty — nothing left to get to. 🎉' : state.view === 'archived' ? 'Nothing archived.' : 'Nothing here yet.';
    $('list').innerHTML = `<div class="empty">${w}</div>`;
    return;
  }
  $('count').textContent = searching ? `${items.length} match${state.view !== 'all' || state.label ? ' in this group' : ''}, best first` : `${current.counts.all} saved`;
  const terms = termsForHighlight();
  let weakShown = false;
  $('list').innerHTML = items.map((b, i) => {
    let pre = '';
    if (searching && b.match && !b.match.strong && !weakShown && i > 0) { weakShown = true; pre = '<div class="divider">matched only inside the page contents — further down on purpose</div>'; }
    return pre + card(b, terms, searching, i);
  }).join('');
}

function card(b, terms, searching, idx) {
  if (b.id === editingId) return editCard(b);
  const dead = b.originalGone;
  const needsInfo = b.captureFailed && !b.title;
  const cls = dead ? 'dead' : needsInfo ? 'needsinfo' : b.unread ? 'toread' : b.archived ? 'archived' : '';
  const badges = (b.unread ? '<span class="badge tr">📖 To read</span>' : '') + (b.archived ? '<span class="badge ar">🗄 Archived</span>' : '') +
    (dead ? '<span class="badge grey">original gone · no copy</span>' : (needsInfo ? '<span class="badge red">needs a title</span>' : ''));
  const status = b.unread ? `<button class="tbtn markread" data-act="markread">✓ Mark as read</button>` : `<button class="tbtn toread" data-act="toread">📖 To read</button>`;
  const tools = b.archived
    ? `<button class="tbtn restore" data-act="restore">⤺ Restore</button><button class="tbtn" data-act="edit">Edit</button>`
    : `${status}<button class="tbtn" data-act="archive">🗄 Archive</button><button class="tbtn" data-act="edit">Edit</button>`;
  const copyChip = dead ? '<span class="copychip no">⚠ no copy — page already gone</span>' : (b.hasCopy ? '<span class="copychip ok">✓ copy kept</span>' : '');
  const title = b.title ? highlight(b.title, terms) : 'Untitled — add a title';
  const why = (searching && b.match) ? b.match.why.map((w) => {
    const label = w.field === 'title' ? 'in title' : w.field === 'summary' ? 'in summary' : w.field === 'labels' ? 'in label' : w.field === 'url' ? 'in link' : 'in page text';
    const c = ['title', 'summary', 'labels'].includes(w.field) ? 'strong' : 'bodyhit';
    return `<span class="hit ${c}">“${esc(w.term)}” ${label}</span>`;
  }).join('') : '';
  const snip = (searching && b.match && b.match.snippet) ? `<p class="snippet">${highlight(b.match.snippet, terms)}</p>` : '';
  const thumb = b.imageUrl ? `<img class="thumb ${dead ? 'dead' : ''} clickable" src="${esc(b.imageUrl)}" data-act="open" alt="">` : `<div class="thumb ph clickable" data-act="open">🔗</div>`;
  return `<div class="card ${cls} ${b.id === flashId ? 'flash' : ''}" data-id="${b.id}">
    ${searching ? `<div class="rankno">${idx + 1}</div>` : ''}
    ${thumb}
    <div class="cardtools">${tools}</div>
    <div class="body">
      <div class="clickable" data-act="open">
        <div class="titlerow">${badges}<div class="title ${b.title ? '' : 'untitled'}">${title}</div></div>
        <div class="url">${esc(b.url)}</div>
        <div class="meta">${fmtDate(b.savedAt)}</div>
        ${b.summary ? `<div class="desc">${highlight(b.summary, terms)}</div>` : ''}
        <div class="why">${why}</div>
        ${snip}
      </div>
      <div class="tags">${(b.labels || []).map((t) => `<span class="tag ${state.label === t ? 'on' : ''}" data-act="filter" data-label="${esc(t)}">${esc(t)}</span>`).join('')}${copyChip}</div>
    </div></div>`;
}

function editCard(b) {
  const chips = draftLabels.map((t, i) => `<span class="chip">${esc(t)}<button data-act="untag" data-i="${i}">×</button></span>`).join('');
  let note = '';
  if (b.id === justSavedId) note = b.captureFailed
    ? '<p class="savenote warn">Saved — but we couldn\'t read this page. Add a title and summary so you can find it later.</p>'
    : '<p class="savenote ok">Saved — details filled in for you. Fix anything, and add your own labels.</p>';
  return `<div class="card" data-id="${b.id}">
    ${b.imageUrl ? `<img class="thumb" src="${esc(b.imageUrl)}" alt="">` : '<div class="thumb ph">🔗</div>'}
    <div class="body"><div class="edit-form">${note}
      <div class="lbl">Title</div><input class="e-title" type="text" value="${esc(b.title)}" placeholder="Give it a title you'll recognise">
      <div class="lbl">Web address</div><input class="e-url" type="text" value="${esc(b.url)}">
      <button class="refetch" data-act="refetch">↻ Re-fetch info from this link</button>
      <div class="refetchhint">Use this if you changed the address to a different page and want fresh title/summary/image.</div>
      <div class="lbl">Summary</div><textarea class="e-desc">${esc(b.summary)}</textarea>
      <div class="lbl">Labels</div>
      <div class="chipbox" data-act="focustag">${chips}<input class="e-tag" type="text" placeholder="Type a label, press Enter…"></div>
      <div class="edit-actions">
        <button class="save" data-act="commit">Save changes</button>
        <button class="cancel" data-act="cancel">Cancel</button>
        <button class="delete" data-act="delete">Delete forever</button>
      </div>
    </div></div></div>`;
}
const itemById = (id) => (current.items || []).find((x) => x.id === id);

// ---------- viewer (open / saved copy) ----------
async function openViewer(id) {
  const c = await api(`/api/bookmarks/${id}/copy`);
  currentOpen = c;
  showViewer(c, c.originalGone ? 'copy' : 'original');
  $('browser').classList.add('show');
}
function showViewer(c, tab) {
  $('addr').textContent = c.url + (tab === 'copy' ? '  ·  saved copy' : '');
  const hasCopy = c.copyStatus === 'kept' && c.copyText;
  $('vtabs').innerHTML = `<div class="vtab ${tab === 'original' ? 'active' : ''}" data-tab="original">Original page</div>` +
    `<div class="vtab ${tab === 'copy' ? 'active' : ''}" data-tab="copy">Your saved copy ${hasCopy ? '✓' : ''}</div>`;
  const v = $('viewer');
  if (tab === 'original') {
    if (c.originalGone) {
      v.innerHTML = `<div class="gonebox"><div class="big">🚫</div><h2>This page is no longer available</h2>
        <p>The original has moved or been taken down.</p>
        ${hasCopy ? `<button class="cta" data-tab="copy">Read your saved copy →</button>` : `<p>No copy was kept for this one (it was already gone when it arrived).</p>`}</div>`;
    } else {
      v.innerHTML = `<div class="reader"><a class="visit" href="${esc(c.url)}" target="_blank" rel="noopener">Visit the original page ↗</a>
        <h2>${esc(c.title || '(untitled)')}</h2><div class="meta">${esc(c.url)}</div>
        ${hasCopy ? `<p style="color:#9aa1ab;font-size:13px">Prefer to read here? Switch to “Your saved copy”.</p>` : ''}</div>`;
    }
  } else {
    if (!hasCopy) {
      v.innerHTML = `<div class="banner gone">No readable copy is available — this page was already gone when it arrived, so there was nothing to keep.</div>`;
    } else {
      const banner = c.originalGone
        ? `<div class="banner gone">The original page is gone — this is the readable copy you saved.</div>`
        : `<div class="banner copy">Your saved copy — stays readable even if the original disappears.</div>`;
      const paras = c.copyText.split(/\n+/).filter((p) => p.trim()).map((p) => `<p>${esc(p)}</p>`).join('');
      v.innerHTML = banner + `<div class="reader"><h2>${esc(c.title || '(untitled)')}</h2><div class="meta">Saved copy · captured when you bookmarked this</div>${paras}</div>`;
    }
  }
}
$('closeBrowser').onclick = () => $('browser').classList.remove('show');
$('browser').addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]');
  if (t && currentOpen) { showViewer(currentOpen, t.dataset.tab); return; }
  if (e.target.id === 'browser') $('browser').classList.remove('show');
});

// ---------- save ----------
function clearErr() { $('saveerr').textContent = ''; $('urlInput').classList.remove('err'); }
$('urlInput').addEventListener('input', clearErr);
async function doSave() {
  const url = $('urlInput').value.trim();
  if (!url) return;
  const unread = $('saveToRead').checked;
  try {
    const r = await api('/api/bookmarks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, unread }) });
    $('urlInput').value = ''; $('saveToRead').checked = false; $('searchInput').value = '';
    state.query = ''; state.label = null; state.view = 'all';
    if (r.status === 'duplicate') { flashId = r.item.id; await refresh(); toast('You already saved this — here it is.'); return; }
    editingId = r.item.id; justSavedId = r.item.id; draftLabels = [];
    await refresh();
    const el = document.querySelector(`[data-id="${r.item.id}"] .e-title`); if (el) el.focus();
    toast(r.needsTitle ? "Saved — but we couldn't read the page. Add a title." : (unread ? 'Saved to your to-read pile' : 'Saved — details grabbed automatically'));
  } catch (err) {
    if (err.status === 400) { $('saveerr').textContent = err.message; $('urlInput').classList.add('err'); }
    else toast('Could not save that just now.');
  }
}
$('saveBtn').onclick = doSave;
$('urlInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });

// ---------- list interactions ----------
let searchTimer = null;
$('searchInput').addEventListener('input', (e) => { state.query = e.target.value; editingId = null; clearTimeout(searchTimer); searchTimer = setTimeout(refresh, 220); });
$('views').addEventListener('click', (e) => { const v = e.target.closest('[data-view]'); if (!v) return; state.view = v.dataset.view; state.label = null; editingId = null; refresh(); });
$('labelbar').addEventListener('click', (e) => { const p = e.target.closest('[data-label]'); if (!p) return; const l = p.dataset.label; state.label = (l === '__all') ? null : (state.label === l ? null : l); editingId = null; refresh(); });
$('scope').addEventListener('click', (e) => { if (e.target.id === 'searchAll') { state.view = 'all'; state.label = null; refresh(); } });

function addDraftTag(raw) { const t = String(raw).trim().replace(/,$/, '').trim(); if (t && !draftLabels.includes(t)) draftLabels.push(t); }
$('list').addEventListener('keydown', (e) => {
  if (e.target.classList.contains('e-tag') && (e.key === 'Enter' || e.key === ',')) {
    e.preventDefault(); addDraftTag(e.target.value); e.target.value = '';
    const b = itemById(editingId); if (b) { $('list').querySelector(`[data-id="${editingId}"]`).outerHTML = editCard({ ...b, title: $('list').querySelector('.e-title').value, url: $('list').querySelector('.e-url').value, summary: $('list').querySelector('.e-desc').value }); const inp = $('list').querySelector('.e-tag'); if (inp) inp.focus(); }
  }
});
$('list').addEventListener('click', async (e) => {
  const el = $('welcomeImport'); // handled elsewhere
  const card = e.target.closest('.card'); if (!card) return;
  const id = card.dataset.id;
  const act = e.target.closest('[data-act]')?.dataset.act;
  const b = itemById(id);
  if (act === 'open') return openViewer(id);
  if (act === 'filter') { const l = e.target.dataset.label; state.label = (state.label === l ? null : l); editingId = null; return refresh(); }
  if (act === 'edit') { editingId = id; justSavedId = null; draftLabels = [...(b.labels || [])]; render(); const t = card.parentNode ? document.querySelector(`[data-id="${id}"] .e-title`) : null; if (t) t.focus(); return; }
  if (act === 'cancel') { editingId = null; justSavedId = null; return render(); }
  if (act === 'untag') { draftLabels.splice(Number(e.target.dataset.i), 1); const cur = { ...b, title: $('list').querySelector('.e-title').value, url: $('list').querySelector('.e-url').value, summary: $('list').querySelector('.e-desc').value }; document.querySelector(`[data-id="${id}"]`).outerHTML = editCard(cur); const inp = document.querySelector('.e-tag'); if (inp) inp.focus(); return; }
  if (act === 'focustag') { if (e.target.classList.contains('chipbox')) { const inp = card.querySelector('.e-tag'); if (inp) inp.focus(); } return; }
  if (act === 'toread') { await api(`/api/bookmarks/${id}/toread`, jsonBody({ value: true })); flashId = id; await refresh(); toast('Added to your to-read pile'); return; }
  if (act === 'markread') { await api(`/api/bookmarks/${id}/toread`, jsonBody({ value: false })); await refresh(); toast('Nice — checked off as read', async () => { await api(`/api/bookmarks/${id}/toread`, jsonBody({ value: true })); refresh(); }); return; }
  if (act === 'archive') { await api(`/api/bookmarks/${id}/archive`, jsonBody({ value: true })); await refresh(); toast('Tucked away in your archive', async () => { await api(`/api/bookmarks/${id}/archive`, jsonBody({ value: false })); refresh(); }); return; }
  if (act === 'restore') { await api(`/api/bookmarks/${id}/archive`, jsonBody({ value: false })); await refresh(); toast('Back in your bookmarks', async () => { await api(`/api/bookmarks/${id}/archive`, jsonBody({ value: true })); refresh(); }); return; }
  if (act === 'refetch') {
    const url = card.querySelector('.e-url').value;
    toast('Fetching fresh info…');
    const r = await api(`/api/bookmarks/${id}/refetch`, jsonBody({ url }));
    if (!r.ok) { toast("Couldn't read that page — you can type the details yourself."); return; }
    card.querySelector('.e-title').value = r.item.title;
    card.querySelector('.e-desc').value = r.item.summary;
    toast('Pulled fresh info from the new link');
    return;
  }
  if (act === 'commit') {
    addDraftTag(card.querySelector('.e-tag').value);
    const payload = { title: card.querySelector('.e-title').value, url: card.querySelector('.e-url').value, summary: card.querySelector('.e-desc').value, labels: draftLabels };
    await api(`/api/bookmarks/${id}`, jsonBody(payload, 'PATCH'));
    editingId = null; justSavedId = null; flashId = id; await refresh(); toast('Updated');
    return;
  }
  if (act === 'delete') {
    await api(`/api/bookmarks/${id}`, { method: 'DELETE' });
    editingId = null; justSavedId = null; await refresh();
    toast('Deleted for good', async () => { await api(`/api/bookmarks/${id}/undelete`, { method: 'POST' }); flashId = id; refresh(); });
    return;
  }
});
function jsonBody(obj, method) { return { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) }; }

// ---------- import ----------
let pickedText = null, pickedName = '';
function openImport() { pickedText = null; pickedName = ''; stepPick(); $('importModal').classList.add('show'); }
$('importBtn').onclick = openImport;
$('fileInput').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  pickedText = await f.text(); pickedName = f.name;
  const fn = $('fname'); if (fn) { fn.style.display = 'block'; fn.textContent = 'Selected: ' + pickedName; }
  const s = $('impStart'); if (s) { s.disabled = false; s.style.opacity = '1'; }
});
function stepPick() {
  $('importIn').innerHTML = `<p>In your browser, export your bookmarks to a file, then choose that file here — the app reads them all in one go. (You can also load a file you exported from this app.)</p>
    <div class="filepick" id="filepick">📄 Click to choose your bookmarks file<div class="fname" id="fname" style="display:none"></div></div>
    <label class="foldopt"><input type="checkbox" id="foldChk" checked><span>Turn my browser folders into labels (rename or drop them later)</span></label>`;
  $('importActions').innerHTML = `<button id="impCancel">Cancel</button><button class="primary" id="impStart" disabled style="opacity:.5">Import</button>`;
  $('filepick').onclick = () => $('fileInput').click();
  $('impCancel').onclick = () => $('importModal').classList.remove('show');
  $('impStart').onclick = () => { if (pickedText != null) runImport($('foldChk').checked); };
}
async function runImport(foldersAsLabels) {
  $('importIn').innerHTML = `<p>Bringing your bookmarks in, keeping each one's original date, and saving a readable copy where the page is still alive…</p><div class="bar"><span id="barfill"></span></div><div class="prog" id="prog">Starting…</div>`;
  $('importActions').innerHTML = `<button id="impBg">Run in background</button>`;
  $('impBg').onclick = () => { $('importModal').classList.remove('show'); toast('Import running in the background…'); };
  let start;
  try { start = await api('/api/import?folders=' + (foldersAsLabels ? 'true' : 'false'), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: pickedText }); }
  catch { $('importIn').innerHTML = '<p>Sorry — that file could not be read.</p>'; return; }
  const poll = async () => {
    let job;
    try { job = await api('/api/import/' + start.jobId); } catch { return; }
    const pct = job.total ? Math.round(job.processed / job.total * 100) : 100;
    const bf = $('barfill'); if (bf) bf.style.width = pct + '%';
    const pr = $('prog'); if (pr) pr.textContent = `Importing ${job.processed} of ${job.total}…`;
    if (job.done) return finishImport(job.summary);
    setTimeout(poll, 250);
  };
  poll();
}
function finishImport(s) {
  $('importIn').innerHTML = `<div class="summary">✓ Moved in! <b>${s.added}</b> bookmarks brought across.<br>
    • Kept each one's <b>original saved date</b>, so your history is intact and newest-first means something.<br>
    ${s.kind !== 'own' ? '• Your folders became labels you can rename or drop.<br>' : ''}
    ${s.duplicates ? `• Skipped <b>${s.duplicates}</b> you already had — no duplicates piled up.<br>` : ''}
    ${s.needsTitle ? `<span class="warn">• <b>${s.needsTitle}</b> couldn't be read right now — saved and flagged “needs a title”, nothing lost.</span><br>` : ''}
    ${s.dead ? `<span class="warn">• <b>${s.dead}</b> were <b>already dead</b> before the move — brought in with their title and date, honestly flagged “original gone · no copy”. We can't copy a page that's already offline, and we won't pretend we did.</span><br>` : ''}
    • A readable copy was kept for every page that was still alive.</div>`;
  $('importActions').innerHTML = `<button class="primary" id="impDone">See my bookmarks</button>`;
  $('impDone').onclick = () => { $('importModal').classList.remove('show'); state.view = 'all'; state.label = null; state.query = ''; $('searchInput').value = ''; refresh(); toast('Welcome in — history and all.'); };
}

// ---------- export ----------
$('exportBtn').onclick = () => { window.location = '/api/export'; toast('Exported everything — links, labels, dates, and saved copies.'); };

// ---------- go ----------
refresh().catch(() => { $('list').innerHTML = '<div class="empty">Could not reach the app server.</div>'; });
