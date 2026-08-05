/* Bookmarks UI. Implements the approved scenarios SCN-001..SCN-008.
   Shared logic (search/tags/validation) comes from window.BM (/shared.js). */
(function () {
  'use strict';
  var BM = window.BM;

  var state = {
    bookmarks: [],   // full library, newest first (as returned by the server)
    query: '',       // SCN-002 live search text
    tag: null,       // SCN-003 active tag filter (null = All)
    freshId: null    // SCN-004 id of the just-saved link showing the tag prompt
  };
  var hiddenIds = new Set();     // SCN-008 items hidden pending an undo window
  var pendingDelete = null;      // { id, timer } for the deferred server delete
  var UNDO_MS = 5000;

  // --- element refs ---
  var $ = function (id) { return document.getElementById(id); };
  var listEl = $('list'), tagsEl = $('tags'), countEl = $('count'),
      emptyEl = $('emptyState'), saveError = $('saveError'), dupeNotice = $('dupeNotice'),
      toastHost = $('toastHost'), urlInput = $('urlInput'), searchInput = $('searchInput');

  // --- tiny API client ---
  var api = {
    list: function () { return fetch('/api/bookmarks').then(j); },
    create: function (url, tags) { return fetch('/api/bookmarks', post({ url: url, tags: tags || [] })); },
    patch: function (id, fields) { return fetch('/api/bookmarks/' + id, { method: 'PATCH', headers: hdr(), body: JSON.stringify(fields) }).then(j); },
    del: function (id) { return fetch('/api/bookmarks/' + id, { method: 'DELETE' }); },
    refresh: function (id) { return fetch('/api/bookmarks/' + id + '/refresh-title', { method: 'POST' }).then(j); }
  };
  function hdr() { return { 'Content-Type': 'application/json' }; }
  function post(body) { return { method: 'POST', headers: hdr(), body: JSON.stringify(body) }; }
  function j(res) { return res.json(); }

  // --- helpers ---
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // Escape, then wrap the first case-insensitive match of q in <mark>.
  function highlight(text, q) {
    text = String(text == null ? '' : text);
    if (!q) return esc(text);
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) +
      '</mark>' + esc(text.slice(i + q.length));
  }
  function byId(id) { return state.bookmarks.find(function (b) { return b.id === id; }); }
  function existingTags() { return BM.deriveTags(state.bookmarks).map(function (t) { return t.tag; }); }
  function visibleAll() { return state.bookmarks.filter(function (b) { return !hiddenIds.has(b.id); }); }

  // --- rendering ---------------------------------------------------------
  function render() {
    renderTags();
    renderList();
  }

  function renderTags() {
    var tags = BM.deriveTags(visibleAll());
    var html = tagChip('All', null, state.tag === null);
    tags.forEach(function (t) {
      html += tagChip(t.tag, t.tag, state.tag === t.tag, t.count);
    });
    tagsEl.innerHTML = html;
    Array.prototype.forEach.call(tagsEl.querySelectorAll('.tag'), function (el) {
      el.onclick = function () {
        var t = el.getAttribute('data-tag');
        state.tag = (t === '' ? null : t);
        render();
      };
    });
  }
  function tagChip(label, value, active, count) {
    return '<span class="tag' + (active ? ' active' : '') + '" data-tag="' + esc(value || '') + '">' +
      esc(label) + (count != null ? '<span class="num">' + count + '</span>' : '') + '</span>';
  }

  function renderList() {
    var all = visibleAll();
    var items = BM.filterBookmarks(all, { query: state.query, tag: state.tag });

    // Empty states (SCN-005)
    if (all.length === 0) {
      countEl.textContent = '';
      listEl.innerHTML = '';
      showEmpty(
        '&#128278;', 'No bookmarks yet',
        'Paste a link at the top to save your first one.',
        'Tip: the app grabs each page’s title for you, so it’s easy to find later.');
      return;
    }
    if (items.length === 0) {
      countEl.textContent = '';
      listEl.innerHTML = '';
      if (state.query) {
        showEmpty('&#128269;', 'No matches for “' + esc(state.query) + '”',
          'Nothing you’ve saved matches that.',
          'Try fewer or different words, or clear the search.');
      } else {
        showEmpty('&#127991;', 'No links tagged “' + esc(state.tag) + '”', '', '');
      }
      return;
    }
    emptyEl.hidden = true;

    // Count line
    if (state.query) {
      countEl.textContent = items.length + ' match' + (items.length === 1 ? '' : 'es') +
        ' for "' + state.query + '"';
    } else if (state.tag) {
      countEl.textContent = items.length + ' link' + (items.length === 1 ? '' : 's') + ' tagged ' + state.tag;
    } else {
      countEl.textContent = all.length + ' saved link' + (all.length === 1 ? '' : 's');
    }

    listEl.innerHTML = items.map(renderItem).join('');
    wireItems();
  }

  function showEmpty(big, title, p, cta) {
    emptyEl.hidden = false;
    emptyEl.innerHTML = '<div class="big">' + big + '</div><h3>' + title + '</h3>' +
      (p ? '<p>' + p + '</p>' : '') + (cta ? '<p class="cta">' + cta + '</p>' : '');
  }

  function renderItem(b) {
    var q = state.query;
    var isFresh = b.id === state.freshId;
    var letter = esc((b.title || b.host || '?').charAt(0).toUpperCase());

    var titleHtml = '<a href="' + esc(b.url) + '" target="_blank" rel="noopener">' +
      highlight(b.title, q) + '</a>';
    var warn = b.needsTitle
      ? ' <span class="warn">title not found</span>' +
        ' <button class="link-btn" data-name="' + esc(b.id) + '">add a name</button>'
      : '';

    var chips = (b.tags || []).map(function (t) {
      return '<span class="chip" data-browse="' + esc(t) + '">' + esc(t) +
        (isFresh ? ' <span class="x" data-untag="' + esc(t) + '">×</span>' : '') + '</span>';
    }).join('');

    var tagArea;
    if (isFresh) {
      tagArea = '<p class="prompt">Add tags for this?</p><div class="chips">' + chips +
        '<span style="position:relative"><input class="taginput" data-tagfor="' + esc(b.id) +
        '" placeholder="type a tag…" autocomplete="off" />' +
        '<div class="sugg" data-sugg="' + esc(b.id) + '" style="display:none"></div></span>' +
        '<button class="skip" data-skip="1">skip</button></div>';
    } else {
      tagArea = chips ? '<div class="chips">' + chips + '</div>' : '';
    }

    return '<li class="item' + (isFresh ? ' fresh' : '') + '" data-id="' + esc(b.id) + '">' +
      '<div class="favicon">' + letter + '</div>' +
      '<div class="meta">' +
        '<p class="title">' + titleHtml + warn + '</p>' +
        '<p class="url">' + highlight(b.host, q) + '</p>' + tagArea +
      '</div>' +
      '<button class="trash" data-del="' + esc(b.id) + '" title="Delete" aria-label="Delete">&#128465;</button>' +
    '</li>';
  }

  function wireItems() {
    // Delete (SCN-008)
    each('[data-del]', function (el) { el.onclick = function () { startDelete(el.getAttribute('data-del')); }; });
    // Browse by clicking a tag chip (SCN-003)
    each('[data-browse]', function (el) {
      el.onclick = function (e) { e.stopPropagation(); state.tag = el.getAttribute('data-browse'); render(); };
    });
    // Remove a tag from the fresh item (correcting a mistake, SCN-004)
    each('[data-untag]', function (el) {
      el.onclick = function (e) { e.stopPropagation(); removeTag(closestId(el), el.getAttribute('data-untag')); };
    });
    // Add-a-name for a link with no fetched title (SCN-006)
    each('[data-name]', function (el) { el.onclick = function () { addName(el.getAttribute('data-name')); }; });
    // Skip the tag prompt (SCN-004)
    each('[data-skip]', function (el) { el.onclick = function () { closePrompt(); }; });
    // The fresh-item tag input + autocomplete
    var ti = listEl.querySelector('[data-tagfor]');
    if (ti) wireTagInput(ti);
  }
  function each(sel, fn) { Array.prototype.forEach.call(listEl.querySelectorAll(sel), fn); }
  function closestId(el) { var li = el.closest('.item'); return li && li.getAttribute('data-id'); }

  // --- saving (SCN-001/006) ---------------------------------------------
  function save() {
    var raw = urlInput.value.trim();
    saveError.textContent = '';
    dupeNotice.hidden = true;
    urlInput.classList.remove('bad');
    if (!raw) return;

    api.create(raw).then(function (res) {
      return res.json().then(function (body) { return { status: res.status, body: body }; });
    }).then(function (r) {
      if (r.status === 400) { // not a link
        urlInput.classList.add('bad');
        saveError.textContent = 'That doesn’t look like a web link, so nothing was saved. ' +
          'Paste a link with a site address (like example.com).';
        return;
      }
      if (r.status === 409) { // duplicate
        showDuplicate(r.body.existing);
        return;
      }
      // created
      state.bookmarks.unshift(r.body);
      state.freshId = r.body.id;
      urlInput.value = '';
      render();
      focusFreshInput();
      if (r.body.needsTitle) tryRefresh(r.body.id); // maybe it was a transient/offline failure
    });
  }

  function showDuplicate(existing) {
    dupeNotice.hidden = false;
    dupeNotice.innerHTML = 'You already saved this link.' +
      '<a data-showdupe="1">Show me the one I saved</a>';
    dupeNotice.querySelector('[data-showdupe]').onclick = function () {
      // clear filters so the existing one is visible, then flash it
      state.query = ''; state.tag = null; searchInput.value = '';
      render();
      var li = listEl.querySelector('[data-id="' + cssEscape(existing.id) + '"]');
      if (li) {
        li.classList.add('flash');
        li.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () { li.classList.remove('flash'); }, 2000);
      }
    };
  }
  function cssEscape(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  // --- title fixups (SCN-006/007) ---------------------------------------
  function addName(id) {
    var b = byId(id); if (!b) return;
    var name = window.prompt('Give this link a name you’ll recognize:', b.title);
    if (name && name.trim()) {
      api.patch(id, { title: name.trim() }).then(function (updated) { replace(updated); render(); });
    }
  }
  function tryRefresh(id) {
    api.refresh(id).then(function (updated) {
      if (updated && !updated.needsTitle) { replace(updated); render(); }
    }).catch(function () {});
  }
  function refreshMissingTitles() {
    state.bookmarks.filter(function (b) { return b.needsTitle; })
      .forEach(function (b) { tryRefresh(b.id); });
  }

  // --- tagging (SCN-003/004) --------------------------------------------
  function wireTagInput(ti) {
    var id = ti.getAttribute('data-tagfor');
    var sugg = listEl.querySelector('[data-sugg="' + cssEscape(id) + '"]');
    var hl = -1;

    function renderSugg() {
      var b = byId(id); if (!b) return;
      var q = ti.value.trim().toLowerCase();
      var matches = existingTags().filter(function (t) {
        return t.toLowerCase().indexOf(q) >= 0 && b.tags.indexOf(t) < 0;
      });
      if (!q || !matches.length) { sugg.style.display = 'none'; return; }
      sugg.innerHTML = matches.map(function (t, i) {
        return '<div class="' + (i === hl ? 'hl' : '') + '" data-pick="' + esc(t) + '">' + esc(t) + '</div>';
      }).join('');
      sugg.style.display = 'block';
      Array.prototype.forEach.call(sugg.querySelectorAll('[data-pick]'), function (d) {
        d.onmousedown = function (e) { e.preventDefault(); commit(d.getAttribute('data-pick')); };
      });
    }
    function commit(tag) {
      tag = (tag || '').trim();
      if (tag) addTag(id, tag);
    }
    ti.addEventListener('input', function () { hl = -1; renderSugg(); });
    ti.addEventListener('keydown', function (e) {
      var opts = sugg.querySelectorAll('[data-pick]');
      if (e.key === 'ArrowDown') { e.preventDefault(); hl = Math.min(hl + 1, opts.length - 1); renderSugg(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hl = Math.max(hl - 1, 0); renderSugg(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (hl >= 0 && opts[hl]) commit(opts[hl].getAttribute('data-pick'));
        else if (ti.value.trim()) commit(ti.value);
        else closePrompt();
      } else if (e.key === 'Escape') { closePrompt(); }
    });
    ti.focus();
  }

  function addTag(id, tag) {
    var b = byId(id); if (!b) return;
    var next = (b.tags || []).concat([tag]);
    api.patch(id, { tags: next }).then(function (updated) {
      replace(updated);
      render();
      focusFreshInput(); // keep adding more tags
    });
  }
  function removeTag(id, tag) {
    var b = byId(id); if (!b) return;
    var next = (b.tags || []).filter(function (t) { return t !== tag; });
    api.patch(id, { tags: next }).then(function (updated) { replace(updated); render(); focusFreshInput(); });
  }
  function closePrompt() { state.freshId = null; render(); urlInput.focus(); }
  function focusFreshInput() {
    var ti = listEl.querySelector('[data-tagfor]');
    if (ti) ti.focus();
  }

  // --- delete + undo (SCN-008) ------------------------------------------
  function startDelete(id) {
    commitPending();            // finalize any earlier pending delete first
    var b = byId(id); if (!b) return;
    if (state.freshId === id) state.freshId = null;
    hiddenIds.add(id);          // vanish immediately from the list
    render();
    var timer = setTimeout(function () { commitPending(); }, UNDO_MS);
    pendingDelete = { id: id, timer: timer };
    showToast(b.title);
  }
  function commitPending() {
    if (!pendingDelete) return;
    var id = pendingDelete.id;
    clearTimeout(pendingDelete.timer);
    pendingDelete = null;
    clearToast();
    api.del(id).then(function () {
      state.bookmarks = state.bookmarks.filter(function (b) { return b.id !== id; });
      hiddenIds.delete(id);
      render();
    });
  }
  function undo() {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    hiddenIds.delete(pendingDelete.id);
    pendingDelete = null;
    clearToast();
    render();
  }
  function showToast(title) {
    var short = title.length > 32 ? title.slice(0, 32) + '…' : title;
    toastHost.innerHTML = '<div class="toast"><span>Deleted “' + esc(short) +
      '”</span><button data-undo="1">Undo</button>' +
      '<div class="timer" style="width:100%"></div></div>';
    toastHost.querySelector('[data-undo]').onclick = undo;
    var t = toastHost.querySelector('.timer');
    // animate the countdown bar
    requestAnimationFrame(function () {
      t.style.transition = 'width ' + UNDO_MS + 'ms linear';
      t.style.width = '0%';
    });
  }
  function clearToast() { toastHost.innerHTML = ''; }

  function replace(updated) {
    if (!updated || !updated.id) return;
    var i = state.bookmarks.findIndex(function (b) { return b.id === updated.id; });
    if (i >= 0) state.bookmarks[i] = updated;
  }

  // --- boot --------------------------------------------------------------
  $('saveForm').addEventListener('submit', function (e) { e.preventDefault(); save(); });
  searchInput.addEventListener('input', function () { state.query = searchInput.value.trim(); renderList(); });
  window.addEventListener('beforeunload', commitPending);

  api.list().then(function (items) {
    state.bookmarks = Array.isArray(items) ? items : [];
    render();
    refreshMissingTitles();
  });
})();
