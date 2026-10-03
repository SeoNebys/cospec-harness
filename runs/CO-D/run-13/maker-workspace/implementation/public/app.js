'use strict';
(function () {
  var F = window.Format, Q = window.SearchQuery;
  var esc = F.escapeHtml;

  // ---- state ----
  var VIEWS = ['all', 'unread', 'archived'];
  var VIEW_LABEL = { all: 'All', unread: 'Unread', archived: 'Archived' };
  var BATCH = 25;
  var st = {
    items: [], active: 'all', query: '', activeTags: [], sortBy: 'newest',
    visibleCount: BATCH, selected: {}, expanded: {},
    editingId: null, editingTagId: null, confirmingDeleteId: null,
    pendingPreview: null, bulkMode: 'none', matchIds: [],
  };

  // ---- elements ----
  var $ = function (id) { return document.getElementById(id); };
  var listEl = $('list'), tabsEl = $('tabs'), filterEl = $('filterbar'),
      searchHead = $('searchhead'), loadmoreEl = $('loadmore'), datalistEl = $('alltags'),
      noticeEl = $('notice'), reviewEl = $('review'), bulkbarEl = $('bulkbar'),
      form = $('saver'), urlInput = $('url'), saveBtn = $('saveBtn'),
      searchInput = $('search'), searchClear = $('searchclear'), sortEl = $('sort'),
      selAllEl = $('selall'), selAllLabel = $('selalllabel'),
      tipsBtn = $('tipsBtn'), tipsPanel = $('tipsPanel');
  var noticeTimer = null;

  // ---- api ----
  async function api(method, path, body) {
    var opt = { method: method, headers: {} };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    var r = await fetch(path, opt);
    var data = null; try { data = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, data: data || {} };
  }
  async function reload() {
    var r = await api('GET', '/api/bookmarks');
    st.items = (r.data && r.data.bookmarks) || [];
  }

  // ---- helpers ----
  function selCount() { return Object.keys(st.selected).length; }
  function clearSelection() { st.selected = {}; st.bulkMode = 'none'; }
  function showNotice(html, isError) {
    noticeEl.innerHTML = html; noticeEl.hidden = false;
    noticeEl.className = 'notice' + (isError ? ' error' : '');
    clearTimeout(noticeTimer); noticeTimer = setTimeout(function () { noticeEl.hidden = true; }, 5500);
  }
  function inView(b, v) {
    if (v === 'all') return !b.archived;
    if (v === 'unread') return !b.archived && !b.read;
    return b.archived;
  }
  function count(v) { return st.items.filter(function (b) { return inView(b, v); }).length; }
  function hasTag(b, t) { return b.tags.some(function (x) { return x.toLowerCase() === t.toLowerCase(); }); }
  function tagActive(t) { return st.activeTags.some(function (x) { return x.toLowerCase() === t.toLowerCase(); }); }
  function toggleTag(t) {
    if (tagActive(t)) st.activeTags = st.activeTags.filter(function (x) { return x.toLowerCase() !== t.toLowerCase(); });
    else st.activeTags = st.activeTags.concat([t]);
  }
  function matchesTags(b) { return st.activeTags.every(function (t) { return hasTag(b, t); }); }
  function allTags() {
    var set = {}; st.items.forEach(function (b) { b.tags.forEach(function (t) { set[t.toLowerCase()] = t; }); });
    return Object.keys(set).sort().map(function (k) { return set[k]; });
  }

  // ---- rendering ----
  function renderTabs() {
    tabsEl.innerHTML = VIEWS.map(function (v) {
      return '<button class="tab' + (v === st.active ? ' active' : '') + '" data-tab="' + v + '">' +
        VIEW_LABEL[v] + '<span class="n">' + count(v) + '</span></button>';
    }).join('');
  }
  function renderFilter() {
    if (!st.activeTags.length) { filterEl.className = 'filterbar'; filterEl.innerHTML = ''; return; }
    filterEl.className = 'filterbar on';
    var chips = st.activeTags.map(function (t) { return '<span class="ftag" data-untag="' + esc(t) + '">' + esc(t) + ' ✕</span>'; }).join('');
    var lead = st.activeTags.length > 1 ? 'Showing links tagged with all of' : 'Showing links tagged';
    filterEl.innerHTML = lead + ' ' + chips + ' <button data-clearfilter>Clear tag filter</button>';
  }
  function refreshDatalist() {
    datalistEl.innerHTML = allTags().map(function (t) { return '<option value="' + esc(t) + '">'; }).join('');
  }
  function badge(b) {
    var read = b.read ? '<span class="sb read">Read</span>' : '<span class="sb unread">Unread</span>';
    var arch = b.archived ? '<span class="sb arch">Archived</span>' : '';
    return read + arch;
  }
  function favHtml(b) { return '<span class="fav"><img src="' + esc(b.favicon) + '" alt="" onerror="this.style.display=\'none\'"></span>'; }
  function noteHtml(b) {
    if (!b.note) return '';
    var long = F.isLongNote(b.note), open = !!st.expanded[b.id];
    var cls = 'note' + (long && !open ? ' clamp' : '');
    var more = long ? '<button class="notemore" data-noteid="' + b.id + '">' + (open ? 'Show less' : 'Show full note') + '</button>' : '';
    return '<div class="' + cls + '"><span class="nlab">Your note</span><div class="md">' + F.renderMarkdown(b.note) + '</div>' + more + '</div>';
  }
  function tagsHtml(b) {
    var chips = b.tags.map(function (t) {
      return '<span class="chip' + (tagActive(t) ? ' on' : '') + '"><span class="lab" data-tagfilter="' + esc(t) + '">' + esc(t) + '</span>' +
        '<span class="x" data-tagremove="' + esc(t) + '" data-id="' + b.id + '" title="Remove tag">✕</span></span>';
    }).join('');
    var adder = st.editingTagId === b.id
      ? '<input class="taginput" list="alltags" data-taginput="' + b.id + '" placeholder="tag name…" autocomplete="off">'
      : '<button class="addtag" data-tagadd="' + b.id + '">＋ tag</button>';
    return '<div class="tags">' + chips + adder + '</div>';
  }
  function controls(b) {
    var btns = [];
    if (b.archived) btns.push('<button class="btn" data-act="restore" data-id="' + b.id + '">↩ Restore</button>');
    else {
      if (!b.read) btns.push('<button class="btn primary" data-act="read" data-id="' + b.id + '">✓ Mark read</button>');
      else btns.push('<button class="btn" data-act="unread" data-id="' + b.id + '">↩ Mark unread</button>');
      btns.push('<button class="btn" data-act="archive" data-id="' + b.id + '">🗄 Archive</button>');
    }
    btns.push('<button class="btn" data-editopen="' + b.id + '">✏ Edit</button>');
    return '<div class="ctrls">' + btns.join('') + '</div>';
  }
  var FMT_HINT = '<div class="fmthint">Supports simple formatting: <code>**bold**</code>, <code># heading</code>, <code>- list</code>, <code>[text](https://…)</code>.</div>';
  function delRow(b) {
    if (st.confirmingDeleteId === b.id) {
      return '<div class="delrow"><span class="delwarn">Delete this link permanently? This can’t be undone.</span>' +
        '<button class="btn danger" data-delyes="' + b.id + '">Delete permanently</button>' +
        '<button class="btn" data-delno>Keep</button></div>';
    }
    return '<div class="delrow"><button class="btn danger-ghost" data-delask="' + b.id + '">🗑 Delete permanently…</button></div>';
  }
  function editRow(b, cls) {
    return '<li class="' + cls + '" data-id="' + b.id + '">' + favHtml(b) +
      '<div class="body"><div class="editform">' +
        (b.image ? '<img class="eimg" src="' + esc(b.image) + '" alt="" onerror="this.style.display=\'none\'">' : '') +
        '<div><label>Address</label><input data-ef="url" value="' + esc(b.url) + '"></div>' +
        '<div><label>Title</label><input data-ef="title" value="' + esc(b.title) + '"></div>' +
        '<div><label>Description</label><textarea data-ef="description" rows="2">' + esc(b.description) + '</textarea></div>' +
        '<div><label>Your note</label><textarea data-ef="note" rows="3" placeholder="Add a private note to your future self…">' + esc(b.note) + '</textarea>' + FMT_HINT + '</div>' +
        '<div class="ef-error" data-eferror hidden></div>' +
        '<div class="row"><button class="btn primary" data-editsave="' + b.id + '">Save changes</button>' +
          '<button class="btn" data-editcancel="' + b.id + '">Cancel</button></div>' +
        delRow(b) +
      '</div></div></li>';
  }

  function render(freshId) {
    renderTabs(); renderFilter(); refreshDatalist();
    var searching = st.query.trim().length > 0;
    var hiTerms = searching ? Q.highlightTerms(st.query) : [];
    var base = st.items.filter(function (b) { return inView(b, st.active); });
    var shown = base.filter(matchesTags).filter(function (b) { return !searching || Q.matches(st.query, b); });
    shown.sort(function (a, b) {
      if (st.sortBy === 'oldest') return new Date(a.savedAt) - new Date(b.savedAt);
      if (st.sortBy === 'title') return String(a.title).toLowerCase().localeCompare(String(b.title).toLowerCase());
      return new Date(b.savedAt) - new Date(a.savedAt);
    });
    if (searching) {
      searchHead.hidden = false;
      searchHead.innerHTML = shown.length + (shown.length === 1 ? ' result' : ' results') +
        ' in <b>' + VIEW_LABEL[st.active] + '</b> for <span class="qq">' + esc(st.query.trim()) + '</span>';
    } else { searchHead.hidden = true; searchHead.innerHTML = ''; }

    if (!shown.length) {
      var msg;
      if (searching) msg = 'No ' + VIEW_LABEL[st.active].toLowerCase() + ' links match “' + esc(st.query.trim()) + '”.';
      else if (st.activeTags.length) msg = 'No ' + VIEW_LABEL[st.active].toLowerCase() + ' links tagged ' + st.activeTags.map(function (t) { return '"' + esc(t) + '"'; }).join(' + ') + '.';
      else msg = { all: 'Your library is empty.', unread: 'Nothing unread — you\'re all caught up.', archived: 'Nothing archived.' }[st.active];
      listEl.innerHTML = '<div class="empty"><div class="big">' + msg + '</div>' +
        (st.active === 'all' && !st.activeTags.length && !searching ? '<div>Paste a link above to add something.</div>' : '') + '</div>';
      loadmoreEl.hidden = true; loadmoreEl.innerHTML = '';
      st.matchIds = []; renderBulk(); return;
    }

    st.matchIds = shown.map(function (b) { return b.id; });
    if (st.visibleCount < BATCH) st.visibleCount = BATCH;
    var display = shown.slice(0, st.visibleCount);
    listEl.innerHTML = display.map(function (b) {
      var cls = 'item' + (b.id === freshId ? ' fresh' : '') + (b.read && !b.archived ? ' read' : '') + (st.selected[b.id] ? ' selected' : '');
      if (st.editingId === b.id) return editRow(b, cls);
      var flag = b.retrieved ? '' : '<span class="flag">details couldn\'t be fetched</span>';
      var desc = b.description ? '<p class="d">' + F.highlight(b.description, hiTerms) + '</p>' : '';
      var chk = '<input type="checkbox" class="selbox" data-sel="' + b.id + '"' + (st.selected[b.id] ? ' checked' : '') + ' aria-label="Select">';
      return '<li class="' + cls + '" data-id="' + b.id + '">' + chk + favHtml(b) +
        '<div class="body">' +
          '<h3 class="t"><a href="' + esc(b.url) + '" target="_blank" rel="noopener">' + F.highlight(b.title, hiTerms) + '</a></h3>' + desc +
          noteHtml(b) +
          '<div class="meta">' + badge(b) + '<span class="site">' + esc(b.siteName) + '</span>' +
            '<span class="dot">·</span><span>' + esc(F.whenLabel(b.savedAt)) + '</span>' +
            (flag ? '<span class="dot">·</span>' + flag : '') + '</div>' +
          tagsHtml(b) + controls(b) +
        '</div></li>';
    }).join('');

    var remaining = shown.length - display.length;
    if (remaining > 0) {
      loadmoreEl.hidden = false;
      loadmoreEl.innerHTML = '<button data-loadmore>Load ' + Math.min(BATCH, remaining) + ' more (' + remaining + ' left)</button>';
    } else { loadmoreEl.hidden = true; loadmoreEl.innerHTML = ''; }

    if (st.editingId != null) { var ef = listEl.querySelector('li.item[data-id="' + st.editingId + '"] [data-ef="title"]'); if (ef) ef.focus(); }
    if (st.editingTagId != null) { var ti = listEl.querySelector('[data-taginput="' + st.editingTagId + '"]'); if (ti) ti.focus(); }
    renderBulk();
  }

  function renderBulk() {
    var n = st.matchIds.length;
    var allSel = n > 0 && st.matchIds.every(function (id) { return st.selected[id]; });
    selAllEl.checked = allSel;
    selAllEl.indeterminate = (!allSel && st.matchIds.some(function (id) { return st.selected[id]; }));
    selAllLabel.textContent = 'Select all' + (n ? ' (' + n + ')' : '');
    var c = selCount();
    if (!c) { bulkbarEl.hidden = true; bulkbarEl.innerHTML = ''; st.bulkMode = 'none'; return; }
    bulkbarEl.hidden = false;
    if (st.bulkMode === 'addtag' || st.bulkMode === 'removetag') {
      bulkbarEl.innerHTML = '<span class="bcount">' + c + ' selected</span>' +
        '<input id="bulktag" list="alltags" placeholder="' + (st.bulkMode === 'addtag' ? 'tag to add…' : 'tag to remove…') + '">' +
        '<button data-bulkapply>' + (st.bulkMode === 'addtag' ? 'Add tag' : 'Remove tag') + '</button>' +
        '<button data-bulkcancel>Cancel</button>';
      var inp = bulkbarEl.querySelector('#bulktag'); if (inp) inp.focus(); return;
    }
    if (st.bulkMode === 'confirmdelete') {
      bulkbarEl.innerHTML = '<span class="bcount warn">Delete ' + c + ' permanently?</span><span class="warn">This can’t be undone.</span>' +
        '<button class="danger" data-bulk="delete">Delete ' + c + ' permanently</button><button data-bulkcancel>Cancel</button>';
      return;
    }
    bulkbarEl.innerHTML = '<span class="bcount">' + c + ' selected</span>' +
      '<button data-bulk="read">Mark read</button><button data-bulk="unread">Mark unread</button>' +
      (st.active === 'archived' ? '<button data-bulk="restore">Restore</button>' : '<button data-bulk="archive">Archive</button>') +
      '<button data-bulkmode="addtag">Add tag…</button><button data-bulkmode="removetag">Remove tag…</button>' +
      '<button class="danger" data-bulkmode="confirmdelete">Delete…</button>' +
      '<span class="spacer"></span><button data-bulkclear>Clear</button>';
  }

  function goToEntry(id) {
    var el = listEl.querySelector('li.item[data-id="' + id + '"]');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  // ---- actions ----
  async function act(id, endpoint, body, msg) {
    var r = await api('POST', '/api/bookmarks/' + id + endpoint, body);
    if (!r.ok) return;
    await reload(); render(); showNotice(msg);
  }
  function markRead(id) { act(id, '/state', { read: true }, 'Marked as <b>read</b>.'); }
  function markUnread(id) { act(id, '/state', { read: false }, 'Marked as <b>unread</b>.'); }
  function archive(id) { act(id, '/state', { archived: true }, '<b>Archived</b> — moved out of your active library, not deleted.'); }
  function restore(id) { act(id, '/state', { archived: false }, '<b>Restored</b> to your library.'); }

  async function tagOp(id, tag, add) {
    var r = await api('POST', '/api/bookmarks/' + id + '/tags/' + (add ? 'add' : 'remove'), { tag: tag });
    if (!r.ok) return;
    await reload();
    var present = allTags();
    st.activeTags = st.activeTags.filter(function (t) { return present.some(function (p) { return p.toLowerCase() === t.toLowerCase(); }); });
    render();
  }

  async function saveEdit(id) {
    var li = listEl.querySelector('li.item[data-id="' + id + '"]');
    if (!li) return;
    var payload = {
      url: li.querySelector('[data-ef="url"]').value,
      title: li.querySelector('[data-ef="title"]').value,
      description: li.querySelector('[data-ef="description"]').value,
      note: li.querySelector('[data-ef="note"]').value,
    };
    var r = await api('PATCH', '/api/bookmarks/' + id, payload);
    if (!r.ok) {
      var box = li.querySelector('[data-eferror]');
      if (box) {
        box.hidden = false;
        box.textContent = r.data.error === 'duplicate_address'
          ? 'That address is already saved as “' + (r.data.title || 'another entry') + '”. Your changes were not applied.'
          : r.data.error === 'invalid_url' ? 'That address doesn’t look valid.'
          : 'Could not save your changes.';
      }
      return;
    }
    st.editingId = null; st.confirmingDeleteId = null;
    await reload(); render(); showNotice('Saved your changes.');
  }

  async function deleteEntry(id) {
    var r = await api('DELETE', '/api/bookmarks/' + id);
    if (!r.ok) return;
    delete st.selected[id];
    st.editingId = null; st.confirmingDeleteId = null;
    await reload(); render(); showNotice('Deleted permanently.');
  }

  function bulkMsg(a, n, v) {
    if (a === 'read') return 'Marked ' + n + ' as read.';
    if (a === 'unread') return 'Marked ' + n + ' as unread.';
    if (a === 'archive') return 'Archived ' + n + '.';
    if (a === 'restore') return 'Restored ' + n + '.';
    if (a === 'addtag') return 'Tagged ' + n + ' with “' + esc(v) + '”.';
    if (a === 'removetag') return 'Removed “' + esc(v) + '” from ' + n + '.';
    if (a === 'delete') return 'Deleted ' + n + ' permanently.';
    return 'Done.';
  }
  async function bulkApply(action, value) {
    var ids = Object.keys(st.selected).map(Number);
    if (!ids.length) return;
    var r = await api('POST', '/api/bulk', { ids: ids, action: action, value: value });
    if (!r.ok) return;
    clearSelection();
    await reload(); render(); showNotice(bulkMsg(action, ids.length, value));
  }

  // ---- save (preview -> review -> create) ----
  function closeReview() { st.pendingPreview = null; reviewEl.hidden = true; reviewEl.innerHTML = ''; }
  function goToExisting(bk) {
    clearSelection();
    st.activeTags = []; st.query = ''; searchInput.value = ''; searchClear.hidden = true;
    st.active = bk.archived ? 'archived' : 'all'; st.visibleCount = Math.max(st.visibleCount, 1e9);
    closeReview(); render();
    showNotice('You already saved this — <b>' + esc(bk.title) + '</b>. Here it is.');
    goToEntry(bk.id);
  }
  function openReview(pv) {
    st.pendingPreview = pv; reviewEl.hidden = false;
    reviewEl.innerHTML =
      '<div class="rh">✎ Review before saving</div>' +
      (pv.image ? '<img class="rimg" src="' + esc(pv.image) + '" alt="" onerror="this.style.display=\'none\'">' : '') +
      '<div class="rurl">' + esc(pv.url) + '</div>' +
      (pv.retrieved ? '' : '<div class="ef-error">We couldn’t read this page’s details automatically — please fill them in below.</div>') +
      '<label>Title</label><input data-rv="title" value="' + esc(pv.title) + '">' +
      '<label>Description</label><textarea data-rv="description" rows="2">' + esc(pv.description) + '</textarea>' +
      '<label>Your note (optional)</label><textarea data-rv="note" rows="2" placeholder="Add a private note…"></textarea>' + FMT_HINT +
      '<div class="row"><button class="btn primary" data-reviewsave>Add to library</button><button class="btn" data-reviewcancel>Discard</button></div>';
    reviewEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    var t = reviewEl.querySelector('[data-rv="title"]'); if (t) t.focus();
  }
  async function confirmCreate() {
    if (!st.pendingPreview) return;
    var pv = st.pendingPreview;
    var payload = {
      url: pv.url,
      title: reviewEl.querySelector('[data-rv="title"]').value,
      description: reviewEl.querySelector('[data-rv="description"]').value,
      note: reviewEl.querySelector('[data-rv="note"]').value,
      image: pv.image || '', retrieved: pv.retrieved,
    };
    var r = await api('POST', '/api/bookmarks', payload);
    if (!r.ok) return;
    if (r.data.duplicate) { goToExisting(r.data.bookmark); return; }
    closeReview(); noticeEl.hidden = true;
    st.activeTags = []; st.query = ''; searchInput.value = ''; searchClear.hidden = true;
    st.active = 'all'; st.visibleCount = BATCH; clearSelection();
    await reload(); render(r.data.bookmark.id);
    showNotice('Added <b>' + esc(r.data.bookmark.title) + '</b> to your library.');
  }

  // ---- events ----
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var url = urlInput.value.trim(); if (!url) return;
    st.editingId = null;
    saveBtn.disabled = true; saveBtn.textContent = 'Fetching…';
    try {
      var r = await api('POST', '/api/preview', { url: url });
      if (!r.ok) {
        showNotice(r.data.error === 'invalid_url'
          ? 'That address doesn’t look valid — please check it and try again.'
          : 'Something went wrong fetching that link — please try again.', true);
        return;
      }
      if (r.data.duplicate) { urlInput.value = ''; goToExisting(r.data.bookmark); }
      else { urlInput.value = ''; openReview(r.data.preview); }
    } finally {
      if (saveBtn.textContent === 'Fetching…') saveBtn.textContent = 'Save';
      saveBtn.disabled = false;
    }
  });

  searchInput.addEventListener('input', function () {
    st.query = searchInput.value; searchClear.hidden = !st.query.length;
    st.editingId = null; st.editingTagId = null; st.visibleCount = BATCH; clearSelection(); render();
  });
  searchClear.addEventListener('click', function () {
    st.query = ''; searchInput.value = ''; searchClear.hidden = true; st.visibleCount = BATCH; clearSelection(); searchInput.focus(); render();
  });
  sortEl.addEventListener('change', function () { st.sortBy = sortEl.value; st.visibleCount = BATCH; render(); });
  tipsBtn.addEventListener('click', function () { tipsPanel.hidden = !tipsPanel.hidden; });
  selAllEl.addEventListener('change', function () {
    if (selAllEl.checked) st.matchIds.forEach(function (id) { st.selected[id] = true; });
    else st.matchIds.forEach(function (id) { delete st.selected[id]; });
    render();
  });
  document.addEventListener('change', function (e) {
    var sb = e.target.closest ? e.target.closest('[data-sel]') : null; if (!sb) return;
    var id = +sb.getAttribute('data-sel');
    if (sb.checked) st.selected[id] = true; else delete st.selected[id];
    render();
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-loadmore]')) { st.visibleCount += BATCH; render(); return; }
    var nm = e.target.closest('[data-noteid]');
    if (nm) { var nid = +nm.getAttribute('data-noteid'); st.expanded[nid] = !st.expanded[nid]; render(); return; }
    var bmo = e.target.closest('[data-bulkmode]');
    if (bmo) { st.bulkMode = bmo.getAttribute('data-bulkmode'); renderBulk(); return; }
    if (e.target.closest('[data-bulkclear]')) { clearSelection(); render(); return; }
    if (e.target.closest('[data-bulkcancel]')) { st.bulkMode = 'none'; renderBulk(); return; }
    if (e.target.closest('[data-bulkapply]')) { var bt = bulkbarEl.querySelector('#bulktag'); bulkApply(st.bulkMode === 'addtag' ? 'addtag' : 'removetag', bt ? bt.value : ''); return; }
    var ba = e.target.closest('[data-bulk]');
    if (ba) { bulkApply(ba.getAttribute('data-bulk')); return; }
    var da = e.target.closest('[data-delask]');
    if (da) { st.confirmingDeleteId = +da.getAttribute('data-delask'); render(); return; }
    if (e.target.closest('[data-delno]')) { st.confirmingDeleteId = null; render(); return; }
    var dy = e.target.closest('[data-delyes]');
    if (dy) { deleteEntry(+dy.getAttribute('data-delyes')); return; }
    var t = e.target.closest('[data-tab]');
    if (t) { st.active = t.getAttribute('data-tab'); st.editingTagId = null; st.editingId = null; st.visibleCount = BATCH; clearSelection(); render(); return; }
    if (e.target.closest('[data-clearfilter]')) { st.activeTags = []; st.visibleCount = BATCH; clearSelection(); render(); return; }
    var un = e.target.closest('[data-untag]');
    if (un) { toggleTag(un.getAttribute('data-untag')); st.visibleCount = BATCH; clearSelection(); render(); return; }
    var tf = e.target.closest('[data-tagfilter]');
    if (tf) { toggleTag(tf.getAttribute('data-tagfilter')); st.editingTagId = null; st.visibleCount = BATCH; clearSelection(); render(); return; }
    var tr = e.target.closest('[data-tagremove]');
    if (tr) { tagOp(+tr.getAttribute('data-id'), tr.getAttribute('data-tagremove'), false); return; }
    var ta = e.target.closest('[data-tagadd]');
    if (ta) { st.editingTagId = +ta.getAttribute('data-tagadd'); render(); return; }
    var eo = e.target.closest('[data-editopen]');
    if (eo) { st.editingId = +eo.getAttribute('data-editopen'); st.editingTagId = null; st.confirmingDeleteId = null; render(); return; }
    var ec = e.target.closest('[data-editcancel]');
    if (ec) { st.editingId = null; st.confirmingDeleteId = null; render(); return; }
    var es = e.target.closest('[data-editsave]');
    if (es) { saveEdit(+es.getAttribute('data-editsave')); return; }
    if (e.target.closest('[data-reviewsave]')) { confirmCreate(); return; }
    if (e.target.closest('[data-reviewcancel]')) { closeReview(); return; }
    var ac = e.target.closest('[data-act]');
    if (ac) {
      var id = +ac.getAttribute('data-id'), a = ac.getAttribute('data-act');
      if (a === 'read') markRead(id); else if (a === 'unread') markUnread(id);
      else if (a === 'archive') archive(id); else if (a === 'restore') restore(id);
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    var bt = e.target.closest ? e.target.closest('#bulktag') : null;
    if (bt) { if (e.key === 'Enter') { e.preventDefault(); bulkApply(st.bulkMode === 'addtag' ? 'addtag' : 'removetag', bt.value); } else if (e.key === 'Escape') { st.bulkMode = 'none'; renderBulk(); } return; }
    var inp = e.target.closest ? e.target.closest('[data-taginput]') : null; if (!inp) return;
    if (e.key === 'Enter') { e.preventDefault(); var id = +inp.getAttribute('data-taginput'); var v = inp.value.trim(); st.editingTagId = null; if (v) tagOp(id, v, true); else render(); }
    else if (e.key === 'Escape') { st.editingTagId = null; render(); }
  });
  document.addEventListener('focusout', function (e) {
    var inp = e.target.closest ? e.target.closest('[data-taginput]') : null; if (!inp) return;
    var id = +inp.getAttribute('data-taginput'); var v = inp.value.trim(); st.editingTagId = null;
    if (v) tagOp(id, v, true); else render();
  });

  // ---- boot ----
  (async function () {
    await reload();
    render();
    document.getElementById('wrap').setAttribute('data-harness-ready', 'true');
  })();
})();
