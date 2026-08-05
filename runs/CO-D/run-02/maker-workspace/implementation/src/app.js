/*
 * app.js — the browser UI. Renders the store and wires every interaction.
 * Depends on the globals from core.js (BookmarkCore) and store.js (BookmarkStore).
 *
 * Scenario map: SCN-001 search box + highlight; SCN-002 tag row + roundups;
 * SCN-004 add panel + autofill + dupe; SCN-005 inline edits + Edit details;
 * SCN-006 set aside / delete / undo; SCN-007 empty states; SCN-008 paste hints;
 * SCN-009 order control; SCN-010 reading pile.
 */
(function () {
  'use strict';
  var core = window.BookmarkCore;
  var $ = function (id) { return document.getElementById(id); };

  // Storage counts as durable only if a write can be read back. If it can't
  // (some browsers block this for double-clicked files), we must NOT pretend to
  // save — we warn the client instead, so nothing is ever silently lost.
  function durableStorage() {
    try {
      var ls = window.localStorage, k = '__bm_probe__';
      ls.setItem(k, '1');
      var ok = ls.getItem(k) === '1';
      ls.removeItem(k);
      return ok ? ls : null;
    } catch (e) { return null; }
  }
  var durable = durableStorage();
  var store = window.BookmarkStore.createStore({ storage: durable || undefined });

  function warnIfNotDurable() {
    if (durable) return;
    var el = document.getElementById('storageWarn');
    el.innerHTML = '<strong>⚠️ This browser isn\'t letting the app keep your bookmarks here.</strong>'
      + 'Anything you save now will be lost when you close the page. To keep your bookmarks for good, '
      + 'open the app with its launcher — <code>start.command</code> (Mac), <code>start.sh</code> (Linux) '
      + 'or <code>start.bat</code> (Windows) — which runs it from a stable local address.';
    el.style.display = 'block';
  }

  var editing = null;      // url of the bookmark being edited, or null when adding
  var pendingTags = [];
  var activeTag = null;
  var readingView = false;
  var viewMode = 'active'; // 'active' | 'aside'
  var deleteArmed = false;
  var toastTimer = null;
  var sortBy = store.getSort();

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function highlight(text, tokens) {
    var safe = escapeHtml(text);
    if (!tokens.length) return safe;
    var re = new RegExp('\\b(' + tokens.map(core.escapeRegExp).join('|') + ')', 'ig');
    return safe.replace(re, '<mark>$1</mark>');
  }

  // --- undo toast (SCN-006 / SCN-010) ---------------------------------------
  function showToast(msg, undoFn) {
    $('toastMsg').textContent = msg;
    $('toast').style.display = 'flex';
    $('toastUndo').onclick = function () { hideToast(); undoFn(); };
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }
  function hideToast() { $('toast').style.display = 'none'; }

  // --- tidy actions ---------------------------------------------------------
  function setAside(url) { store.setAside(url, true); if (activeTag && !store.labels().includes(activeTag)) activeTag = null; render(); showToast('Set aside — out of your main list.', function () { store.setAside(url, false); render(); }); }
  function bringBack(url) { store.setAside(url, false); render(); showToast('Brought back to your list.', function () { store.setAside(url, true); render(); }); }
  function markRead(url) { store.setUnread(url, false); render(); showToast('Marked as read — off your reading pile.', function () { store.setUnread(url, true); render(); }); }
  function markUnread(url) { store.setUnread(url, true); render(); showToast('Added to your reading pile.', function () { store.setUnread(url, false); render(); }); }
  function deleteForGood(url) {
    var removed = store.remove(url);
    if (!removed) return;
    if (activeTag && !store.labels().includes(activeTag)) activeTag = null;
    render();
    showToast('Deleted for good.', function () { store.insertAt(removed.item, removed.index); render(); });
  }

  // --- add / edit panel -----------------------------------------------------
  function renderChips() {
    var box = $('chipsIn');
    Array.prototype.slice.call(box.querySelectorAll('.chip-editable')).forEach(function (e) { e.remove(); });
    pendingTags.forEach(function (t, i) {
      var c = document.createElement('span');
      c.className = 'chip-editable';
      c.innerHTML = escapeHtml(t) + ' <button>✕</button>';
      c.querySelector('button').addEventListener('click', function () { pendingTags.splice(i, 1); renderChips(); renderSuggest(); });
      box.insertBefore(c, $('labelInput'));
    });
  }
  function renderSuggest() {
    var typed = $('labelInput').value.trim().toLowerCase();
    var existing = store.labels().filter(function (t) { return pendingTags.indexOf(t) === -1; });
    if (typed) existing = existing.filter(function (t) { return t.toLowerCase().indexOf(typed) !== -1; });
    var heading = typed ? 'Did you mean: ' : 'Reuse a label: ';
    $('suggest').innerHTML = existing.length ? heading + existing.map(function (t) { return '<button data-t="' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>'; }).join('') : '';
    Array.prototype.slice.call($('suggest').querySelectorAll('button')).forEach(function (b) {
      b.addEventListener('click', function () { pendingTags.push(b.getAttribute('data-t')); $('labelInput').value = ''; renderChips(); renderSuggest(); });
    });
  }
  function addLabelFromInput() {
    var v = $('labelInput').value.trim();
    if (v) { var use = store.canonicalLabel(v); if (pendingTags.indexOf(use) === -1) pendingTags.push(use); }
    $('labelInput').value = '';
    renderChips(); renderSuggest();
  }
  function resetDelete() { deleteArmed = false; $('deleteBtn').classList.remove('armed'); $('deleteBtn').textContent = 'Delete for good'; }

  function openAdder() {
    editing = null; resetDelete();
    $('adder').classList.add('open');
    $('adderTitle').textContent = 'Save a new bookmark';
    $('urlLabel').textContent = 'Paste the link';
    $('saveBtn').textContent = 'Save it'; $('saveBtn').disabled = true;
    $('deleteBtn').style.display = 'none'; $('asideBtn').style.display = 'none';
    $('url').value = ''; $('url').readOnly = false;
    $('fUnread').checked = false;
    $('dupe').style.display = 'none'; $('urlHint').style.display = 'none'; $('warn').style.display = 'none';
    $('preview').classList.remove('show');
    pendingTags = []; renderChips(); renderSuggest();
    $('url').focus();
  }
  function openEditor(item) {
    editing = item.url; resetDelete();
    $('adder').classList.add('open');
    $('adderTitle').textContent = 'Edit details';
    $('urlLabel').textContent = 'The link (its real web address — you can fix it if it moved or is wrong)';
    $('dupe').style.display = 'none'; $('urlHint').style.display = 'none'; $('warn').style.display = 'none';
    $('url').value = item.url; $('url').readOnly = false;
    $('preview').classList.add('show');
    $('fTitle').value = item.title; $('fSite').value = item.source; $('fDesc').value = item.desc || ''; $('fNote').value = item.note || ''; $('fUnread').checked = !!item.unread;
    $('tFill').textContent = ''; $('sFill').textContent = ''; $('dFill').textContent = '';
    pendingTags = (item.tags || []).slice(); renderChips(); renderSuggest();
    $('saveBtn').textContent = 'Save changes'; $('saveBtn').disabled = false;
    $('deleteBtn').style.display = 'inline-block'; $('asideBtn').style.display = 'inline-block';
    $('adder').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function closeAdder() {
    $('adder').classList.remove('open'); $('preview').classList.remove('show');
    $('url').value = ''; $('url').readOnly = false;
    $('fTitle').value = ''; $('fSite').value = ''; $('fDesc').value = ''; $('fNote').value = ''; $('fUnread').checked = false;
    $('dupe').style.display = 'none'; $('warn').style.display = 'none'; $('urlHint').style.display = 'none';
    editing = null; resetDelete();
    $('deleteBtn').style.display = 'none'; $('asideBtn').style.display = 'none';
    pendingTags = []; renderChips(); renderSuggest(); $('saveBtn').disabled = true;
    $('tFill').textContent = ''; $('sFill').textContent = ''; $('dFill').textContent = '';
  }
  function flashTo(url) {
    render();
    var el = $('list').querySelector('[data-url="' + cssEscape(url) + '"]');
    if (el) { el.classList.add('fresh'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cssEscape(s) { return String(s).replace(/"/g, '\\"'); }

  $('addBtn').addEventListener('click', openAdder);
  $('cancelBtn').addEventListener('click', closeAdder);

  $('url').addEventListener('input', function () {
    if (editing) return; // in the editor the link is yours to fix; no auto-fetch
    var u = $('url').value.trim();
    if (!u) { $('urlHint').style.display = 'none'; $('dupe').style.display = 'none'; $('preview').classList.remove('show'); $('saveBtn').disabled = true; return; }
    var existing = store.find(u);
    if (existing) {
      $('urlHint').style.display = 'none'; $('dupe').style.display = 'block';
      $('dupeText').textContent = 'You already saved this one — "' + existing.title + '".';
      $('openExisting').onclick = function () { $('dupe').style.display = 'none'; openEditor(existing); };
      $('preview').classList.remove('show'); $('saveBtn').disabled = true; return;
    }
    $('dupe').style.display = 'none';
    if (!core.asUrl(u)) {
      $('urlHint').style.display = 'block'; $('urlHint').style.color = '#b45309';
      $('urlHint').textContent = "That doesn't look like a web link yet — a bookmark needs an address (like https://…) to take you back to.";
      $('preview').classList.remove('show'); $('saveBtn').disabled = true; return;
    }
    var g = core.resolveMetadata(u);
    $('preview').classList.add('show');
    $('fTitle').value = g.title; $('fSite').value = g.source; $('fDesc').value = g.desc;
    if (g.autofilled) {
      $('urlHint').style.display = 'none';
      $('tFill').textContent = 'filled in for you'; $('sFill').textContent = 'filled in for you'; $('dFill').textContent = 'filled in for you';
    } else {
      $('urlHint').style.display = 'block'; $('urlHint').style.color = '#6b7280';
      $('urlHint').textContent = "Couldn't read this page automatically — pop in a title so you'll recognise it later. You can still save it.";
      $('tFill').textContent = ''; $('sFill').textContent = ''; $('dFill').textContent = '';
    }
    renderSuggest(); $('saveBtn').disabled = false;
  });

  $('labelInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addLabelFromInput(); } });
  $('labelInput').addEventListener('input', renderSuggest);

  $('saveBtn').addEventListener('click', function () {
    if (editing) {
      var res = store.update(editing, {
        url: $('url').value.trim(), title: $('fTitle').value.trim() || '(untitled)', source: $('fSite').value.trim() || 'Unknown site',
        desc: $('fDesc').value.trim(), note: $('fNote').value.trim(), tags: pendingTags.slice(), unread: $('fUnread').checked
      });
      if (!res.ok && res.clash) { $('warn').style.display = 'block'; $('warn').textContent = 'That link already belongs to another bookmark ("' + res.clash.title + '"). Give this one a different link.'; return; }
      var url = res.item.url; closeAdder(); flashTo(url); return;
    }
    var u = $('url').value.trim();
    var add = store.add({
      url: u, title: $('fTitle').value.trim() || '(untitled)', source: $('fSite').value.trim() || 'Unknown site',
      desc: $('fDesc').value.trim(), note: $('fNote').value.trim(), tags: pendingTags.slice(), unread: $('fUnread').checked
    });
    if (add.duplicate) { closeAdder(); openEditor(add.item); return; }
    closeAdder(); $('q').value = ''; activeTag = null; flashTo(add.item.url);
  });

  $('asideBtn').addEventListener('click', function () { if (!editing) return; var url = editing; closeAdder(); setAside(url); });
  $('deleteBtn').addEventListener('click', function () {
    if (!editing) return;
    if (!deleteArmed) { deleteArmed = true; $('deleteBtn').classList.add('armed'); $('deleteBtn').textContent = 'Really delete? Click again'; return; }
    var url = editing; closeAdder(); deleteForGood(url);
  });

  // --- top bars -------------------------------------------------------------
  function renderAsideBar() {
    var n = store.asideItems().length; var bar = $('asideBar');
    if (viewMode === 'aside') { bar.innerHTML = '<a href="#" id="backActive">← Back to my list</a>'; $('backActive').onclick = function (e) { e.preventDefault(); viewMode = 'active'; render(); }; }
    else if (n > 0) { bar.innerHTML = '<a href="#" id="toAside">🗂 Set aside (' + n + ')</a>'; $('toAside').onclick = function (e) { e.preventDefault(); viewMode = 'aside'; render(); }; }
    else bar.innerHTML = '';
  }
  function renderReadBar() {
    if (viewMode === 'aside') { $('readBar').innerHTML = ''; return; }
    var n = store.unreadCount(); var bar = $('readBar');
    if (n > 0 || readingView) {
      bar.innerHTML = '<button class="readtoggle ' + (readingView ? 'on' : '') + '" id="readToggle">📖 To read (' + n + ')</button>';
      $('readToggle').onclick = function () { readingView = !readingView; render(); };
    } else bar.innerHTML = '';
  }
  function renderTagbar() {
    var all = store.labels();
    $('tagbar').innerHTML = (all.length ? '<span class="label">Round up:</span>' : '') + all.map(function (t) {
      return '<button class="filter ' + (t === activeTag ? 'on' : '') + '" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>';
    }).join('') + (activeTag ? '<button class="clear" id="clearBtn">✕ Show all again</button>' : '');
    Array.prototype.slice.call($('tagbar').querySelectorAll('.filter')).forEach(function (el) {
      el.addEventListener('click', function () { var t = el.getAttribute('data-tag'); activeTag = (activeTag === t) ? null : t; render(); });
    });
    var cb = $('clearBtn'); if (cb) cb.addEventListener('click', function () { activeTag = null; render(); });
  }

  // --- set-aside view -------------------------------------------------------
  function renderAside() {
    $('searchBar').style.display = 'none'; $('tagbar').innerHTML = ''; $('sortWrap').style.display = 'none';
    var aside = store.asideItems();
    $('count').textContent = aside.length + (aside.length === 1 ? ' thing set aside' : ' things set aside');
    if (!aside.length) { $('list').innerHTML = ''; $('empty').style.display = 'block'; $('empty').innerHTML = 'Nothing set aside.'; return; }
    $('empty').style.display = 'none';
    $('list').innerHTML = aside.map(function (b) {
      return '<li data-url="' + escapeHtml(b.url || '') + '" style="opacity:.85;">'
        + '<p class="title">' + escapeHtml(b.title) + '</p>'
        + '<p class="site">' + escapeHtml(b.source) + '</p>'
        + (b.note ? '<p class="desc" style="border-left:3px solid #c7d2fe; padding-left:10px; color:#3730a3;"><em>' + escapeHtml(b.note) + '</em></p>' : '')
        + '<div class="aside-actions"><button class="save bringback" data-url="' + escapeHtml(b.url || '') + '">Bring back</button>'
        + '<button class="cancel delperm" data-url="' + escapeHtml(b.url || '') + '">Delete for good</button></div>'
        + '</li>';
    }).join('');
    Array.prototype.slice.call($('list').querySelectorAll('.bringback')).forEach(function (el) { el.addEventListener('click', function () { bringBack(el.getAttribute('data-url')); }); });
    Array.prototype.slice.call($('list').querySelectorAll('.delperm')).forEach(function (el) { el.addEventListener('click', function () { deleteForGood(el.getAttribute('data-url')); }); });
  }

  // --- main list ------------------------------------------------------------
  function render() {
    renderAsideBar();
    if (viewMode === 'aside') { renderReadBar(); renderAside(); return; }
    renderTagbar(); renderReadBar();

    var criteria = { search: $('q').value, tag: activeTag, reading: readingView, sort: sortBy };
    var tokens = core.tokenize($('q').value);
    var matches = store.view(criteria);

    var anySaved = store.all().length > 0;
    var totalActive = store.view({}).length;
    $('searchBar').style.display = anySaved ? '' : 'none';

    if (matches.length === 0) {
      $('list').innerHTML = ''; $('empty').style.display = 'block'; $('count').textContent = ''; $('sortWrap').style.display = 'none';
      if (!anySaved) { $('empty').innerHTML = '<div style="font-size:34px; margin-bottom:8px;">🔖</div><strong style="display:block; font-size:17px; margin-bottom:6px;">Nothing saved yet</strong>Paste your first link with <strong>＋ Add bookmark</strong> above,<br>and it\'ll live here where you can always find it.'; }
      else if (totalActive === 0) { $('empty').innerHTML = 'Everything is tucked away in <strong>🗂 Set aside</strong>.<br>Your main list is clear.'; }
      else if (readingView && !($('q').value.trim() || activeTag)) { $('empty').innerHTML = '<div style="font-size:28px; margin-bottom:6px;">🎉</div>You\'re all caught up — nothing left to read.'; }
      else { $('empty').innerHTML = 'Nothing to show for that.'; }
      return;
    }
    $('empty').style.display = 'none';
    $('sortSel').value = sortBy; $('sortWrap').style.display = matches.length > 1 ? '' : 'none';
    $('count').textContent = matches.length + (matches.length === 1 ? ' bookmark' : ' bookmarks') + (activeTag ? ' tagged "' + escapeHtml(activeTag) + '"' : '');

    $('list').innerHTML = matches.map(function (b) {
      return '<li data-url="' + escapeHtml(b.url || '') + '">'
        + '<div class="card-head"><p class="title"><a href="' + escapeHtml(b.url || '#') + '" target="_blank" rel="noopener">' + highlight(b.title, tokens) + '</a></p>'
        + '<button class="edit-btn" data-url="' + escapeHtml(b.url || '') + '">Edit details</button></div>'
        + '<p class="site">' + highlight(b.source, tokens) + '</p>'
        + (b.desc ? '<p class="desc">' + highlight(b.desc, tokens) + '</p>' : '')
        + (b.note ? '<div class="note-edit" contenteditable="true" data-url="' + escapeHtml(b.url || '') + '">' + highlight(b.note, tokens) + '</div>' : '<button class="add-note" data-url="' + escapeHtml(b.url || '') + '">＋ add a note</button>')
        + '<p class="date">' + escapeHtml(b.date) + '</p>'
        + '<div class="tags" data-url="' + escapeHtml(b.url || '') + '">'
        + (b.unread ? '<span class="toread-badge">📖 To read</span><button class="mark-read" data-url="' + escapeHtml(b.url || '') + '">✓ mark read</button>' : '')
        + (b.tags || []).map(function (t) { return '<span class="tag ' + (t === activeTag ? 'on' : '') + '" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + '<span class="x" data-remove="' + escapeHtml(t) + '">×</span></span>'; }).join('')
        + '<span class="add-label">＋ label</span>'
        + (!b.unread ? '<button class="to-read-btn" data-url="' + escapeHtml(b.url || '') + '">📖 to read</button>' : '')
        + '</div></li>';
    }).join('');

    wireCards(tokens);
  }

  function wireCards(tokens) {
    var list = $('list');
    Array.prototype.slice.call(list.querySelectorAll('.edit-btn')).forEach(function (el) {
      el.addEventListener('click', function () { var b = store.find(el.getAttribute('data-url')); if (b) openEditor(b); });
    });
    Array.prototype.slice.call(list.querySelectorAll('.mark-read')).forEach(function (el) {
      el.addEventListener('click', function (e) { e.stopPropagation(); markRead(el.getAttribute('data-url')); });
    });
    Array.prototype.slice.call(list.querySelectorAll('.to-read-btn')).forEach(function (el) {
      el.addEventListener('click', function (e) { e.stopPropagation(); markUnread(el.getAttribute('data-url')); });
    });
    Array.prototype.slice.call(list.querySelectorAll('.tag')).forEach(function (el) {
      el.addEventListener('click', function (e) { if (e.target.classList.contains('x')) return; var t = el.getAttribute('data-tag'); activeTag = (activeTag === t) ? null : t; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    });
    Array.prototype.slice.call(list.querySelectorAll('.tag .x')).forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var li = el.closest('li'); var b = store.find(li.getAttribute('data-url'));
        if (b) { var next = b.tags.filter(function (x) { return x !== el.getAttribute('data-remove'); }); store.update(b.url, { tags: next }); if (activeTag && !store.labels().includes(activeTag)) activeTag = null; render(); }
      });
    });
    function wireNote(el) {
      el.addEventListener('blur', function () {
        var b = store.find(el.closest('li').getAttribute('data-url'));
        if (b) { var v = el.textContent.trim(); if (v !== (b.note || '')) { store.update(b.url, { note: v }); render(); } }
      });
    }
    Array.prototype.slice.call(list.querySelectorAll('.note-edit')).forEach(wireNote);
    Array.prototype.slice.call(list.querySelectorAll('.add-note')).forEach(function (el) {
      el.addEventListener('click', function () {
        var div = document.createElement('div'); div.className = 'note-edit'; div.setAttribute('contenteditable', 'true');
        el.replaceWith(div); wireNote(div); div.focus();
      });
    });
    Array.prototype.slice.call(list.querySelectorAll('.add-label')).forEach(function (el) {
      el.addEventListener('click', function () {
        var b = store.find(el.closest('li').getAttribute('data-url'));
        var inp = document.createElement('input'); inp.className = 'add-label-input'; inp.placeholder = 'label…';
        el.replaceWith(inp); inp.focus();
        var done = false;
        var commit = function () { if (done) return; done = true; var v = inp.value.trim(); if (v && b) { var use = store.canonicalLabel(v); if (b.tags.indexOf(use) === -1) store.update(b.url, { tags: b.tags.concat([use]) }); } render(); };
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { done = true; render(); } });
        inp.addEventListener('blur', commit);
      });
    });
  }

  $('q').addEventListener('input', render);
  $('sortSel').addEventListener('change', function () { sortBy = $('sortSel').value; store.setSort(sortBy); render(); });

  warnIfNotDurable();
  render();
})();
