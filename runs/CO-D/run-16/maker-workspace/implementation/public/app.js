// Frontend for the bookmarks app. Talks to the REST API; search, sort, and
// pagination run here over the full data set. Behaviour basis: SCN-001..025.
import { buildSearch } from '/src/query.js';
import { renderMarkdown } from '/src/markdown.js';
import { isValidUrl, normalizeUrl, domainOf } from '/src/urls.js';

const $ = (id) => document.getElementById(id);
const state = { bookmarks: [], savedSearches: [], prefs: { defaultSort: 'added_desc', pageSize: 25, textSize: 'medium' } };

let currentTab = 'all';
let currentSort = 'added_desc';
let query = '';
let selected = {};
let pageLimit = 25;
let lastSig = '';
let lastShown = [];
let currentMeta = null; // metadata for the link being composed

// ---------- helpers ----------
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
async function api(url, opts) {
  const res = await fetch(url, opts);
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}
function palette(dom) {
  const colors = ['#2f6fed', '#e0663a', '#2fa36b', '#8a4fd0', '#d0434f', '#1f8a9c', '#c78a1a'];
  let s = 0; for (let i = 0; i < dom.length; i++) s += dom.charCodeAt(i);
  return colors[s % colors.length];
}
function gradientFor(dom) {
  return `linear-gradient(135deg,${palette(dom)} 0%,${palette(dom.split('').reverse().join('') + 'x')} 100%)`;
}
function faviconHTML(b, big) {
  const dom = b.dom || domainOf(b.url);
  const size = big ? 'width:38px;height:38px;font-size:1em' : '';
  const inner = b.favicon
    ? `<img src="${esc(b.favicon)}" onerror="this.style.display='none'" alt=""><span>${esc(dom.charAt(0).toUpperCase())}</span>`
    : `<span>${esc(dom.charAt(0).toUpperCase())}</span>`;
  return `<span class="favicon" style="background:${palette(dom)};${size}">${inner}</span>`;
}
function previewBg(b) {
  const dom = b.dom || domainOf(b.url);
  return b.image ? `background-image:url('${esc(b.image)}');background-color:#eef1f6` : `background:${gradientFor(dom)}`;
}
function usedTags() {
  const set = {};
  state.bookmarks.forEach((b) => (b.tags || []).forEach((t) => { set[t.toLowerCase()] = t; }));
  return set;
}
function hlMulti(text, terms) {
  let s = esc(text || '');
  if (!terms || !terms.length) return s;
  terms.forEach((t) => {
    if (!t) return;
    const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    s = s.replace(re, '$1');
  });
  return s.replace(//g, '<mark>').replace(//g, '</mark>');
}
function noteExcerpt(note, terms) {
  if (!note || !terms || !terms.length) return '';
  const low = note.toLowerCase();
  let hit = -1, hitLen = 0;
  terms.forEach((t) => { if (!t) return; const i = low.indexOf(t); if (i >= 0 && (hit < 0 || i < hit)) { hit = i; hitLen = t.length; } });
  if (hit < 0) return '';
  const pad = 50, start = Math.max(0, hit - pad), end = Math.min(note.length, hit + hitLen + pad);
  const frag = (start > 0 ? '…' : '') + note.slice(start, end) + (end < note.length ? '…' : '');
  return `<div class="noteex">📝 ${hlMulti(frag, terms)}</div>`;
}
function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function parseTagList(raw) { return raw ? raw.split(',').map((t) => t.trim()).filter(Boolean) : []; }

// ---------- composer: metadata / auto-fill ----------
const urlEl = $('url'), previewEl = $('preview'), fetchnoteEl = $('fetchnote'), fieldsEl = $('fields'),
  previmgEl = $('previmg'), faviconEl = $('favicon'), titleEl = $('title'), descEl = $('desc'),
  tagsEl = $('tags'), noteEl = $('note'), dupEl = $('dupbanner'), suggestEl = $('suggest');
let fetchTimer = null;

urlEl.addEventListener('input', () => {
  const url = urlEl.value.trim();
  clearTimeout(fetchTimer);
  dupEl.hidden = true; fetchnoteEl.hidden = true;
  currentMeta = null;
  if (!url) { previewEl.hidden = true; fieldsEl.hidden = true; return; }
  previewEl.hidden = false; fieldsEl.hidden = true;
  fetchTimer = setTimeout(doLookup, 400);
});
async function doLookup() {
  const url = urlEl.value.trim();
  const { data } = await api('/api/metadata', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
  previewEl.hidden = true;
  if (!data || !data.valid) {
    fieldsEl.hidden = true;
    fetchnoteEl.textContent = "That doesn't look like a web address. Please enter a valid address (for example example.com) to save a bookmark.";
    fetchnoteEl.hidden = false;
    return;
  }
  if (data.duplicate) { showDuplicate(data.duplicate); return; }
  const meta = data.meta || {};
  currentMeta = meta;
  const dom = domainOf(url);
  // mutate the favicon element in place (do not replace the node)
  faviconEl.style.background = palette(dom);
  const letter = esc(dom.charAt(0).toUpperCase());
  faviconEl.innerHTML = meta.favicon
    ? `<img src="${esc(meta.favicon)}" onerror="this.style.display='none'" alt=""><span>${letter}</span>`
    : `<span>${letter}</span>`;
  if (meta.ok) {
    titleEl.value = meta.title || '';
    descEl.value = meta.description || '';
    if (meta.image) { previmgEl.style.cssText = previewBg({ url, dom, image: meta.image }); previmgEl.hidden = false; }
    else { previmgEl.hidden = true; }
    fetchnoteEl.hidden = true;
  } else {
    titleEl.value = ''; descEl.value = ''; previmgEl.hidden = true;
    fetchnoteEl.textContent = "We couldn't fetch this page's details. You can still save it — add a title yourself so it's easy to recognise later.";
    fetchnoteEl.hidden = false;
  }
  fieldsEl.hidden = false;
}
function showDuplicate(b) {
  dupEl.innerHTML = `You already saved this link. <a href="#" style="color:inherit;font-weight:600;margin-left:4px">Go to it to update →</a>`;
  dupEl.hidden = false;
  dupEl.querySelector('a').onclick = (e) => { e.preventDefault(); openEditor(b.id, true); };
  previewEl.hidden = true; fieldsEl.hidden = true;
}

// tag suggestions in composer
let activeSug = -1;
tagsEl.addEventListener('input', () => {
  const parts = tagsEl.value.split(',');
  const cur = parts[parts.length - 1].trim().toLowerCase();
  if (!cur) { suggestEl.hidden = true; return; }
  const chosen = parts.slice(0, -1).map((t) => t.trim().toLowerCase());
  const matches = Object.keys(usedTags()).filter((t) => t.indexOf(cur) === 0 && chosen.indexOf(t) < 0).slice(0, 6);
  if (!matches.length) { suggestEl.hidden = true; return; }
  activeSug = -1;
  suggestEl.innerHTML = matches.map((t) => `<div>${esc(t)}</div>`).join('');
  [...suggestEl.children].forEach((el) => { el.onclick = () => applyTag(parts, el.textContent); });
  suggestEl.hidden = false;
});
function applyTag(parts, tag) { parts[parts.length - 1] = ' ' + tag; tagsEl.value = parts.join(',') + ', '; suggestEl.hidden = true; tagsEl.focus(); }
tagsEl.addEventListener('keydown', (e) => {
  if (suggestEl.hidden) return;
  const opts = suggestEl.children;
  if (e.key === 'ArrowDown') { e.preventDefault(); activeSug = Math.min(activeSug + 1, opts.length - 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); activeSug = Math.max(activeSug - 1, 0); }
  else if (e.key === 'Enter' && activeSug >= 0) { e.preventDefault(); opts[activeSug].click(); return; }
  else return;
  [...opts].forEach((el, i) => el.classList.toggle('active', i === activeSug));
});
document.addEventListener('click', (e) => { if (!e.target.closest('.tagwrap')) suggestEl.hidden = true; });

// save
$('composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = urlEl.value.trim();
  if (!url) return;
  if (!isValidUrl(url)) {
    fetchnoteEl.textContent = "That doesn't look like a web address. Please enter a valid address (for example example.com) to save a bookmark.";
    fetchnoteEl.hidden = false; urlEl.focus(); return;
  }
  const body = {
    url, title: titleEl.value.trim(), description: descEl.value.trim(), note: noteEl.value.trim(),
    tags: parseTagList(tagsEl.value), image: currentMeta && currentMeta.image ? currentMeta.image : '',
    favicon: currentMeta ? currentMeta.favicon : '', readLater: $('readlater').checked,
  };
  const { ok, status, data } = await api('/api/bookmarks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (status === 409 && data && data.existing) { openEditor(data.existing.id, true); return; }
  if (!ok) return;
  state.bookmarks.unshift(data);
  resetComposer(url); // do not clobber a URL the user has already started typing next
  render();
  // capture happens in the background; refresh shortly to reflect the preserved copy
  setTimeout(refreshState, 1500);
});
function resetComposer(submittedUrl) {
  // If the user has already typed a different URL for the next save, leave the
  // composer alone so we don't wipe their in-progress input.
  if (submittedUrl && urlEl.value.trim() !== submittedUrl.trim()) return;
  urlEl.value = ''; titleEl.value = ''; descEl.value = ''; tagsEl.value = ''; noteEl.value = '';
  $('readlater').checked = true; previmgEl.hidden = true; fieldsEl.hidden = true; fetchnoteEl.hidden = true; currentMeta = null;
}

// ---------- list rendering ----------
function addedOf(b) { return b.added || 0; }
function sortShown(arr) {
  const a = arr.slice();
  a.sort((x, y) => {
    switch (currentSort) {
      case 'added_asc': return addedOf(x) - addedOf(y);
      case 'title_asc': return (x.title || x.url).toLowerCase().localeCompare((y.title || y.url).toLowerCase());
      case 'title_desc': return (y.title || y.url).toLowerCase().localeCompare((x.title || x.url).toLowerCase());
      default: return addedOf(y) - addedOf(x);
    }
  });
  return a;
}
function selCount() { return Object.keys(selected).length; }
function selectedItems() { return state.bookmarks.filter((b) => selected[b.id]); }

function render() {
  const live = state.bookmarks.filter((b) => !b.archived);
  $('tc-all').textContent = live.length;
  $('tc-unread').textContent = live.filter((b) => b.status !== 'done').length;
  $('tc-done').textContent = live.filter((b) => b.status === 'done').length;
  $('tc-archived').textContent = state.bookmarks.filter((b) => b.archived).length;

  const byTab = state.bookmarks.filter((b) => {
    if (currentTab === 'archived') return b.archived;
    if (b.archived) return false;
    if (currentTab === 'unread') return b.status !== 'done';
    if (currentTab === 'done') return b.status === 'done';
    return true;
  });
  const srch = buildSearch(query);
  const q = srch.active ? srch.terms : null;
  const shown = sortShown(srch.active ? byTab.filter(srch.pred) : byTab);
  lastShown = shown;
  updateBulkUI();
  const sig = currentTab + '|' + query + '|' + currentSort;
  if (sig !== lastSig) { pageLimit = state.prefs.pageSize; lastSig = sig; }

  const listEl = $('list');
  if (!state.bookmarks.length) {
    $('count').textContent = '';
    listEl.innerHTML = '<div class="empty"><div class="big">No bookmarks yet</div>Paste a link above to save your first one.</div>';
    return;
  }
  $('count').textContent = srch.active ? `${shown.length} of ${byTab.length} match`
    : `${byTab.length} ${byTab.length === 1 ? 'bookmark' : 'bookmarks'}`;
  if (!shown.length) {
    if (srch.active) listEl.innerHTML = `<div class="empty"><div class="big">No matches for "${esc(query.trim())}"</div>Try a different word, or switch tabs.</div>`;
    else if (currentTab === 'unread') listEl.innerHTML = '<div class="empty"><div class="big">Nothing left to read</div>Links you save appear here until you mark them finished.</div>';
    else if (currentTab === 'done') listEl.innerHTML = '<div class="empty"><div class="big">Nothing finished yet</div>When you finish with a link, mark it as read and it moves here.</div>';
    else if (currentTab === 'archived') listEl.innerHTML = '<div class="empty"><div class="big">Archive is empty</div>Archived bookmarks are hidden from your lists and searches, and can be restored from here.</div>';
    else listEl.innerHTML = '';
    return;
  }
  const visible = state.prefs.pageSize === 'all' ? shown : shown.slice(0, pageLimit);
  listEl.innerHTML = visible.map((b) => renderItem(b, q)).join('');
  if (state.prefs.pageSize !== 'all' && shown.length > visible.length) {
    listEl.innerHTML += `<button class="showmore" onclick="showMore()">Show more (${shown.length - visible.length} more)</button>`;
  }
}

function renderItem(b, q) {
  if (b._editing) return renderEditor(b);
  const tags = (b.tags || []).map((t) => `<span class="tag clickable" onclick="filterByTag(${JSON.stringify(t).replace(/"/g, '&quot;')})">${hlMulti(t, q)}</span>`).join('');
  const actions = b.archived
    ? `<span class="status-pill archived-pill">📦 Archived</span>
       <button class="toggle-btn" onclick="restoreItem('${b.id}')">Restore</button>
       <button class="toggle-btn danger" onclick="deleteItem('${b.id}')">Delete permanently</button>`
    : `${(b.status === 'done'
        ? `<span class="status-pill done">✓ Finished</span><button class="toggle-btn" onclick="toggleStatus('${b.id}')">Move back to “To read”</button>`
        : `<span class="status-pill unread">● To read</span><button class="toggle-btn" onclick="toggleStatus('${b.id}')">Mark as finished</button>`)}
       <button class="toggle-btn" onclick="openEditor('${b.id}',false)">Edit</button>
       <button class="toggle-btn" onclick="archiveItem('${b.id}')">Archive</button>
       <button class="toggle-btn danger" onclick="deleteItem('${b.id}')">Delete</button>`;
  return `<div class="item${selected[b.id] ? ' selected' : ''}" id="bm-${b.id}">
    <div class="head">
      <input type="checkbox" class="selbox" ${selected[b.id] ? 'checked' : ''} onchange="toggleSelect('${b.id}')">
      ${faviconHTML(b)}
      <div style="flex:1">
        <div class="title"><a href="${esc(b.url.match(/^https?:/i) ? b.url : 'http://' + b.url)}" target="_blank" rel="noopener">${hlMulti(b.title, q)}</a></div>
        <div class="url">${hlMulti(b.url, q)}</div>
      </div>
    </div>
    ${b.image ? `<div class="previmg" style="${previewBg(b)}"></div>` : ''}
    ${b.description ? `<div class="desc">${hlMulti(b.description, q)}</div>` : ''}
    ${q ? noteExcerpt(b.note, q) : ''}
    ${tags ? `<div class="tags">${tags}</div>` : ''}
    ${b.note ? `<div class="noteview" id="note-${b.id}" hidden>${renderMarkdown(b.note)}</div>` : ''}
    <div class="snapview" id="snap-${b.id}" hidden>${snapPanel(b)}</div>
    <div class="rowactions">
      ${b.note ? `<button class="toggle-btn" onclick="toggleNote('${b.id}')">📝 Note</button>` : ''}
      <button class="toggle-btn" onclick="toggleSnap('${b.id}')">${b.snapType === 'pdf' ? '🗎 Saved PDF' : '🗎 Saved copy'}</button>
      ${actions}
    </div>
  </div>`;
}
function renderEditor(b) {
  return `<div class="item highlight" id="bm-${b.id}">
    <div class="head">${faviconHTML(b)}<div><div class="title">${esc(b.title)}</div><div class="url">${esc(b.url)}</div></div></div>
    <div class="editor">
      <label>Link</label><input id="e-url-${b.id}" value="${esc(b.url)}">
      <label>Title</label><input id="e-title-${b.id}" value="${esc(b.title)}">
      <label>Description</label><textarea id="e-desc-${b.id}">${esc(b.description || '')}</textarea>
      <label>Tags</label><input id="e-tags-${b.id}" value="${esc((b.tags || []).join(', '))}">
      <label>Note</label><textarea id="e-note-${b.id}">${esc(b.note || '')}</textarea>
      <div class="hint" style="margin-bottom:8px">Markdown: # headings, **bold**, *italic*, \`code\`, fenced code, &gt; quotes, - bullets, 1. numbered, links.</div>
      <button class="save" onclick="saveEdit('${b.id}')">Update bookmark</button>
      <button class="cancel" style="background:none;border:1px solid var(--line);border-radius:8px;padding:8px 14px;cursor:pointer;margin-left:6px" onclick="cancelEdit('${b.id}')">Cancel</button>
    </div>
  </div>`;
}

function snapPanel(b) {
  let html = '';
  if (!b.snapAt) {
    html += `<div class="snap-row">No preserved copy was captured for this bookmark (its page could not be fetched). <button class="linklike" onclick="recapture('${b.id}')">Try to capture now</button></div>`;
  } else if (b.snapType === 'pdf') {
    html += `<div class="snap-row"><strong>Original PDF preserved</strong> · saved ${fmtDate(b.snapAt)} <a class="linklike" href="/snapshots/${b.id}" target="_blank" rel="noopener">Open saved PDF</a></div>`;
  } else {
    html += `<div class="snap-row"><strong>Self-contained page saved</strong> · ${fmtDate(b.snapAt)} <a class="linklike" href="/snapshots/${b.id}" target="_blank" rel="noopener">Open saved copy</a></div>`;
  }
  html += `<div class="snap-row" style="margin-top:8px">Internet Archive: ${b.archiveUrl
    ? `<a href="${esc(b.archiveUrl)}" target="_blank" rel="noopener">view archived copy</a>`
    : `<button class="linklike" onclick="sendArchive('${b.id}')">Send this page to the Internet Archive</button>`}</div>`;
  return html;
}

// ---------- item actions ----------
window.showMore = () => { pageLimit += state.prefs.pageSize; render(); };
window.filterByTag = (tag) => {
  const q = /\s/.test(tag) ? `#"${tag}"` : `#${tag}`;
  query = q; $('search').value = q; syncSearchButtons(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.toggleNote = (id) => { const el = $('note-' + id); if (el) el.hidden = !el.hidden; };
window.toggleSnap = (id) => { const el = $('snap-' + id); if (el) el.hidden = !el.hidden; };
window.toggleSelect = (id) => { if (selected[id]) delete selected[id]; else selected[id] = true; render(); };

async function patch(id, body) {
  const { ok, status, data } = await api('/api/bookmarks/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok, status, data };
}
function replaceLocal(updated) {
  const i = state.bookmarks.findIndex((b) => String(b.id) === String(updated.id));
  if (i >= 0) state.bookmarks[i] = { ...state.bookmarks[i], ...updated };
}
window.toggleStatus = async (id) => {
  const b = state.bookmarks.find((x) => String(x.id) === String(id));
  const { ok, data } = await patch(id, { status: b.status === 'done' ? 'unread' : 'done' });
  if (ok) { replaceLocal(data); render(); }
};
window.archiveItem = async (id) => { const { ok, data } = await patch(id, { archived: true }); if (ok) { replaceLocal(data); render(); } };
window.restoreItem = async (id) => { const { ok, data } = await patch(id, { archived: false }); if (ok) { replaceLocal(data); render(); } };
window.deleteItem = async (id) => {
  const b = state.bookmarks.find((x) => String(x.id) === String(id));
  if (!confirm('Delete this bookmark permanently? This cannot be undone.\n\n' + (b.title || b.url))) return;
  const { ok } = await api('/api/bookmarks/' + id, { method: 'DELETE' });
  if (ok) { state.bookmarks = state.bookmarks.filter((x) => String(x.id) !== String(id)); delete selected[id]; render(); }
};
window.openEditor = (id, scroll) => {
  const b = state.bookmarks.find((x) => String(x.id) === String(id));
  if (!b) return;
  b._editing = true; render();
  if (scroll) { const el = $('bm-' + id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
};
window.cancelEdit = (id) => { const b = state.bookmarks.find((x) => String(x.id) === String(id)); if (b) { delete b._editing; render(); } };
window.saveEdit = async (id) => {
  const body = {
    url: $('e-url-' + id).value.trim(),
    title: $('e-title-' + id).value.trim(),
    description: $('e-desc-' + id).value.trim(),
    tags: parseTagList($('e-tags-' + id).value),
    note: $('e-note-' + id).value.trim(),
  };
  const { ok, status, data } = await patch(id, body);
  if (status === 409 && data && data.existing) {
    const b = state.bookmarks.find((x) => String(x.id) === String(id)); if (b) delete b._editing;
    $('msg').textContent = 'That link is already saved as another bookmark — opening it instead.';
    openEditor(data.existing.id, true);
    return;
  }
  if (ok) { const b = state.bookmarks.find((x) => String(x.id) === String(id)); delete b._editing; replaceLocal(data); render(); }
};
window.recapture = async (id) => {
  $('msg').textContent = 'Trying to capture a copy…';
  const { ok, data } = await api('/api/bookmarks/' + id + '/recapture', { method: 'POST' });
  $('msg').textContent = '';
  if (ok) { replaceLocal(data); render(); const el = $('snap-' + id); if (el) el.hidden = false; }
};
window.sendArchive = async (id) => {
  $('msg').textContent = 'Sending to the Internet Archive…';
  const { ok, data } = await api('/api/bookmarks/' + id + '/archive-web', { method: 'POST' });
  $('msg').textContent = ok ? '' : 'The Internet Archive could not be reached right now.';
  if (ok) { replaceLocal(data); render(); const el = $('snap-' + id); if (el) el.hidden = false; }
};

// ---------- bulk ----------
function updateBulkUI() {
  const bar = $('bulkbar'), saEl = $('selectall');
  const n = selCount();
  saEl.checked = lastShown.length > 0 && lastShown.every((b) => selected[b.id]);
  if (n === 0) { bar.hidden = true; return; }
  bar.hidden = false;
  $('bulkcount').textContent = n + ' selected';
  const acts = $('bulkactions');
  acts.innerHTML = currentTab === 'archived'
    ? `<button onclick="bulkRestore()">Restore</button><button class="danger" onclick="bulkDelete()">Delete permanently</button>`
    : `<button onclick="bulkAddTags()">Add tags…</button><button onclick="bulkRemoveTags()">Remove tags…</button>
       <button onclick="bulkMark('unread')">Mark “To read”</button><button onclick="bulkMark('done')">Mark finished</button>
       <button onclick="bulkArchive()">Archive</button><button class="danger" onclick="bulkDelete()">Delete</button>`;
}
async function bulk(action, payload) {
  const ids = Object.keys(selected);
  const { ok, data } = await api('/api/bookmarks/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, action, payload }) });
  if (ok && data.bookmarks) state.bookmarks = data.bookmarks;
  return ok;
}
window.bulkMark = async (status) => { if (await bulk('mark', { status })) render(); };
window.bulkArchive = async () => { if (await bulk('archive')) { selected = {}; render(); } };
window.bulkRestore = async () => { if (await bulk('restore')) { selected = {}; render(); } };
window.bulkDelete = async () => {
  if (!confirm(`Delete ${selCount()} bookmark(s) permanently? This cannot be undone.`)) return;
  if (await bulk('delete')) { selected = {}; render(); }
};
window.bulkAddTags = () => openBulkTagPanel('add');
window.bulkRemoveTags = () => openBulkTagPanel('remove');
function tagsOnSelected() {
  const seen = {}, out = [];
  selectedItems().forEach((b) => (b.tags || []).forEach((t) => { const k = t.toLowerCase(); if (!seen[k]) { seen[k] = true; out.push(t); } }));
  return out.sort();
}
function openBulkTagPanel(mode) {
  const n = selCount();
  const pool = mode === 'add' ? Object.values(usedTags()).sort() : tagsOnSelected();
  const label = mode === 'add' ? `Add tags to ${n} bookmark(s)` : `Remove tags from ${n} bookmark(s)`;
  const hint = mode === 'add' ? 'Type a tag (suggestions from your existing tags), comma to add another' : 'Pick tags that appear on the selected bookmarks';
  const panel = $('bulktagpanel');
  panel.innerHTML = `<div class="pnl"><span class="pl">${label}</span>
    <input id="btInput" placeholder="${esc(hint)}" autocomplete="off">
    <div class="chips" id="btChips">${pool.length ? pool.map((t) => `<span class="tag" data-t="${esc(t)}">${mode === 'remove' ? '✕ ' : '+ '}${esc(t)}</span>`).join('')
      : `<span style="font-size:.82em;color:#6b7686">${mode === 'remove' ? 'No tags on the selected bookmarks.' : 'No existing tags yet — type a new one.'}</span>`}</div>
    <div class="pnl-actions"><button class="save" id="btApply">${mode === 'add' ? 'Add' : 'Remove'}</button>
    <button class="cancel" id="btCancel">Cancel</button></div></div>`;
  const input = $('btInput'); input.focus();
  $('btChips').querySelectorAll('.tag').forEach((el) => {
    el.onclick = () => { const parts = input.value.split(','); parts[parts.length - 1] = ' ' + el.getAttribute('data-t'); input.value = parts.join(',') + ', '; input.focus(); };
  });
  input.oninput = () => {
    const cur = (input.value.split(',').pop() || '').trim().toLowerCase();
    $('btChips').querySelectorAll('.tag').forEach((el) => { const t = el.getAttribute('data-t').toLowerCase(); el.style.display = (!cur || t.indexOf(cur) >= 0) ? '' : 'none'; });
  };
  $('btApply').onclick = () => applyBulkTags(mode, input.value);
  input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); applyBulkTags(mode, input.value); } };
  $('btCancel').onclick = () => { panel.innerHTML = ''; };
}
async function applyBulkTags(mode, raw) {
  const list = parseTagList(raw);
  if (list.length) await bulk(mode === 'add' ? 'addTags' : 'removeTags', { tags: list });
  $('bulktagpanel').innerHTML = '';
  render();
}

// ---------- tabs / search / sort ----------
$('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab'); if (!btn) return;
  currentTab = btn.getAttribute('data-f');
  [...$('tabs').children].forEach((el) => el.classList.toggle('active', el === btn));
  render();
});
const searchEl = $('search'), clearEl = $('clearsearch'), saveSearchBtn = $('savesearch');
function syncSearchButtons() { clearEl.hidden = !query; saveSearchBtn.disabled = !query.trim(); }
searchEl.addEventListener('input', () => { query = searchEl.value; syncSearchButtons(); render(); });
clearEl.addEventListener('click', () => { query = ''; searchEl.value = ''; syncSearchButtons(); render(); searchEl.focus(); });
$('sortsel').addEventListener('change', function () { currentSort = this.value; render(); });

// ---------- saved searches ----------
saveSearchBtn.addEventListener('click', async () => {
  const q = query.trim(); if (!q) return;
  const name = prompt('Name this saved search:', q); if (name === null) return;
  const { ok, data } = await api('/api/searches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() || q, query: q }) });
  if (ok) { state.savedSearches.push(data); renderSavedSearches(); }
});
function renderSavedSearches() {
  $('savedsearches').innerHTML = state.savedSearches.map((s) =>
    `<span class="savedchip" onclick="runSaved('${s.id}')" title="${esc(s.query)}"><span>★</span>${esc(s.name)}<button class="x" title="Remove" onclick="event.stopPropagation();deleteSaved('${s.id}')">✕</button></span>`).join('');
}
window.runSaved = (id) => {
  const s = state.savedSearches.find((x) => String(x.id) === String(id)); if (!s) return;
  query = s.query; searchEl.value = s.query; syncSearchButtons(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.deleteSaved = async (id) => {
  const { ok } = await api('/api/searches/' + id, { method: 'DELETE' });
  if (ok) { state.savedSearches = state.savedSearches.filter((s) => String(s.id) !== String(id)); renderSavedSearches(); }
};

// ---------- bulk bar controls ----------
$('selectall').addEventListener('change', function () {
  if (this.checked) lastShown.forEach((b) => { selected[b.id] = true; });
  else lastShown.forEach((b) => { delete selected[b.id]; });
  render();
});
$('bulkclear').addEventListener('click', () => { selected = {}; render(); });

// ---------- display preferences ----------
function applyTextSize() { document.body.className = 'text-' + state.prefs.textSize; }
$('prefsBtn').addEventListener('click', () => { $('prefspanel').hidden = !$('prefspanel').hidden; });
$('pref-sort').addEventListener('change', async function () {
  state.prefs.defaultSort = this.value; currentSort = this.value; $('sortsel').value = this.value;
  await api('/api/prefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ defaultSort: this.value }) });
  render();
});
$('pref-page').addEventListener('change', async function () {
  state.prefs.pageSize = this.value === 'all' ? 'all' : parseInt(this.value, 10);
  pageLimit = state.prefs.pageSize === 'all' ? 0 : state.prefs.pageSize; lastSig = '';
  await api('/api/prefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageSize: state.prefs.pageSize }) });
  render();
});
$('pref-text').addEventListener('change', async function () {
  state.prefs.textSize = this.value; applyTextSize();
  await api('/api/prefs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ textSize: this.value }) });
});

// ---------- import / export ----------
$('exportBtn').addEventListener('click', () => { window.location = '/api/export'; });
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    const { ok, data } = await api('/api/import', { method: 'POST', headers: { 'Content-Type': 'text/html' }, body: r.result });
    if (ok) {
      state.bookmarks = data.bookmarks;
      $('msg').textContent = `Imported ${data.added} bookmark(s)` + (data.skipped ? `, skipped ${data.skipped} (duplicates or invalid).` : '.');
      render();
    }
    e.target.value = '';
  };
  r.readAsText(f);
});

// ---------- init ----------
async function refreshState() {
  const { ok, data } = await api('/api/state');
  if (!ok) return;
  const editing = new Set(state.bookmarks.filter((b) => b._editing).map((b) => String(b.id)));
  state.bookmarks = data.bookmarks.map((b) => editing.has(String(b.id)) ? { ...b, _editing: true } : b);
  state.savedSearches = data.savedSearches;
  state.prefs = data.prefs;
  render();
}
async function init() {
  const { data } = await api('/api/state');
  if (data) { state.bookmarks = data.bookmarks; state.savedSearches = data.savedSearches; state.prefs = { ...state.prefs, ...data.prefs }; }
  currentSort = state.prefs.defaultSort;
  pageLimit = state.prefs.pageSize === 'all' ? 0 : state.prefs.pageSize;
  $('sortsel').value = currentSort;
  $('pref-sort').value = state.prefs.defaultSort;
  $('pref-page').value = String(state.prefs.pageSize);
  $('pref-text').value = state.prefs.textSize;
  applyTextSize();
  renderSavedSearches();
  render();
  document.body.setAttribute('data-harness-ready', 'true');
}
init();
