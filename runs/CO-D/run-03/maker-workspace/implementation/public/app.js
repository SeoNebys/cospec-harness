'use strict';
/* Bookmarks app frontend — implements approved scenarios SCN-001..017. */

const api = {
  async get(url) { const r = await fetch(url); return r.json(); },
  async send(method, url, body) {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return r.json();
  },
  post(u, b) { return this.send('POST', u, b); },
  put(u, b) { return this.send('PUT', u, b); },
  del(u) { return this.send('DELETE', u); }
};

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg, kind) { const t = document.createElement('div'); t.className = 'toast' + (kind ? ' ' + kind : ''); t.textContent = msg; $('#toastRoot').appendChild(t); setTimeout(() => t.remove(), 2600); }

/* ---------- markdown subset for notes ---------- */
function renderNote(src) {
  const lines = String(src || '').split(/\r?\n/); let out = ''; let inList = false;
  const inline = s => esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  for (const ln of lines) {
    if (/^###\s+/.test(ln)) { if (inList) { out += '</ul>'; inList = false; } out += '<h3>' + inline(ln.replace(/^###\s+/, '')) + '</h3>'; }
    else if (/^[-*]\s+/.test(ln)) { if (!inList) { out += '<ul>'; inList = true; } out += '<li>' + inline(ln.replace(/^[-*]\s+/, '')) + '</li>'; }
    else if (ln.trim() === '') { if (inList) { out += '</ul>'; inList = false; } }
    else { if (inList) { out += '</ul>'; inList = false; } out += '<p>' + inline(ln) + '</p>'; }
  }
  if (inList) out += '</ul>';
  return out;
}
function favColor(seed) { let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

/* ---------- app state ---------- */
const state = {
  scope: 'all',            // all | toread | finished | archived
  collection: null,        // collection object or null
  query: '',
  sort: 'newest',
  prefs: { text_size: 'medium', density: 'comfortable', per_load: 50, default_sort: 'newest' },
  items: [], total: 0, offset: 0, loading: false,
  selected: new Set(), selectAllMatching: false,
  collections: []
};

function effectiveParams(extra = {}) {
  const parts = [];
  if (state.collection) {
    if (state.collection.text) parts.push(state.collection.text);
    for (const t of state.collection.inc || []) parts.push('#' + t);
    for (const t of state.collection.exc || []) parts.push('NOT #' + t);
  }
  if (state.query) parts.push(state.query);
  const archived = state.scope === 'archived';
  return {
    query: parts.join(' '),
    status: archived ? 'all' : state.scope,
    archived: archived ? '1' : '0',
    sort: state.sort,
    ...extra
  };
}
function qs(obj) { return Object.entries(obj).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'); }

/* ---------- loading / rendering ---------- */
async function reload() {
  state.offset = 0; state.items = [];
  state.selected.clear(); state.selectAllMatching = false;
  await loadMore(true);
  renderSidebarCounts();
  renderBulkBar();
}
async function loadMore(reset = false) {
  if (state.loading) return;
  state.loading = true;
  $('#loadingMore').hidden = state.offset === 0;
  const params = effectiveParams({ offset: state.offset, limit: state.prefs.per_load });
  const data = await api.get('/api/bookmarks?' + qs(params));
  state.total = data.total;
  state.items = reset ? data.items : state.items.concat(data.items);
  state.offset = state.items.length;
  state.loading = false;
  $('#loadingMore').hidden = true;
  renderList();
}
function statusBadge(b) {
  if (b.archived) return '<span class="badge archived">Archived</span>';
  return b.status === 'finished' ? '<span class="badge finished">Finished</span>' : '<span class="badge toread">To read</span>';
}
function favHtml(b) {
  if (b.favicon) return `<img class="fav" src="${esc(b.favicon)}" onerror="this.replaceWith(document.createRange().createContextualFragment('<span class=&quot;fav&quot;></span>'))"/>`;
  const h = favColor(b.site || b.url);
  return `<span class="fav" style="background:hsl(${h} 60% 60%);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:.6rem;font-weight:700">${esc((b.site || '?')[0].toUpperCase())}</span>`;
}
function cardHtml(b) {
  const on = state.selectAllMatching || state.selected.has(b.id);
  const preview = b.preview_image
    ? `<div class="preview" data-open="${b.id}" style="background-image:url('${esc(b.preview_image)}')"></div>`
    : `<div class="preview ph">No preview image</div>`;
  const copyBadge = b.copy.status === 'saved' ? '<span class="copybadge saved">Copy saved</span>'
    : b.copy.status === 'pending' ? '<span class="copybadge pending">Saving copy…</span>'
    : b.copy.status === 'failed' ? '<span class="copybadge failed">Copy failed</span>' : '';
  return `<div class="card ${on ? 'sel' : ''}" data-card="${b.id}">
    <div class="check"><input type="checkbox" data-sel="${b.id}" ${on ? 'checked' : ''} ${state.selectAllMatching ? 'disabled' : ''}/></div>
    <div class="inner">
      ${preview}
      <div class="cbody">
        <div class="title"><a class="title-link" data-open="${b.id}">${esc(b.title)}</a></div>
        ${b.description ? `<div class="desc">${esc(b.description)}</div>` : ''}
        ${b.note ? `<div class="note">${renderNote(b.note)}</div>` : ''}
        ${b.tags.length ? `<div class="tags">${b.tags.map(t => `<button class="chip" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
        <div class="meta">${favHtml(b)}<span>${esc(b.site)}</span> ${statusBadge(b)} ${copyBadge}
          <a class="urllink" data-open="${b.id}">${esc(b.url)}</a></div>
        <div class="rowacts">
          <button class="act open" data-open="${b.id}">↗ Open page</button>
          <button class="act" data-edit="${b.id}">✎ Edit</button>
          <button class="act" data-detail="${b.id}">🗂 Saved copy</button>
          ${b.archived ? `<button class="act" data-restore="${b.id}">↩ Restore</button>` : `<button class="act" data-arch="${b.id}">🗄 Archive</button>`}
          <button class="act danger" data-del="${b.id}">🗑 Delete</button>
        </div>
      </div>
    </div></div>`;
}
function renderList() {
  const list = $('#list');
  if (state.total === 0) { list.innerHTML = ''; showEmpty(); }
  else { $('#emptyState').hidden = true; list.innerHTML = state.items.map(cardHtml).join(''); }
  // count line
  const label = { newest: 'Newest added', oldest: 'Oldest added', updated: 'Recently updated', az: 'Title A–Z', za: 'Title Z–A' }[state.sort];
  const where = state.collection ? ` · <b>${esc(state.collection.name)}</b>` : '';
  const q = state.query ? ` · matching “${esc(state.query)}”` : '';
  $('#count').innerHTML = `${state.total} bookmark${state.total === 1 ? '' : 's'} · sorted by ${label}${where}${q}`;
  bindCardEvents();
  renderMatchBanner();
}
function showEmpty() {
  const e = $('#emptyState'); e.hidden = false;
  if (state.query || state.collection) e.innerHTML = `<span class="ic">🔍</span><h3>Nothing matches</h3><div>Try a different word, a #tag, or fewer conditions.</div>`;
  else if (state.scope === 'toread') e.innerHTML = `<span class="ic">✅</span><h3>You're all caught up</h3><div>Nothing left to read. Switch to All or Finished to see the rest.</div>`;
  else if (state.scope === 'finished') e.innerHTML = `<span class="ic">📁</span><h3>Nothing finished yet</h3><div>Mark bookmarks as read to see them here.</div>`;
  else if (state.scope === 'archived') e.innerHTML = `<span class="ic">🗄</span><h3>No archived bookmarks</h3><div>Archiving keeps a link without cluttering your main list — you can always restore it.</div>`;
  else e.innerHTML = `<span class="ic">🔖</span><h3>Save your first bookmark</h3><div>Paste any link in the box above and press Save. I'll fill in its details and let you add tags and a note.</div>`;
}
function bindCardEvents() {
  $('#list').querySelectorAll('[data-open]').forEach(el => el.onclick = e => { e.preventDefault(); const b = byId(+el.dataset.open); if (b) window.open(b.url, '_blank', 'noopener'); });
  $('#list').querySelectorAll('[data-tag]').forEach(el => el.onclick = () => { $('#search').value = '#' + el.dataset.tag; state.query = '#' + el.dataset.tag; reload(); });
  $('#list').querySelectorAll('[data-edit]').forEach(el => el.onclick = () => openEdit(+el.dataset.edit));
  $('#list').querySelectorAll('[data-detail]').forEach(el => el.onclick = () => openDetail(+el.dataset.detail));
  $('#list').querySelectorAll('[data-arch]').forEach(el => el.onclick = async () => { await api.post(`/api/bookmarks/${el.dataset.arch}/archive`); toast('Archived.'); reload(); });
  $('#list').querySelectorAll('[data-restore]').forEach(el => el.onclick = async () => { await api.post(`/api/bookmarks/${el.dataset.restore}/restore`); toast('Restored.'); reload(); });
  $('#list').querySelectorAll('[data-del]').forEach(el => el.onclick = () => confirmDelete([+el.dataset.del]));
  $('#list').querySelectorAll('[data-sel]').forEach(el => el.onchange = () => { const id = +el.dataset.sel; if (el.checked) state.selected.add(id); else state.selected.delete(id); state.selectAllMatching = false; renderList(); renderBulkBar(); });
}
const byId = (id) => state.items.find(b => b.id === id);

/* ---------- selection / bulk (SCN-012) ---------- */
function selCount() { return state.selectAllMatching ? state.total : state.selected.size; }
function renderMatchBanner() {
  const el = $('#matchBanner');
  const allPage = state.items.length > 0 && state.items.every(b => state.selected.has(b.id));
  if (state.selectAllMatching) {
    el.innerHTML = `<div class="matchbanner"><span>✔ All <b>${state.total}</b> matching bookmarks selected (every page).</span><span class="link" id="clearMatch">Clear selection</span></div>`;
    $('#clearMatch').onclick = () => { state.selectAllMatching = false; state.selected.clear(); renderList(); renderBulkBar(); };
  } else if (allPage && state.total > state.items.length) {
    el.innerHTML = `<div class="matchbanner"><span>✔ All ${state.items.length} on this page selected.</span><span class="link" id="selMatch">Select all ${state.total} that match</span></div>`;
    $('#selMatch').onclick = () => { state.selectAllMatching = true; renderList(); renderBulkBar(); };
  } else el.innerHTML = '';
}
function renderBulkBar() {
  const n = selCount(); const bar = $('#bulkBar');
  if (n === 0) { bar.hidden = true; bar.innerHTML = ''; return; }
  bar.hidden = false;
  bar.innerHTML = `<span class="nsel">${n} selected</span>
    <button data-b="addTags">＋ Add tags</button><button data-b="removeTags">－ Remove tags</button>
    <button data-b="markRead">✓ Mark read</button><button data-b="markUnread">📖 Mark unread</button>
    <button data-b="archive">🗄 Archive</button><button data-b="delete" class="danger">🗑 Delete</button>
    <button class="x" id="bulkClose">✕</button>`;
  bar.querySelectorAll('[data-b]').forEach(el => el.onclick = () => bulkAction(el.dataset.b));
  $('#bulkClose').onclick = () => { state.selected.clear(); state.selectAllMatching = false; renderList(); renderBulkBar(); };
}
function selection() { return state.selectAllMatching ? { match: effectiveParams() } : { ids: [...state.selected] }; }
async function bulkAction(action) {
  const n = selCount();
  if (action === 'delete') { confirmDelete(null, n); return; }
  if (action === 'addTags' || action === 'removeTags') { openBulkTags(action, n); return; }
  await api.post('/api/bookmarks/bulk', { action, ...selection() });
  toast(`${action === 'markRead' ? 'Marked read' : action === 'markUnread' ? 'Marked unread' : 'Archived'}: ${n} bookmarks.`, 'good');
  reload();
}

/* ---------- tag widget (SCN-002) ---------- */
function tagWidget(mount, tags) {
  let typed = '';
  async function draw() {
    let sugg = [];
    if (typed.trim()) { const r = await api.get('/api/tags?q=' + encodeURIComponent(typed.trim())); sugg = r.tags.filter(t => !tags.includes(t)); }
    const exact = sugg.some(s => s.toLowerCase() === typed.trim().toLowerCase());
    mount.innerHTML = `<div class="chipbox">${tags.map(t => `<span class="tchip">${esc(t)}<span class="x" data-x="${esc(t)}">×</span></span>`).join('')}<input placeholder="type a tag…" value="${esc(typed)}"/></div>${typed.trim() ? `<div class="suggest">${sugg.map(s => `<span class="sug" data-s="${esc(s)}">${esc(s)}</span>`).join('')}${exact ? '' : `<span class="sug new" data-new="1">+ Create “${esc(typed.trim())}”</span>`}</div>` : ''}`;
    const input = mount.querySelector('input'); input.focus(); input.setSelectionRange(input.value.length, input.value.length);
    input.oninput = () => { typed = input.value; draw(); };
    input.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const v = input.value.trim(); if (v && !tags.includes(v)) tags.push(v); typed = ''; draw(); } };
    mount.querySelectorAll('.sug').forEach(s => s.onclick = () => { const v = s.dataset.new ? typed.trim() : s.dataset.s; if (v && !tags.includes(v)) tags.push(v); typed = ''; draw(); });
    mount.querySelectorAll('[data-x]').forEach(x => x.onclick = () => { const i = tags.indexOf(x.dataset.x); if (i >= 0) tags.splice(i, 1); draw(); });
  }
  draw();
}

/* ---------- modal helper ---------- */
function openModal(html, wide) {
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}</div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  $('#modalRoot').appendChild(ov);
  const close = () => ov.remove();
  ov.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
  return { ov, close, q: (s) => ov.querySelector(s) };
}

/* ---------- save flow (SCN-001/006/007) ---------- */
async function doSave() {
  const url = $('#saveUrl').value.trim();
  if (!url) return;
  $('#saveBtn').disabled = true; $('#saveBtn').textContent = '…';
  const res = await api.post('/api/preview', { url });
  $('#saveBtn').disabled = false; $('#saveBtn').textContent = 'Save';
  if (res.error) { toast("That doesn't look like a link — please check it.", 'bad'); return; }
  $('#saveUrl').value = '';
  if (res.duplicate) { toast('You already saved this — opening it to edit.'); openEdit(res.bookmark.id, res.bookmark); return; }
  openReview(res.draft);
}
function fieldsFormHtml(v, { showUrl = false, showStatus = true } = {}) {
  return `
    ${showUrl ? `<label class="fl">Link (web address)</label><input class="in" id="fUrl" value="${esc(v.url)}"/>` : ''}
    <label class="fl">Title</label><input class="in" id="fTitle" value="${esc(v.title)}"/>
    <label class="fl">Description</label><input class="in" id="fDesc" value="${esc(v.description || '')}"/>
    <label class="fl">Tags</label><div id="fTags"></div>
    <label class="fl">Your note <span style="font-weight:400;color:#9aa2ad">— why you saved it</span></label>
    <div class="noteedit"><div class="col"><div class="plabel">You type</div><textarea class="in" id="fNote">${esc(v.note || '')}</textarea></div>
      <div class="col"><div class="plabel">Live preview</div><div class="pv" id="fNotePv"></div></div></div>
    ${showStatus ? `<label class="fl">Add to</label><div class="choice" id="fStatus">
      <button type="button" class="toread ${v.status !== 'finished' ? 'sel' : ''}" data-s="toread">📖 To read</button>
      <button type="button" class="finished ${v.status === 'finished' ? 'sel' : ''}" data-s="finished">✓ Finished</button></div>
      <div class="hintline" id="fStatusHint"></div>` : ''}`;
}
function wireFields(m, v) {
  const tags = [...(v.tags || [])];
  tagWidget(m.q('#fTags'), tags);
  const note = m.q('#fNote'), pv = m.q('#fNotePv');
  const upd = () => pv.innerHTML = renderNote(note.value); note.oninput = upd; upd();
  let status = v.status === 'finished' ? 'finished' : 'toread';
  const hint = m.q('#fStatusHint');
  const paintStatus = () => {
    if (!m.q('#fStatus')) return;
    m.q('#fStatus').querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.s === status));
    if (hint) hint.innerHTML = status === 'toread' ? 'Kept in your <b>To read</b> view until you mark it finished.' : "Saved to <b>Finished</b> — it won't appear in To read.";
  };
  if (m.q('#fStatus')) { m.q('#fStatus').querySelectorAll('button').forEach(b => b.onclick = () => { status = b.dataset.s; paintStatus(); }); paintStatus(); }
  return { collect: () => ({
    url: m.q('#fUrl') ? m.q('#fUrl').value.trim() : undefined,
    title: m.q('#fTitle').value.trim(), description: m.q('#fDesc').value.trim(),
    note: note.value, tags, status
  }) };
}
function openReview(draft) {
  const banner = draft.preview_image ? `<div class="banner" style="background-image:url('${esc(draft.preview_image)}')"></div>` : `<div class="banner ph">No preview available</div>`;
  const warn = draft.readable ? '' : `<div class="warnbar"><span>⚠️</span><span>I couldn't read this page's details (it may be offline, private, or blocking access). Nothing was made up — you can still save the link and fill in the details yourself.</span></div>`;
  const m = openModal(`<div class="mhead"><h3>Review before saving</h3><button class="x" data-close>×</button></div>
    <div class="mbody">${banner}${warn}<div class="meta" style="color:var(--muted);font-size:.8rem;margin-bottom:6px">${esc(draft.site)}${draft.isPdf ? ' · PDF' : ''}</div>
    ${fieldsFormHtml(draft)}
    <div class="mactions"><button class="btn primary" id="doCreate">Save bookmark</button><button class="btn" data-close>Cancel</button></div></div>`);
  const f = wireFields(m, draft);
  m.q('#doCreate').onclick = async () => {
    const data = f.collect(); data.url = draft.url; data.favicon = draft.favicon; data.preview_image = draft.preview_image;
    const res = await api.post('/api/bookmarks', data);
    if (res.duplicate) { toast('Already saved — opening it.'); m.close(); openEdit(res.bookmark.id); return; }
    m.close(); toast('Saved.', 'good'); reload();
  };
}
async function openEdit(id, known) {
  const b = known || await api.get('/api/bookmarks/' + id);
  const m = openModal(`<div class="mhead"><h3>Edit bookmark</h3><button class="x" data-close>×</button></div>
    <div class="mbody">${fieldsFormHtml(b, { showUrl: true })}
    <div class="mactions"><button class="btn primary" id="doSaveEdit">Save changes</button><button class="btn" data-close>Cancel</button></div></div>`);
  const f = wireFields(m, b);
  m.q('#doSaveEdit').onclick = async () => {
    const res = await api.put('/api/bookmarks/' + id, f.collect());
    if (res && res.error === 'duplicate_url') { toast('Another bookmark already uses that link.', 'bad'); return; }
    m.close(); toast('Updated.', 'good'); reload();
  };
}

/* ---------- detail: preserved copy + Internet Archive (SCN-013) ---------- */
async function openDetail(id) {
  const b = await api.get('/api/bookmarks/' + id);
  const copyDot = { saved: 'ok', pending: 'pending', failed: 'failed', none: 'none' }[b.copy.status] || 'none';
  const copyLine = b.copy.status === 'saved'
    ? `<div class="statusline"><span class="dot ok"></span><span>${b.copy.kind === 'pdf' ? 'Original <b>PDF</b> preserved' : 'Self-contained page copy kept'}${b.copy.size ? ' · ' + (b.copy.size / 1024 | 0) + ' KB' : ''}</span></div>
       <div class="mactions" style="margin-top:0"><a class="btn primary" href="/api/bookmarks/${id}/copy" target="_blank" rel="noopener">👁 View saved copy</a><a class="btn" href="/api/bookmarks/${id}/copy" download>⬇ Download</a><button class="btn" id="retryCopy">↻ Refresh copy</button></div>`
    : b.copy.status === 'pending'
    ? `<div class="statusline"><span class="dot pending"></span><span><span class="spin"></span> Saving a copy of this page… (you can keep working)</span></div>`
    : `<div class="statusline"><span class="dot failed"></span><span>Couldn't save a copy (the page blocked access or was unreachable).</span></div>
       <div class="mactions" style="margin-top:0"><button class="btn primary" id="retryCopy">Try again</button><button class="btn" id="openLive2">Open the live page</button></div>`;
  const iaLine = b.ia.status === 'saved'
    ? `<div class="statusline"><span class="dot ok"></span><span>Saved to the Internet Archive</span></div><div class="mactions" style="margin-top:0"><a class="btn" href="${esc(b.ia.url)}" target="_blank" rel="noopener">🌐 View on web.archive.org</a></div>`
    : b.ia.status === 'pending'
    ? `<div class="statusline"><span class="dot pending"></span><span><span class="spin"></span> Submitting to the Internet Archive… this can take a while; I'll show the link when done. If archive.org is unavailable, retry later.</span></div>`
    : b.ia.status === 'failed'
    ? `<div class="statusline"><span class="dot failed"></span><span>The Internet Archive didn't accept it (it may be unavailable). You can retry.</span></div><div class="mactions" style="margin-top:0"><button class="btn primary" id="iaBtn">🌐 Try again</button></div>`
    : `<p class="hintline">Optionally keep a public copy in the Internet Archive too.</p><div class="mactions" style="margin-top:0"><button class="btn primary" id="iaBtn">🌐 Save a copy to the Internet Archive</button></div><p class="hintline">This sends the page's address to archive.org, a third-party service — only when you choose it.</p>`;
  const m = openModal(`<div class="mhead"><h3>${esc(b.title)}</h3><button class="x" data-close>×</button></div>
    <div class="mbody"><div class="meta" style="color:var(--muted);font-size:.8rem;margin-bottom:8px">${esc(b.url)}</div>
      <div class="mactions" style="margin-top:0"><button class="btn" id="openLive">↗ Open live page</button></div>
      <div class="panelbox"><h4>📥 Your saved copy</h4>${copyLine}</div>
      <div class="panelbox"><h4>🌐 Internet Archive <span style="font-weight:400;color:var(--muted);font-size:.8rem">(optional)</span></h4>${iaLine}</div></div>`);
  const openLive = () => window.open(b.url, '_blank', 'noopener');
  m.q('#openLive').onclick = openLive; if (m.q('#openLive2')) m.q('#openLive2').onclick = openLive;
  if (m.q('#retryCopy')) m.q('#retryCopy').onclick = async () => { await api.post(`/api/bookmarks/${id}/copy/retry`); toast('Re-saving copy…'); m.close(); };
  if (m.q('#iaBtn')) m.q('#iaBtn').onclick = async () => { await api.post(`/api/bookmarks/${id}/internet-archive`); toast('Submitting to the Internet Archive…'); m.close(); };
}

/* ---------- delete confirm (SCN-005/012) ---------- */
function confirmDelete(ids, bulkN) {
  const n = bulkN != null ? bulkN : ids.length;
  const m = openModal(`<div class="mhead"><h3>🗑 Delete ${n} bookmark${n === 1 ? '' : 's'} permanently?</h3><button class="x" data-close>×</button></div>
    <div class="mbody"><p>This can't be undone — the bookmark${n === 1 ? ', its' : 's, their'} tags and note${n === 1 ? '' : 's'} are removed for good.</p>
    <div class="warnbar" style="color:#41495a;background:#f5f7fa;border-color:var(--line)">Just want ${n === 1 ? 'it' : 'them'} out of your main list? Use <b>Archive</b> instead — that keeps ${n === 1 ? 'it' : 'them'} and can be restored anytime.</div>
    <div class="mactions"><button class="btn" data-close>Cancel</button><button class="btn danger" id="doDel">Delete ${n} permanently</button></div></div>`);
  m.q('#doDel').onclick = async () => {
    if (bulkN != null) await api.post('/api/bookmarks/bulk', { action: 'delete', ...selection() });
    else await api.del('/api/bookmarks/' + ids[0]);
    m.close(); toast(`Deleted ${n}.`); reload();
  };
}
function openBulkTags(action, n) {
  const tags = [];
  const m = openModal(`<div class="mhead"><h3>${action === 'addTags' ? 'Add tags to' : 'Remove tags from'} ${n} bookmarks</h3><button class="x" data-close>×</button></div>
    <div class="mbody"><label class="fl">Tags</label><div id="btTags"></div>
    <div class="mactions"><button class="btn primary" id="applyBt">Apply to ${n}</button><button class="btn" data-close>Cancel</button></div></div>`);
  tagWidget(m.q('#btTags'), tags);
  m.q('#applyBt').onclick = async () => { if (!tags.length) { m.close(); return; } await api.post('/api/bookmarks/bulk', { action, tags, ...selection() }); m.close(); toast(`Updated tags on ${n} bookmarks.`, 'good'); reload(); };
}

/* ---------- collections (SCN-014) ---------- */
async function loadCollections() { const r = await api.get('/api/collections'); state.collections = r.collections; renderCollNav(); }
function renderCollNav() {
  const nav = $('#collNav');
  nav.innerHTML = state.collections.map(c => `<button class="collitem ${state.collection && state.collection.id === c.id ? 'active' : ''}" data-coll="${c.id}">
    <span>${esc(c.name)}<span class="sub">${c.text ? '“' + esc(c.text) + '” ' : ''}${(c.inc || []).map(t => '#' + esc(t)).join(' ')} ${(c.exc || []).map(t => '−#' + esc(t)).join(' ')}</span></span>
    <span class="cnt" data-delcoll="${c.id}" title="Delete collection">✕</span></button>`).join('') || '<div style="font-size:.8rem;color:var(--muted);padding:4px 10px">No collections yet.</div>';
  nav.querySelectorAll('[data-coll]').forEach(el => el.onclick = (e) => { if (e.target.dataset.delcoll) return; const c = state.collections.find(x => x.id === +el.dataset.coll); state.collection = c; state.scope = 'all'; renderStatusNav(); reload(); renderCollNav(); });
  nav.querySelectorAll('[data-delcoll]').forEach(el => el.onclick = async (e) => { e.stopPropagation(); await api.del('/api/collections/' + el.dataset.delcoll); if (state.collection && state.collection.id === +el.dataset.delcoll) state.collection = null; loadCollections(); reload(); });
}
function openNewCollection() {
  const inc = [], exc = [];
  const m = openModal(`<div class="mhead"><h3>New collection</h3><button class="x" data-close>×</button></div>
    <div class="mbody"><label class="fl">Name</label><input class="in" id="cName" placeholder="e.g. Reading, no desserts"/>
    <label class="fl">Search text</label><input class="in" id="cText" placeholder="optional words"/>
    <label class="fl">Include tags <span style="font-weight:400;color:#9aa2ad">— must have all</span></label><div id="cInc"></div>
    <label class="fl">Exclude tags <span style="font-weight:400;color:#9aa2ad">— hide any with these</span></label><div id="cExc"></div>
    <div class="mactions"><button class="btn primary" id="cSave">Save collection</button><button class="btn" data-close>Cancel</button></div></div>`);
  tagWidget(m.q('#cInc'), inc); tagWidget(m.q('#cExc'), exc);
  m.q('#cSave').onclick = async () => { const name = m.q('#cName').value.trim(); if (!name) { toast('Please name the collection.', 'bad'); return; } await api.post('/api/collections', { name, text: m.q('#cText').value.trim(), inc, exc }); m.close(); toast('Collection saved.', 'good'); loadCollections(); };
}

/* ---------- preferences (SCN-016) ---------- */
function applyPrefs() { document.body.dataset.text = state.prefs.text_size; document.body.dataset.density = state.prefs.density; }
async function savePref(patch) { Object.assign(state.prefs, patch); state.prefs = await api.put('/api/preferences', patch); applyPrefs(); }
function openPrefs() {
  const p = state.prefs;
  const seg = (name, opts, cur) => `<div class="choice" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" class="${v === cur ? 'sel toread' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const m = openModal(`<div class="mhead"><h3>Display preferences</h3><button class="x" data-close>×</button></div>
    <div class="mbody">
      <label class="fl">Text size</label>${seg('text_size', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']], p.text_size)}
      <label class="fl">List density</label>${seg('density', [['comfortable', 'Comfortable'], ['compact', 'Compact']], p.density)}
      <label class="fl">Items per load</label><select class="in" id="pPer"><option ${p.per_load == 20 ? 'selected' : ''}>20</option><option ${p.per_load == 50 ? 'selected' : ''}>50</option><option ${p.per_load == 100 ? 'selected' : ''}>100</option></select>
      <label class="fl">Default sort order</label><select class="in" id="pSort">
        <option value="newest">Newest added</option><option value="oldest">Oldest added</option><option value="updated">Recently updated</option><option value="az">Title A–Z</option><option value="za">Title Z–A</option></select>
      <div class="hintline" id="pSaved">Preferences save automatically as you change them.</div>
    </div>`);
  m.q('#pSort').value = p.default_sort;
  m.ov.querySelectorAll('[data-seg]').forEach(seggroup => seggroup.querySelectorAll('button').forEach(btn => btn.onclick = async () => {
    seggroup.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b === btn)); seggroup.querySelectorAll('button').forEach(b => b.classList.toggle('toread', b === btn));
    await savePref({ [seggroup.dataset.seg]: btn.dataset.v }); m.q('#pSaved').textContent = '✓ Saved.'; reload();
  }));
  m.q('#pPer').onchange = async e => { await savePref({ per_load: +e.target.value }); m.q('#pSaved').textContent = '✓ Saved.'; reload(); };
  m.q('#pSort').onchange = async e => { await savePref({ default_sort: e.target.value }); state.sort = e.target.value; $('#sort').value = e.target.value; m.q('#pSaved').textContent = '✓ Saved.'; reload(); };
}

/* ---------- import / export (SCN-015) ---------- */
function openImportExport() {
  const m = openModal(`<div class="mhead"><h3>Import &amp; export</h3><button class="x" data-close>×</button></div>
    <div class="mbody">
      <div class="panelbox"><h4>⬆ Import bookmarks</h4>
        <p class="hintline">Choose a bookmarks HTML file exported from a browser or another bookmark app.</p>
        <input type="file" id="impFile" accept=".html,.htm,text/html"/>
        <div id="impPreview"></div>
      </div>
      <div class="panelbox"><h4>⬇ Export your library</h4>
        <div class="scope"><label><input type="radio" name="scope" value="all" checked/> Entire library</label>
          <label><input type="radio" name="scope" value="view"/> Current view/collection</label>
          <label><input type="radio" name="scope" value="all-archived"/> Include archived</label></div>
        <p class="hintline">Keeps title, tags, and original save date (standard fields), plus your note, reading status, and archive status as compatible extras.</p>
        <div class="mactions" style="margin-top:8px"><button class="btn primary" id="expBtn">⬇ Export bookmarks file</button></div>
      </div>
    </div>`);
  let file = null;
  m.q('#impFile').onchange = async e => {
    file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch('/api/import/preview', { method: 'POST', body: fd }).then(x => x.json());
    if (!r.ok) { m.q('#impPreview').innerHTML = `<div class="warnbar" style="margin-top:12px">This file doesn't look like a bookmarks file, so nothing will be imported. Your library is unchanged.</div>`; return; }
    m.q('#impPreview').innerHTML = `<div class="panelbox" style="margin-top:12px">
      <div class="statusline"><span class="dot ok"></span>Found ${r.total} bookmarks. <b>${r.neu} new</b>, ${r.existed} already in your library (skipped), ${r.skipped} without a valid address (skipped).</div>
      <div class="opt"><input type="checkbox" id="impFolders" checked/><label for="impFolders">Turn browser folders into tags</label></div>
      <div class="opt"><input type="checkbox" id="impToRead"/><label for="impToRead">Add imported bookmarks to To read <span style="color:var(--muted)">(off by default)</span></label></div>
      <div class="mactions" style="margin-top:12px"><button class="btn primary" id="impGo">Import ${r.neu} bookmarks</button></div></div>`;
    m.q('#impGo').onclick = async () => {
      const fd2 = new FormData(); fd2.append('file', file);
      fd2.append('folderTags', m.q('#impFolders').checked ? 'true' : 'false');
      fd2.append('addToRead', m.q('#impToRead').checked ? 'true' : 'false');
      const res = await fetch('/api/import', { method: 'POST', body: fd2 }).then(x => x.json());
      if (!res.ok) { toast('Import failed.', 'bad'); return; }
      m.close(); toast(`Imported ${res.imported} (${res.existed} already existed, ${res.skipped} skipped).`, 'good'); reload();
    };
  };
  m.q('#expBtn').onclick = () => {
    const scope = m.ov.querySelector('input[name=scope]:checked').value;
    const p = effectiveParams();
    const url = '/api/export?scope=' + scope + '&' + qs(p);
    const a = document.createElement('a'); a.href = url; a.download = 'bookmarks.html'; a.click();
  };
}

/* ---------- sidebar nav ---------- */
function renderStatusNav() {
  const items = [['all', 'All'], ['toread', 'To read'], ['finished', 'Finished'], ['archived', 'Archived']];
  $('#statusNav').innerHTML = items.map(([v, l]) => `<button class="${!state.collection && state.scope === v ? 'active' : ''}" data-scope="${v}">${l}<span class="cnt" id="cnt-${v}"></span></button>`).join('');
  $('#statusNav').querySelectorAll('[data-scope]').forEach(el => el.onclick = () => { state.scope = el.dataset.scope; state.collection = null; renderCollNav(); renderStatusNav(); reload(); });
}
async function renderSidebarCounts() {
  for (const v of ['all', 'toread', 'finished', 'archived']) {
    const params = { query: '', status: v === 'archived' ? 'all' : v, archived: v === 'archived' ? '1' : '0', sort: 'newest', limit: 1, offset: 0 };
    const d = await api.get('/api/bookmarks?' + qs(params));
    const el = $('#cnt-' + v); if (el) el.textContent = d.total;
  }
}

/* ---------- events + init ---------- */
let searchTimer;
function init() {
  $('#saveBtn').onclick = doSave;
  $('#saveUrl').addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });
  $('#search').addEventListener('input', e => { clearTimeout(searchTimer); const v = e.target.value; searchTimer = setTimeout(() => { state.query = v.trim(); reload(); }, 220); });
  $('#searchClear').onclick = () => { $('#search').value = ''; state.query = ''; reload(); };
  $('#sort').onchange = e => { state.sort = e.target.value; reload(); };
  $('#selPage').onchange = e => { if (e.target.checked) state.items.forEach(b => state.selected.add(b.id)); else { state.selected.clear(); state.selectAllMatching = false; } renderList(); renderBulkBar(); };
  $('#prefsBtn').onclick = openPrefs;
  $('#importBtn').onclick = openImportExport;
  $('#newCollBtn').onclick = openNewCollection;
  // infinite scroll
  const io = new IntersectionObserver(entries => { if (entries[0].isIntersecting && state.items.length < state.total && !state.loading) loadMore(); });
  io.observe($('#sentinel'));

  bootstrap();
}
async function bootstrap() {
  state.prefs = await api.get('/api/preferences');
  state.sort = state.prefs.default_sort;
  $('#sort').value = state.sort;
  applyPrefs();
  renderStatusNav();
  await loadCollections();
  await reload();
  document.body.setAttribute('data-harness-ready', 'true');
}
init();
