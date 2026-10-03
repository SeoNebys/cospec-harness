'use strict';
(function () {
  var U = window.BMUrls, Q = window.BMQuery;

  // ---- client state --------------------------------------------------------
  var state = { bookmarks: [], views: [], settings: { sort: 'new', pageSize: 10, textSize: 'm' } };
  var statusView = 'all';        // all | unread | read | archived
  var incTags = [], excTags = [];
  var query = '';
  var sortBy = 'new', pageSize = 10, textSize = 'm';
  var visibleCount = 10;
  var selected = new Set();
  var editingId = null;          // bookmark open in the editor
  var openTagEditor = null;      // bookmark whose add-tag input is open
  var bulkTagMode = null;
  var lastShownIds = [];

  // ---- DOM refs ------------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  var urlEl = $('url'), saveEl = $('save'), hintEl = $('cap-hint');
  var listEl = $('list'), listheadEl = $('listhead'), toastEl = $('toast');
  var statusbarEl = $('statusbar'), searchbarEl = $('searchbar'), controlsEl = $('controls');
  var searchEl = $('search'), tagbarEl = $('tagbar'), filterbarEl = $('filterbar');
  var viewsbarEl = $('viewsbar'), bulkbarEl = $('bulkbar');

  // ---- helpers -------------------------------------------------------------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2600); }
  function byId(id) { return state.bookmarks.find(function (b) { return b.id === id; }); }
  function fmtDate(ms) { var d = new Date(ms); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
  function allTags() { var s = {}; state.bookmarks.forEach(function (b) { (b.tags || []).forEach(function (t) { s[t] = 1; }); }); return Object.keys(s).sort(); }
  function pruneTags() { var a = allTags(); incTags = incTags.filter(function (x) { return a.indexOf(x) >= 0; }); excTags = excTags.filter(function (x) { return a.indexOf(x) >= 0; }); }

  function api(method, path, body, raw) {
    var opts = { method: method, headers: {} };
    if (body !== undefined) {
      if (raw) { opts.body = body; opts.headers['Content-Type'] = 'text/html'; }
      else { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
    }
    return fetch(path, opts).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); });
  }

  // ---- Markdown (safe subset) ----------------------------------------------
  function mdInline(s) {
    var codes = [];
    s = s.replace(/`([^`]+)`/g, function (_, c) { codes.push(c); return '' + (codes.length - 1) + ''; });
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, t, u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/(\d+)/g, function (_, i) { return '<code>' + codes[+i] + '</code>'; });
    return s;
  }
  function mdToHtml(src) {
    var lines = esc(src).split(/\n/), out = [], i = 0;
    while (i < lines.length) {
      var ln = lines[i];
      if (/^```/.test(ln)) { var buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; } i++; out.push('<pre><code>' + buf.join('\n') + '</code></pre>'); continue; }
      var h = ln.match(/^(#{1,6})\s+(.*)$/);
      if (h) { var lvl = Math.min(h[1].length, 4); out.push('<h' + lvl + '>' + mdInline(h[2]) + '</h' + lvl + '>'); i++; continue; }
      if (/^\s*[-*]\s+/.test(ln)) { out.push('<ul>'); while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { out.push('<li>' + mdInline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>'); i++; } out.push('</ul>'); continue; }
      if (/^\s*\d+\.\s+/.test(ln)) { out.push('<ol>'); while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { out.push('<li>' + mdInline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'); i++; } out.push('</ol>'); continue; }
      if (/^\s*$/.test(ln)) { i++; continue; }
      var para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !/^```/.test(lines[i])) { para.push(lines[i]); i++; }
      out.push('<p>' + mdInline(para.join('<br>')) + '</p>');
    }
    return out.join('');
  }
  function highlightText(text) {
    var out = esc(text); var words = Q.terms(query);
    words.forEach(function (w) { if (!w) return; var re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); out = out.replace(re, '<mark>$1</mark>'); });
    return out;
  }
  function highlightNotes() {
    var words = Q.terms(query).filter(Boolean); if (!words.length) return;
    var re = new RegExp('(' + words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'ig');
    listEl.querySelectorAll('.note-md').forEach(function (root) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null); var nodes = [], nd;
      while ((nd = walker.nextNode())) nodes.push(nd);
      nodes.forEach(function (node) {
        if (node.parentNode.tagName === 'CODE') return;
        if (!re.test(node.nodeValue)) return;
        var span = document.createElement('span'); span.innerHTML = esc(node.nodeValue).replace(re, '<mark>$1</mark>');
        node.parentNode.replaceChild(span, node);
      });
    });
  }

  // ---- snapshot / offline section ------------------------------------------
  function snapUrl(b) { return '/snapshots/' + b.id; }
  function offlineHtml(b) {
    var kindWord = b.isPdf ? 'the PDF file' : 'a copy of this page';
    var h = '<div class="offline-title">Offline copy</div>';
    if (b.snapshot) {
      var label = b.snapshot.kind === 'pdf' ? 'Saved PDF' : 'Saved copy';
      h += '<p class="offline-line">✅ ' + label + ' from ' + fmtDate(b.snapshot.date) + ' — ' +
        '<a href="' + snapUrl(b) + '" target="_blank" rel="noopener">View saved copy</a> ' +
        '<button class="ctl-link" data-snap="' + b.id + '">Update copy</button> ' +
        '<button class="danger-link" data-snap-remove="' + b.id + '">Remove copy</button></p>';
    } else {
      h += '<p class="offline-line"><button class="ghost" data-snap="' + b.id + '">Save ' + kindWord + '</button> ' +
        '<span class="hint">keeps it readable if the original changes or disappears</span></p>';
    }
    if (b.wayback) {
      h += '<p class="offline-line">🌐 Preserved on the Internet Archive (' + fmtDate(b.wayback.date) + ') — ' +
        '<a href="' + esc(b.wayback.url) + '" target="_blank" rel="noopener">View on web.archive.org</a></p>';
    } else {
      h += '<p class="offline-line"><button class="ghost" data-wayback="' + b.id + '">Also preserve via Internet Archive</button></p>';
    }
    return h;
  }

  // ---- rendering -----------------------------------------------------------
  function renderTagbar() {
    var tags = allTags();
    filterbarEl.hidden = tags.length === 0;
    tagbarEl.innerHTML = tags.map(function (t) {
      var cls = incTags.indexOf(t) >= 0 ? 'inc' : (excTags.indexOf(t) >= 0 ? 'exc' : '');
      var mark = cls === 'exc' ? '−#' : '#';
      return '<button class="pill ' + cls + '" data-t="' + esc(t) + '">' + mark + esc(t) + '</button>';
    }).join('') + ((incTags.length || excTags.length) ? '<button class="pill" data-clear="1">clear</button>' : '');
  }
  function viewMatchesCurrent(v) {
    function same(a, b) { if (a.length !== b.length) return false; var s = b.slice().sort(); return a.slice().sort().every(function (x, i) { return x === s[i]; }); }
    return (v.query || '') === query && same(v.inc || [], incTags) && same(v.exc || [], excTags);
  }
  function renderViews() {
    viewsbarEl.hidden = state.bookmarks.length === 0;
    $('viewchips').innerHTML = state.views.map(function (v, i) {
      return '<span class="view-chip' + (viewMatchesCurrent(v) ? ' active' : '') + '" data-view-apply="' + i + '">' + esc(v.name) + '<span class="vx" data-view-del="' + i + '">×</span></span>';
    }).join('') || '<span class="hint">none yet</span>';
  }
  function flash(id) { var el = $('item-' + id); if (!el) return; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 1400); }

  function currentFiltered() {
    var shown = state.bookmarks.filter(function (b) {
      if (statusView === 'archived') { if (!b.archived) return false; }
      else { if (b.archived) return false; if (statusView === 'unread' && b.read) return false; if (statusView === 'read' && !b.read) return false; }
      return incTags.every(function (t) { return (b.tags || []).indexOf(t) >= 0; })
        && excTags.every(function (t) { return (b.tags || []).indexOf(t) < 0; })
        && Q.matches(b, query);
    });
    shown.sort(function (a, b) {
      if (sortBy === 'new') return b.saved - a.saved;
      if (sortBy === 'updated') return (b.updated || b.saved) - (a.updated || a.saved);
      if (sortBy === 'old') return a.saved - b.saved;
      if (sortBy === 'az') return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
      if (sortBy === 'za') return a.title.toLowerCase() > b.title.toLowerCase() ? -1 : 1;
      return 0;
    });
    return shown;
  }

  function render() {
    selected.forEach(function (id) { if (!byId(id)) selected.delete(id); });
    var has = state.bookmarks.length > 0;
    statusbarEl.hidden = !has; searchbarEl.hidden = !has; controlsEl.hidden = !has;
    renderTagbar(); renderViews();
    listEl.className = 'ts-' + textSize;

    // status counts
    var active = state.bookmarks.filter(function (b) { return !b.archived; });
    var unread = active.filter(function (b) { return !b.read; }).length;
    $('n-unread').textContent = unread;
    $('n-read').textContent = active.length - unread;
    $('n-arch').textContent = state.bookmarks.length - active.length;
    statusbarEl.querySelectorAll('.pill').forEach(function (p) { p.classList.toggle('active', p.dataset.view === statusView); });

    var inArchive = statusView === 'archived';
    var shown = currentFiltered();
    lastShownIds = shown.map(function (b) { return b.id; });
    var total = shown.length;
    if (pageSize > 0 && visibleCount < pageSize) visibleCount = pageSize;
    var capped = pageSize > 0 ? shown.slice(0, visibleCount) : shown;

    var filtering = incTags.length || excTags.length || query || statusView !== 'all';
    listheadEl.textContent = filtering ? (total + ' of ' + state.bookmarks.length + ' bookmarks') : 'Saved links';

    if (!has) { listEl.innerHTML = '<div class="empty">No links saved yet. Paste one above to get started.</div>'; updateBulkbar(); return; }
    if (total === 0) {
      var msg;
      if (query) msg = 'No bookmarks match “' + esc(query) + '” with the current filters.';
      else if (incTags.length || excTags.length) msg = 'No bookmarks match the selected tag filters' + (statusView !== 'all' ? ' in this view.' : '.');
      else if (statusView === 'unread') msg = 'Nothing left to read — you’re all caught up! 🎉';
      else if (statusView === 'read') msg = 'No bookmarks marked as read yet.';
      else if (inArchive) msg = 'Your archive is empty. Archive a bookmark to tuck it away here.';
      else msg = 'No bookmarks to show.';
      listEl.innerHTML = (inArchive ? '<p class="arch-note">Archived bookmarks are kept here, out of your main list.</p>' : '') + '<div class="empty">' + msg + '</div>';
      updateBulkbar(); return;
    }

    listEl.innerHTML = inArchive ? '<p class="arch-note">Archived bookmarks are kept here, out of your main list. Restore any to bring it back.</p>' : '';
    capped.forEach(function (b) {
      var el = document.createElement('div');
      el.className = 'item' + (b.read && !b.archived ? ' is-read' : '') + (b.archived ? ' is-archived' : '') + (selected.has(b.id) ? ' selected' : '');
      el.id = 'item-' + b.id;
      var preview = b.image ? '<img class="preview" src="' + esc(b.image) + '" alt="" onerror="this.style.display=\'none\'">' : '';
      var favInner = b.icon ? '<img src="' + esc(b.icon) + '" alt="" onerror="this.parentNode.textContent=\'🔖\'">' : '🔖';
      var descHtml = b.description ? '<p class="desc">' + highlightText(b.description) + '</p>' : '';
      var noteHtml = b.note ? '<div class="note-line"><span class="note-pin">✎</span><div class="note-md">' + mdToHtml(b.note) + '</div></div>' : '';
      var chips = (b.tags || []).map(function (t) { return '<span class="chip">#' + esc(t) + '<span class="x" data-rm="' + b.id + '|' + esc(t) + '">×</span></span>'; }).join('');
      var adder = openTagEditor === b.id
        ? '<span class="tag-editor"><input class="tag-input" data-taginput="' + b.id + '" placeholder="type a tag…" autocomplete="off"><span class="suggest" data-suggest="' + b.id + '"></span></span>'
        : '<span class="chip add" data-add="' + b.id + '">+ tag</span>';
      var offParts = [];
      if (b.snapshot) offParts.push('💾 ' + (b.snapshot.kind === 'pdf' ? 'PDF saved' : 'Saved copy') + ' · <a href="' + snapUrl(b) + '" target="_blank" rel="noopener">View</a>');
      if (b.wayback) offParts.push('🌐 <a href="' + esc(b.wayback.url) + '" target="_blank" rel="noopener">Internet Archive</a>');
      var offBadge = offParts.length ? '<p class="offline-badge">' + offParts.join(' · ') + '</p>' : '';
      el.innerHTML = preview +
        '<div class="content">' +
        '<input type="checkbox" class="selbox" data-sel="' + b.id + '"' + (selected.has(b.id) ? ' checked' : '') + '>' +
        '<div class="fav">' + favInner + '</div>' +
        '<div class="body">' +
        '<p class="title"><a href="' + esc(b.url) + '" target="_blank" rel="noopener">' + highlightText(b.title) + '</a>' + (b.read || b.archived ? '' : '<span class="unread-badge">To read</span>') + '</p>' +
        descHtml + noteHtml +
        '<p class="url">' + (b.isPdf ? '<span class="pdf-tag">PDF</span> ' : '') + esc(b.url) + '</p>' +
        offBadge +
        '<p class="meta">Saved ' + fmtDate(b.saved) + '</p>' +
        '<div class="chips">' + chips + adder + '</div>' +
        '<div class="actions">' +
        (b.archived
          ? '<button class="ghost" data-archive="' + b.id + '">Restore to list</button>'
          : '<button class="ghost" data-read="' + b.id + '">' + (b.read ? 'Mark as unread' : 'Mark as read') + '</button>' +
            '<button class="ghost" data-archive="' + b.id + '">Archive</button>') +
        '<button class="ghost" data-edit="' + b.id + '">Edit</button>' +
        '</div>' +
        '</div>' +
        '</div>';
      if (editingId === b.id) el.appendChild(buildEditor(b));
      listEl.appendChild(el);
    });

    if (pageSize > 0 && total > capped.length) {
      var more = document.createElement('button');
      more.className = 'showmore'; more.id = 'showmore';
      more.textContent = 'Show more (' + (total - capped.length) + ' more of ' + total + ')';
      listEl.appendChild(more);
    }
    highlightNotes();
    updateBulkbar();
    if (openTagEditor !== null) { var inp = listEl.querySelector('[data-taginput="' + openTagEditor + '"]'); if (inp) { inp.focus(); updateSuggest(openTagEditor, ''); } }
  }

  function buildEditor(b) {
    var box = document.createElement('div'); box.className = 'edit';
    box.innerHTML =
      '<label>Title</label><input data-f="title" value="' + esc(b.title) + '">' +
      '<label>Web address</label><input data-f="url" value="' + esc(b.url) + '">' +
      '<label>Description <span class="hint">(from the page)</span></label><textarea data-f="description">' + esc(b.description || '') + '</textarea>' +
      '<label>Your note <span class="hint">(private, simple Markdown)</span></label><textarea data-f="note" placeholder="Why you saved this…">' + esc(b.note || '') + '</textarea>' +
      '<div class="offline">' + offlineHtml(b) + '</div>' +
      '<div class="row" style="margin-top:0"><button class="primary" data-save-edit="' + b.id + '">Save changes</button>' +
      '<button class="ghost" data-cancel-edit="' + b.id + '">Cancel</button>' +
      '<button class="danger" data-delete="' + b.id + '">Delete permanently</button></div>';
    return box;
  }

  // ---- tag add with suggestions --------------------------------------------
  function updateSuggest(id, q) {
    var box = listEl.querySelector('[data-suggest="' + id + '"]'); if (!box) return;
    var b = byId(id), have = b ? b.tags : [];
    q = (q || '').trim().toLowerCase();
    var matches = allTags().filter(function (t) { return have.indexOf(t) < 0 && t.indexOf(q) >= 0; }).slice(0, 6);
    var html = matches.map(function (t) { return '<div data-pick="' + esc(t) + '">#' + esc(t) + '</div>'; }).join('');
    if (q && allTags().indexOf(q) < 0 && have.indexOf(q) < 0) html += '<div class="new" data-pick="' + esc(q) + '">+ create “' + esc(q) + '”</div>';
    box.style.display = html ? 'block' : 'none'; box.innerHTML = html;
  }
  function addTagTo(id, raw) {
    var t = (raw || '').trim().toLowerCase().replace(/^#/, ''); if (!t) return;
    var b = byId(id); if (!b || b.tags.indexOf(t) >= 0) { keepTagEditor(id); return; }
    var next = b.tags.concat([t]);
    api('PATCH', '/api/bookmarks/' + id, { tags: next }).then(function (r) { if (r.body.bookmark) replaceBookmark(r.body.bookmark); openTagEditor = id; render(); var inp = listEl.querySelector('[data-taginput="' + id + '"]'); if (inp) { inp.value = ''; inp.focus(); updateSuggest(id, ''); } });
  }
  function keepTagEditor(id) { openTagEditor = id; render(); }

  function replaceBookmark(nb) { var i = state.bookmarks.findIndex(function (x) { return x.id === nb.id; }); if (i >= 0) state.bookmarks[i] = nb; }

  // ---- capture -------------------------------------------------------------
  function refreshButton() { var v = urlEl.value.trim().length > 0; saveEl.disabled = !v; hintEl.textContent = v ? 'Ready to save.' : 'Enter a link to enable saving.'; hintEl.style.color = ''; }
  function save() {
    var raw = urlEl.value.trim(); if (!raw) return;
    var norm = U.normalize(raw);
    if (!U.isValid(norm)) { hintEl.textContent = 'That doesn’t look like a web address. Try something like example.com/page.'; hintEl.style.color = '#b42318'; return; }
    saveEl.disabled = true; hintEl.textContent = 'Saving…';
    api('POST', '/api/bookmarks', { url: norm }).then(function (r) {
      if (r.status === 201) { state.bookmarks.unshift(r.body.bookmark); urlEl.value = ''; refreshButton(); render(); toast('Saved “' + r.body.bookmark.title + '”'); urlEl.focus(); }
      else if (r.status === 409) { urlEl.value = ''; refreshButton(); editingId = r.body.existingId; render(); flash(r.body.existingId); toast('You already saved this link — opened it for editing.'); }
      else { hintEl.textContent = r.body.error || 'Could not save.'; hintEl.style.color = '#b42318'; }
    });
  }

  // ---- events: capture -----------------------------------------------------
  urlEl.addEventListener('input', refreshButton);
  urlEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } });
  saveEl.addEventListener('click', save);

  // ---- events: list (delegated) --------------------------------------------
  listEl.addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'showmore') { visibleCount += (pageSize || 0); render(); return; }
    if (t.dataset.edit) { editingId = Number(t.dataset.edit); openTagEditor = null; render(); flash(editingId); }
    else if (t.dataset.cancelEdit) { editingId = null; render(); }
    else if (t.dataset.saveEdit) {
      var id = Number(t.dataset.saveEdit), box = t.closest('.edit');
      var nu = U.normalize(box.querySelector('[data-f=url]').value);
      if (!nu) { toast('A web address is required.'); return; }
      if (!U.isValid(nu)) { toast('That doesn’t look like a web address.'); return; }
      var payload = {
        title: box.querySelector('[data-f=title]').value.trim() || byId(id).title,
        url: nu,
        description: box.querySelector('[data-f=description]').value.trim(),
        note: box.querySelector('[data-f=note]').value.trim()
      };
      api('PATCH', '/api/bookmarks/' + id, payload).then(function (r) {
        if (r.status === 409) { editingId = null; render(); flash(r.body.existingId); toast('Another bookmark already uses that address — showing it.'); return; }
        if (r.body.bookmark) replaceBookmark(r.body.bookmark);
        editingId = null; render(); flash(id); toast('Changes saved.');
      });
    }
    else if (t.dataset.delete) {
      var did = Number(t.dataset.delete), b = byId(did);
      if (confirm('Delete “' + b.title + '” permanently? This cannot be undone.')) {
        api('DELETE', '/api/bookmarks/' + did).then(function () { state.bookmarks = state.bookmarks.filter(function (x) { return x.id !== did; }); editingId = null; pruneTags(); render(); toast('Bookmark deleted permanently.'); });
      }
    }
    else if (t.dataset.rm) { var p = t.dataset.rm.split('|'); var rid = Number(p[0]); var bk = byId(rid); var next = bk.tags.filter(function (x) { return x !== p[1]; }); api('PATCH', '/api/bookmarks/' + rid, { tags: next }).then(function (r) { if (r.body.bookmark) replaceBookmark(r.body.bookmark); pruneTags(); render(); }); }
    else if (t.dataset.add) { openTagEditor = Number(t.dataset.add); render(); }
    else if (t.dataset.pick) { addTagTo(openTagEditor, t.dataset.pick); }
    else if (t.dataset.read) { var rd = Number(t.dataset.read), bb = byId(rd); api('PATCH', '/api/bookmarks/' + rd, { read: !bb.read }).then(function (r) { if (r.body.bookmark) replaceBookmark(r.body.bookmark); render(); if ($('item-' + rd)) flash(rd); toast(!bb.read ? 'Marked as read.' : 'Marked as still to read.'); }); }
    else if (t.dataset.archive) { var ar = Number(t.dataset.archive), ab = byId(ar); api('PATCH', '/api/bookmarks/' + ar, { archived: !ab.archived }).then(function (r) { if (r.body.bookmark) replaceBookmark(r.body.bookmark); editingId = null; render(); toast(!ab.archived ? 'Archived — moved out of your main list.' : 'Restored to your list.'); }); }
    else if (t.dataset.snap) { doSnapshot(Number(t.dataset.snap)); }
    else if (t.dataset.snapRemove) { var srid = Number(t.dataset.snapRemove); api('DELETE', '/api/bookmarks/' + srid + '/snapshot').then(function () { var bm = byId(srid); bm.snapshot = null; render(); toast('Saved copy removed.'); }); }
    else if (t.dataset.wayback) { doWayback(Number(t.dataset.wayback)); }
  });
  listEl.addEventListener('input', function (e) { if (e.target.dataset.taginput) updateSuggest(Number(e.target.dataset.taginput), e.target.value); });
  listEl.addEventListener('keydown', function (e) { if (!e.target.dataset.taginput) return; var id = Number(e.target.dataset.taginput); if (e.key === 'Enter') { e.preventDefault(); addTagTo(id, e.target.value); } else if (e.key === 'Escape') { openTagEditor = null; render(); } });
  listEl.addEventListener('change', function (e) { if (e.target.dataset.sel) { var id = Number(e.target.dataset.sel); if (e.target.checked) selected.add(id); else selected.delete(id); var c = $('item-' + id); if (c) c.classList.toggle('selected', e.target.checked); updateBulkbar(); } });
  document.addEventListener('click', function (e) { if (openTagEditor !== null && !e.target.closest('.tag-editor') && !e.target.dataset.add) { openTagEditor = null; render(); } });

  function doSnapshot(id) {
    var b = byId(id); toast(b.isPdf ? 'Saving the PDF…' : 'Saving a copy…');
    api('POST', '/api/bookmarks/' + id + '/snapshot').then(function (r) {
      if (r.status === 200) { b.snapshot = r.body.snapshot; render(); toast(b.isPdf ? 'PDF saved for offline viewing.' : 'A copy of this page was saved.'); }
      else { toast(r.body.error || 'Could not save a copy. You can retry.'); }
    });
  }
  function doWayback(id) {
    var b = byId(id); toast('Requesting Internet Archive…');
    api('POST', '/api/bookmarks/' + id + '/wayback').then(function (r) {
      if (r.status === 200) { b.wayback = r.body.wayback; render(); toast('Preserved via the Internet Archive.'); }
      else { toast(r.body.error || 'Internet Archive preservation failed. You can retry.'); }
    });
  }

  // ---- status / tags / search / controls -----------------------------------
  statusbarEl.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; statusView = b.dataset.view; visibleCount = pageSize; render(); });
  tagbarEl.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.clear) { incTags = []; excTags = []; }
    else { var t = b.dataset.t, iI = incTags.indexOf(t), iE = excTags.indexOf(t); if (iI < 0 && iE < 0) incTags.push(t); else if (iI >= 0) { incTags.splice(iI, 1); excTags.push(t); } else excTags.splice(iE, 1); }
    visibleCount = pageSize; render();
  });
  searchEl.addEventListener('input', function () { query = searchEl.value.trim(); visibleCount = pageSize; render(); });

  var sortsel = $('sortsel'), pagesel = $('pagesel'), setdefault = $('setdefault');
  function markDirty() { setdefault.textContent = 'Set as my default'; setdefault.classList.remove('saved'); }
  sortsel.addEventListener('change', function () { sortBy = sortsel.value; visibleCount = pageSize; markDirty(); render(); });
  pagesel.addEventListener('change', function () { pageSize = parseInt(pagesel.value, 10); visibleCount = pageSize; markDirty(); render(); });
  setdefault.addEventListener('click', function () { api('PUT', '/api/settings', { sort: sortBy, pageSize: pageSize, textSize: textSize }).then(function (r) { state.settings = r.body.settings; setdefault.textContent = 'Saved as default ✓'; setdefault.classList.add('saved'); toast('These settings are now your default.'); }); });
  $('textup').addEventListener('click', function () { textSize = textSize === 's' ? 'm' : 'l'; markDirty(); render(); });
  $('textdown').addEventListener('click', function () { textSize = textSize === 'l' ? 'm' : 's'; markDirty(); render(); });

  // ---- saved views ---------------------------------------------------------
  $('saveview').addEventListener('click', function () {
    if (!query && !incTags.length && !excTags.length) { toast('Set a search and/or tag filters first, then save the view.'); return; }
    var name = prompt('Name this view:'); if (!name) return; name = name.trim(); if (!name) return;
    api('POST', '/api/views', { name: name, query: query, inc: incTags.slice(), exc: excTags.slice() }).then(function (r) { state.views = r.body.views; render(); toast('View “' + name + '” saved.'); });
  });
  $('viewchips').addEventListener('click', function (e) {
    if (e.target.dataset.viewDel !== undefined) { e.stopPropagation(); var i = Number(e.target.dataset.viewDel); var nm = state.views[i].name; api('DELETE', '/api/views/' + encodeURIComponent(nm)).then(function (r) { state.views = r.body.views; render(); toast('View “' + nm + '” removed.'); }); return; }
    var c = e.target.closest('[data-view-apply]'); if (c) { var v = state.views[Number(c.dataset.viewApply)]; query = v.query || ''; searchEl.value = query; incTags = (v.inc || []).slice(); excTags = (v.exc || []).slice(); visibleCount = pageSize; render(); }
  });

  // ---- bulk ----------------------------------------------------------------
  function selectedItems() { var a = []; selected.forEach(function (id) { var b = byId(id); if (b) a.push(b); }); return a; }
  function updateBulkbar() {
    var n = selected.size, matchN = lastShownIds.length;
    var allSel = matchN > 0 && lastShownIds.every(function (id) { return selected.has(id); });
    $('selectall-top').textContent = allSel && matchN > 0 ? 'Clear selection' : 'Select all ' + matchN + ' matching';
    bulkbarEl.hidden = n === 0; if (n === 0) return;
    $('bulkcount').textContent = n + ' selected';
    $('selectall').textContent = allSel ? 'Clear all ' + matchN + ' matching' : 'Select all ' + matchN + ' matching';
    var inArchive = statusView === 'archived';
    $('bulk-arch').textContent = inArchive ? 'Restore' : 'Archive';
    $('bulk-read').style.display = inArchive ? 'none' : '';
    $('bulk-unread').style.display = inArchive ? 'none' : '';
  }
  function toggleSelectAll() { var matchN = lastShownIds.length; var allSel = matchN > 0 && lastShownIds.every(function (id) { return selected.has(id); }); if (allSel) lastShownIds.forEach(function (id) { selected.delete(id); }); else lastShownIds.forEach(function (id) { selected.add(id); }); render(); }
  $('selectall').addEventListener('click', toggleSelectAll);
  $('selectall-top').addEventListener('click', toggleSelectAll);
  $('bulk-clear').addEventListener('click', function () { selected.clear(); closeBulkTag(); render(); });
  function bulk(action, extra) {
    var ids = selectedItems().map(function (b) { return b.id; }); if (!ids.length) return Promise.resolve();
    var body = Object.assign({ ids: ids, action: action }, extra || {});
    return api('POST', '/api/bookmarks/bulk', body).then(function (r) { if (r.body.state) state = r.body.state; return r; });
  }
  function openBulkTag(mode) { bulkTagMode = mode; $('bulk-taglist').innerHTML = allTags().map(function (t) { return '<option value="' + esc(t) + '">'; }).join(''); $('bulk-taginput').hidden = false; $('bulk-tag-mode').textContent = (mode === 'add' ? 'Add this tag to ' : 'Remove this tag from ') + selected.size + ' bookmarks'; var f = $('bulk-tagfield'); f.value = ''; f.focus(); }
  function closeBulkTag() { $('bulk-taginput').hidden = true; bulkTagMode = null; }
  function applyBulkTag() { var t = $('bulk-tagfield').value.trim().toLowerCase().replace(/^#/, ''); if (!t) return; var mode = bulkTagMode; bulk(mode === 'add' ? 'addTag' : 'removeTag', { tag: t }).then(function (r) { pruneTags(); closeBulkTag(); render(); toast((mode === 'add' ? 'Tagged ' : 'Untagged ') + (r.body.count || 0) + ' bookmark(s) “#' + t + '”.'); }); }
  $('bulk-tag-add').addEventListener('click', function () { openBulkTag('add'); });
  $('bulk-tag-rm').addEventListener('click', function () { openBulkTag('remove'); });
  $('bulk-tag-cancel').addEventListener('click', closeBulkTag);
  $('bulk-tag-apply').addEventListener('click', applyBulkTag);
  $('bulk-tagfield').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyBulkTag(); } });
  $('bulk-read').addEventListener('click', function () { var n = selected.size; bulk('read').then(function () { render(); toast('Marked ' + n + ' as read.'); }); });
  $('bulk-unread').addEventListener('click', function () { var n = selected.size; bulk('unread').then(function () { render(); toast('Marked ' + n + ' as to read.'); }); });
  $('bulk-arch').addEventListener('click', function () { var restore = statusView === 'archived', n = selected.size; bulk(restore ? 'restore' : 'archive').then(function () { selected.clear(); render(); toast((restore ? 'Restored ' : 'Archived ') + n + ' bookmark(s).'); }); });
  $('bulk-del').addEventListener('click', function () { var n = selected.size; if (confirm('Delete ' + n + ' bookmark(s) permanently? This cannot be undone.')) { bulk('delete').then(function () { selected.clear(); pruneTags(); render(); toast(n + ' bookmark(s) deleted permanently.'); }); } });

  // ---- import / export -----------------------------------------------------
  $('exportbtn').addEventListener('click', function () { window.location.href = '/api/export'; });
  $('importbtn').addEventListener('click', function () { $('importfile').click(); });
  $('importfile').addEventListener('change', function (e) { var f = e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { api('POST', '/api/import', String(r.result), true).then(function (resp) { if (resp.body.state) state = resp.body.state; render(); toast('Imported ' + resp.body.added + ' bookmark(s)' + (resp.body.skipped ? ', skipped ' + resp.body.skipped + ' already saved or invalid' : '') + '.'); }); }; r.readAsText(f); e.target.value = ''; });

  // ---- init ----------------------------------------------------------------
  function init() {
    api('GET', '/api/state').then(function (r) {
      state = r.body;
      sortBy = state.settings.sort || 'new';
      pageSize = state.settings.pageSize != null ? Number(state.settings.pageSize) : 10;
      textSize = state.settings.textSize || 'm';
      visibleCount = pageSize;
      sortsel.value = sortBy; pagesel.value = String(pageSize);
      refreshButton(); render();
      document.body.setAttribute('data-harness-ready', 'true');
    });
  }
  init();
})();
