'use strict';
(function () {
  // ---------- tiny API helper ----------
  async function api(method, path, body) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, ok: res.ok, data };
  }

  // ---------- state ----------
  const state = {
    email: null,
    bookmarks: [],
    knownTags: new Set(),
    tab: 'toread',
    query: '',
    tagFilter: null,
    editingId: null,
    currentTags: [],
    authMode: 'login',
  };

  const $ = (id) => document.getElementById(id);

  // ---------- helpers ----------
  function isValidUrl(u) {
    try { const x = new URL((u || '').trim()); return x.protocol === 'http:' || x.protocol === 'https:'; }
    catch { return false; }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  function highlight(text, q) {
    const e = esc(text);
    if (!q) return e;
    const rx = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return e.replace(rx, '<mark>$1</mark>');
  }
  function matches(b, q) {
    if (!q) return true;
    const hay = (b.title + ' ' + b.description + ' ' + (b.note || '') + ' ' + b.url + ' ' + b.tags.join(' ')).toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
  }
  function upsert(bm) {
    const i = state.bookmarks.findIndex((x) => x.id === bm.id);
    if (i >= 0) state.bookmarks[i] = bm; else state.bookmarks.unshift(bm);
    bm.tags.forEach((t) => state.knownTags.add(t));
  }
  function rebuildKnownTags() {
    state.knownTags = new Set();
    state.bookmarks.forEach((b) => b.tags.forEach((t) => state.knownTags.add(t)));
  }

  // ---------- auth view ----------
  function showSignin() {
    $('app').hidden = true;
    $('userbar').hidden = true;
    $('signin').hidden = false;
    $('authError').textContent = '';
  }
  function showApp() {
    $('signin').hidden = true;
    $('app').hidden = false;
    $('userbar').hidden = false;
    $('whoami').textContent = state.email || '';
  }
  function setAuthMode(mode) {
    state.authMode = mode;
    const login = mode === 'login';
    $('authTitle').textContent = login ? 'Sign in to your bookmarks' : 'Create your account';
    $('authIntro').textContent = login
      ? 'Your collection is kept in one place so you can reach it from any device.'
      : 'Create a personal account to save and reach your bookmarks from any device.';
    $('authSubmit').textContent = login ? 'Sign in' : 'Create account';
    $('switchPrompt').textContent = login ? 'New here?' : 'Already have an account?';
    $('switchLink').textContent = login ? 'Create an account' : 'Sign in';
    $('authError').textContent = '';
  }
  async function submitAuth() {
    const email = $('email').value.trim();
    const password = $('password').value;
    const path = state.authMode === 'login' ? '/api/login' : '/api/register';
    const r = await api('POST', path, { email, password });
    if (r.ok) {
      state.email = r.data.email;
      $('password').value = '';
      await loadData();
      showApp();
    } else {
      $('authError').textContent = (r.data && r.data.error) || 'Something went wrong.';
    }
  }
  async function signOut() {
    await api('POST', '/api/logout');
    state.email = null;
    state.bookmarks = [];
    showSignin();
  }

  // ---------- data ----------
  async function loadData() {
    const r = await api('GET', '/api/bookmarks');
    if (r.ok) {
      state.bookmarks = r.data.bookmarks;
      rebuildKnownTags();
      (r.data.tags || []).forEach((t) => state.knownTags.add(t));
      render();
    }
  }

  // ---------- save form ----------
  let fetchSeq = 0;
  function refreshSaveEnabled() { $('save').disabled = !isValidUrl($('url').value.trim()); }
  function setSaveStatus(text, cls) { const el = $('saveStatus'); el.textContent = text; el.className = 'msg' + (cls ? ' ' + cls : ''); }

  async function autofill() {
    const url = $('url').value.trim();
    if (!isValidUrl(url)) { if (url) setSaveStatus("That doesn’t look like a web link — it should start with http:// or https://", 'warn'); else setSaveStatus(''); return; }
    const seq = ++fetchSeq;
    setSaveStatus('Fetching details…', 'fetching');
    const r = await api('GET', '/api/metadata?url=' + encodeURIComponent(url));
    if (seq !== fetchSeq) return; // a newer request superseded this one
    if (r.ok && r.data.ok && (r.data.title || r.data.description)) {
      if (r.data.title) { $('title').value = r.data.title; $('title').classList.add('autofilled'); }
      if (r.data.description) { $('desc').value = r.data.description; $('desc').classList.add('autofilled'); }
      setSaveStatus('Details filled in for you — edit if you like.', 'ok');
    } else {
      setSaveStatus("Couldn’t fetch details for this link — type a title yourself, then save.", 'warn');
      $('title').focus();
    }
  }

  // Chip editor bound to state.currentTags for the save form.
  function renderSaveTags() {
    const box = $('tagbox');
    box.querySelectorAll('.chip').forEach((c) => c.remove());
    state.currentTags.forEach((tag) => {
      const chip = mkChip(tag, () => { state.currentTags = state.currentTags.filter((t) => t !== tag); renderSaveTags(); renderSuggest(); });
      box.insertBefore(chip, $('taginput'));
    });
  }
  function addSaveTag(raw) {
    const t = raw.trim();
    if (!t) return;
    if (!state.currentTags.includes(t)) { state.currentTags.push(t); state.knownTags.add(t); }
    $('taginput').value = '';
    renderSaveTags(); renderSuggest();
  }
  function renderSuggest() {
    const el = $('suggest');
    const avail = [...state.knownTags].filter((t) => !state.currentTags.includes(t)).sort();
    el.innerHTML = '';
    if (!avail.length) return;
    const lbl = document.createElement('span'); lbl.textContent = 'Reuse:'; el.appendChild(lbl);
    avail.forEach((t) => {
      const b = document.createElement('span'); b.className = 'sug'; b.textContent = '#' + t;
      b.addEventListener('click', () => addSaveTag(t));
      el.appendChild(b);
    });
  }
  function mkChip(tag, onRemove) {
    const chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = '#' + tag;
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×';
    x.addEventListener('click', onRemove);
    chip.appendChild(x); return chip;
  }

  async function doSave() {
    const url = $('url').value.trim();
    if (!isValidUrl(url)) return;
    if ($('taginput').value.trim()) addSaveTag($('taginput').value);
    const payload = {
      url,
      title: $('title').value.trim() || (function () { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } })(),
      description: $('desc').value.trim(),
      note: $('note').value.trim(),
      tags: state.currentTags.slice(),
    };
    const r = await api('POST', '/api/bookmarks', payload);
    if (r.status === 201) {
      upsert(r.data.bookmark);
      clearSaveForm();
      state.tab = 'toread'; syncTabs();
      render(); flash(r.data.bookmark.id);
    } else if (r.status === 409 && r.data.duplicate) {
      const ex = r.data.bookmark; upsert(ex);
      $('url').value = ''; refreshSaveEnabled();
      setSaveStatus("You’ve already saved this — here it is. Use Edit to add a tag or change its status.", 'info');
      state.query = ''; $('search').value = ''; state.tagFilter = null;
      state.tab = ex.archived ? 'archived' : (ex.finished ? 'finished' : 'toread'); syncTabs();
      state.editingId = ex.id;
      render(); flash(ex.id);
    } else {
      setSaveStatus((r.data && r.data.error) || 'Could not save.', 'warn');
    }
  }
  function clearSaveForm() {
    $('url').value = ''; $('title').value = ''; $('desc').value = ''; $('note').value = '';
    $('title').classList.remove('autofilled'); $('desc').classList.remove('autofilled');
    state.currentTags = []; renderSaveTags(); renderSuggest();
    setSaveStatus(''); refreshSaveEnabled();
  }

  // ---------- tabs / search ----------
  function syncTabs() {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.t === state.tab));
  }
  function counts() {
    let toread = 0, finished = 0, archived = 0;
    state.bookmarks.forEach((b) => {
      if (b.archived) archived++;
      else if (b.finished) finished++;
      else toread++;
    });
    return { toread, finished, archived };
  }

  // ---------- inline edit (SCN-007) ----------
  function buildEditForm(b) {
    const form = document.createElement('div'); form.className = 'editform';
    let editTags = b.tags.slice();

    const l0 = label('Web address'); const ue = input('url', b.url);
    const err = document.createElement('div'); err.className = 'msg warn';
    const l1 = label('Title'); const ti = input('text', b.title);
    const l2 = label('Description'); const de = textarea(b.description);
    const l3 = label('Personal note'); const ne = textarea(b.note || '');
    const l4 = label('Tags');
    const tb = document.createElement('div'); tb.className = 'tagbox';
    const tin = document.createElement('input'); tin.type = 'text'; tin.placeholder = 'Type a tag, press Enter'; tb.appendChild(tin);
    function drawTags() {
      tb.querySelectorAll('.chip').forEach((c) => c.remove());
      editTags.forEach((t) => tb.insertBefore(mkChip(t, () => { editTags = editTags.filter((z) => z !== t); drawTags(); }), tin));
    }
    tin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const v = tin.value.trim(); if (v && !editTags.includes(v)) editTags.push(v); tin.value = ''; drawTags(); }
      else if (e.key === 'Backspace' && !tin.value && editTags.length) { editTags.pop(); drawTags(); }
    });
    tb.addEventListener('click', () => tin.focus());
    drawTags();

    const btns = document.createElement('div'); btns.className = 'editbtns';
    const save = document.createElement('button'); save.className = 'btn-primary'; save.textContent = 'Save changes';
    const cancel = document.createElement('button'); cancel.className = 'btn-light'; cancel.textContent = 'Cancel';
    save.addEventListener('click', async () => {
      const nu = ue.value.trim();
      if (!isValidUrl(nu)) { err.textContent = "That doesn’t look like a web link — it should start with http:// or https://"; return; }
      if (tin.value.trim()) { const v = tin.value.trim(); if (!editTags.includes(v)) editTags.push(v); }
      const r = await api('PUT', '/api/bookmarks/' + b.id, {
        url: nu, title: ti.value.trim(), description: de.value.trim(), note: ne.value.trim(), tags: editTags.slice(),
      });
      if (r.ok) { upsert(r.data.bookmark); state.editingId = null; render(); flash(b.id); }
      else if (r.status === 409) { err.textContent = (r.data && r.data.error) || 'Another saved bookmark already uses this address.'; }
      else { err.textContent = (r.data && r.data.error) || 'Could not save changes.'; }
    });
    cancel.addEventListener('click', () => { state.editingId = null; render(); });
    btns.append(save, cancel);
    form.append(l0, ue, err, l1, ti, l2, de, l3, ne, l4, tb, btns);
    return form;
  }
  function label(t) { const l = document.createElement('label'); l.textContent = t; return l; }
  function input(type, val) { const i = document.createElement('input'); i.type = type; i.value = val || ''; return i; }
  function textarea(val) { const t = document.createElement('textarea'); t.value = val || ''; return t; }

  // ---------- actions ----------
  async function toggleFinished(b) {
    const r = await api('PATCH', '/api/bookmarks/' + b.id + '/status', { finished: !b.finished });
    if (r.ok) { upsert(r.data.bookmark); render(); flash(b.id); }
  }
  async function setArchived(b, archived) {
    const r = await api('PATCH', '/api/bookmarks/' + b.id + '/archived', { archived });
    if (r.ok) { upsert(r.data.bookmark); if (state.editingId === b.id) state.editingId = null; render(); if (archived === false) flash(b.id); }
  }
  function askDelete(b) {
    $('confirmBody').innerHTML = '“' + esc(b.title || b.url) + '” will be permanently removed. This can’t be undone.';
    const overlay = $('overlay');
    overlay.hidden = false;
    const ok = $('confirmOk'), cancel = $('confirmCancel');
    function close() { overlay.hidden = true; ok.onclick = null; cancel.onclick = null; }
    cancel.onclick = close;
    ok.onclick = async () => {
      const r = await api('DELETE', '/api/bookmarks/' + b.id);
      if (r.ok) { state.bookmarks = state.bookmarks.filter((x) => x.id !== b.id); if (state.editingId === b.id) state.editingId = null; rebuildKnownTags(); render(); }
      close();
    };
  }

  // ---------- render ----------
  function flash(id) {
    const el = $('list').querySelector('li[data-id="' + id + '"]');
    if (el) { el.classList.add('flash'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }
  function applySearchMeta(total) {
    const meta = $('searchmeta');
    if (!state.query && !state.tagFilter) { meta.textContent = ''; return; }
    const parts = [];
    if (state.query) parts.push('for "<b>' + esc(state.query) + '</b>"');
    if (state.tagFilter) parts.push('tagged <b>#' + esc(state.tagFilter) + '</b>');
    meta.innerHTML = 'Showing <b>' + total + '</b> result' + (total === 1 ? '' : 's') + ' ' + parts.join(' and ') +
      ' across both tabs.' + (state.tagFilter ? ' <span class="activefilter">#' + esc(state.tagFilter) + ' <button title="clear tag">×</button></span>' : '');
    const btn = meta.querySelector('.activefilter button');
    if (btn) btn.addEventListener('click', () => { state.tagFilter = null; render(); });
  }
  function render() {
    const c = counts();
    $('badge-toread').textContent = c.toread;
    $('badge-finished').textContent = c.finished;
    $('badge-archived').textContent = c.archived;
    syncTabs();

    const searching = state.query || state.tagFilter;
    let items = state.bookmarks.filter((b) => matches(b, state.query) && (!state.tagFilter || b.tags.includes(state.tagFilter)));
    if (searching) {
      // Archived items stay out of normal search; only visible on the Archived tab (SCN-011).
      items = state.tab === 'archived' ? items.filter((b) => b.archived) : items.filter((b) => !b.archived);
    } else {
      items = items.filter((b) => state.tab === 'archived' ? b.archived : (state.tab === 'toread' ? (!b.archived && !b.finished) : (!b.archived && b.finished)));
    }
    applySearchMeta(state.bookmarks.filter((b) => matches(b, state.query) && (!state.tagFilter || b.tags.includes(state.tagFilter)) && !b.archived).length);

    const list = $('list'); list.innerHTML = '';
    const empty = $('empty');
    if (!items.length) {
      empty.hidden = false;
      empty.textContent = searching ? 'No bookmarks match your search.'
        : (state.bookmarks.length === 0 ? 'No bookmarks yet. Open “Save a link” above to add your first one.'
          : (state.tab === 'toread' ? 'Nothing left to read — nice.' : state.tab === 'finished' ? 'Nothing finished yet.' : 'Nothing archived.'));
    } else empty.hidden = true;

    for (const b of items) list.appendChild(renderItem(b));
  }
  function renderItem(b) {
    const li = document.createElement('li'); li.className = 'item' + (b.archived ? ' archived' : ''); li.dataset.id = b.id;
    const head = document.createElement('div'); head.className = 'itemhead';
    const left = document.createElement('div');
    const t = document.createElement('div'); t.className = 'title';
    const a = document.createElement('a'); a.href = b.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.innerHTML = highlight(b.title || b.url, state.query);
    t.appendChild(a);
    const url = document.createElement('div'); url.className = 'url'; url.textContent = b.url;
    left.append(t, url);

    const actions = document.createElement('div'); actions.className = 'actions';
    const edit = document.createElement('button'); edit.className = 'actbtn'; edit.textContent = state.editingId === b.id ? 'Close' : 'Edit';
    edit.addEventListener('click', () => { state.editingId = state.editingId === b.id ? null : b.id; render(); });
    actions.appendChild(edit);
    if (b.archived) {
      const rs = document.createElement('button'); rs.className = 'actbtn'; rs.textContent = '↩ Restore'; rs.title = 'Move back to your lists';
      rs.addEventListener('click', () => setArchived(b, false)); actions.appendChild(rs);
    } else {
      const mv = document.createElement('button');
      if (b.finished) { mv.className = 'actbtn'; mv.textContent = '↩ To read'; } else { mv.className = 'actbtn done'; mv.textContent = '✓ Finished'; }
      mv.addEventListener('click', () => toggleFinished(b));
      const ar = document.createElement('button'); ar.className = 'actbtn'; ar.textContent = 'Archive'; ar.title = 'Hide from your lists but keep it';
      ar.addEventListener('click', () => setArchived(b, true));
      actions.append(mv, ar);
    }
    const del = document.createElement('button'); del.className = 'actbtn danger'; del.textContent = 'Delete'; del.title = 'Remove permanently';
    del.addEventListener('click', () => askDelete(b)); actions.appendChild(del);

    head.append(left, actions); li.appendChild(head);
    if (b.description) { const d = document.createElement('div'); d.className = 'desc'; d.innerHTML = highlight(b.description, state.query); li.appendChild(d); }
    if (b.note) { const n = document.createElement('div'); n.className = 'note'; n.innerHTML = highlight(b.note, state.query); li.appendChild(n); }
    if (b.tags && b.tags.length) {
      const ch = document.createElement('div'); ch.className = 'chips';
      b.tags.forEach((tag) => { const s = document.createElement('span'); s.className = 'chip'; s.textContent = '#' + tag; s.title = 'Filter by #' + tag; s.addEventListener('click', () => { state.tagFilter = tag; render(); }); ch.appendChild(s); });
      li.appendChild(ch);
    }
    if (state.editingId === b.id) li.appendChild(buildEditForm(b));
    return li;
  }

  // ---------- wire up ----------
  function bind() {
    $('authSubmit').addEventListener('click', submitAuth);
    $('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAuth(); });
    $('email').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAuth(); });
    $('switchLink').addEventListener('click', (e) => { e.preventDefault(); setAuthMode(state.authMode === 'login' ? 'register' : 'login'); });
    $('signout').addEventListener('click', signOut);

    $('url').addEventListener('input', () => { refreshSaveEnabled(); $('title').classList.remove('autofilled'); $('desc').classList.remove('autofilled'); });
    $('url').addEventListener('change', autofill);
    $('url').addEventListener('blur', autofill);
    ['title', 'desc'].forEach((id) => $(id).addEventListener('input', () => $(id).classList.remove('autofilled')));
    $('tagbox').addEventListener('click', () => $('taginput').focus());
    $('taginput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSaveTag($('taginput').value); }
      else if (e.key === 'Backspace' && !$('taginput').value && state.currentTags.length) { state.currentTags.pop(); renderSaveTags(); renderSuggest(); }
    });
    $('save').addEventListener('click', doSave);

    $('search').addEventListener('input', () => { state.query = $('search').value.trim(); render(); });
    document.querySelectorAll('#tabs button').forEach((btn) => btn.addEventListener('click', () => { state.tab = btn.dataset.t; render(); }));
  }

  async function init() {
    bind();
    setAuthMode('login');
    const me = await api('GET', '/api/me');
    if (me.ok) { state.email = me.data.email; await loadData(); showApp(); }
    else { showSignin(); }
    document.body.setAttribute('data-harness-ready', 'true');
  }

  init();
})();
