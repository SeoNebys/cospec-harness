'use strict';

// ---- small helpers --------------------------------------------------------
const $ = sel => document.querySelector(sel);
const el = (tag, props = {}, children = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) n.append(c);
  return n;
};
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(path, opts);
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

// ---- state ----------------------------------------------------------------
const state = {
  items: [],
  pendingTags: [],
  activeFilter: null,
  readView: 'all',    // all | toread | read
  editingId: null,
  titleEdited: false,
};

// ---- save form ------------------------------------------------------------
function renderPendingTags() {
  const chips = $('#tagChips');
  chips.innerHTML = '';
  state.pendingTags.forEach((t, i) => {
    chips.append(el('span', { class: 'tag' }, [
      document.createTextNode('#' + t + ' '),
      el('button', { title: 'remove', type: 'button', onclick: () => { state.pendingTags.splice(i, 1); renderPendingTags(); } }, '×'),
    ]));
  });
}
function addPendingTag(raw) {
  const t = (raw || '').trim().replace(/^#/, '').toLowerCase();
  if (t && !state.pendingTags.includes(t)) state.pendingTags.push(t);
  renderPendingTags();
}

function clearFormMsg() { $('#formMsg').innerHTML = ''; $('#url').classList.remove('invalid'); }

async function lookupTitle() {
  const url = $('#url').value.trim();
  if (!url) return;
  if (state.titleEdited && $('#title').value) return;
  $('#titleStatus').textContent = '· looking up…';
  const { data } = await api('GET', '/api/lookup-title?url=' + encodeURIComponent(url));
  if (state.titleEdited && $('#title').value) { $('#titleStatus').textContent = ''; return; }
  if (data.title) { $('#title').value = data.title; $('#titleStatus').textContent = '· filled in automatically'; }
  else $('#titleStatus').textContent = data.ok ? '· no title found — you can type one' : '· could not reach the page — type a title';
}

function resetForm() {
  $('#url').value = ''; $('#title').value = ''; $('#note').value = ''; $('#tagInput').value = '';
  $('#toread').checked = true; $('#keepcopy').checked = false;
  state.pendingTags = []; state.titleEdited = false;
  renderPendingTags(); $('#titleStatus').textContent = ''; clearFormMsg();
}

function showDuplicate(existing, message) {
  const msg = el('div', { class: 'msg-warn' }, [
    document.createTextNode(message + ' (' + (existing.title || existing.url) + ') '),
    el('button', { type: 'button', onclick: () => goToItem(existing.id) }, 'Go to it'),
  ]);
  $('#formMsg').innerHTML = ''; $('#formMsg').append(msg);
}

async function save() {
  clearFormMsg();
  const payload = {
    url: $('#url').value,
    title: $('#title').value,
    note: $('#note').value,
    tags: state.pendingTags.slice(),
    toread: $('#toread').checked,
    keepcopy: $('#keepcopy').checked,
  };
  // account for a tag typed but not yet committed
  const pending = $('#tagInput').value.trim();
  if (pending) { addPendingTag(pending); $('#tagInput').value = ''; payload.tags = state.pendingTags.slice(); }

  const { status, data } = await api('POST', '/api/bookmarks', payload);
  if (status === 201) { resetForm(); await reload(); return; }
  if (data.error === 'duplicate') { showDuplicate(data.existing, data.message); return; }
  $('#url').classList.add('invalid');
  $('#formMsg').innerHTML = '<div class="msg-error">' + (data.message || 'Could not save this link.') + '</div>';
}

// ---- list rendering -------------------------------------------------------
function allTags() {
  const set = new Set();
  state.items.forEach(it => (it.tags || []).forEach(t => set.add(t)));
  return Array.from(set).sort();
}

function matchesSearch(it, q) {
  if (!q) return true;
  const hay = [it.title, it.note, it.url, (it.tags || []).join(' ')].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(term => hay.includes(term));
}

function renderReadTabs() {
  const wrap = $('#readTabs');
  const toReadCount = state.items.filter(it => it.toread).length;
  const tabs = [['all', 'All'], ['toread', `To read (${toReadCount})`], ['read', 'Read']];
  wrap.innerHTML = '';
  tabs.forEach(([key, label]) => {
    wrap.append(el('button', {
      class: 'rtab' + (state.readView === key ? ' active' : ''),
      type: 'button', text: label,
      onclick: () => { state.readView = key; render(); },
    }));
  });
}

function renderFilterBar() {
  const bar = $('#filterBar');
  bar.innerHTML = '';
  const tags = allTags();
  if (!tags.length) return;
  bar.append(el('span', { class: 'filter-note', text: 'Filter by tag: ' }));
  tags.forEach(t => {
    bar.append(el('span', {
      class: 'tag click' + (state.activeFilter === t ? ' active' : ''),
      text: '#' + t,
      onclick: () => { state.activeFilter = state.activeFilter === t ? null : t; render(); },
    }));
    bar.append(document.createTextNode(' '));
  });
  if (state.activeFilter) {
    bar.append(el('span', { class: 'clear-link', text: 'clear filter', onclick: () => { state.activeFilter = null; render(); } }));
  }
}

function editForm(it) {
  const box = el('div');
  const urlI = el('input', { type: 'url', value: it.url || '' });
  const titleI = el('input', { type: 'text', value: it.title || '' });
  const noteI = el('textarea', {}, it.note || '');
  const tagsI = el('input', { type: 'text', value: (it.tags || []).join(', ') });
  const msg = el('div', { class: 'form-msg' });
  const field = (labelText, input) => el('div', { class: 'edit-field' }, [el('label', { text: labelText }), input]);

  box.append(
    field('Link address', urlI),
    field('Title', titleI),
    field('Why are you saving this?', noteI),
    field('Tags (comma-separated)', tagsI),
    msg,
    el('div', { class: 'actions' }, [
      el('button', { class: 'primary', type: 'button', style: 'color:#fff', onclick: async () => {
        msg.innerHTML = '';
        const { status, data } = await api('PUT', '/api/bookmarks/' + it.id, {
          url: urlI.value, title: titleI.value, note: noteI.value, tags: tagsI.value.split(','),
        });
        if (status === 200) { state.editingId = null; await reload(); return; }
        msg.innerHTML = '<div class="msg-error">' + (data.message || 'Could not save changes.') + '</div>';
      } }, 'Save changes'),
      el('button', { type: 'button', onclick: () => { state.editingId = null; render(); } }, 'Cancel'),
    ]),
  );
  return box;
}

function itemView(it) {
  const div = el('div', { class: 'item' + (it.toread ? '' : ' read'), 'data-item': it.id });
  if (state.editingId === it.id) { div.append(editForm(it)); return div; }

  const title = el('a', { class: 'title', href: it.url, target: '_blank', rel: 'noopener', text: it.title || it.url });
  div.append(title);
  if (it.toread) div.append(el('span', { class: 'badge toread', text: 'To read' }));
  if (it.keepcopy) div.append(el('span', { class: 'badge copy', text: 'Copy kept' }));
  div.append(el('div', { class: 'host', text: hostOf(it.url) }));
  if (it.note) div.append(el('div', { class: 'note', text: it.note }));

  if ((it.tags || []).length) {
    const tagsWrap = el('div', { class: 'tags' });
    it.tags.forEach(t => tagsWrap.append(el('span', {
      class: 'tag click', text: '#' + t,
      onclick: () => { state.activeFilter = t; render(); },
    })));
    div.append(tagsWrap);
  }

  const actions = el('div', { class: 'actions' });
  actions.append(el('button', { type: 'button', text: 'Edit', onclick: () => { state.editingId = it.id; render(); } }));
  actions.append(el('button', {
    type: 'button', text: it.toread ? 'Mark as read' : 'Mark as to read',
    onclick: async () => { await api('PUT', '/api/bookmarks/' + it.id, { toread: !it.toread }); await reload(); },
  }));
  if (it.keepcopy) actions.append(el('button', { type: 'button', text: 'View saved copy', onclick: () => showSavedCopy(it) }));
  actions.append(el('button', { type: 'button', text: 'Remove', onclick: () => confirmDelete(it, actions) }));
  div.append(actions);
  return div;
}

function confirmDelete(it, actions) {
  actions.innerHTML = '';
  const box = el('span', { class: 'inline-confirm' }, [
    document.createTextNode('Remove "' + (it.title || it.url) + '"?'),
    el('button', { class: 'primary', type: 'button', style: 'color:#fff', onclick: async () => { await api('DELETE', '/api/bookmarks/' + it.id); await reload(); } }, 'Remove'),
    el('button', { type: 'button', onclick: render }, 'Keep'),
  ]);
  actions.append(box);
}

async function showSavedCopy(it) {
  const { data } = await api('GET', '/api/snapshot/' + it.id);
  const captured = (data.capturedAt && new Date(data.capturedAt).toLocaleString()) || 'the day you saved it';
  const hasText = data && data.ok && data.text;
  const content = hasText
    ? el('div', { class: 'content', text: data.text })
    : el('div', { class: 'content unavailable', text: 'The page content could not be captured (the page may have been unreachable when saved). The original link and its details are still kept.' });

  const overlay = el('div', { class: 'overlay', onclick: e => { if (e.target === overlay) overlay.remove(); } }, [
    el('div', { class: 'snap' }, [
      el('div', { class: 'bar' }, [
        el('span', { text: 'Saved copy — captured on ' + captured + '. Shown even if the original page is gone.' }),
        el('button', { type: 'button', text: 'Close', onclick: () => overlay.remove() }),
      ]),
      el('div', { class: 'body' }, [
        el('h3', { text: (data && data.title) || it.title || it.url }),
        el('div', { class: 'src', text: 'Originally from ' + hostOf(it.url) }),
        content,
      ]),
    ]),
  ]);
  $('#overlayRoot').append(overlay);
}

function render() {
  renderReadTabs();
  renderFilterBar();
  const q = ($('#search').value || '').trim();
  let shown = state.activeFilter ? state.items.filter(it => (it.tags || []).includes(state.activeFilter)) : state.items.slice();
  if (state.readView === 'toread') shown = shown.filter(it => it.toread);
  else if (state.readView === 'read') shown = shown.filter(it => !it.toread);
  shown = shown.filter(it => matchesSearch(it, q));

  const desc = (state.activeFilter ? ' tagged #' + state.activeFilter : '') + (q ? ` matching "${q}"` : '');
  $('#count').textContent = (shown.length === 1 ? '1 saved link' : shown.length + ' saved links') + desc;

  const list = $('#list');
  list.innerHTML = '';
  if (!shown.length) {
    let msg;
    if (!state.items.length) msg = 'No links saved yet. Save your first one above.';
    else if (q) msg = 'No links match your search' + (state.activeFilter ? ' within #' + state.activeFilter : '') + '.';
    else if (state.readView === 'toread') msg = 'Nothing left to read here.';
    else if (state.readView === 'read') msg = 'No read links yet.';
    else msg = 'No links tagged #' + state.activeFilter + '.';
    list.append(el('div', { class: 'empty', text: msg }));
    return;
  }
  shown.forEach(it => list.append(itemView(it)));
}

function goToItem(id) {
  state.activeFilter = null; state.readView = 'all'; $('#search').value = '';
  render();
  const node = document.querySelector('[data-item="' + id + '"]');
  if (node) {
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash');
  }
  clearFormMsg();
}

async function reload() {
  const { data } = await api('GET', '/api/bookmarks');
  state.items = data.bookmarks || [];
  render();
}

// ---- wiring ---------------------------------------------------------------
function init() {
  $('#saveBtn').addEventListener('click', save);
  $('#url').addEventListener('blur', lookupTitle);
  $('#title').addEventListener('input', () => { state.titleEdited = true; });
  $('#search').addEventListener('input', render);
  const tagInput = $('#tagInput');
  tagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addPendingTag(tagInput.value); tagInput.value = ''; }
    else if (e.key === 'Backspace' && tagInput.value === '' && state.pendingTags.length) { state.pendingTags.pop(); renderPendingTags(); }
  });
  tagInput.addEventListener('blur', () => { if (tagInput.value.trim()) { addPendingTag(tagInput.value); tagInput.value = ''; } });

  reload().finally(() => document.body.setAttribute('data-harness-ready', 'true'));
}

init();
