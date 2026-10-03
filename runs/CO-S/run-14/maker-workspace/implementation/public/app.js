'use strict';
/* Frontend for the bookmarks app. Talks to the JSON API; all search, filter,
   sort and pagination happen client-side for responsiveness. */

const S = {
  bookmarks: [], savedSearches: [], preferences: {},
  view: 'all', sortBy: 'newest', activeTag: null, search: '',
  page: 1, selected: new Set(), saving: false,
  edit: {}, // id -> {details:bool, note:bool, expanded:bool, tagediting:bool}
};

// ---------- API ----------
const api = {
  async state() { return (await fetch('/api/state')).json(); },
  async create(body) { const r = await fetch('/api/bookmarks', { method: 'POST', headers: h(), body: JSON.stringify(body) }); return { status: r.status, data: await r.json() }; },
  async patch(id, body) { const r = await fetch('/api/bookmarks/' + id, { method: 'PATCH', headers: h(), body: JSON.stringify(body) }); return { status: r.status, data: await r.json() }; },
  async del(id) { const r = await fetch('/api/bookmarks/' + id, { method: 'DELETE' }); return r.json(); },
  async restore(entries) { const r = await fetch('/api/bookmarks/restore', { method: 'POST', headers: h(), body: JSON.stringify({ entries }) }); return r.json(); },
  async bulk(ids, action, payload) { const r = await fetch('/api/bookmarks/bulk', { method: 'POST', headers: h(), body: JSON.stringify({ ids, action, payload }) }); return r.json(); },
  async snapshot(id) { const r = await fetch('/api/bookmarks/' + id + '/snapshot', { method: 'POST' }); return { status: r.status, data: await r.json() }; },
  async archiveOrg(id) { const r = await fetch('/api/bookmarks/' + id + '/archive-org', { method: 'POST' }); return { status: r.status, data: await r.json() }; },
  async import(body) { const r = await fetch('/api/import', { method: 'POST', headers: h(), body: JSON.stringify(body) }); return r.json(); },
  async addSaved(body) { const r = await fetch('/api/saved-searches', { method: 'POST', headers: h(), body: JSON.stringify(body) }); return r.json(); },
  async delSaved(id) { return (await fetch('/api/saved-searches/' + id, { method: 'DELETE' })).json(); },
  async prefs(body) { const r = await fetch('/api/preferences', { method: 'PUT', headers: h(), body: JSON.stringify(body) }); return r.json(); },
};
function h() { return { 'content-type': 'application/json' }; }

// ---------- helpers ----------
const $ = sel => document.querySelector(sel);
function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function allTags() { const s = new Set(); S.bookmarks.forEach(b => (b.tags || []).forEach(t => s.add(t))); return [...s].sort(); }
function normKey(url) { try { const u = new URL(/:\/\//.test(url) ? url : 'https://' + url); return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '') + u.search).toLowerCase(); } catch (e) { return (url || '').toLowerCase(); } }
function fmtWhen(ms) { const d = new Date(ms); const diff = (Date.now() - ms) / 1000; if (diff < 60) return 'just now'; if (diff < 3600) return Math.floor(diff / 60) + ' min ago'; if (diff < 86400) return Math.floor(diff / 3600) + ' h ago'; if (diff < 7 * 86400) return Math.floor(diff / 86400) + ' d ago'; return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
function editState(id) { return S.edit[id] || (S.edit[id] = {}); }

function hl(text, terms) {
  const escaped = esc(text || '');
  const t = (terms || []).filter(Boolean);
  if (!t.length) return escaped;
  // Single combined pass so highlighting never re-matches inside inserted <mark> tags.
  const pat = t.map(x => esc(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|');
  try { return escaped.replace(new RegExp('(' + pat + ')', 'ig'), '<mark>$1</mark>'); } catch (e) { return escaped; }
}

// ---------- toast / undo ----------
let toastTimer = null;
function toast(html, undoFn) {
  const t = $('#toast'); t.innerHTML = '';
  t.appendChild(el('span', null, html));
  if (undoFn) { const u = el('span', 'undo', 'Undo'); u.onclick = () => { hideToast(); undoFn(); }; t.appendChild(u); }
  t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 6000);
}
function hideToast() { $('#toast').hidden = true; }

// ---------- init ----------
async function init() {
  const st = await api.state();
  S.bookmarks = st.bookmarks; S.savedSearches = st.savedSearches; S.preferences = st.preferences;
  S.view = S.preferences.defaultView || 'all';
  S.sortBy = S.preferences.defaultSort || 'newest';
  $('#sort').value = S.sortBy;
  applyPrefs();
  mountSaveTagInput();
  wireEvents();
  render();
  document.body.setAttribute('data-harness-ready', 'true');
}

function wireEvents() {
  $('#saveBtn').onclick = doSave;
  $('#url').addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });
  $('#search').addEventListener('input', () => { S.search = $('#search').value; S.page = 1; render(); });
  $('#sort').addEventListener('change', () => { S.sortBy = $('#sort').value; render(); });
  $('#prefsBtn').onclick = openPrefs;
  $('#importBtn').onclick = openImport;
  $('#exportBtn').onclick = openExport;
  $('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeOverlay(); });
}

// ---------- prefs application ----------
function applyPrefs() {
  const p = S.preferences;
  const dark = p.theme === 'dark' || (p.theme === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('theme-dark', dark);
  document.body.classList.toggle('density-compact', p.density === 'compact');
  document.body.classList.toggle('text-small', p.textSize === 'small');
  document.body.classList.toggle('text-large', p.textSize === 'large');
  document.body.classList.toggle('no-preview', !p.showPreview);
}

// ---------- reusable tag entry with suggestions ----------
function mountTagEntry(container, tags, onChange, opts) {
  opts = opts || {};
  container.innerHTML = '';
  tags.forEach((t, i) => {
    const chip = el('span', 'chip' + (opts.clickable ? ' clickable' : ''));
    const label = el('span', null, esc(t));
    if (opts.onClickTag) label.onclick = () => opts.onClickTag(t);
    chip.appendChild(label);
    const x = el('span', 'x', '×'); x.title = 'Remove tag'; x.onclick = (e) => { e.stopPropagation(); tags.splice(i, 1); onChange(); };
    chip.appendChild(x);
    container.appendChild(chip);
  });
  const inp = el('input', 'tag-entry'); inp.placeholder = 'add tag…'; container.appendChild(inp);
  let sug = null, active = -1;
  const close = () => { if (sug) { sug.remove(); sug = null; active = -1; } };
  const add = (t) => { t = t.trim().replace(/,$/, ''); if (t && !tags.includes(t)) tags.push(t); onChange(); };
  const show = () => {
    close(); const q = inp.value.trim().toLowerCase(); if (!q) return;
    const matches = allTags().filter(t => t.toLowerCase().includes(q) && !tags.includes(t));
    sug = el('div', 'suggest');
    matches.slice(0, 6).forEach(mm => { const d = el('div', null, esc(mm)); d.onmousedown = e => { e.preventDefault(); add(mm); }; sug.appendChild(d); });
    if (!allTags().some(t => t.toLowerCase() === q)) { const d = el('div', 'new', 'Create “' + esc(inp.value.trim()) + '”'); d.onmousedown = e => { e.preventDefault(); add(inp.value); }; sug.appendChild(d); }
    if (sug.children.length) container.appendChild(sug); else close();
  };
  inp.addEventListener('input', show);
  inp.addEventListener('keydown', e => {
    const opts2 = sug ? [...sug.children] : [];
    if (e.key === 'ArrowDown' && opts2.length) { e.preventDefault(); active = (active + 1) % opts2.length; opts2.forEach((o, i) => o.classList.toggle('active', i === active)); }
    else if (e.key === 'ArrowUp' && opts2.length) { e.preventDefault(); active = (active - 1 + opts2.length) % opts2.length; opts2.forEach((o, i) => o.classList.toggle('active', i === active)); }
    else if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (active >= 0 && opts2[active]) opts2[active].dispatchEvent(new MouseEvent('mousedown')); else if (inp.value.trim()) add(inp.value); }
    else if (e.key === 'Escape') close();
  });
  inp.addEventListener('blur', () => setTimeout(close, 120));
  return inp;
}

// save-box tags (kept between renders)
let saveTags = [];
function mountSaveTagInput() { mountTagEntry($('#saveTags'), saveTags, mountSaveTagInput); }

// ---------- save flow (SCN-001/002/008/009/010) ----------
async function doSave() {
  const raw = $('#url').value.trim();
  const msg = $('#saveMsg');
  msg.hidden = true;
  if (!raw) { showSaveMsg('err', 'Enter a link to save.'); return; }
  const note = $('#saveNote').value;
  S.saving = true; $('#saveBtn').disabled = true; render();
  const { status, data } = await api.create({ url: raw, tags: saveTags.slice(), note });
  S.saving = false; $('#saveBtn').disabled = false;
  if (status === 400) { showSaveMsg('err', 'That doesn’t look like a link. Check for a typo — a link looks like <code>example.com/page</code>.'); render(); return; }
  if (status === 409) {
    showSaveMsg('warn', 'You’ve already saved this. <span class="link" id="gotoDup">Show the one you saved</span>.');
    render();
    const g = document.getElementById('gotoDup'); if (g) g.onclick = () => jumpToEdit(data.existingId);
    return;
  }
  // success
  S.bookmarks.unshift(data.bookmark);
  $('#url').value = ''; $('#saveNote').value = ''; saveTags = []; mountSaveTagInput();
  S.view = 'all'; S.page = 1;
  if (data.bookmark.detailsMissing) { editState(data.bookmark.id).details = true; }
  render();
  flash(data.bookmark.id);
}
function showSaveMsg(kind, html) { const m = $('#saveMsg'); m.className = 'save-msg ' + kind; m.innerHTML = html; m.hidden = false; }

function jumpToEdit(id) {
  S.view = 'all'; S.search = ''; $('#search').value = ''; S.activeTag = null; S.page = 1;
  editState(id).details = true;
  render();
  const card = document.querySelector('[data-id="' + id + '"]');
  if (card) { card.classList.add('flash'); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); const t = card.querySelector('.title-input'); if (t) t.focus(); setTimeout(() => card.classList.remove('flash'), 1500); }
}
function flash(id) { const card = document.querySelector('[data-id="' + id + '"]'); if (card) { card.classList.add('just-added'); setTimeout(() => card.classList.remove('just-added'), 1000); } }

// ---------- filtering / sorting / pagination ----------
function inView(b) { if (S.view === 'archived') return b.archived; if (S.view === 'toread') return b.readLater && !b.archived; return !b.archived; }
function counts() { return { all: S.bookmarks.filter(b => !b.archived).length, toread: S.bookmarks.filter(b => b.readLater && !b.archived).length, archived: S.bookmarks.filter(b => b.archived).length }; }
function sortList(a) {
  const s = a.slice();
  if (S.sortBy === 'newest') s.sort((x, y) => y.createdAt - x.createdAt);
  else if (S.sortBy === 'oldest') s.sort((x, y) => x.createdAt - y.createdAt);
  else if (S.sortBy === 'title') s.sort((x, y) => (x.title || x.url || '').toLowerCase().localeCompare((y.title || y.url || '').toLowerCase()));
  else if (S.sortBy === 'updated') s.sort((x, y) => y.updatedAt - x.updatedAt);
  return s;
}
function currentMatcher() { return BQuery.buildMatcher(S.search); }
function visible(matcher) {
  const mt = matcher || currentMatcher();
  return sortList(S.bookmarks.filter(b => inView(b) && (!S.activeTag || (b.tags || []).includes(S.activeTag)) && mt.test(b)));
}

// ---------- render ----------
function render() {
  renderViews();
  renderSavedStrip();
  renderTagFilter();
  renderSaveSearchRow();
  renderBulkBar();
  const matcher = currentMatcher();
  renderSyntax(matcher);
  renderList(matcher);
}

function renderViews() {
  const c = counts(); const bar = $('#views'); bar.innerHTML = '';
  [['all', 'All', c.all], ['toread', 'To read', c.toread], ['archived', 'Archived', c.archived]].forEach(([k, label, n]) => {
    const b = el('button', S.view === k ? 'on' : '', label + ' <span class="count">' + n + '</span>');
    b.onclick = () => { S.view = k; S.page = 1; render(); };
    bar.appendChild(b);
  });
}

function renderTagFilter() {
  const box = $('#tagFilter'); box.innerHTML = '<span class="lbl">Filter by tag:</span>';
  const tags = allTags();
  if (!tags.length) { box.appendChild(el('span', 'lbl', 'no tags yet')); return; }
  tags.forEach(t => { const c = el('span', 'fchip' + (S.activeTag === t ? ' on' : ''), esc(t)); c.onclick = () => { S.activeTag = S.activeTag === t ? null : t; S.page = 1; render(); }; box.appendChild(c); });
}

function renderSyntax(matcher) {
  const s = $('#syntax'), inp = $('#search');
  const bad = !matcher.ok && S.search.trim() !== '';
  inp.classList.toggle('bad', bad);
  if (bad) { s.className = 'syntax bad'; s.textContent = 'Couldn’t read that query (' + matcher.error + ') — showing plain-text matches instead.'; }
  else { s.className = 'syntax'; s.innerHTML = 'Matches title, description, note, tags and the link. Use <code>"…"</code> for exact phrases, <code>#tag</code> for a tag, and <code>AND</code> / <code>OR</code> / <code>NOT</code> with <code>( )</code>.'; }
}

// ----- saved searches (SCN-018) -----
function currentCriteria() { return { query: S.search.trim(), tag: S.activeTag, view: S.view }; }
function sameCriteria(a, b) { return (a.query || '') === (b.query || '') && (a.tag || null) === (b.tag || null) && (a.view || 'all') === (b.view || 'all'); }
function hasCriteria() { const c = currentCriteria(); return !!(c.query || c.tag || c.view !== 'all'); }
function renderSavedStrip() {
  const strip = $('#savedStrip'); strip.innerHTML = '';
  if (!S.savedSearches.length) { strip.appendChild(el('span', 'lbl', 'No saved searches yet — build a search below and save it.')); return; }
  strip.appendChild(el('span', 'lbl', 'Saved searches:'));
  const cur = currentCriteria();
  S.savedSearches.forEach(ss => {
    const chip = el('span', 'saved-chip' + (sameCriteria(cur, ss) ? ' active' : ''));
    chip.appendChild(el('span', 'star', '★'));
    chip.appendChild(document.createTextNode(' ' + ss.name + ' '));
    const x = el('span', 'x', '×'); x.title = 'Remove'; x.onclick = async (e) => { e.stopPropagation(); await api.delSaved(ss.id); S.savedSearches = S.savedSearches.filter(s => s.id !== ss.id); render(); };
    chip.appendChild(x);
    chip.onclick = (e) => { if (e.target === x) return; applySaved(ss); };
    strip.appendChild(chip);
  });
}
function applySaved(ss) { S.search = ss.query || ''; $('#search').value = S.search; S.activeTag = ss.tag || null; S.view = ss.view || 'all'; S.page = 1; render(); }
function renderSaveSearchRow() {
  const row = $('#saveSearchRow'); const cur = currentCriteria();
  const matches = S.savedSearches.some(s => sameCriteria(cur, s));
  if (row._editing) {
    row.innerHTML = '';
    const inp = el('input'); inp.placeholder = 'Name this search…'; inp.value = suggestName(cur);
    const ok = el('button', 'primary-btn sm', 'Save'); const cancel = el('button', 'ghost-btn', 'Cancel');
    ok.onclick = async () => { const name = inp.value.trim() || suggestName(cur); const rec = await api.addSaved(Object.assign({ name }, cur)); S.savedSearches.push(rec.savedSearch); row._editing = false; render(); };
    cancel.onclick = () => { row._editing = false; render(); };
    inp.onkeydown = e => { if (e.key === 'Enter') ok.click(); if (e.key === 'Escape') cancel.click(); };
    row.appendChild(inp); row.appendChild(ok); row.appendChild(cancel); setTimeout(() => { inp.focus(); inp.select(); }, 0);
  } else {
    row.innerHTML = '';
    const btn = el('button', 'ghost-btn', '★ Save this search'); const desc = el('span', 'desc');
    if (!hasCriteria()) { btn.disabled = true; desc.textContent = 'Type a search or pick a filter/view to save it.'; }
    else if (matches) { btn.disabled = true; desc.textContent = 'This search is already saved.'; }
    else { desc.textContent = 'Saves the current text, tag filter and view together.'; btn.onclick = () => { row._editing = true; render(); }; }
    row.appendChild(btn); row.appendChild(desc);
  }
}
function suggestName(c) { const parts = []; if (c.view !== 'all') parts.push(c.view === 'toread' ? 'To read' : 'Archived'); if (c.tag) parts.push('#' + c.tag); if (c.query) parts.push(c.query); return parts.join(' · ') || 'My search'; }

// ----- list + cards -----
function renderList(matcher) {
  const listEl = $('#list'), pager = $('#pager'), pc = $('#pageCount');
  listEl.innerHTML = ''; pager.innerHTML = ''; pc.textContent = '';
  const terms = matcher.terms;

  if (S.saving) listEl.appendChild(savingCard());

  const vis = visible(matcher);
  if (vis.length === 0 && !S.saving) {
    let big = 'No matches', small = 'Try different words, or clear the filters.';
    if (!S.search.trim() && !S.activeTag) {
      if (S.view === 'toread') { big = 'Nothing to read yet'; small = 'Mark a saved link “Read later”.'; }
      else if (S.view === 'archived') { big = 'No archived links'; small = 'Archive a link to tuck it away without deleting it.'; }
      else { big = 'No bookmarks yet'; small = 'Paste a link above to save your first one.'; }
    }
    listEl.appendChild(el('div', 'empty', '<div class="big">' + big + '</div><div>' + small + '</div>'));
    return;
  }
  // pagination (SCN-024)
  const size = S.preferences.pageSize === 'all' ? Infinity : (S.preferences.pageSize || 25);
  const pages = Math.max(1, Math.ceil(vis.length / size));
  if (S.page > pages) S.page = pages; if (S.page < 1) S.page = 1;
  const start = (S.page - 1) * size;
  const pageItems = size === Infinity ? vis : vis.slice(start, start + size);
  pc.textContent = size === Infinity ? ('Showing all ' + vis.length) : ('Showing ' + (start + 1) + '–' + Math.min(start + size, vis.length) + ' of ' + vis.length);

  pageItems.forEach(b => listEl.appendChild(card(b, terms)));

  if (pages > 1) {
    const prev = el('button', null, '‹ Prev'); prev.disabled = S.page <= 1; prev.onclick = () => { S.page--; render(); };
    const info = el('span', null, 'Page ' + S.page + ' of ' + pages);
    const next = el('button', null, 'Next ›'); next.disabled = S.page >= pages; next.onclick = () => { S.page++; render(); };
    pager.appendChild(prev); pager.appendChild(info); pager.appendChild(next);
  }
}

function savingCard() { const c = el('div', 'card'); c.innerHTML = '<div class="thumb none"></div><div class="body"><div class="working">Getting details…</div></div>'; return c; }

function iconImg(b) {
  const img = el('img', 'favi'); img.alt = ''; if (b.icon) { img.src = b.icon; img.onerror = () => { img.style.visibility = 'hidden'; }; } else img.style.visibility = 'hidden';
  return img;
}

function card(b, terms) {
  const es = editState(b.id);
  const c = el('div', 'card'); c.dataset.id = b.id;
  if (S.selected.has(b.id)) c.classList.add('selected');

  // selection checkbox
  const sel = el('label', 'selbox'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = S.selected.has(b.id);
  cb.onchange = () => { if (cb.checked) S.selected.add(b.id); else S.selected.delete(b.id); render(); };
  sel.appendChild(cb); c.appendChild(sel);

  // thumb
  const thumb = el('div', 'thumb' + (b.preview ? '' : ' none'));
  if (b.preview) { const im = el('img'); im.alt = ''; im.src = b.preview; im.onerror = () => { thumb.classList.add('none'); }; thumb.appendChild(im); }
  c.appendChild(thumb);

  const body = el('div', 'body'); c.appendChild(body);

  // details (title/desc) — view or edit
  if (es.details) {
    const wrap = el('div');
    const tr = el('div', 'title-row'); tr.appendChild(iconImg(b));
    const ti = el('input', 'title-input'); ti.placeholder = 'Add a title'; ti.value = b.title || ''; tr.appendChild(ti);
    wrap.appendChild(tr);
    const di = el('textarea', 'note-input desc-input'); di.rows = 3; di.placeholder = 'Add a description'; di.value = b.description || ''; wrap.appendChild(di);
    const ui = el('input', 'url-edit'); ui.placeholder = 'Link (URL)'; ui.value = b.url || ''; wrap.appendChild(ui);
    const rl = el('label', 'refresh-row'); const rc = el('input'); rc.type = 'checkbox'; rl.appendChild(rc); rl.appendChild(document.createTextNode(' Update title, description & preview from this link')); wrap.appendChild(rl);
    const done = el('button', 'primary-btn sm', 'Done'); done.style.marginTop = '8px';
    done.onclick = async () => {
      const patch = { title: ti.value.trim(), description: di.value.trim(), url: ui.value.trim(), refresh: rc.checked };
      const r = await api.patch(b.id, patch);
      Object.assign(b, r.data.bookmark); es.details = false; render();
    };
    wrap.appendChild(done);
    body.appendChild(wrap);
  } else {
    const wrap = el('div');
    const tr = el('div', 'title-row'); tr.appendChild(iconImg(b));
    const a = el('a', 'title' + (es.expanded ? '' : ' clamp')); a.href = b.url; a.target = '_blank'; a.rel = 'noopener'; a.innerHTML = hl(b.title || b.url, terms); tr.appendChild(a);
    const ed = el('span', 'edit-inline', '✎ edit'); ed.onclick = () => { es.details = true; render(); }; tr.appendChild(ed);
    wrap.appendChild(tr);
    const descHtml = b.description ? hl(b.description, terms) : (b.detailsMissing ? '<span class="no-desc">No description could be read for this page.</span>' : '');
    const d = el('div', 'desc' + (es.expanded ? '' : ' clamp'), descHtml); wrap.appendChild(d);
    const more = el('span', 'more', es.expanded ? 'Show less' : 'Show more'); more.style.display = 'none'; more.onclick = () => { es.expanded = !es.expanded; render(); };
    wrap.appendChild(more);
    body.appendChild(wrap);
    setTimeout(() => { if ((a.scrollHeight > a.clientHeight + 1) || (d.scrollHeight > d.clientHeight + 1) || es.expanded) more.style.display = 'inline-block'; }, 0);
  }

  // note (markdown) SCN-025
  body.appendChild(noteBlock(b, es));

  // tags (editable + clickable to filter) SCN-002/003/006
  const tags = el('div', 'tags');
  (b.tags || []).forEach((t, i) => {
    const chip = el('span', 'chip clickable');
    const label = el('span', null, hl(t, terms)); label.title = 'Filter by “' + t + '”'; label.onclick = () => { S.activeTag = S.activeTag === t ? null : t; S.page = 1; render(); };
    chip.appendChild(label);
    const x = el('span', 'x', '×'); x.onclick = async (e) => { e.stopPropagation(); const nt = b.tags.slice(); nt.splice(i, 1); const r = await api.patch(b.id, { tags: nt }); Object.assign(b, r.data.bookmark); render(); };
    chip.appendChild(x); tags.appendChild(chip);
  });
  const addTagBtn = el('button', 'add-tag-btn', '＋ Tag'); addTagBtn.onclick = () => { es.tagediting = true; render(); };
  if (es.tagediting) {
    const tmp = b.tags.slice();
    mountTagEntry(tags, tmp, async () => { const r = await api.patch(b.id, { tags: tmp }); Object.assign(b, r.data.bookmark); es.tagediting = true; render(); });
  } else { tags.appendChild(addTagBtn); }
  body.appendChild(tags);

  // sub line + badges
  const sub = el('div', 'sub');
  sub.appendChild(el('span', 'site', esc(b.site || '')));
  sub.appendChild(document.createTextNode(' · saved ' + fmtWhen(b.createdAt)));
  if (b.snapshot) sub.appendChild(el('span', 'badge copy', '📄 Copy saved'));
  if (b.archiveOrg) { const a = el('a', 'badge arch', '🌐 On Internet Archive'); a.href = b.archiveOrg.url; a.target = '_blank'; a.rel = 'noopener'; sub.appendChild(a); }
  body.appendChild(sub);

  body.appendChild(actionsRow(b, es));
  return c;
}

function noteBlock(b, es) {
  const wrap = el('div');
  if (es.note) {
    const ta = el('textarea', 'note-input'); ta.rows = 4; ta.placeholder = 'Why did you save this? (Markdown supported)'; ta.value = b.note || '';
    const hint = el('div', 'hint', 'Markdown supported — shows formatted after you save.');
    const save = el('button', 'primary-btn sm', 'Save note'); save.style.marginTop = '6px';
    save.onclick = async () => { const r = await api.patch(b.id, { note: ta.value }); Object.assign(b, r.data.bookmark); es.note = false; render(); };
    wrap.style.marginTop = '8px'; wrap.appendChild(ta); wrap.appendChild(hint); wrap.appendChild(save);
  } else if (b.note) {
    const box = el('div', 'note');
    const hd = el('div', 'hd'); hd.appendChild(document.createTextNode('📝 Note')); const edit = el('span', 'edit-note', 'edit'); edit.onclick = () => { es.note = true; render(); }; hd.appendChild(edit); box.appendChild(hd);
    box.appendChild(el('div', null, BMarkdown.render(b.note)));
    wrap.appendChild(box);
  } else {
    const add = el('button', 'add-note-btn', '＋ Note'); add.style.marginTop = '8px'; add.onclick = () => { es.note = true; render(); };
    wrap.appendChild(add);
  }
  return wrap;
}

function actionsRow(b, es) {
  const row = el('div', 'actions');
  if (!b.archived) {
    const rl = el('button', 'act' + (b.readLater ? ' on' : ''), b.readLater ? '🔖 To read' : '🔖 Read later');
    rl.onclick = async () => { const r = await api.patch(b.id, { readLater: !b.readLater }); Object.assign(b, r.data.bookmark); render(); };
    const ar = el('button', 'act', '🗄 Archive'); ar.onclick = async () => { const r = await api.patch(b.id, { archived: true }); Object.assign(b, r.data.bookmark); render(); };
    row.appendChild(rl); row.appendChild(ar);
  } else {
    const un = el('button', 'act', '↩ Restore to list'); un.onclick = async () => { const r = await api.patch(b.id, { archived: false }); Object.assign(b, r.data.bookmark); render(); };
    row.appendChild(un);
  }
  // snapshot (SCN-019)
  if (es.capturing) { row.appendChild(el('span', 'working', '📄 Saving a copy…')); }
  else if (b.snapshot) {
    const v = el('button', 'act', '📄 View copy'); v.onclick = () => openSnapshot(b); row.appendChild(v);
    const u = el('button', 'act', '↻ Update copy'); u.onclick = () => captureCopy(b); row.appendChild(u);
  } else { const sc = el('button', 'act', '📄 Save a copy'); sc.onclick = () => captureCopy(b); row.appendChild(sc); }
  // internet archive (SCN-020)
  if (es.archiving) { row.appendChild(el('span', 'working', '🌐 Sending to the Internet Archive…')); }
  else if (b.archiveOrg) { const a = el('a', 'act'); a.href = b.archiveOrg.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '🌐 View on Internet Archive'; row.appendChild(a); }
  else { const a = el('button', 'act', '🌐 Save to Internet Archive'); a.onclick = () => doArchiveOrg(b); row.appendChild(a); }
  // delete
  const del = el('button', 'act danger', '🗑 Delete'); del.onclick = () => doDelete(b); row.appendChild(del);
  return row;
}

// ---------- snapshot / archive actions ----------
async function captureCopy(b) {
  const es = editState(b.id); es.capturing = true; render();
  const { status, data } = await api.snapshot(b.id);
  es.capturing = false;
  if (status === 200) { Object.assign(b, data.bookmark); render(); toast('Saved a copy of “' + esc((b.title || b.url).slice(0, 32)) + '”'); }
  else { render(); toast('Couldn’t save a copy (' + esc(data.reason || 'failed') + '). You can try again.'); }
}
async function doArchiveOrg(b) {
  const es = editState(b.id); es.archiving = true; render();
  const { status, data } = await api.archiveOrg(b.id);
  es.archiving = false;
  if (status === 200) { Object.assign(b, data.bookmark); render(); toast('Preserved on the Internet Archive'); }
  else { render(); toast('Couldn’t reach the Internet Archive (' + esc(data.reason || 'failed') + '). You can try again.'); }
}
function openSnapshot(b) {
  const inner = $('#overlayInner'); inner.innerHTML = '';
  const snap = el('div', 'snap');
  const kind = b.snapshot.kind === 'pdf' ? 'Preserved PDF' : 'Full-page copy';
  const bar = el('div', 'bar');
  bar.appendChild(el('span', 'badge2', '📄 ' + kind));
  bar.appendChild(el('span', 'meta', 'Saved ' + fmtWhen(b.snapshot.savedAt) + ' · self-contained, read-only'));
  const close = el('button', 'close', '×'); close.onclick = closeOverlay; bar.appendChild(close);
  snap.appendChild(bar);
  const frame = el('iframe'); frame.src = '/api/bookmarks/' + b.id + '/snapshot'; frame.setAttribute('sandbox', ''); snap.appendChild(frame);
  inner.appendChild(snap); $('#overlay').hidden = false;
}
function closeOverlay() { $('#overlay').hidden = true; $('#overlayInner').innerHTML = ''; }

// ---------- delete + undo (SCN-013) ----------
async function doDelete(b) {
  const r = await api.del(b.id);
  if (r.status !== 'ok') return;
  S.bookmarks = S.bookmarks.filter(x => x.id !== b.id);
  render();
  toast('Deleted “' + esc((b.title || b.url).slice(0, 40)) + '”', async () => {
    await api.restore([{ bookmark: r.removed, index: r.index }]);
    const st = await api.state(); S.bookmarks = st.bookmarks; render();
  });
}

// ---------- bulk bar (SCN-016/017) ----------
function selItems() { return S.bookmarks.filter(b => S.selected.has(b.id)); }
function renderBulkBar() {
  const bar = $('#bulkBar');
  // prune stale selections
  [...S.selected].forEach(id => { if (!S.bookmarks.some(b => b.id === id)) S.selected.delete(id); });
  if (S.selected.size === 0) { bar.hidden = true; bar.innerHTML = ''; return; }
  bar.hidden = false; bar.innerHTML = '';
  const visIds = visible().map(b => b.id);
  const allInView = visIds.length > 0 && visIds.every(id => S.selected.has(id));
  bar.appendChild(el('span', 'cnt', S.selected.size + ' selected'));
  const selAll = el('span', 'link', allInView ? 'Clear this view' : 'Select all in view (' + visIds.length + ')');
  selAll.onclick = () => { if (allInView) visIds.forEach(id => S.selected.delete(id)); else visIds.forEach(id => S.selected.add(id)); render(); };
  bar.appendChild(selAll);
  bar.appendChild(el('span', 'spacer'));

  // add-tag
  bar.appendChild(bulkTagInput('add tag to all…', async (t) => { await api.bulk([...S.selected], 'add-tag', { tag: t }); await refreshBulk(); }, () => allTags()));
  // remove-tag (suggest only tags on selected)
  bar.appendChild(bulkTagInput('remove tag from all…', async (t) => { await api.bulk([...S.selected], 'remove-tag', { tag: t }); await refreshBulk(); }, () => { const s = new Set(); selItems().forEach(b => (b.tags || []).forEach(t => s.add(t))); return [...s].sort(); }));

  const mkBtn = (label, cls, fn) => { const b = el('button', cls, label); b.onclick = fn; return b; };
  bar.appendChild(mkBtn('🔖 Read later', '', async () => { await api.bulk([...S.selected], 'read-later'); await refreshBulk(); }));
  bar.appendChild(mkBtn('Mark read', '', async () => { await api.bulk([...S.selected], 'mark-read'); await refreshBulk(); }));
  bar.appendChild(mkBtn('🗄 Archive', '', async () => { await api.bulk([...S.selected], 'archive'); await refreshBulk(); }));
  bar.appendChild(mkBtn('🗑 Delete', 'danger', bulkDelete));
  const clear = el('span', 'link', 'Clear'); clear.onclick = () => { S.selected.clear(); render(); }; bar.appendChild(clear);
}
async function refreshBulk() { const st = await api.state(); S.bookmarks = st.bookmarks; render(); }
function bulkTagInput(placeholder, onPick, listFn) {
  const wrap = el('span', 'bulk-tag'); const inp = el('input'); inp.placeholder = placeholder; wrap.appendChild(inp);
  let sug = null; const close = () => { if (sug) { sug.remove(); sug = null; } };
  inp.oninput = () => { close(); const q = inp.value.trim().toLowerCase(); const ms = listFn().filter(t => t.toLowerCase().includes(q)); if (!ms.length) return; sug = el('div', 'suggest'); ms.slice(0, 6).forEach(m => { const d = el('div', null, esc(m)); d.onmousedown = e => { e.preventDefault(); onPick(m); }; sug.appendChild(d); }); wrap.appendChild(sug); };
  inp.onkeydown = e => { if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); onPick(inp.value.trim()); } };
  inp.onblur = () => setTimeout(close, 120);
  return wrap;
}
async function bulkDelete() {
  const ids = [...S.selected];
  const r = await api.bulk(ids, 'delete');
  S.bookmarks = S.bookmarks.filter(b => !S.selected.has(b.id)); S.selected.clear();
  render();
  const removed = r.removed || [];
  toast('Deleted ' + removed.length + ' bookmark' + (removed.length === 1 ? '' : 's'), async () => {
    await api.restore(removed);
    const st = await api.state(); S.bookmarks = st.bookmarks; render();
  });
}

// ---------- preferences (SCN-023/024) ----------
function seg(name, val, options) { return '<div class="seg">' + options.map(([v, l]) => '<button data-' + name + '="' + v + '" class="' + (val === v ? 'on' : '') + '">' + l + '</button>').join('') + '</div>'; }
function openPrefs() {
  const p = S.preferences; const inner = $('#overlayInner');
  inner.innerHTML =
    '<div class="modal"><div class="head"><h2>Preferences</h2><button class="close">×</button></div><div class="bd">' +
      '<div class="pref-grp"><div class="lbl2">Appearance</div>' + seg('theme', p.theme, [['light', 'Light'], ['dark', 'Dark'], ['system', 'Match system']]) + '</div>' +
      '<div class="pref-grp"><div class="lbl2">List density</div>' + seg('density', p.density, [['comfortable', 'Comfortable'], ['compact', 'Compact']]) + '</div>' +
      '<div class="pref-grp"><div class="lbl2">Text size</div>' + seg('textsize', p.textSize, [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]) + '</div>' +
      '<div class="pref-grp"><div class="pref-row"><span>Show preview images</span>' + seg('showpv', p.showPreview ? 'on' : 'off', [['on', 'On'], ['off', 'Off']]) + '</div></div>' +
      '<div class="pref-grp"><div class="pref-row"><span>Bookmarks shown per page</span><select id="pv-page"><option value="5">5</option><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="all">All</option></select></div>' +
        '<div class="pref-row"><span>Open to</span><select id="pv-view"><option value="all">All</option><option value="toread">To read</option></select></div>' +
        '<div class="pref-row"><span>Default sort</span><select id="pv-sort"><option value="newest">Newest saved</option><option value="oldest">Oldest saved</option><option value="title">Title A–Z</option><option value="updated">Recently updated</option></select></div></div>' +
      '<div class="pref-grp"><div class="pref-row"><span>Automatically save a full-page copy of new bookmarks</span>' + seg('autocopy', p.autoCopy ? 'on' : 'off', [['on', 'On'], ['off', 'Off']]) + '</div></div>' +
    '</div></div>';
  $('#overlay').hidden = false;
  inner.querySelector('.close').onclick = closeOverlay;
  async function set(patch) { const r = await api.prefs(patch); S.preferences = r.preferences; applyPrefs(); render(); openPrefs(); }
  inner.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => set({ theme: b.dataset.theme }));
  inner.querySelectorAll('[data-density]').forEach(b => b.onclick = () => set({ density: b.dataset.density }));
  inner.querySelectorAll('[data-textsize]').forEach(b => b.onclick = () => set({ textSize: b.dataset.textsize }));
  inner.querySelectorAll('[data-showpv]').forEach(b => b.onclick = () => set({ showPreview: b.dataset.showpv === 'on' }));
  inner.querySelectorAll('[data-autocopy]').forEach(b => b.onclick = () => set({ autoCopy: b.dataset.autocopy === 'on' }));
  const pvp = inner.querySelector('#pv-page'); pvp.value = String(p.pageSize); pvp.onchange = async () => { const v = pvp.value === 'all' ? 'all' : parseInt(pvp.value, 10); S.page = 1; const r = await api.prefs({ pageSize: v }); S.preferences = r.preferences; render(); };
  const pvv = inner.querySelector('#pv-view'); pvv.value = p.defaultView; pvv.onchange = async () => { const r = await api.prefs({ defaultView: pvv.value }); S.preferences = r.preferences; S.view = pvv.value; S.page = 1; render(); };
  const pvs = inner.querySelector('#pv-sort'); pvs.value = p.defaultSort; pvs.onchange = async () => { const r = await api.prefs({ defaultSort: pvs.value }); S.preferences = r.preferences; S.sortBy = pvs.value; $('#sort').value = pvs.value; render(); };
}

// ---------- import / export (SCN-021/022) ----------
let importParsed = null;
function openImport() {
  const inner = $('#overlayInner');
  inner.innerHTML = '<div class="modal"><div class="head"><h2>Import bookmarks</h2><button class="close">×</button></div>' +
    '<div class="bd"><p>Export your bookmarks from your browser (Chrome, Firefox, Safari or Edge) as an HTML file, then choose it here.</p>' +
    '<div class="filepick">Choose your browser’s bookmarks file (.html)<br><input type="file" id="impFile" accept=".html,.htm" style="margin-top:10px"></div></div></div>';
  $('#overlay').hidden = false;
  inner.querySelector('.close').onclick = closeOverlay;
  inner.querySelector('#impFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { importParsed = BPorter.parseNetscape(r.result); importPreview(); }; r.readAsText(f); };
}
function importPreview() {
  const inner = $('#overlayInner');
  if (!importParsed || !importParsed.length) {
    inner.innerHTML = '<div class="modal"><div class="head"><h2>Import preview</h2><button class="close">×</button></div><div class="bd"><p>No bookmarks were found in that file. Make sure you chose your browser’s exported bookmarks file (an <b>.html</b> file).</p></div><div class="ft"><button class="ghost-btn" id="back">Choose another file</button></div></div>';
    inner.querySelector('.close').onclick = closeOverlay; inner.querySelector('#back').onclick = openImport; return;
  }
  const folders = [...new Set(importParsed.map(p => p.folder))];
  const dup = importParsed.filter(p => S.bookmarks.some(b => normKey(b.url) === normKey(p.url))).length;
  inner.innerHTML = '<div class="modal"><div class="head"><h2>Import preview</h2><button class="close">×</button></div><div class="bd">' +
    '<p>Found <span class="big-n">' + importParsed.length + '</span> bookmarks across <span class="big-n">' + folders.length + '</span> folders.</p>' +
    '<label class="opt"><input type="checkbox" id="foldertags" checked> Add each folder name as a tag</label>' +
    '<div class="folders" id="foldermap"></div>' +
    '<label class="opt"><input type="checkbox" id="skipdupes" checked> Skip links I’ve already saved (' + dup + ' found)</label>' +
    '</div><div class="ft"><button class="ghost-btn" id="back">Back</button><button class="primary-btn" id="doImport"></button></div></div>';
  inner.querySelector('.close').onclick = closeOverlay; inner.querySelector('#back').onclick = openImport;
  const refresh = () => {
    const ft = inner.querySelector('#foldertags').checked; const fm = inner.querySelector('#foldermap'); fm.innerHTML = '';
    folders.forEach(f => fm.appendChild(el('div', 'fr', '<span>📁 ' + esc(f) + '</span><span class="tag">' + (ft ? '#' + esc(f.toLowerCase().replace(/\s+/g, '-')) : '—') + '</span>')));
    const skip = inner.querySelector('#skipdupes').checked; const will = skip ? importParsed.length - dup : importParsed.length;
    const btn = inner.querySelector('#doImport');
    if (will === 0) { btn.disabled = true; btn.textContent = (skip && dup === importParsed.length) ? 'All ' + importParsed.length + ' already saved' : 'Nothing to import'; }
    else { btn.disabled = false; btn.textContent = 'Import ' + will + ' bookmark' + (will === 1 ? '' : 's'); }
  };
  inner.querySelector('#foldertags').onchange = refresh; inner.querySelector('#skipdupes').onchange = refresh; refresh();
  inner.querySelector('#doImport').onclick = async () => {
    const ft = inner.querySelector('#foldertags').checked, skip = inner.querySelector('#skipdupes').checked;
    const r = await api.import({ items: importParsed, addFolderTags: ft, skipDupes: skip });
    const st = await api.state(); S.bookmarks = st.bookmarks; closeOverlay(); render(); toast('Imported ' + r.imported + ' bookmark' + (r.imported === 1 ? '' : 's') + (r.skipped ? ' (' + r.skipped + ' skipped)' : ''));
  };
}
function openExport() {
  const inner = $('#overlayInner');
  inner.innerHTML = '<div class="modal"><div class="head"><h2>Export</h2><button class="close">×</button></div><div class="bd">' +
    '<p>Export your <span class="big-n">' + S.bookmarks.length + '</span> bookmarks.</p>' +
    '<label class="radio"><input type="radio" name="fmt" value="html" checked> Browser bookmarks file (.html) — re-importable into any browser</label>' +
    '<label class="radio"><input type="radio" name="fmt" value="backup"> Full backup (.json) — includes tags, notes, read-later & archive state</label>' +
    '</div><div class="ft"><button class="primary-btn" id="download">Download</button></div></div>';
  $('#overlay').hidden = false;
  inner.querySelector('.close').onclick = closeOverlay;
  inner.querySelector('#download').onclick = () => {
    const fmt = inner.querySelector('input[name="fmt"]:checked').value;
    let blob, name;
    if (fmt === 'html') { blob = new Blob([BPorter.buildBookmarksHtml(S.bookmarks)], { type: 'text/html' }); name = 'bookmarks.html'; }
    else { blob = new Blob([BPorter.buildBackupJson(S.bookmarks, { savedSearches: S.savedSearches, preferences: S.preferences })], { type: 'application/json' }); name = 'bookmarks-backup.json'; }
    const a = el('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    closeOverlay(); toast('Exported ' + S.bookmarks.length + ' bookmarks as ' + name);
  };
}

init();
