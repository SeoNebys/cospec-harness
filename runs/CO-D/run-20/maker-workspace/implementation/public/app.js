// My Bookmarks — client. Talks to the REST API; all list logic (search, sort,
// paging, selection) runs here over the loaded collection using the shared
// domain modules, so counts and selection always cover the full result set.

import { isValidUrl, dedupKey, normalizeUrl, isPdf } from '/src/urls.js';
import { normalizeTag } from '/src/tags.js';
import { compile, searchableText } from '/src/search.js';
import { comparator, SORT_MODES } from '/src/sort.js';
import { renderMarkdown, escapeHtml } from '/src/markdown.js';

const $ = (id) => document.getElementById(id);

const state = {
  bookmarks: [], savedSearches: [], prefs: { defaultSort: 'added-desc', pageSize: 25, textSize: 'md' },
  query: '', sortMode: 'added-desc', statusFilter: 'all', pageChunks: 1,
  selected: new Set(), settingsOpen: false, savingSearch: false,
  bulkTagMode: null, bulkConfirmDelete: false,
};
const ui = new Map(); // per-bookmark transient UI: {editing, confirmDelete, descOpen, noteOpen}
function u(id) { if (!ui.has(id)) ui.set(id, {}); return ui.get(id); }

// ---- API --------------------------------------------------------------------
async function api(method, url, body, asText) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    if (asText) { opts.headers['Content-Type'] = 'text/html'; opts.body = body; }
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(url, opts);
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : await res.text();
  return { ok: res.ok, status: res.status, data };
}

async function loadState() {
  const { data } = await api('GET', '/api/state');
  state.bookmarks = data.bookmarks || [];
  state.savedSearches = data.savedSearches || [];
  state.prefs = data.prefs || state.prefs;
  if (!SORT_MODES.some((m) => m[0] === state.sortMode)) state.sortMode = state.prefs.defaultSort;
}
async function refresh() { await loadState(); render(); }

// ---- helpers ----------------------------------------------------------------
function pageSizeNumber() { return state.prefs.pageSize === 'all' ? Infinity : (parseInt(state.prefs.pageSize, 10) || 25); }
function applyTextSize() { document.querySelector('main').className = 'text-' + (state.prefs.textSize || 'md'); }
function allTags() {
  const set = new Set();
  state.bookmarks.forEach((b) => (b.tags || []).forEach((t) => set.add(t)));
  return Array.from(set).sort();
}
function highlighter(query) {
  const { literals } = compile(query);
  const parts = literals.filter(Boolean).map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!parts.length) return (text) => escapeHtml(text);
  const rx = new RegExp('(' + parts.join('|') + ')', 'ig');
  return (text) => escapeHtml(text).replace(rx, '<mark>$1</mark>');
}
function highlightWithin(el, query) {
  const { literals } = compile(query);
  const parts = literals.filter(Boolean).map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!parts.length) return;
  const rx = new RegExp('(' + parts.join('|') + ')', 'ig');
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((n) => {
    if (n.parentNode.nodeName === 'MARK') return;
    rx.lastIndex = 0;
    if (!rx.test(n.nodeValue)) return;
    const span = document.createElement('span');
    span.innerHTML = escapeHtml(n.nodeValue).replace(rx, '<mark>$1</mark>');
    n.parentNode.replaceChild(span, n);
  });
}
function notice(text, warn = true) {
  const n = $('notice');
  n.innerHTML = text ? `<div class="notice" style="${warn ? '' : 'color:var(--muted)'}">${escapeHtml(text)}</div>` : '';
}
function ioMessage(text) { const m = $('ioMsg'); m.hidden = false; m.innerHTML = `<div class="inner"></div>`; m.querySelector('.inner').textContent = text; }

function thumbStyle(el, item) {
  if (item.image) { el.style.backgroundImage = `url("${item.image}")`; el.textContent = ''; }
  else { el.style.background = `linear-gradient(135deg,${item.color || '#2f6fed'},#0d1b3a)`; el.textContent = item.host || ''; }
}

// ---- field + tag editor -----------------------------------------------------
function field(label, kind, value) {
  const w = document.createElement('div'); w.className = 'field';
  const l = document.createElement('label'); l.textContent = label;
  const el = document.createElement(kind === 'textarea' ? 'textarea' : 'input'); el.value = value || '';
  w.appendChild(l); w.appendChild(el); return w;
}
function toReadToggle(current) {
  const w = document.createElement('div'); w.className = 'field';
  const l = document.createElement('label'); l.textContent = 'Reading list';
  const c = document.createElement('div'); c.className = 'choice'; c.dataset.value = current ? '1' : '0';
  const b = document.createElement('button'); b.type = 'button';
  const paint = () => { const on = c.dataset.value === '1'; b.className = on ? 'on' : ''; b.textContent = on ? '✓ Marked to read' : 'Mark to read'; };
  b.onclick = () => { c.dataset.value = c.dataset.value === '1' ? '0' : '1'; paint(); };
  paint(); c.appendChild(b); w.appendChild(l); w.appendChild(c); return w;
}
function tagEditor(tags) {
  let current = (tags || []).slice();
  const w = document.createElement('div'); w.className = 'field';
  const l = document.createElement('label'); l.textContent = 'Tags';
  const box = document.createElement('div'); box.className = 'tagbox';
  const inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = 'Add a tag, press Enter';
  const sug = document.createElement('div'); sug.className = 'suggest'; sug.style.display = 'none';
  const drawChips = () => {
    box.querySelectorAll('.chip').forEach((c) => c.remove());
    current.forEach((t) => {
      const chip = document.createElement('span'); chip.className = 'chip'; chip.appendChild(document.createTextNode(t));
      const x = document.createElement('button'); x.type = 'button'; x.className = 'chipx'; x.textContent = '×';
      x.onclick = () => { current = current.filter((y) => y !== t); drawChips(); updateSug(); };
      chip.appendChild(x); box.insertBefore(chip, inp);
    });
  };
  const updateSug = () => {
    sug.innerHTML = ''; const v = normalizeTag(inp.value);
    if (!inp.value.trim()) { sug.style.display = 'none'; return; }
    const matches = allTags().filter((t) => current.indexOf(t) === -1 && t.indexOf(v) !== -1).slice(0, 8);
    if (!matches.length) { sug.style.display = 'none'; return; }
    sug.style.display = 'flex';
    const hint = document.createElement('span'); hint.className = 'sughint'; hint.textContent = 'Existing:'; sug.appendChild(hint);
    matches.forEach((t) => { const s = document.createElement('button'); s.type = 'button'; s.className = 'sugtag'; s.textContent = '#' + t; s.onclick = () => { add(t); inp.focus(); }; sug.appendChild(s); });
  };
  const add = (raw) => { const t = normalizeTag(raw); if (t && current.indexOf(t) === -1) current.push(t); inp.value = ''; drawChips(); updateSug(); };
  inp.addEventListener('input', updateSug);
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(inp.value); }
    else if (e.key === 'Backspace' && inp.value === '' && current.length) { current.pop(); drawChips(); updateSug(); }
  });
  box.appendChild(inp); drawChips();
  w.appendChild(l); w.appendChild(box); w.appendChild(sug);
  w.getTags = () => { if (inp.value.trim()) add(inp.value); return current.slice(); };
  return w;
}

// ---- save flow --------------------------------------------------------------
async function onSaveSubmit(e) {
  e.preventDefault();
  const raw = $('urlInput').value.trim();
  if (!raw) return;
  notice('');
  if (!isValidUrl(raw)) { notice("That doesn’t look like a web address. Check the link and try again."); return; }
  const key = dedupKey(raw);
  const existing = state.bookmarks.find((b) => dedupKey(b.url) === key);
  $('urlInput').value = ''; $('saveBtn').disabled = true;
  if (existing) { openExisting(existing); return; }
  const { data: meta } = await api('POST', '/api/fetch-meta', { url: raw });
  openCompose(raw, meta);
}
function openExisting(b) {
  notice('You already saved this link — here it is, ready to edit.');
  u(b.id).editing = true; render();
  setTimeout(() => { const el = $('item-' + b.id); if (el) { el.classList.add('flash'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 30);
}
function openCompose(rawUrl, meta) {
  const slot = $('composeSlot'); slot.innerHTML = '';
  const card = document.createElement('div'); card.className = 'card';
  const head = document.createElement('div'); head.className = 'compose-head' + (meta.failed ? ' failed' : '');
  head.textContent = meta.failed
    ? "We couldn't load this page's details automatically — you can still save it and add a title yourself."
    : 'We pulled these details from the page — adjust anything before saving:';
  const preview = document.createElement('div'); preview.className = 'preview';
  const thumb = document.createElement('div'); thumb.className = 'thumb';
  if (meta.failed) { thumb.style.background = '#e6e8eb'; thumb.style.color = '#6b7684'; thumb.textContent = 'No preview'; }
  else thumbStyle(thumb, { image: meta.image, color: meta.color, host: meta.host });
  const right = document.createElement('div'); right.style.flex = '1'; right.style.minWidth = '0';
  const f1 = field('Title', 'input', meta.title || ''); if (meta.failed) f1.querySelector('input').placeholder = 'Give this bookmark a title';
  const f2 = field('Description', 'textarea', meta.description || '');
  const cf = toReadToggle(false); const tf = tagEditor([]); const nf = field('Notes (Markdown supported)', 'textarea', '');
  const addr = document.createElement('a'); addr.className = 'link'; addr.href = normalizeUrl(rawUrl); addr.target = '_blank'; addr.rel = 'noopener'; addr.textContent = normalizeUrl(rawUrl); addr.style.marginTop = '0';
  right.append(f1, f2, cf, tf, nf, addr);
  preview.append(thumb, right);
  const actions = document.createElement('div'); actions.style.cssText = 'display:flex;gap:8px;margin-top:14px';
  const add = document.createElement('button'); add.className = 'btn'; add.textContent = 'Add to bookmarks';
  const cancel = document.createElement('button'); cancel.className = 'btn secondary'; cancel.textContent = 'Cancel';
  add.onclick = async () => {
    const body = {
      url: normalizeUrl(rawUrl),
      title: f1.querySelector('input').value.trim() || (meta.failed ? normalizeUrl(rawUrl) : meta.title),
      description: f2.querySelector('textarea').value.trim(),
      image: meta.image || '', color: meta.color, host: meta.host,
      toRead: cf.querySelector('.choice').dataset.value === '1',
      tags: tf.getTags(), notes: nf.querySelector('textarea').value,
    };
    const r = await api('POST', '/api/bookmarks', body);
    slot.innerHTML = '';
    if (r.status === 409) { await loadState(); const ex = state.bookmarks.find((b) => b.id === r.data.id); if (ex) return openExisting(ex); }
    await loadState(); const created = state.bookmarks.find((b) => dedupKey(b.url) === dedupKey(body.url)); if (created) u(created.id).flash = true;
    render();
  };
  cancel.onclick = () => { slot.innerHTML = ''; };
  actions.append(add, cancel);
  card.append(head, preview, actions);
  slot.appendChild(card);
}

// ---- rendering --------------------------------------------------------------
function inView(b) {
  if (state.statusFilter === 'archived') return b.archived;
  if (b.archived) return false;
  if (state.statusFilter === 'toread') return b.toRead;
  if (state.statusFilter === 'reference') return !b.toRead;
  return true;
}

function render() {
  renderSaved(); buildSettings();
  const list = $('list'); const countEl = $('count'); list.innerHTML = '';
  const q = state.query.trim();

  if (state.bookmarks.length === 0) {
    countEl.textContent = ''; $('bulkbar').hidden = true;
    const d = document.createElement('div'); d.className = 'empty'; d.textContent = 'Nothing saved yet. Paste a link above to get started.';
    list.appendChild(d); return;
  }

  const { test } = compile(q);
  const inScope = state.bookmarks.filter(inView);
  const visible = inScope.filter(test).sort(comparator(state.sortMode));
  buildBulkBar(visible);

  const scopeWord = state.statusFilter === 'toread' ? ' to read' : state.statusFilter === 'reference' ? ' for reference' : state.statusFilter === 'archived' ? ' archived' : '';
  countEl.textContent = q
    ? `${visible.length} of ${inScope.length} match “${q}”${scopeWord}`
    : `${inScope.length} ${inScope.length === 1 ? 'bookmark' : 'bookmarks'}${scopeWord}`;

  if (visible.length === 0) {
    const e = document.createElement('div'); e.className = 'empty';
    e.textContent = q ? `No bookmarks match “${q}”${scopeWord}. Try a different word or combination.`
      : state.statusFilter === 'toread' ? 'Nothing on your reading list yet.'
      : state.statusFilter === 'archived' ? 'No archived bookmarks.'
      : state.statusFilter === 'reference' ? 'Nothing here — everything is on your reading list.'
      : 'Nothing saved yet. Paste a link above to get started.';
    list.appendChild(e); return;
  }

  const limit = pageSizeNumber() === Infinity ? visible.length : pageSizeNumber() * state.pageChunks;
  const pageItems = visible.slice(0, limit);
  const hl = highlighter(q);
  pageItems.forEach((b) => list.appendChild(renderItem(b, q, hl)));

  const remaining = visible.length - pageItems.length;
  if (remaining > 0) {
    const note = document.createElement('div'); note.className = 'pagenote';
    note.textContent = `Showing ${pageItems.length} of ${visible.length} — search, counts and “Select all” still cover all ${visible.length}.`;
    list.appendChild(note);
    const more = document.createElement('button'); more.className = 'btn secondary showmore';
    more.textContent = `Show more (${remaining} more of ${visible.length})`;
    more.onclick = () => { state.pageChunks++; render(); };
    list.appendChild(more);
  }
}

function renderItem(b, q, hl) {
  const s = u(b.id);
  if (s.confirmDelete) return renderDeleteConfirm(b);
  const li = document.createElement('li'); li.className = 'item' + (s.flash ? ' flash' : '') + (state.selected.has(b.id) ? ' selected' : ''); li.id = 'item-' + b.id; s.flash = false;
  const top = document.createElement('div'); top.className = 'item-top';
  const chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'selbox'; chk.checked = state.selected.has(b.id); chk.setAttribute('aria-label', 'Select bookmark');
  chk.onchange = () => { chk.checked ? state.selected.add(b.id) : state.selected.delete(b.id); render(); };
  const thumb = document.createElement('div'); thumb.className = 'thumb'; thumbStyle(thumb, b);
  const body = document.createElement('div'); body.className = 'item-body';

  if (s.editing) { renderEditor(b, body); }
  else {
    const titlerow = document.createElement('div'); titlerow.className = 'titlerow';
    const ic = document.createElement('span'); ic.className = 'icon'; ic.style.background = b.color || '#2f6fed'; ic.textContent = b.iconLetter || '?';
    const a = document.createElement('a'); a.className = 'title'; a.href = b.url; a.target = '_blank'; a.rel = 'noopener'; a.innerHTML = hl(b.title);
    titlerow.append(ic, a);
    if (b.toRead) { const bd = document.createElement('span'); bd.className = 'badge toread'; bd.textContent = 'To read'; titlerow.appendChild(bd); }
    if (b.archived) { const bd = document.createElement('span'); bd.className = 'badge archived'; bd.textContent = 'Archived'; titlerow.appendChild(bd); }
    if (b.offline) { const bd = document.createElement('span'); bd.className = 'badge offline'; bd.textContent = b.offline.type === 'pdf' ? 'PDF saved' : 'Offline copy'; titlerow.appendChild(bd); }
    body.appendChild(titlerow);

    if (b.description) {
      const desc = document.createElement('div'); desc.className = 'desc'; desc.innerHTML = hl(b.description);
      const longDesc = b.description.length > 180;
      if (longDesc && !s.descOpen) desc.classList.add('clamped');
      body.appendChild(desc);
      if (longDesc) { const t = document.createElement('button'); t.className = 'linkbtn'; t.textContent = s.descOpen ? 'Show less' : 'Show more'; t.onclick = () => { s.descOpen = !s.descOpen; render(); }; body.appendChild(t); }
    }
    if ((b.tags || []).length) {
      const tg = document.createElement('div'); tg.className = 'tags';
      b.tags.forEach((t) => { const tb = document.createElement('button'); tb.className = 'tag'; tb.textContent = '#' + t; tb.onclick = () => { $('searchInput').value = '#' + t; state.query = '#' + t; state.selected.clear(); state.pageChunks = 1; render(); }; tg.appendChild(tb); });
      body.appendChild(tg);
    }
    if (b.notes && b.notes.trim()) {
      const nt = document.createElement('div'); nt.className = 'note'; nt.innerHTML = renderMarkdown(b.notes); highlightWithin(nt, q);
      const longNote = b.notes.length > 280; if (longNote && !s.noteOpen) nt.classList.add('collapsed');
      body.appendChild(nt);
      if (longNote) { const t = document.createElement('button'); t.className = 'linkbtn'; t.textContent = s.noteOpen ? 'Show less' : 'Show more'; t.onclick = () => { s.noteOpen = !s.noteOpen; render(); }; body.appendChild(t); }
    }
    const link = document.createElement('a'); link.className = 'link'; link.href = b.url; link.target = '_blank'; link.rel = 'noopener'; link.innerHTML = hl(b.url);
    body.appendChild(link);
    body.appendChild(renderMeta(b));
  }

  top.append(chk, thumb, body); li.appendChild(top); return li;
}

function renderMeta(b) {
  const meta = document.createElement('div'); meta.className = 'meta';
  const when = document.createElement('span'); when.textContent = 'Saved ' + new Date(b.createdAt).toLocaleDateString();
  meta.appendChild(when);
  const btn = (label, cls, fn) => { const x = document.createElement('button'); x.className = 'linkbtn' + (cls ? ' ' + cls : ''); x.textContent = label; x.onclick = fn; meta.appendChild(x); };
  btn('Edit', '', () => { u(b.id).editing = true; render(); });
  if (!b.archived) {
    btn(b.toRead ? 'Mark as read' : 'Mark to read', '', async () => { await api('PATCH', '/api/bookmarks/' + b.id, { toRead: !b.toRead }); refresh(); });
    btn('Archive', '', async () => { await api('PATCH', '/api/bookmarks/' + b.id, { archived: true }); refresh(); });
  } else {
    btn('Restore', '', async () => { await api('PATCH', '/api/bookmarks/' + b.id, { archived: false }); refresh(); });
  }
  if (b.offline) {
    btn('Open offline copy', '', () => window.open('/api/offline/' + b.id, '_blank'));
    btn('Remove offline copy', '', async () => { await api('DELETE', '/api/bookmarks/' + b.id + '/offline'); refresh(); });
  } else {
    btn(isPdf(b.url) ? 'Save PDF offline' : 'Save page offline', '', async () => {
      notice('Saving offline copy…', false);
      const r = await api('POST', '/api/bookmarks/' + b.id + '/offline');
      notice(r.ok ? '' : ('Could not save an offline copy: ' + (r.data.message || 'the page could not be fetched.')));
      refresh();
    });
  }
  if (b.archiveUrl) {
    const a = document.createElement('a'); a.className = 'linkbtn'; a.href = b.archiveUrl; a.target = '_blank'; a.rel = 'noopener'; a.style.textDecoration = 'none'; a.textContent = 'View on Internet Archive'; meta.appendChild(a);
  } else {
    btn('Submit to Internet Archive', '', async () => { notice('Submitting to the Internet Archive…', false); const r = await api('POST', '/api/bookmarks/' + b.id + '/archive'); notice(r.ok ? '' : 'Could not reach the Internet Archive.'); refresh(); });
  }
  btn('Delete', 'danger', () => { u(b.id).confirmDelete = true; render(); });
  return meta;
}

function renderEditor(b, body) {
  const f1 = field('Title', 'input', b.title), f2 = field('Description', 'textarea', b.description), f3 = field('Address (link)', 'input', b.url);
  const f4 = toReadToggle(b.toRead), f5 = tagEditor(b.tags), f6 = field('Notes (Markdown supported)', 'textarea', b.notes);
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px';
  const save = document.createElement('button'); save.className = 'btn'; save.textContent = 'Save changes';
  const cancel = document.createElement('button'); cancel.className = 'btn secondary'; cancel.textContent = 'Cancel';
  save.onclick = async () => {
    const patch = {
      title: f1.querySelector('input').value.trim() || b.title,
      description: f2.querySelector('textarea').value.trim(),
      notes: f6.querySelector('textarea').value,
      toRead: f4.querySelector('.choice').dataset.value === '1',
      tags: f5.getTags(),
    };
    const newUrl = f3.querySelector('input').value.trim();
    if (newUrl) patch.url = newUrl;
    const r = await api('PATCH', '/api/bookmarks/' + b.id, patch);
    if (!r.ok && r.data && r.data.error === 'not-a-web-address') { notice('That address doesn’t look like a web address.'); return; }
    u(b.id).editing = false; refresh();
  };
  cancel.onclick = () => { u(b.id).editing = false; render(); };
  row.append(save, cancel);
  body.append(f1, f2, f3, f4, f5, f6, row);
}

function renderDeleteConfirm(b) {
  const li = document.createElement('li'); li.className = 'item'; li.id = 'item-' + b.id;
  const box = document.createElement('div'); box.className = 'confirm';
  const h = document.createElement('h4'); h.textContent = `Permanently delete “${b.title}”?`;
  const p = document.createElement('p'); p.textContent = 'This deletes the bookmark for good and cannot be undone — unlike Archive, which only hides it and keeps it restorable.';
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px';
  const del = document.createElement('button'); del.className = 'btn danger'; del.textContent = 'Delete permanently';
  const can = document.createElement('button'); can.className = 'btn secondary'; can.textContent = 'Cancel';
  del.onclick = async () => { await api('DELETE', '/api/bookmarks/' + b.id); u(b.id).confirmDelete = false; refresh(); };
  can.onclick = () => { u(b.id).confirmDelete = false; render(); };
  row.append(del, can); box.append(h, p, row); li.appendChild(box); return li;
}

// ---- bulk bar ---------------------------------------------------------------
function selectedItems() { return state.bookmarks.filter((b) => state.selected.has(b.id)); }
function pruneSelection() { for (const id of Array.from(state.selected)) if (!state.bookmarks.some((b) => b.id === id)) state.selected.delete(id); }
async function bulk(action, value) { const ids = Array.from(state.selected); await api('POST', '/api/bulk', { ids, action, value }); }

function buildBulkBar(visible) {
  const bar = $('bulkbar'); bar.className = 'bulkbar'; bar.innerHTML = '';
  pruneSelection();
  const count = state.selected.size;
  if (count === 0) { bar.hidden = true; state.bulkConfirmDelete = false; state.bulkTagMode = null; return; }
  bar.hidden = false;

  if (state.bulkConfirmDelete) {
    const t = document.createElement('span'); t.className = 'bcount'; t.textContent = `Permanently delete ${count} bookmark${count > 1 ? 's' : ''}?`;
    const dl = document.createElement('button'); dl.className = 'danger'; dl.textContent = `Delete ${count} permanently`;
    dl.onclick = async () => { await bulk('delete'); state.selected.clear(); state.bulkConfirmDelete = false; refresh(); };
    const cn = document.createElement('button'); cn.textContent = 'Cancel'; cn.onclick = () => { state.bulkConfirmDelete = false; render(); };
    const hint = document.createElement('span'); hint.className = 'scopehint'; hint.textContent = 'This cannot be undone — unlike Archive, which only hides them.';
    bar.append(t, dl, cn, hint); return;
  }
  if (state.bulkTagMode === 'add') {
    const lab = document.createElement('span'); lab.className = 'bcount'; lab.textContent = `Add tag to ${count} selected:`;
    const inp = document.createElement('input'); inp.className = 'btag'; inp.placeholder = 'tag name';
    const ap = document.createElement('button'); ap.className = 'primary'; ap.textContent = 'Apply';
    const doAdd = async () => { const t = normalizeTag(inp.value); if (!t) { state.bulkTagMode = null; return render(); } await bulk('addTag', t); state.bulkTagMode = null; refresh(); };
    ap.onclick = doAdd; inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
    const cn = document.createElement('button'); cn.textContent = 'Cancel'; cn.onclick = () => { state.bulkTagMode = null; render(); };
    bar.append(lab, inp, ap, cn); setTimeout(() => inp.focus(), 0); return;
  }
  if (state.bulkTagMode === 'remove') {
    const lab = document.createElement('span'); lab.className = 'bcount'; lab.textContent = `Remove a tag from ${count} selected:`; bar.appendChild(lab);
    const union = {}; selectedItems().forEach((b) => (b.tags || []).forEach((t) => { union[t] = (union[t] || 0) + 1; }));
    const keys = Object.keys(union).sort();
    if (!keys.length) { const none = document.createElement('span'); none.className = 'scopehint'; none.textContent = 'The selected bookmarks have no tags.'; bar.appendChild(none); }
    keys.forEach((t) => { const bt = document.createElement('button'); bt.textContent = '#' + t + ' ✕'; bt.title = `Remove from ${union[t]} of ${count}`; bt.onclick = async () => { await bulk('removeTag', t); refresh(); }; bar.appendChild(bt); });
    const done = document.createElement('button'); done.className = 'ghost'; done.textContent = 'Done'; done.onclick = () => { state.bulkTagMode = null; render(); }; bar.appendChild(done); return;
  }

  const c = document.createElement('span'); c.className = 'bcount'; c.textContent = count + ' selected'; bar.appendChild(c);
  const act = (label, cls, fn) => { const x = document.createElement('button'); if (cls) x.className = cls; x.textContent = label; x.onclick = fn; bar.appendChild(x); };
  act('Add tag…', '', () => { state.bulkTagMode = 'add'; render(); });
  act('Remove tag…', '', () => { state.bulkTagMode = 'remove'; render(); });
  act('Mark to read', '', async () => { await bulk('toRead', true); state.selected.clear(); refresh(); });
  act('Mark as read', '', async () => { await bulk('toRead', false); state.selected.clear(); refresh(); });
  if (state.statusFilter === 'archived') act('Restore', '', async () => { await bulk('archived', false); state.selected.clear(); refresh(); });
  else act('Archive', '', async () => { await bulk('archived', true); state.selected.clear(); refresh(); });
  act('Delete', 'danger', () => { state.bulkConfirmDelete = true; render(); });

  const allSel = visible.length > 0 && visible.every((b) => state.selected.has(b.id));
  if (!allSel && visible.length > 0) act('Select all ' + visible.length + ' matching', 'ghost', () => { visible.forEach((b) => state.selected.add(b.id)); render(); });
  act('Clear', 'ghost', () => { state.selected.clear(); state.bulkTagMode = null; render(); });
  const scopeName = state.query.trim() ? 'search' : state.statusFilter === 'all' ? 'list' : 'view';
  const hint = document.createElement('span'); hint.className = 'scopehint';
  hint.textContent = `Actions apply to the ${count} selected only. “Select all” covers every bookmark in the current ${scopeName} — including any not yet revealed by Show more — never your whole collection.`;
  bar.appendChild(hint);
}

// ---- saved searches ---------------------------------------------------------
function applySaved(s) { state.query = s.query; $('searchInput').value = s.query; state.selected.clear(); state.pageChunks = 1; render(); }
function renderSaved() {
  const bar = $('savedbar'); bar.innerHTML = '';
  if (state.savingSearch) {
    bar.hidden = false;
    const q = state.query.trim();
    const wrap = document.createElement('div'); wrap.className = 'saveform';
    const lab = document.createElement('span'); lab.className = 'slabel'; lab.textContent = 'Save current search:';
    const nm = document.createElement('input'); nm.placeholder = 'Name this search'; nm.value = q;
    const sv = document.createElement('button'); sv.className = 'linkbtn2'; sv.textContent = 'Save';
    const cn = document.createElement('button'); cn.className = 'linkbtn2'; cn.textContent = 'Cancel';
    const qd = document.createElement('span'); qd.className = 'slabel'; qd.textContent = '— finds: ' + q;
    const err = document.createElement('span'); err.className = 'err';
    const doSave = async () => {
      const name = nm.value.trim() || q;
      const r = await api('POST', '/api/saved-searches', { name, query: q });
      if (r.status === 409) { err.textContent = `A saved search called “${name}” already exists — choose another name.`; nm.focus(); nm.select(); return; }
      state.savingSearch = false; await refresh();
    };
    sv.onclick = doSave; cn.onclick = () => { state.savingSearch = false; renderSaved(); };
    nm.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
    wrap.append(lab, nm, sv, cn, qd, err); bar.appendChild(wrap); setTimeout(() => { nm.focus(); nm.select(); }, 0); return;
  }
  if (!state.savedSearches.length) { bar.hidden = true; return; }
  bar.hidden = false;
  const slbl = document.createElement('span'); slbl.className = 'slabel'; slbl.textContent = 'Saved searches:'; bar.appendChild(slbl);
  state.savedSearches.forEach((s) => {
    const chip = document.createElement('span'); chip.className = 'schip'; chip.appendChild(document.createTextNode(s.name)); chip.title = s.query; chip.onclick = () => applySaved(s);
    const x = document.createElement('button'); x.className = 'sx'; x.textContent = '×'; x.title = 'Delete saved search';
    x.onclick = async (e) => { e.stopPropagation(); await api('DELETE', '/api/saved-searches/' + s.id); await refresh(); };
    chip.appendChild(x); bar.appendChild(chip);
  });
}

// ---- settings ---------------------------------------------------------------
function prefRow(labelText, control) { const r = document.createElement('div'); r.className = 'prefrow'; const l = document.createElement('label'); l.textContent = labelText; r.append(l, control); return r; }
function buildSettings() {
  const s = $('settings'); s.innerHTML = '';
  if (!state.settingsOpen) { s.hidden = true; return; }
  s.hidden = false;
  const h = document.createElement('div'); h.className = 'settings-title'; h.textContent = 'Display settings'; s.appendChild(h);
  const ds = document.createElement('select');
  SORT_MODES.forEach(([v, label]) => { const o = document.createElement('option'); o.value = v; o.textContent = label; if (v === state.prefs.defaultSort) o.selected = true; ds.appendChild(o); });
  ds.onchange = async () => { state.prefs.defaultSort = ds.value; state.sortMode = ds.value; $('sortSelect').value = ds.value; state.pageChunks = 1; await api('PUT', '/api/prefs', { defaultSort: ds.value }); render(); };
  s.appendChild(prefRow('Default sort (used when the app opens)', ds));
  const ps = document.createElement('select');
  [['5', '5'], ['10', '10'], ['25', '25'], ['50', '50'], ['all', 'All']].forEach(([v, label]) => { const o = document.createElement('option'); o.value = v; o.textContent = label; const cur = state.prefs.pageSize === 'all' ? 'all' : String(state.prefs.pageSize); if (v === cur) o.selected = true; ps.appendChild(o); });
  ps.onchange = async () => { state.prefs.pageSize = ps.value === 'all' ? 'all' : parseInt(ps.value, 10); state.pageChunks = 1; await api('PUT', '/api/prefs', { pageSize: ps.value }); render(); };
  s.appendChild(prefRow('Items shown per page', ps));
  const tsz = document.createElement('select');
  [['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']].forEach(([v, label]) => { const o = document.createElement('option'); o.value = v; o.textContent = label; if (v === state.prefs.textSize) o.selected = true; tsz.appendChild(o); });
  tsz.onchange = async () => { state.prefs.textSize = tsz.value; applyTextSize(); await api('PUT', '/api/prefs', { textSize: tsz.value }); render(); };
  s.appendChild(prefRow('Text size', tsz));
  const done = document.createElement('button'); done.className = 'hbtn'; done.style.marginTop = '12px'; done.textContent = 'Done'; done.onclick = () => { state.settingsOpen = false; buildSettings(); };
  s.appendChild(done);
}

// ---- wiring -----------------------------------------------------------------
function wire() {
  const sortSel = $('sortSelect');
  SORT_MODES.forEach(([v, label]) => { const o = document.createElement('option'); o.value = v; o.textContent = label; sortSel.appendChild(o); });

  $('urlInput').addEventListener('input', (e) => { $('saveBtn').disabled = e.target.value.trim() === ''; notice(''); });
  $('saveForm').addEventListener('submit', onSaveSubmit);
  $('searchInput').addEventListener('input', (e) => { state.query = e.target.value; state.selected.clear(); state.pageChunks = 1; render(); });
  sortSel.addEventListener('change', (e) => { state.sortMode = e.target.value; state.pageChunks = 1; render(); });
  $('segmented').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.statusFilter = b.dataset.f; state.selected.clear(); state.pageChunks = 1;
    Array.from($('segmented').children).forEach((x) => { x.className = x === b ? 'active' : ''; });
    render();
  });
  $('settingsBtn').addEventListener('click', () => { state.settingsOpen = !state.settingsOpen; buildSettings(); });
  $('saveSearchBtn').addEventListener('click', () => {
    if (!state.query.trim()) { notice('Type a search (words and/or #tags, using NOT to exclude) first, then save it.'); return; }
    notice(''); state.savingSearch = true; renderSaved();
  });
  $('exportBtn').addEventListener('click', () => { window.location = '/api/export'; });
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      const res = await api('POST', '/api/import', String(r.result), true);
      const d = res.data;
      if (d.added === 0 && d.skipped === 0) ioMessage('No bookmarks were found in that file. Make sure it is a browser-exported bookmarks HTML file.');
      else ioMessage(`Imported ${d.added} bookmark${d.added === 1 ? '' : 's'}${d.skipped ? ` — skipped ${d.skipped} already in your collection` : ''}. Titles, tags and original saved dates were kept where available.`);
      await refresh();
    };
    r.readAsText(f); e.target.value = '';
  });
}

async function init() {
  wire();
  await loadState();
  $('sortSelect').value = state.sortMode;
  applyTextSize();
  render();
  document.body.setAttribute('data-harness-ready', 'true');
}
init();
