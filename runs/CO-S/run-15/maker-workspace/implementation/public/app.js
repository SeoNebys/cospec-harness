'use strict';

// Front-end for the bookmarks app. Talks to the JSON API in src/server.js and
// renders the behaviour approved in scenarios SCN-001..SCN-008.

(function () {
  var bookmarks = [];       // local mirror of server state (newest first)
  var searchText = '';
  var tagFilter = null;
  var view = 'all';         // all | unread | read
  var uiState = {};         // per-id transient UI flags keyed by bookmark id

  var el = {
    url: document.getElementById('url'),
    saveBtn: document.getElementById('saveBtn'),
    readLaterChoice: document.getElementById('readLaterChoice'),
    err: document.getElementById('err'),
    notice: document.getElementById('notice'),
    search: document.getElementById('search'),
    clearSearch: document.getElementById('clearSearch'),
    activeFilter: document.getElementById('activeFilter'),
    views: document.getElementById('views'),
    unreadCount: document.getElementById('unreadCount'),
    count: document.getElementById('count'),
    list: document.getElementById('list'),
    emptyState: document.getElementById('emptyState'),
  };

  // ---- API helpers -------------------------------------------------------
  function api(method, path, body) {
    return fetch(path, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  function ui(id) {
    if (!uiState[id]) uiState[id] = {};
    return uiState[id];
  }

  // ---- derived data ------------------------------------------------------
  function normaliseTag(s) { return (s || '').trim().toLowerCase(); }

  function allTags() {
    var set = {};
    bookmarks.forEach(function (b) { b.tags.forEach(function (t) { set[t] = true; }); });
    return Object.keys(set).sort();
  }

  function unreadCount() {
    return bookmarks.filter(function (b) { return b.readLater && !b.read; }).length;
  }

  function visible() {
    var q = searchText.trim().toLowerCase();
    return bookmarks.filter(function (b) {
      if (view === 'unread' && !(b.readLater && !b.read)) return false;
      if (view === 'read' && !(b.readLater && b.read)) return false;
      if (tagFilter && b.tags.indexOf(tagFilter) === -1) return false;
      if (!q) return true;
      var hay = (b.title + ' ' + b.url + ' ' + b.tags.join(' ')).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  // ---- rendering ---------------------------------------------------------
  function render() {
    // View tabs + unread badge
    el.unreadCount.textContent = unreadCount();
    var viewBtns = el.views.querySelectorAll('.view');
    viewBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });

    // Active tag-filter banner
    if (tagFilter) {
      el.activeFilter.hidden = false;
      el.activeFilter.innerHTML =
        'Filtered by tag <span class="chip"></span> <button class="clearf" type="button">show all</button>';
      el.activeFilter.querySelector('.chip').textContent = tagFilter;
      el.activeFilter.querySelector('.clearf').addEventListener('click', function () {
        tagFilter = null; render();
      });
    } else {
      el.activeFilter.hidden = true;
      el.activeFilter.innerHTML = '';
    }

    var filtering = !!(searchText.trim() || tagFilter || view !== 'all');
    var shown = visible();
    el.count.textContent = filtering ? (shown.length + ' of ' + bookmarks.length) : bookmarks.length;

    el.list.innerHTML = '';
    el.emptyState.hidden = true;

    if (bookmarks.length === 0) {
      showEmpty('No links saved yet. Paste a link above to get started.');
      return;
    }
    if (shown.length === 0) {
      showEmpty(emptyMessage());
      return;
    }
    shown.forEach(function (b) { el.list.appendChild(card(b)); });
  }

  function showEmpty(msg) {
    el.emptyState.hidden = false;
    el.emptyState.textContent = msg;
  }

  function emptyMessage() {
    if (searchText.trim() || tagFilter) {
      return 'No links match your search. Try different words, or clear the search.';
    }
    if (view === 'unread') {
      return 'Your read-later list is empty. Tick "Add to my read-later list" when saving, or use "+ Add to read-later" on a link.';
    }
    if (view === 'read') {
      return 'Nothing marked read yet. Links you finish reading will show up here.';
    }
    return 'No links to show.';
  }

  function card(b) {
    var s = ui(b.id);
    var li = document.createElement('li');
    li.className = 'card' + (b.read ? ' read' : '');
    li.setAttribute('data-id', b.id);

    // Title row
    var titlerow = document.createElement('div');
    titlerow.className = 'titlerow';
    if (s.editing) {
      var field = document.createElement('input');
      field.className = 'title-edit'; field.type = 'text'; field.value = b.title;
      var saveName = document.createElement('button');
      saveName.className = 'savename'; saveName.type = 'button'; saveName.textContent = 'Save name';
      var commitName = function () {
        var v = field.value.trim();
        s.editing = false;
        if (v && v !== b.title) { patch(b.id, { title: v }); } else { render(); }
      };
      saveName.addEventListener('click', commitName);
      field.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') commitName();
        else if (e.key === 'Escape') { s.editing = false; render(); }
      });
      titlerow.appendChild(field);
      titlerow.appendChild(saveName);
    } else {
      var title = document.createElement('div');
      title.className = 'title';
      title.textContent = b.title;
      titlerow.appendChild(title);

      var actions = document.createElement('span');
      actions.className = 'rowactions';
      if (s.confirmingDelete) {
        var cd = document.createElement('span');
        cd.className = 'confirmdel';
        cd.appendChild(document.createTextNode('Delete this bookmark? '));
        var yes = document.createElement('button'); yes.className = 'yes'; yes.type = 'button'; yes.textContent = 'Delete';
        var no = document.createElement('button'); no.className = 'no'; no.type = 'button'; no.textContent = 'Keep';
        yes.addEventListener('click', function () { remove(b.id); });
        no.addEventListener('click', function () { s.confirmingDelete = false; render(); });
        cd.appendChild(yes); cd.appendChild(no);
        actions.appendChild(cd);
      } else {
        var ren = document.createElement('button'); ren.className = 'editbtn'; ren.type = 'button'; ren.textContent = 'Rename';
        ren.addEventListener('click', function () { s.editing = true; render(); focusEdit(li); });
        var del = document.createElement('button'); del.className = 'deletebtn'; del.type = 'button'; del.textContent = 'Delete';
        del.addEventListener('click', function () { s.confirmingDelete = true; render(); });
        actions.appendChild(ren); actions.appendChild(del);
      }
      titlerow.appendChild(actions);
    }
    li.appendChild(titlerow);

    if (!s.editing) {
      var link = document.createElement('a');
      link.className = 'link'; link.href = b.url; link.target = '_blank'; link.rel = 'noopener';
      link.textContent = b.url;
      li.appendChild(link);

      if (b.titleFailed) {
        var warn = document.createElement('div');
        warn.className = 'meta warn';
        warn.textContent = "Couldn't fetch the page title — showing the address instead. You can Rename it.";
        li.appendChild(warn);
      } else {
        var meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = b.host;
        li.appendChild(meta);
      }

      li.appendChild(buildTags(b));
      li.appendChild(buildStatus(b));
    }
    return li;
  }

  function focusEdit(li) {
    var f = li.querySelector('.title-edit');
    if (f) { f.focus(); f.select(); }
  }

  function buildTags(b) {
    var s = ui(b.id);
    var wrap = document.createElement('div');
    wrap.className = 'tags';
    b.tags.forEach(function (t) {
      var chip = document.createElement('span');
      chip.className = 'tag';
      var label = document.createElement('span');
      label.className = 'label'; label.textContent = t; label.title = 'Filter by this tag';
      label.addEventListener('click', function () {
        tagFilter = t; searchText = ''; el.search.value = ''; render();
      });
      var x = document.createElement('span');
      x.className = 'x'; x.textContent = '×'; x.title = 'Remove tag';
      x.addEventListener('click', function () {
        patch(b.id, { tags: b.tags.filter(function (v) { return v !== t; }) });
      });
      chip.appendChild(label); chip.appendChild(x);
      wrap.appendChild(chip);
    });

    if (s.addingTag) {
      var box = document.createElement('span');
      box.className = 'tagwrap';
      var inp = document.createElement('input');
      inp.className = 'taginput'; inp.type = 'text'; inp.placeholder = 'tag name';
      var sug = document.createElement('ul'); sug.className = 'suggest'; sug.style.display = 'none';

      var addTag = function (v) {
        v = normaliseTag(v);
        if (v && b.tags.indexOf(v) === -1) {
          patch(b.id, { tags: b.tags.concat([v]) });
        } else {
          s.addingTag = false; render();
        }
      };
      var refresh = function () {
        var q = normaliseTag(inp.value);
        sug.innerHTML = '';
        if (!q) { sug.style.display = 'none'; return; }
        var matches = allTags().filter(function (t) {
          return t.indexOf(q) !== -1 && b.tags.indexOf(t) === -1;
        }).slice(0, 6);
        if (matches.length === 0) { sug.style.display = 'none'; return; }
        matches.forEach(function (t) {
          var opt = document.createElement('li');
          opt.textContent = t;
          opt.addEventListener('mousedown', function (e) { e.preventDefault(); s._suppressBlur = true; addTag(t); });
          sug.appendChild(opt);
        });
        sug.style.display = 'block';
      };
      inp.addEventListener('input', refresh);
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { s._suppressBlur = true; addTag(inp.value); }
        else if (e.key === 'Escape') { s.addingTag = false; s._suppressBlur = true; render(); }
      });
      inp.addEventListener('blur', function () {
        if (s._suppressBlur) { s._suppressBlur = false; return; }
        addTag(inp.value);
      });
      box.appendChild(inp); box.appendChild(sug);
      wrap.appendChild(box);
      setTimeout(function () { inp.focus(); }, 0);
    } else {
      var add = document.createElement('button');
      add.className = 'tagadd'; add.type = 'button';
      add.textContent = b.tags.length ? '+ tag' : '+ add tag';
      add.addEventListener('click', function () { s.addingTag = true; render(); });
      wrap.appendChild(add);
    }
    return wrap;
  }

  function buildStatus(b) {
    var row = document.createElement('div');
    row.className = 'status';
    if (!b.readLater) {
      var addl = document.createElement('button');
      addl.className = 'addlater'; addl.type = 'button'; addl.textContent = '+ Add to read-later';
      addl.addEventListener('click', function () { patch(b.id, { readLater: true, read: false }); });
      row.appendChild(addl);
      return row;
    }
    var label = document.createElement('span');
    label.className = 'statuslabel ' + (b.read ? 'isread' : 'unread');
    label.textContent = b.read ? '✓ Read' : '● To read';
    var toggle = document.createElement('button');
    toggle.className = 'readtoggle'; toggle.type = 'button';
    toggle.textContent = b.read ? 'Mark as to read' : 'Mark as read';
    toggle.addEventListener('click', function () { patch(b.id, { read: !b.read }); });
    var rem = document.createElement('button');
    rem.className = 'removelater'; rem.type = 'button'; rem.textContent = 'Remove from read-later';
    rem.addEventListener('click', function () { patch(b.id, { readLater: false }); });
    row.appendChild(label); row.appendChild(toggle); row.appendChild(rem);
    return row;
  }

  // ---- mutations ---------------------------------------------------------
  function upsertLocal(bookmark) {
    var idx = bookmarks.findIndex(function (b) { return b.id === bookmark.id; });
    if (idx === -1) bookmarks.unshift(bookmark); else bookmarks[idx] = bookmark;
  }

  function save() {
    var raw = el.url.value;
    hideErr(); hideNotice();
    api('POST', '/api/bookmarks', {
      url: raw,
      readLater: el.readLaterChoice.checked,
    }).then(function (res) {
      if (res.status === 400) { showErr('That doesn\'t look like a valid link. Try something like example.com/page.'); return null; }
      if (res.status === 409) { return res.json().then(function (d) { handleDuplicate(d.bookmark); return null; }); }
      if (res.status === 201) {
        return res.json().then(function (d) {
          upsertLocal(d.bookmark);
          el.url.value = '';
          el.readLaterChoice.checked = false;
          render();
        });
      }
      showErr('Something went wrong saving that link. Please try again.');
      return null;
    }).catch(function () { showErr('Could not reach the app. Please try again.'); });
  }

  function handleDuplicate(existing) {
    upsertLocal(existing);
    searchText = ''; el.search.value = '';
    tagFilter = null; view = 'all';
    ui(existing.id).editing = true;
    el.url.value = '';
    render();
    showNotice('This link is already saved — here it is, ready to edit.');
    var cardEl = el.list.querySelector('[data-id="' + existing.id + '"]');
    if (cardEl) {
      cardEl.classList.add('flash');
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      focusEdit(cardEl);
    }
  }

  function patch(id, changes) {
    api('PATCH', '/api/bookmarks/' + id, changes).then(function (res) {
      if (!res.ok) return;
      return res.json().then(function (d) { upsertLocal(d.bookmark); render(); });
    });
  }

  function remove(id) {
    api('DELETE', '/api/bookmarks/' + id).then(function (res) {
      if (res.status === 204) {
        bookmarks = bookmarks.filter(function (b) { return b.id !== id; });
        delete uiState[id];
        render();
      }
    });
  }

  // ---- small helpers -----------------------------------------------------
  function showErr(m) { el.err.textContent = m; el.err.classList.add('show'); }
  function hideErr() { el.err.classList.remove('show'); }
  function showNotice(m) { el.notice.textContent = m; el.notice.classList.add('show'); }
  function hideNotice() { el.notice.classList.remove('show'); }

  // ---- wiring ------------------------------------------------------------
  el.saveBtn.addEventListener('click', save);
  el.url.addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); });
  el.search.addEventListener('input', function (e) { searchText = e.target.value; render(); });
  el.clearSearch.addEventListener('click', function () { searchText = ''; el.search.value = ''; render(); });
  el.views.querySelectorAll('.view').forEach(function (btn) {
    btn.addEventListener('click', function () { view = btn.getAttribute('data-view'); render(); });
  });

  // ---- boot --------------------------------------------------------------
  function boot() {
    api('GET', '/api/bookmarks').then(function (res) { return res.json(); })
      .then(function (data) {
        bookmarks = data.bookmarks || [];
        render();
        document.body.setAttribute('data-harness-ready', 'true');
      })
      .catch(function () {
        render();
        document.body.setAttribute('data-harness-ready', 'true');
      });
  }
  boot();
})();
