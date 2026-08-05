/*
 * Bookmarks — app wiring (browser DOM). Uses BookmarksCore for all logic and
 * BookmarksStorage for persistence. Persists after every change.
 */
(function () {
  'use strict';
  const C = window.BookmarksCore;
  const store = window.BookmarksStorage;

  let items = store.load();      // newest first
  let filter = 'All';            // selected group, or 'All'
  let pending = [];              // groups being attached to the link about to be saved
  let editing = null;            // id of the bookmark whose groups are being edited
  let flashId = null;            // id of a card to briefly highlight

  const $ = function (id) { return document.getElementById(id); };
  const urlInput = $('url');
  const groupInput = $('groupinput');
  const searchInput = $('search');

  let idCounter = 0;
  function nextId() { idCounter += 1; return 'bm_' + Date.now() + '_' + idCounter; }

  function persist() { store.save(items); }

  // --- messages -------------------------------------------------------------
  function showMsg(kind, text) { const m = $('savemsg'); m.className = 'savemsg ' + kind; m.textContent = text; }
  function clearMsg() { const m = $('savemsg'); m.className = 'savemsg'; m.textContent = ''; }

  // --- rendering ------------------------------------------------------------
  function renderDatalist() {
    const dl = $('grouplist');
    dl.innerHTML = '';
    C.usedGroups(items).forEach(function (g) {
      const o = document.createElement('option'); o.value = g; dl.appendChild(o);
    });
  }

  function renderChips() {
    const box = $('chipbox');
    box.querySelectorAll('.chip').forEach(function (c) { c.remove(); });
    pending.forEach(function (g, idx) {
      const c = document.createElement('span');
      c.className = 'chip';
      c.appendChild(document.createTextNode(g + ' '));
      const x = document.createElement('b'); x.title = 'remove'; x.textContent = '×';
      x.onclick = function () { pending.splice(idx, 1); renderChips(); };
      c.appendChild(x);
      box.insertBefore(c, groupInput);
    });
  }

  function renderSide() {
    const s = $('side');
    s.innerHTML = '';
    const groups = C.usedGroups(items);
    if (filter !== 'All' && !groups.some(function (g) { return g.toLowerCase() === filter.toLowerCase(); })) {
      filter = 'All'; // SCN-007: viewed group emptied out
    }
    const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = 'Browse'; s.appendChild(lbl);
    ['All'].concat(groups).forEach(function (g) {
      const b = document.createElement('button');
      b.textContent = g === 'All' ? 'All bookmarks' : g;
      if (g === filter) b.className = 'active';
      b.onclick = function () { filter = g; render(); };
      s.appendChild(b);
    });
  }

  function makeCard(it) {
    const li = document.createElement('li');
    li.className = 'card';
    if (it.id === flashId) li.classList.add('flash');

    const a = document.createElement('a');
    a.className = 'title'; a.href = it.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = it.title;
    const u = document.createElement('span');
    u.className = 'url'; u.textContent = it.url;
    li.appendChild(a); li.appendChild(u);

    if (it.groups.length) {
      const t = document.createElement('div'); t.className = 'tags';
      it.groups.forEach(function (g) {
        const s = document.createElement('span'); s.className = 'tag'; s.textContent = g; t.appendChild(s);
      });
      li.appendChild(t);
    }

    if (editing === it.id) {
      li.appendChild(makeEditor(it));
    } else {
      const act = document.createElement('div'); act.className = 'actions';
      const edit = document.createElement('button'); edit.textContent = 'Edit groups';
      edit.onclick = function () { editing = it.id; render(); focusEditor(); };
      const del = document.createElement('button'); del.className = 'danger'; del.textContent = 'Remove';
      del.onclick = function () { removeBookmark(it); };
      act.appendChild(edit); act.appendChild(del);
      li.appendChild(act);
    }
    return li;
  }

  function makeEditor(it) {
    const ed = document.createElement('div'); ed.className = 'editor';
    const box = document.createElement('div'); box.className = 'chipbox2';
    it.groups.forEach(function (g, idx) {
      const c = document.createElement('span'); c.className = 'chip';
      c.appendChild(document.createTextNode(g + ' '));
      const x = document.createElement('b'); x.title = 'remove'; x.textContent = '×';
      x.onclick = function () { it.groups.splice(idx, 1); persist(); render(); focusEditor(); };
      c.appendChild(x);
      box.appendChild(c);
    });
    const gin = document.createElement('input');
    gin.setAttribute('list', 'grouplist');
    gin.placeholder = 'Add a group and press Enter…';
    gin.className = 'editor-input';
    gin.onkeydown = function (e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const g = C.canonicalGroup(gin.value, C.usedGroups(items).concat(it.groups));
        if (g && !it.groups.some(function (x) { return x.toLowerCase() === g.toLowerCase(); })) {
          it.groups.push(g); persist();
        }
        render(); focusEditor();
      }
    };
    box.appendChild(gin); ed.appendChild(box);
    const done = document.createElement('button'); done.className = 'done'; done.textContent = 'Done';
    done.onclick = function () { editing = null; render(); };
    ed.appendChild(done);
    return ed;
  }

  function focusEditor() {
    setTimeout(function () { const el = document.querySelector('.editor-input'); if (el) el.focus(); }, 0);
  }

  function render() {
    renderSide();
    renderDatalist();
    const list = $('list');
    const count = $('count');
    const q = (searchInput.value || '').trim();
    let shown;
    if (q) {
      shown = C.search(items, q); // SCN-004: spans everything
      count.textContent = shown.length + (shown.length === 1 ? ' match' : ' matches') + ' for “' + q + '”';
    } else {
      shown = C.inGroup(items, filter);
      count.textContent = shown.length + (shown.length === 1 ? ' bookmark' : ' bookmarks') + (filter === 'All' ? '' : ' in ' + filter);
    }

    list.innerHTML = '';
    if (shown.length === 0) {
      let msg;
      if (q) msg = 'No bookmarks match “' + q + '”.';
      else if (filter !== 'All') msg = 'No bookmarks in “' + filter + '” yet.';
      else if (items.length === 0) msg = 'Nothing saved yet. Paste a link above to save your first bookmark.';
      else msg = 'Nothing here yet.';
      const li = document.createElement('li'); li.className = 'noresult'; li.textContent = msg;
      list.appendChild(li);
    } else {
      shown.forEach(function (it) { list.appendChild(makeCard(it)); });
    }
    flashId = null;
  }

  // --- actions --------------------------------------------------------------
  function addPendingGroup(rawValue) {
    const g = C.canonicalGroup(rawValue, C.usedGroups(items).concat(pending));
    if (g && !pending.some(function (x) { return x.toLowerCase() === g.toLowerCase(); })) pending.push(g);
  }

  function removeBookmark(it) {
    if (!window.confirm('Remove “' + it.title + '” from your bookmarks?')) return; // SCN-006
    const i = items.indexOf(it);
    if (i > -1) { items.splice(i, 1); persist(); }
    render();
  }

  function saveBookmark() {
    const raw = urlInput.value.trim();
    const check = C.validateAdd(items, raw);
    if (!check.ok) {
      if (check.error === 'empty') return;
      if (check.error === 'invalid') { showMsg('error', 'That doesn’t look like a web link. Try something like example.com/page.'); return; }
      if (check.error === 'duplicate') { showMsg('warn', 'You’ve already saved this link — it’s highlighted below.'); flashId = check.duplicate.id; render(); return; }
    }
    // Fold in a group left typed but not yet entered.
    const leftover = groupInput.value.trim();
    if (leftover) addPendingGroup(leftover);
    const bm = C.makeBookmark(raw, pending, nextId());
    items.unshift(bm);        // newest first (SCN-001)
    persist();
    urlInput.value = ''; groupInput.value = ''; pending = [];
    clearMsg(); renderChips(); render();
  }

  // --- events ---------------------------------------------------------------
  $('saver').addEventListener('submit', function (e) { e.preventDefault(); saveBookmark(); });
  urlInput.addEventListener('input', clearMsg);
  groupInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addPendingGroup(groupInput.value);
      groupInput.value = ''; renderChips(); renderDatalist();
    }
  });
  searchInput.addEventListener('input', render);

  renderChips();
  render();
})();
