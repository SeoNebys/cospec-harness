/*
 * app.js — browser UI wiring. Uses the pure core (window.BM) for all logic,
 * localStorage for persistence, and /api/title for title lookup.
 *
 * Traceability: see docs/scenario-code-map.md.
 */
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const STORAGE_KEY = 'mybookmarks.v1';

  // --- persistence -----------------------------------------------------
  function loadItems() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store.items));
  }

  const store = new BM.BookmarkStore(loadItems());

  // --- UI state --------------------------------------------------------
  let activeTag = null;   // currently browsed tag, or null (SCN-004)
  let pending = [];       // tags chosen for the bookmark being composed (SCN-005)
  let titleTouched = false; // has the user edited the name field? (SCN-002)
  let flashId = null;     // bookmark to briefly highlight (SCN-007 duplicate jump)

  // --- helpers ---------------------------------------------------------
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function highlight(text, q) {
    if (!q) return esc(text);
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) +
      '</mark>' + esc(text.slice(i + q.length));
  }

  // --- title lookup (SCN-002 / SCN-007) --------------------------------
  let titleReq = 0;
  let debounce;
  function onUrlInput() {
    const url = $('url').value.trim();
    $('banner').innerHTML = '';
    clearTimeout(debounce);
    if (!url) { setHint('', ''); return; }
    setHint('working', 'Looking up the page title…');
    const reqId = ++titleReq;
    debounce = setTimeout(function () {
      // Skip lookup if the user already named it themselves.
      if (titleTouched && $('title').value.trim()) { setHint('', ''); return; }
      fetch('/api/title?url=' + encodeURIComponent(url))
        .then(function (r) { return r.json(); })
        .catch(function () { return { ok: false }; })
        .then(function (data) {
          if (reqId !== titleReq) return;              // a newer lookup superseded this
          if ($('url').value.trim() !== url) return;    // url changed meanwhile
          if (data && data.ok && data.title) {
            if (!titleTouched || !$('title').value.trim()) $('title').value = data.title;
            setHint('ok', 'Filled in the page title — edit it if you like.');
          } else {
            setHint('warn', '⚠ Couldn’t reach that page to grab its title. ' +
              'You can type your own name — the link is still fine to save.');
          }
        });
    }, 500);
  }
  function setHint(cls, text) {
    const h = $('hint');
    h.className = 'hint' + (cls ? ' ' + cls : '');
    h.textContent = text;
  }

  // --- tag entry (SCN-005) ---------------------------------------------
  function renderPills() {
    const f = $('tagfield');
    Array.prototype.slice.call(f.querySelectorAll('.pill')).forEach(function (e) { e.remove(); });
    pending.forEach(function (tag) {
      const p = document.createElement('span');
      p.className = 'pill';
      p.appendChild(document.createTextNode(tag + ' '));
      const b = document.createElement('b');
      b.textContent = '×';
      b.setAttribute('aria-label', 'Remove tag ' + tag);
      b.onclick = function () {
        pending = pending.filter(function (x) { return x !== tag; });
        renderPills(); renderSuggest();
      };
      p.appendChild(b);
      f.insertBefore(p, $('tagInput'));
    });
  }
  function addPendingTag(raw) {
    const t = BM.normalizeTag(raw);
    if (!t) return;
    if (pending.indexOf(t) === -1) pending.push(t);
    $('tagInput').value = '';
    renderPills(); renderSuggest();
    $('tagInput').focus();
  }
  function renderSuggest() {
    const box = $('suggest');
    box.innerHTML = '';
    const s = store.suggestTags($('tagInput').value, pending);
    s.matches.forEach(function (t) {
      const el = document.createElement('span');
      el.className = 's';
      el.textContent = t;
      el.onclick = function () { addPendingTag(t); };
      box.appendChild(el);
    });
    if (s.canCreate) {
      const el = document.createElement('span');
      el.className = 's';
      el.innerHTML = '<span class="new">+ create</span> “' + esc(s.normalized) + '”';
      el.onclick = function () { addPendingTag(s.normalized); };
      box.appendChild(el);
    }
  }

  // --- save (SCN-001 / SCN-007) ----------------------------------------
  function onSave() {
    const banner = $('banner');
    banner.innerHTML = '';
    const url = $('url').value.trim();
    if (!url) return;
    const result = store.add({ url: url, title: $('title').value, tags: pending });
    if (!result.ok && result.reason === BM.ADD_INVALID) {
      banner.innerHTML = '<div class="banner bad">That doesn’t look like a web link. ' +
        'Double-check it, or add <b>https://</b> in front if you’re sure.</div>';
      return;
    }
    if (!result.ok && result.reason === BM.ADD_DUPLICATE) {
      const ex = result.existing;
      const div = document.createElement('div');
      div.className = 'banner dup';
      div.innerHTML = 'You’ve already saved this one — “<b>' + esc(BM.displayName(ex)) +
        '</b>”. <a data-jump="1">Show it</a>';
      div.querySelector('a').onclick = function () {
        $('search').value = ''; activeTag = null;
        flashId = ex.id; render();
        const node = document.querySelector('li[data-id="' + ex.id + '"]');
        if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      banner.appendChild(div);
      return;
    }
    // success
    persist();
    $('url').value = ''; $('title').value = ''; $('tagInput').value = '';
    pending = []; titleTouched = false;
    setHint('', ''); renderPills(); renderSuggest();
    render();
  }

  // --- rendering (SCN-001/003/004/006/008/009) -------------------------
  function renderTagbar() {
    const bar = $('tagbar');
    bar.innerHTML = '';
    const tags = store.tagCounts();
    if (tags.length === 0) return; // nothing to browse yet
    const all = document.createElement('span');
    all.className = 'chip' + (activeTag === null ? ' active' : '');
    all.textContent = 'All';
    all.onclick = function () { activeTag = null; render(); };
    bar.appendChild(all);
    tags.forEach(function (x) {
      const c = document.createElement('span');
      c.className = 'chip' + (activeTag === x.tag ? ' active' : '');
      c.textContent = x.tag + ' · ' + x.count;
      c.onclick = function () { activeTag = (activeTag === x.tag ? null : x.tag); render(); };
      bar.appendChild(c);
    });
  }

  function render() {
    renderTagbar();
    const q = $('search').value.trim();
    const empty = store.items.length === 0;

    // Search box is disabled while there is nothing to search (SCN-006).
    $('search').disabled = empty;

    const list = $('list');
    const count = $('count');
    list.innerHTML = '';

    if (empty) {
      count.textContent = '';
      list.innerHTML =
        '<li class="welcome" style="border:0;background:none">' +
        '<div class="big">📑</div>' +
        '<h2>Your bookmarks live here</h2>' +
        '<p>Save your first link above and it’ll show up right here.<br/>' +
        'Give it a tag or two, and later you can find it by searching<br/>' +
        'or by clicking a tag — however it comes to mind.</p>' +
        '<div class="arrow">↑ Start by pasting a link</div></li>';
      return;
    }

    // Combine tag browse (SCN-004) then search (SCN-003).
    let items = activeTag ? store.byTag(activeTag) : store.all();
    if (q) {
      const ql = q.toLowerCase();
      items = items.filter(function (b) {
        return BM.displayName(b).toLowerCase().indexOf(ql) !== -1 ||
               b.url.toLowerCase().indexOf(ql) !== -1;
      });
    }

    // Count / status line.
    let label = items.length + (items.length === 1 ? ' bookmark' : ' bookmarks');
    if (activeTag) label += ' tagged “' + activeTag + '”';
    if (q) label = items.length + ' match' + (items.length === 1 ? '' : 'es');
    count.textContent = items.length ? label : '';

    if (items.length === 0) {
      list.innerHTML = '<li class="no-match" style="border:0;background:none">No bookmarks match “' +
        esc(q) + '”' + (activeTag ? ' in “' + esc(activeTag) + '”' : '') + '.</li>';
      return;
    }

    items.forEach(function (b) {
      const li = document.createElement('li');
      li.setAttribute('data-id', b.id);
      if (b.id === flashId) li.className = 'flash';
      const title = document.createElement('div');
      title.className = 'title';
      title.innerHTML = highlight(BM.displayName(b), q);
      const a = document.createElement('a');
      a.className = 'link';
      a.href = b.url; a.target = '_blank'; a.rel = 'noopener';
      a.innerHTML = highlight(b.url, q);
      li.appendChild(title); li.appendChild(a);
      b.tags.forEach(function (t) {
        const tag = document.createElement('span');
        tag.className = 'itemtag';
        tag.textContent = t;
        li.appendChild(tag);
      });
      list.appendChild(li);
    });
    flashId = null; // one-shot highlight
  }

  // --- wiring ----------------------------------------------------------
  $('url').addEventListener('input', onUrlInput);
  $('title').addEventListener('input', function () { titleTouched = true; });
  $('tagInput').addEventListener('input', renderSuggest);
  $('tagInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addPendingTag($('tagInput').value); }
  });
  $('save').addEventListener('click', onSave);
  $('search').addEventListener('input', render);

  renderPills();
  renderSuggest();
  render();
})();
