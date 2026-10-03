// Browser client for My Bookmarks. Talks to the JSON API and renders the
// collection. Shared, testable data logic lives in /shared/filters.js.

import { filterItems, allTopics, archivedCount } from '/shared/filters.js';

const $ = (id) => document.getElementById(id);
const els = {
  app: $('app'),
  saveCard: $('saveCard'),
  saveHeading: $('saveHeading'),
  form: $('saveForm'),
  url: $('url'),
  fieldStatus: $('fieldStatus'),
  details: $('details'),
  title: $('title'),
  description: $('description'),
  note: $('note'),
  topicInput: $('topicInput'),
  topicSuggestions: $('topicSuggestions'),
  editChips: $('editChips'),
  saveBtn: $('saveBtn'),
  cancelBtn: $('cancelBtn'),
  listHeading: $('listHeading'),
  archiveToggle: $('archiveToggle'),
  search: $('search'),
  statusSeg: $('statusSeg'),
  archiveNote: $('archiveNote'),
  topicsBar: $('topicsBar'),
  count: $('count'),
  list: $('list'),
};

const state = {
  items: [],
  scope: 'collection', // 'collection' | 'archive'
  status: 'all', // 'all' | 'unread' | 'read'
  topic: 'All',
  query: '',
  editingId: null,
  pendingTopics: [],
  fetchedFavicon: '',
};

// --- API -------------------------------------------------------------------
async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let body = null;
  try { body = await res.json(); } catch { /* no body */ }
  return { status: res.status, ok: res.ok, body };
}

async function loadItems() {
  const { body } = await api('/api/bookmarks');
  state.items = (body && body.items) || [];
}

// --- Helpers ---------------------------------------------------------------
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : s;
  return d.innerHTML;
}
function highlight(text, q) {
  const t = text == null ? '' : String(text);
  if (!q) return esc(t);
  const i = t.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(t);
  return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length));
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// --- Auto-fill (SCN-001 / SCN-006) ----------------------------------------
let fillTimer = null;
function scheduleAutofill() {
  const url = els.url.value.trim();
  state.fetchedFavicon = '';
  if (!isValidUrl(url)) {
    els.details.hidden = true;
    setFieldStatus('', '');
    els.saveBtn.disabled = true;
    return;
  }
  setFieldStatus('Reading the page details…', '');
  clearTimeout(fillTimer);
  fillTimer = setTimeout(fetchMeta, 400);
}
function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}
async function fetchMeta() {
  const url = els.url.value.trim();
  if (!isValidUrl(url)) return;
  const { body } = await api('/api/metadata', { method: 'POST', body: JSON.stringify({ url }) });
  els.details.hidden = false;
  if (body && body.ok) {
    if (!els.title.value) els.title.value = body.title || '';
    if (!els.description.value) els.description.value = body.description || '';
    state.fetchedFavicon = body.favicon || '';
    setFieldStatus('Title and description filled in — edit them if you like.', 'ok');
  } else {
    setFieldStatus("Couldn't read this page automatically — please add a title yourself. You can still save it.", 'warn');
  }
  els.saveBtn.disabled = false;
}
function setFieldStatus(text, kind) {
  els.fieldStatus.textContent = text;
  els.fieldStatus.className = 'field-status' + (kind ? ' ' + kind : '');
}

// --- Pending topics (edit chips) ------------------------------------------
function renderEditChips() {
  els.editChips.innerHTML = '';
  state.pendingTopics.forEach((t, idx) => {
    const chip = document.createElement('span');
    chip.className = 'ec';
    chip.append(document.createTextNode(t));
    const x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', 'Remove ' + t);
    x.textContent = '×';
    x.addEventListener('click', () => { state.pendingTopics.splice(idx, 1); renderEditChips(); });
    chip.appendChild(x);
    els.editChips.appendChild(chip);
  });
}
function addPendingTopic() {
  const v = els.topicInput.value.trim();
  if (v && !state.pendingTopics.some((t) => t.toLowerCase() === v.toLowerCase())) {
    state.pendingTopics.push(v);
  }
  els.topicInput.value = '';
  renderEditChips();
}

// --- Rendering -------------------------------------------------------------
function faviconEl(item) {
  const wrap = document.createElement('div');
  wrap.className = 'favicon';
  const host = item.host || hostOf(item.url);
  wrap.textContent = (host[0] || '?').toUpperCase();
  if (item.favicon) {
    const img = document.createElement('img');
    img.src = item.favicon;
    img.alt = '';
    img.addEventListener('load', () => { wrap.textContent = ''; wrap.appendChild(img); });
    img.addEventListener('error', () => { /* keep letter tile */ });
  }
  return wrap;
}

function renderTopicsBar() {
  const scoped = state.items.filter((it) => !!it.archived === (state.scope === 'archive'));
  const topics = ['All', ...allTopics(scoped)];
  els.topicsBar.innerHTML = '';
  topics.forEach((t) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (t === state.topic ? ' active' : '');
    chip.textContent = t;
    chip.addEventListener('click', () => { state.topic = t; render(); });
    els.topicsBar.appendChild(chip);
  });
  els.topicSuggestions.innerHTML = '';
  allTopics(state.items).forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t;
    els.topicSuggestions.appendChild(opt);
  });
}

function render() {
  const inArchive = state.scope === 'archive';
  els.listHeading.textContent = inArchive ? 'Archived links' : 'Saved links';
  const archived = archivedCount(state.items);
  els.archiveToggle.textContent = inArchive
    ? 'Back to collection'
    : 'View archive' + (archived ? ` (${archived})` : '');
  els.statusSeg.hidden = inArchive;
  els.archiveNote.hidden = !inArchive;

  renderTopicsBar();

  const q = state.query.trim();
  const scopedAll = state.items.filter((it) => !!it.archived === inArchive);
  const items = filterItems(state.items, {
    scope: state.scope, status: state.status, topic: state.topic, query: q,
  });

  els.list.innerHTML = '';
  if (scopedAll.length === 0) {
    els.count.textContent = '';
    els.list.appendChild(emptyRow(inArchive
      ? 'No archived links. Archive a link to keep it out of your main view.'
      : 'No links saved yet. Paste a link above to save your first.'));
    markReady();
    return;
  }
  if (items.length === 0) {
    els.count.textContent = '';
    let msg;
    if (q) msg = `No links match “${q}”${state.topic !== 'All' ? ' in ' + state.topic : ''}.`;
    else if (state.status === 'unread' && !inArchive) msg = 'Nothing left to read here — your reading queue is clear.';
    else if (state.status === 'read' && !inArchive) msg = 'No read links here yet.';
    else msg = `No links in ${state.topic} yet.`;
    els.list.appendChild(emptyRow(msg));
    markReady();
    return;
  }

  const scopeWord = inArchive ? 'archived' : (state.status === 'unread' ? 'to read' : state.status === 'read' ? 'read' : '');
  els.count.textContent =
    `${items.length} ${items.length === 1 ? 'link' : 'links'}` +
    (scopeWord ? ' ' + scopeWord : '') +
    (state.topic !== 'All' ? ' in ' + state.topic : '') +
    (q ? ' matching' : '');

  for (const it of items) els.list.appendChild(renderItem(it, q));
  markReady();
}

function emptyRow(text) {
  const li = document.createElement('li');
  li.className = 'empty';
  li.textContent = text;
  return li;
}

function renderItem(it, q) {
  const li = document.createElement('li');
  li.className = 'item' + (!it.unread && !it.archived ? ' read' : '');

  const body = document.createElement('div');
  body.className = 'body';

  const titleLine = document.createElement('div');
  titleLine.className = 'title-line';
  const a = document.createElement('a');
  a.href = it.url; a.target = '_blank'; a.rel = 'noopener';
  a.innerHTML = highlight(it.title, q);
  titleLine.appendChild(a);
  const badge = document.createElement('span');
  if (it.archived) { badge.className = 'badge archived'; badge.textContent = 'Archived'; }
  else if (it.unread) { badge.className = 'badge toread'; badge.textContent = 'To read'; }
  else { badge.className = 'badge read'; badge.textContent = 'Read'; }
  titleLine.appendChild(badge);
  body.appendChild(titleLine);

  if ((it.topics || []).length) {
    const wrap = document.createElement('div');
    wrap.className = 'topic-tags';
    it.topics.forEach((t) => {
      const tag = document.createElement('span');
      tag.className = 'topic-tag';
      tag.textContent = t;
      tag.addEventListener('click', () => { state.topic = t; render(); });
      wrap.appendChild(tag);
    });
    body.appendChild(wrap);
  }

  if (it.description) {
    const d = document.createElement('div');
    d.className = 'desc';
    d.innerHTML = highlight(it.description, q);
    body.appendChild(d);
  }
  if (it.note) {
    const n = document.createElement('div');
    n.className = 'note';
    n.innerHTML = '<span class="tag">Note: </span>' + highlight(it.note, q);
    body.appendChild(n);
  }

  const url = document.createElement('div');
  url.className = 'url';
  url.innerHTML = highlight(it.url, q);
  body.appendChild(url);

  const foot = document.createElement('div');
  foot.className = 'row-foot';
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = 'Saved ' + fmtDate(it.created);
  foot.appendChild(meta);

  if (it.archived) {
    foot.appendChild(actionBtn('Restore to collection', () => setArchived(it.id, false)));
  } else {
    foot.appendChild(actionBtn(it.unread ? 'Mark as read' : 'Move back to “to read”', () => setUnread(it.id, !it.unread)));
    foot.appendChild(actionBtn('Archive', () => setArchived(it.id, true)));
  }
  foot.appendChild(actionBtn('Edit', () => startEdit(it.id)));
  const del = actionBtn('Delete', () => deleteItem(it.id));
  del.classList.add('danger');
  foot.appendChild(del);
  body.appendChild(foot);

  li.appendChild(faviconEl(it));
  li.appendChild(body);
  return li;
}

function actionBtn(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'link-btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

let ready = false;
function markReady() {
  if (!ready) { ready = true; els.app.setAttribute('data-harness-ready', 'true'); }
}

// --- Mutations -------------------------------------------------------------
async function submitForm(e) {
  e.preventDefault();
  addPendingTopic();
  const url = els.url.value.trim();
  if (!isValidUrl(url)) return;

  const payload = {
    url,
    title: els.title.value.trim(),
    description: els.description.value.trim(),
    note: els.note.value.trim(),
    topics: [...state.pendingTopics],
  };

  if (state.editingId !== null) {
    const res = await api(`/api/bookmarks/${state.editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
    if (res.status === 409 && res.body && res.body.conflict) {
      setFieldStatus('Another saved link already uses this address.', 'warn');
      return;
    }
    if (res.ok) { await refresh(); cancelEdit(); }
    return;
  }

  payload.favicon = state.fetchedFavicon || '';
  const res = await api('/api/bookmarks', { method: 'POST', body: JSON.stringify(payload) });
  if (res.status === 409 && res.body && res.body.duplicate) {
    await refresh();
    const existing = res.body.item;
    startEdit(existing.id);
    setFieldStatus(
      'You already saved this link' + (existing.archived ? ' (it was in your archive)' : '') +
      ' — opened it here so you can edit it instead.', 'warn');
    return;
  }
  if (res.ok) { await refresh(); resetForm(); }
}

function startEdit(id) {
  const it = state.items.find((x) => x.id === id);
  if (!it) return;
  state.editingId = id;
  state.pendingTopics = [...(it.topics || [])];
  state.fetchedFavicon = it.favicon || '';
  els.url.value = it.url;
  els.title.value = it.title || '';
  els.description.value = it.description || '';
  els.note.value = it.note || '';
  renderEditChips();
  els.details.hidden = false;
  setFieldStatus('', '');
  els.saveBtn.disabled = false;
  els.saveBtn.textContent = 'Update';
  els.saveHeading.textContent = 'Edit link';
  els.cancelBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  state.editingId = null;
  resetForm();
}

function resetForm() {
  els.form.reset();
  state.pendingTopics = [];
  state.fetchedFavicon = '';
  state.editingId = null;
  renderEditChips();
  els.details.hidden = true;
  setFieldStatus('', '');
  els.saveBtn.disabled = true;
  els.saveBtn.textContent = 'Save';
  els.saveHeading.textContent = 'Save a link';
  els.cancelBtn.hidden = true;
}

async function deleteItem(id) {
  const it = state.items.find((x) => x.id === id);
  if (!it) return;
  const ok = window.confirm(
    `Delete “${it.title}” permanently? This cannot be undone.\n\n(To keep it out of the way instead, use Archive.)`);
  if (!ok) return;
  const res = await api(`/api/bookmarks/${id}`, { method: 'DELETE' });
  if (res.ok) {
    if (state.editingId === id) cancelEdit();
    await refresh();
  }
}

async function setArchived(id, archived) {
  const res = await api(`/api/bookmarks/${id}/archived`, { method: 'POST', body: JSON.stringify({ archived }) });
  if (res.ok) await refresh();
}
async function setUnread(id, unread) {
  const res = await api(`/api/bookmarks/${id}/unread`, { method: 'POST', body: JSON.stringify({ unread }) });
  if (res.ok) await refresh();
}

async function refresh() {
  await loadItems();
  render();
}

// --- Wiring ----------------------------------------------------------------
els.url.addEventListener('input', scheduleAutofill);
els.form.addEventListener('submit', submitForm);
els.cancelBtn.addEventListener('click', cancelEdit);
els.topicInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addPendingTopic(); }
});
els.topicInput.addEventListener('blur', addPendingTopic);
els.search.addEventListener('input', () => { state.query = els.search.value; render(); });
els.statusSeg.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.status = b.dataset.status;
  [...els.statusSeg.children].forEach((c) => c.classList.toggle('active', c === b));
  render();
});
els.archiveToggle.addEventListener('click', () => {
  state.scope = state.scope === 'archive' ? 'collection' : 'archive';
  state.topic = 'All';
  render();
});

(async function init() {
  await loadItems();
  render();
})();
