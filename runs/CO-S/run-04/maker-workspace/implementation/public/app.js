'use strict';

// Front-end for the bookmarks app. Talks to the local server over /api and
// renders the single list. Behaviour mirrors the approved scenarios SCN-001..009.

(function () {
  const $ = (id) => document.getElementById(id);
  const adder = $('adder');
  const urlInput = $('url');
  const notice = $('notice');
  const searchbar = $('searchbar');
  const searchInput = $('search');
  const countEl = $('count');
  const listEl = $('list');
  const toast = $('toast');
  const toastMsg = $('toastMsg');
  const undoBtn = $('undoBtn');

  let bookmarks = [];      // server-backed list, newest first
  let pending = [];        // optimistic rows awaiting a server response
  let query = '';
  let pendingSeq = 0;
  let undoState = null;
  let undoTimer = null;
  let toastTimer = null;

  // ---------- helpers ----------
  // Search/browse logic (SCN-003) lives in search.js, shared with the tests.
  const esc = window.BookmarkSearch.esc;
  const highlight = window.BookmarkSearch.highlight;
  const matches = window.BookmarkSearch.matches;
  const summarize = window.BookmarkSearch.summarize;

  function looksLikeUrl(text) {
    const s = String(text || '').trim();
    return !!s && !/\s/.test(s) && /\./.test(s);
  }
  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  // ---------- notice (SCN-007 / SCN-008) ----------
  function clearNotice() { notice.className = 'notice'; notice.innerHTML = ''; }
  function showInfo(text) {
    clearNotice();
    notice.className = 'notice info show';
    notice.innerHTML = '<span class="txt">' + esc(text) + '</span>';
  }
  function showNotLinkWarning(text, onSaveAnyway) {
    clearNotice();
    notice.className = 'notice warn show';
    const t = document.createElement('span');
    t.className = 'txt';
    t.textContent = '“' + text + '” doesn’t look like a web link. Save it anyway?';
    const save = document.createElement('button');
    save.className = 'primary'; save.type = 'button'; save.textContent = 'Save anyway';
    const cancel = document.createElement('button');
    cancel.className = 'ghost'; cancel.type = 'button'; cancel.textContent = 'Cancel';
    save.addEventListener('click', () => { clearNotice(); onSaveAnyway(); });
    cancel.addEventListener('click', () => { clearNotice(); urlInput.focus(); });
    notice.appendChild(t); notice.appendChild(save); notice.appendChild(cancel);
  }

  // ---------- render ----------
  function render(flashId) {
    const total = bookmarks.length;
    searchbar.hidden = total === 0 && pending.length === 0;

    if (total === 0 && pending.length === 0) {
      countEl.textContent = '';
      listEl.innerHTML =
        '<li class="empty"><div class="big">🔖</div>' +
        '<div class="head">No links saved yet</div>' +
        '<div class="small">Paste a link in the box above and it’ll show up here — your one spot to find it again.</div></li>';
      return;
    }

    const summary = summarize(bookmarks, query); // SCN-003
    countEl.textContent = summary.label;

    if (pending.length === 0 && summary.noMatch) {
      listEl.innerHTML = '<li class="empty"><div class="small">No links match “' + esc(query) + '”.</div></li>';
      return;
    }

    listEl.innerHTML = '';
    pending.forEach((p) => listEl.appendChild(renderPending(p))); // new saves on top
    summary.shown.forEach((b) => listEl.appendChild(renderRow(b, flashId)));
  }

  function renderPending(b) {
    const li = document.createElement('li');
    li.className = 'fetching';
    const row = document.createElement('div'); row.className = 'titlerow';
    const t = document.createElement('span'); t.className = 'title'; t.textContent = 'Getting the page name…';
    row.appendChild(t);
    const u = document.createElement('div'); u.className = 'link-url'; u.textContent = b.url;
    li.appendChild(row); li.appendChild(u);
    return li;
  }

  function renderRow(b, flashId) {
    const li = document.createElement('li');
    if (flashId && b.id === flashId) {
      li.className = 'flash';
      setTimeout(() => li.classList.remove('flash'), 1500);
      setTimeout(() => li.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
    }
    const row = document.createElement('div'); row.className = 'titlerow';

    const t = document.createElement('a');
    t.className = 'title' + (b.nameStatus === 'fallback' ? ' fallback' : '');
    t.href = b.url; t.target = '_blank'; t.rel = 'noopener';
    t.innerHTML = highlight(b.title, query);
    // SCN-002: single click opens the link (default anchor behaviour).
    row.appendChild(t);

    if (b.nameStatus === 'fallback') { // SCN-006 nudge
      const badge = document.createElement('span');
      badge.className = 'badge'; badge.textContent = 'name not found — rename?';
      row.appendChild(badge);
    }

    const actions = document.createElement('div'); actions.className = 'rowactions';
    const pencil = document.createElement('button');
    pencil.className = 'iconbtn'; pencil.type = 'button'; pencil.title = 'Rename'; pencil.textContent = '✎';
    pencil.setAttribute('aria-label', 'Rename');
    pencil.addEventListener('click', () => startRename(b, row, t, badgeOf(row)));
    const trash = document.createElement('button');
    trash.className = 'iconbtn trash'; trash.type = 'button'; trash.title = 'Remove'; trash.textContent = '🗑';
    trash.setAttribute('aria-label', 'Remove');
    trash.addEventListener('click', () => removeBookmark(b));
    actions.appendChild(pencil); actions.appendChild(trash);
    row.appendChild(actions);

    const u = document.createElement('div'); u.className = 'link-url'; u.innerHTML = highlight(b.url, query);
    li.appendChild(row); li.appendChild(u);
    return li;
  }

  function badgeOf(row) { return row.querySelector('.badge'); }

  // ---------- rename (SCN-002) ----------
  function startRename(b, row, titleEl, badgeEl) {
    const input = document.createElement('input');
    input.className = 'edit'; input.value = b.title;
    row.replaceChild(input, titleEl);
    if (badgeEl) badgeEl.style.display = 'none';
    setTimeout(() => { input.focus(); input.select(); }, 0);

    let done = false;
    async function commit() {
      if (done) return; done = true;
      const value = input.value.trim();
      if (!value || value === b.title) { render(); return; } // empty keeps old name
      const { ok, data } = await api('PATCH', '/api/bookmarks/' + encodeURIComponent(b.id), { title: value });
      if (ok && data.bookmark) replaceBookmark(data.bookmark);
      render();
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') { done = true; render(); } // cancel, restore previous
    });
    input.addEventListener('blur', commit);
  }

  // ---------- remove + undo (SCN-004) ----------
  async function removeBookmark(b) {
    const { ok, data } = await api('DELETE', '/api/bookmarks/' + encodeURIComponent(b.id));
    if (!ok) return;
    bookmarks = bookmarks.filter((x) => x.id !== b.id);
    render();
    undoState = { bookmark: data.bookmark, index: data.index };
    showToast('Removed “' + data.bookmark.title + '”');
  }
  function showToast(msg) {
    toastMsg.textContent = msg;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    if (undoTimer) clearTimeout(undoTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 5000);
    undoTimer = setTimeout(() => { undoState = null; }, 5000);
  }
  undoBtn.addEventListener('click', async () => {
    if (!undoState) return;
    const { ok, data } = await api('POST', '/api/bookmarks/' + encodeURIComponent(undoState.bookmark.id) + '/restore',
      { bookmark: undoState.bookmark, index: undoState.index });
    if (ok && data.bookmark) {
      const at = Math.max(0, Math.min(undoState.index, bookmarks.length));
      bookmarks.splice(at, 0, data.bookmark);
      render();
    }
    undoState = null;
    toast.classList.remove('show');
  });

  // ---------- add (SCN-001 / 006 / 007 / 008) ----------
  function doSave(rawUrl) {
    clearNotice();
    const ticket = { id: 'pending-' + (++pendingSeq), _pending: true, url: rawUrl };
    pending.unshift(ticket);
    render();

    api('POST', '/api/bookmarks', { url: rawUrl }).then(({ ok, status, data }) => {
      pending = pending.filter((p) => p.id !== ticket.id);
      if (status === 200 && data.duplicate) {          // SCN-008
        render(data.bookmark.id);
        showInfo('You already saved this one — here it is.');
        return;
      }
      if (ok && data.bookmark) {                        // SCN-001 / 006
        bookmarks.unshift(data.bookmark);
        render();
        return;
      }
      render();
      showInfo('Sorry, that couldn’t be saved. Please try again.');
    }).catch(() => {
      pending = pending.filter((p) => p.id !== ticket.id);
      render();
      showInfo('Sorry, that couldn’t be saved. Please try again.');
    });
  }

  adder.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) return;
    urlInput.value = '';
    if (!looksLikeUrl(rawUrl)) {                         // SCN-007
      showNotLinkWarning(rawUrl, () => doSave(rawUrl));
      return;
    }
    doSave(rawUrl);
  });

  searchInput.addEventListener('input', () => { query = searchInput.value.trim(); render(); });

  function replaceBookmark(updated) {
    bookmarks = bookmarks.map((b) => (b.id === updated.id ? updated : b));
  }

  // ---------- boot ----------
  (async function init() {
    const { ok, data } = await api('GET', '/api/bookmarks');
    if (ok && Array.isArray(data.bookmarks)) bookmarks = data.bookmarks;
    render();
  })();
})();
