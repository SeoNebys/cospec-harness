/* Bookmarks app frontend. Behaviour per approved scenarios SCN-001..021. */
(function () {
  const { normalizeUrl, dupKey } = window.Normalize;
  const { parseQuery, termsFromQuery } = window.Search;

  // ---------- state ----------
  const state = {
    bookmarks: [], collections: [], settings: { defaultSort: 'newest', autoLocalCopy: false, textSize: 'medium', perPage: 25 },
    query: '', view: 'all', activeTags: new Set(), sortBy: 'newest', page: 1, selected: new Set(),
    compiled: { ok: true, pred: () => true }, highlightTerms: []
  };
  const $ = id => document.getElementById(id);
  const statusEl = $('status');
  function setStatus(t) { statusEl.textContent = t || ''; }

  // ---------- api ----------
  async function api(method, url, body, asText) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      if (asText) { opts.headers['Content-Type'] = 'text/html'; opts.body = body; }
      else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    }
    const res = await fetch(url, opts);
    let data = null; try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, data };
  }

  // ---------- helpers ----------
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  function fmtDate(ms) { return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  function isPdf(url) { return /\.pdf(\?|#|$)/i.test(url); }

  function renderNote(txt) {
    const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const link = s => esc(s).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return String(txt || '').split(/\n{2,}/).map(b => {
      const lines = b.split('\n');
      return lines.every(l => /^\s*-\s+/.test(l))
        ? '<ul>' + lines.map(l => '<li>' + link(l.replace(/^\s*-\s+/, '')) + '</li>').join('') + '</ul>'
        : '<p>' + lines.map(link).join('<br>') + '</p>';
    }).join('');
  }
  function hl(text) {
    if (!state.highlightTerms.length) return escapeHtml(text);
    const low = text.toLowerCase(); const marks = [];
    state.highlightTerms.forEach(term => { let from = 0, i; while ((i = low.indexOf(term, from)) >= 0) { marks.push([i, i + term.length]); from = i + term.length; } });
    if (!marks.length) return escapeHtml(text);
    marks.sort((a, b) => a[0] - b[0]); const merged = [];
    for (const m of marks) { if (merged.length && m[0] <= merged[merged.length - 1][1]) merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], m[1]); else merged.push([...m]); }
    let out = '', pos = 0; for (const [s, e] of merged) { out += escapeHtml(text.slice(pos, s)) + '<mark>' + escapeHtml(text.slice(s, e)) + '</mark>'; pos = e; } out += escapeHtml(text.slice(pos)); return out;
  }
  function allTags() {
    const m = new Map();
    state.bookmarks.forEach(b => (b.tags || []).forEach(t => m.set(t, (m.get(t) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }

  // ---------- filtering / view / sort ----------
  function inView(b) {
    if (state.view === 'archived') return b.archived;
    if (b.archived) return false;
    if (state.view === 'toread') return b.readLater;
    return true;
  }
  function matches(b) {
    if (!inView(b)) return false;
    if (state.activeTags.size) { for (const t of state.activeTags) if (!(b.tags || []).includes(t)) return false; }
    if (!state.compiled.ok) return false;
    return state.compiled.pred(b);
  }
  function sortShown(arr) {
    const a = [...arr], s = state.sortBy;
    if (s === 'newest') a.sort((x, y) => y.addedAt - x.addedAt);
    else if (s === 'recent') a.sort((x, y) => y.updatedAt - x.updatedAt);
    else if (s === 'oldest') a.sort((x, y) => x.addedAt - y.addedAt);
    else if (s === 'title-az') a.sort((x, y) => x.title.localeCompare(y.title, undefined, { sensitivity: 'base' }));
    else if (s === 'title-za') a.sort((x, y) => y.title.localeCompare(x.title, undefined, { sensitivity: 'base' }));
    return a;
  }
  function counts() {
    return {
      all: state.bookmarks.filter(b => !b.archived).length,
      toread: state.bookmarks.filter(b => !b.archived && b.readLater).length,
      archived: state.bookmarks.filter(b => b.archived).length
    };
  }

  // ---------- views ----------
  function renderViews() {
    const c = counts(); const defs = [['all', `All (${c.all})`], ['toread', `To read (${c.toread})`], ['archived', `Archived (${c.archived})`]];
    const v = $('views'); v.innerHTML = '';
    defs.forEach(([k, label]) => { const b = document.createElement('button'); b.textContent = label; if (state.view === k) b.className = 'on'; b.onclick = () => { state.view = k; renderAll(); }; v.appendChild(b); });
  }

  // ---------- collections ----------
  function currentSig() { return JSON.stringify({ q: state.query.trim(), t: [...state.activeTags].sort() }); }
  function collSig(c) { return JSON.stringify({ q: (c.query || '').trim(), t: [...(c.tags || [])].sort() }); }
  function applyCollection(c) {
    state.query = c.query || ''; $('search').value = state.query;
    state.compiled = parseQuery(state.query); state.highlightTerms = termsFromQuery(state.query);
    state.activeTags = new Set(c.tags || []);
    $('searcherr').textContent = state.compiled.ok ? '' : "That search isn't complete yet — check quotes and parentheses.";
    renderAll();
  }
  function renderCollections() {
    const box = $('collections'); box.innerHTML = ''; const sig = currentSig();
    if (state.collections.length) { const l = document.createElement('span'); l.className = 'clbl'; l.textContent = 'Collections:'; box.appendChild(l); }
    state.collections.forEach(c => {
      const on = collSig(c) === sig;
      const el = document.createElement('span'); el.className = 'coll' + (on ? ' on' : '');
      el.innerHTML = `${escapeHtml(c.name)} <span class="x" title="Remove collection">×</span>`;
      el.onclick = async e => {
        if (e.target.classList.contains('x')) { await api('DELETE', '/api/collections/' + c.id); state.collections = state.collections.filter(x => x.id !== c.id); setStatus(`Removed collection “${c.name}”.`); renderCollections(); return; }
        applyCollection(c); setStatus(`Showing collection “${c.name}”.`);
      };
      box.appendChild(el);
    });
    const hasCriteria = state.query.trim() || state.activeTags.size;
    const alreadySaved = state.collections.some(c => collSig(c) === sig);
    if (hasCriteria && !alreadySaved) {
      const save = document.createElement('button'); save.className = 'save'; save.textContent = '＋ Save current search';
      save.onclick = () => {
        const form = document.createElement('form');
        form.innerHTML = `<input placeholder="Name this collection…" maxlength="40"><button type="submit">Save</button>`;
        const inp = form.querySelector('input');
        form.onsubmit = async e => {
          e.preventDefault(); const name = inp.value.trim(); if (!name) { inp.focus(); return; }
          const r = await api('POST', '/api/collections', { name, query: state.query, tags: [...state.activeTags] });
          if (r.data && r.data.collection) { state.collections.push(r.data.collection); setStatus(`Saved collection “${name}”.`); renderCollections(); }
        };
        box.replaceChild(form, save); inp.focus();
      };
      box.appendChild(save);
    }
  }

  // ---------- tag filter chips ----------
  function renderFilters() {
    const tags = allTags(); const box = $('filters'); box.innerHTML = tags.length ? '<span class="lbl">Tags:</span>' : '';
    tags.forEach(([t, n]) => {
      const el = document.createElement('span'); el.className = 'tag click' + (state.activeTags.has(t) ? ' on' : ''); el.textContent = `${t} (${n})`;
      el.onclick = () => { state.activeTags.has(t) ? state.activeTags.delete(t) : state.activeTags.add(t); renderAll(); };
      box.appendChild(el);
    });
    if (state.activeTags.size) { const clr = document.createElement('span'); clr.className = 'tag click'; clr.style.color = '#b91c1c'; clr.textContent = 'clear'; clr.onclick = () => { state.activeTags.clear(); renderAll(); }; box.appendChild(clr); }
  }

  // ---------- sort note (default vs temporary) ----------
  const SORT_LABELS = { newest: 'Newest first', recent: 'Recently updated', oldest: 'Oldest first', 'title-az': 'Title A–Z', 'title-za': 'Title Z–A' };
  function refreshSortNote() {
    const el = $('sortnote');
    if (state.sortBy === state.settings.defaultSort) { el.innerHTML = `Sorted by your default (${SORT_LABELS[state.settings.defaultSort]}).`; }
    else {
      el.innerHTML = `Temporary sort — <a id="resetsort">return to default (${SORT_LABELS[state.settings.defaultSort]})</a>.`;
      $('resetsort').onclick = () => { state.sortBy = state.settings.defaultSort; $('sort').value = state.sortBy; renderAll(); };
    }
  }

  // ---------- bulk bar ----------
  function renderBulkBar() {
    const bar = $('bulkbar'); const sel = [...state.selected];
    if (!sel.length) { bar.className = 'bulkbar hidden'; bar.innerHTML = ''; return; }
    bar.className = 'bulkbar';
    const shown = state.bookmarks.filter(matches);
    const allShownSelected = shown.length > 0 && shown.every(b => state.selected.has(b.id));
    bar.innerHTML =
      `<span class="n">${sel.length} selected</span>` +
      `<button class="link" data-a="selall">${allShownSelected ? 'Deselect' : 'Select'} all ${shown.length} shown</button>` +
      `<button class="link" data-a="clear">Clear</button><span class="sep"></span>` +
      `<input class="tagin" placeholder="tag name…">` +
      `<button data-a="addtag">Add tag</button><button data-a="rmtag">Remove tag</button><span class="sep"></span>` +
      `<button data-a="read">Mark read later</button><button data-a="unread">Mark as read</button>` +
      `<button data-a="arch">Archive</button><button data-a="unarch">Unarchive</button><span class="sep"></span>` +
      `<button class="danger" data-a="del">Delete…</button>`;
    const tagin = bar.querySelector('.tagin'); const norm = s => s.trim().toLowerCase();
    bar.querySelectorAll('button[data-a]').forEach(btn => btn.onclick = async () => {
      const a = btn.dataset.a; const ids = [...state.selected];
      if (a === 'selall') { if (allShownSelected) shown.forEach(b => state.selected.delete(b.id)); else shown.forEach(b => state.selected.add(b.id)); renderAll(); return; }
      if (a === 'clear') { state.selected.clear(); renderAll(); return; }
      let action = a, tag = null;
      if (a === 'addtag' || a === 'rmtag') { tag = norm(tagin.value); if (!tag) { setStatus('Type a tag name.'); return; } action = a === 'addtag' ? 'add-tag' : 'remove-tag'; }
      if (a === 'del') {
        bar.innerHTML = `<span class="n">Delete ${ids.length} bookmark(s) permanently? This can't be undone.</span>` +
          `<button class="danger" data-y>Delete permanently</button><button class="link" data-n>Keep</button>`;
        bar.querySelector('[data-y]').onclick = async () => { await doBulk('delete', null, ids); };
        bar.querySelector('[data-n]').onclick = renderBulkBar;
        return;
      }
      await doBulk(action, tag, ids);
    });
  }
  async function doBulk(action, tag, ids) {
    const r = await api('POST', '/api/bookmarks/bulk', { ids, action, tag });
    if (r.data && r.data.bookmarks) state.bookmarks = r.data.bookmarks;
    const affectedIds = new Set(ids);
    // keep selection only if every affected item still matches the current view
    const stillOk = ids.every(id => { const b = state.bookmarks.find(x => x.id === id); return b && matches(b); });
    if (!stillOk || action === 'delete') state.selected.clear();
    setStatus(bulkMessage(action, tag, r.data ? r.data.affected : ids.length));
    renderAll();
  }
  function bulkMessage(action, tag, n) {
    if (action === 'add-tag') return `Added “${tag}” to ${n} bookmark(s).`;
    if (action === 'remove-tag') return `Removed “${tag}” from ${n} bookmark(s).`;
    if (action === 'read') return `Marked ${n} to read later.`;
    if (action === 'unread') return `Marked ${n} as read.`;
    if (action === 'archive') return `Archived ${n}.`;
    if (action === 'unarchive') return `Unarchived ${n}.`;
    if (action === 'delete') return `Deleted ${n} bookmark(s).`;
    return '';
  }

  // ---------- list + paging ----------
  let lastFilterSig = '';
  function render() {
    const fsig = JSON.stringify({ q: state.query, t: [...state.activeTags], view: state.view, sortBy: state.sortBy, perPage: state.settings.perPage });
    if (fsig !== lastFilterSig) { state.page = 1; lastFilterSig = fsig; }
    const list = $('list'), pager = $('pager'), count = $('count');
    const shown = sortShown(state.bookmarks.filter(matches));
    count.textContent = (state.query || state.activeTags.size) ? `${shown.length} of ${state.bookmarks.length} shown` : `${state.bookmarks.length} bookmark(s)`;
    if (shown.length === 0) {
      let msg;
      if (state.query || state.activeTags.size) msg = '<strong>No matches</strong>Nothing matches your search or the selected tags. Try different words or clear a tag.';
      else if (state.view === 'toread') msg = '<strong>Nothing to read later</strong>Mark a bookmark with ☆ Read later and it will show up here.';
      else if (state.view === 'archived') msg = '<strong>Archive is empty</strong>Archived bookmarks are kept here, out of your main list.';
      else msg = '<strong>No bookmarks yet</strong>Paste a link above to save your first one.';
      list.innerHTML = '<div class="empty">' + msg + '</div>'; pager.innerHTML = ''; return;
    }
    const per = state.settings.perPage;
    let pageItems = shown;
    if (per > 0 && shown.length > per) {
      const totalPages = Math.ceil(shown.length / per);
      if (state.page > totalPages) state.page = totalPages; if (state.page < 1) state.page = 1;
      const start = (state.page - 1) * per; pageItems = shown.slice(start, start + per);
      pager.innerHTML = '';
      const prev = document.createElement('button'); prev.textContent = '‹ Previous'; prev.disabled = state.page <= 1; prev.onclick = () => { state.page--; render(); };
      const info = document.createElement('span'); info.textContent = `Page ${state.page} of ${totalPages} · showing ${start + 1}–${start + pageItems.length} of ${shown.length}`;
      const next = document.createElement('button'); next.textContent = 'Next ›'; next.disabled = state.page >= totalPages; next.onclick = () => { state.page++; render(); };
      pager.appendChild(prev); pager.appendChild(info); pager.appendChild(next);
    } else pager.innerHTML = '';
    list.innerHTML = '';
    pageItems.forEach(b => list.appendChild(renderItem(b)));
  }

  function renderItem(b) {
    const el = document.createElement('div'); el.className = 'bm' + (b._flash ? ' flash' : '') + (state.selected.has(b.id) ? ' selected' : ''); el.dataset.id = b.id;
    const sel = document.createElement('div'); sel.className = 'selbox';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = state.selected.has(b.id); cb.title = 'Select';
    cb.onchange = () => { cb.checked ? state.selected.add(b.id) : state.selected.delete(b.id); renderAll(); };
    sel.appendChild(cb); el.appendChild(sel);

    const fav = document.createElement('div'); fav.className = 'fav';
    fav.style.background = b.favicon.fallback.color; fav.textContent = b.favicon.fallback.letter; el.appendChild(fav);
    if (b.favicon.real) { const im = new Image(); im.className = 'fav-real'; im.onload = () => { fav.textContent = ''; fav.style.background = '#fff'; fav.style.border = '1px solid var(--line)'; fav.appendChild(im); }; im.src = b.favicon.real; }

    const body = document.createElement('div'); body.className = 'body'; el.appendChild(body);
    body.innerHTML =
      `<p class="title"><a href="${escapeHtml(b.url)}" target="_blank" rel="noopener">${hl(b.title)}</a></p>` +
      (b.description ? `<p class="desc">${hl(b.description)}</p>` : '') +
      (b.note ? `<div class="note"><div class="note-label">My note</div><div class="note-body">${renderNote(b.note)}</div></div>` : '') +
      ((b.tags && b.tags.length) ? `<div class="tagrow"></div>` : '') +
      `<div class="copies"></div>` +
      `<div class="url">${hl(b.url)}</div>` +
      `<div class="actions">` +
        `<button class="edit">Edit details</button>` +
        `<button class="star">${b.readLater ? '★ To read' : '☆ Read later'}</button>` +
        `<button class="arch">${b.archived ? 'Unarchive' : 'Archive'}</button>` +
        `<button class="del">Delete</button>` +
      `</div>`;
    if (b.tags && b.tags.length) { const tr = body.querySelector('.tagrow'); b.tags.forEach(t => { const s = document.createElement('span'); s.className = 'tag click' + (state.activeTags.has(t) ? ' on' : ''); s.textContent = t; s.onclick = () => { state.activeTags.has(t) ? state.activeTags.delete(t) : state.activeTags.add(t); renderAll(); }; tr.appendChild(s); }); }
    renderCopies(b, body.querySelector('.copies'));
    body.querySelector('.edit').onclick = () => openEditor(b, body);
    body.querySelector('.star').onclick = async () => { await patch(b.id, { readLater: !b.readLater, _touch: false }); setStatus(b.readLater ? 'Removed from To read.' : 'Marked to read later.'); };
    body.querySelector('.arch').onclick = async () => { await patch(b.id, { archived: !b.archived, _touch: false }); setStatus(b.archived ? 'Restored to your main list.' : 'Archived — hidden from your main list.'); };
    body.querySelector('.del').onclick = () => confirmDelete(b, body);

    if (b.preview) { const p = document.createElement('div'); p.className = 'preview'; p.style.backgroundImage = `url("${b.preview}")`; p.title = 'Page preview'; p.innerHTML = '<span>preview</span>'; el.appendChild(p); }
    return el;
  }

  function confirmDelete(b, body) {
    const act = body.querySelector('.actions');
    act.innerHTML = `<span class="confirm">Delete permanently? This can't be undone. </span>` +
      `<button class="del confirm-yes">Delete permanently</button><button class="confirm-no">Keep</button>`;
    act.querySelector('.confirm-yes').onclick = async () => { await api('DELETE', '/api/bookmarks/' + b.id); state.bookmarks = state.bookmarks.filter(x => x.id !== b.id); state.selected.delete(b.id); setStatus('Bookmark permanently deleted.'); renderAll(); };
    act.querySelector('.confirm-no').onclick = renderAll;
  }

  // ---------- copies (local / archive) ----------
  function renderCopies(b, host) {
    host.innerHTML = ''; const pdf = isPdf(b.url);
    const c1 = document.createElement('span');
    if (b.snapshot && b.snapshot.status === 'done') {
      c1.innerHTML = `<span class="ok">✓ ${pdf ? 'PDF stored' : 'Local copy'} (${fmtDate(b.snapshot.at)})</span> · <a class="linkb" href="/api/bookmarks/${b.id}/snapshot" target="_blank" rel="noopener">View</a> · <button class="linkb re">Update</button>`;
      c1.querySelector('.re').onclick = () => captureSnapshot(b);
    } else if (b.snapshot && b.snapshot.status === 'saving') { c1.innerHTML = `<span class="pending">Saving ${pdf ? 'PDF' : 'local copy'}…</span>`; }
    else if (b.snapshot && b.snapshot.status === 'failed') { c1.innerHTML = `<span class="failed">Couldn't save a copy — ${escapeHtml(b.snapshot.reason)}.</span> · <button class="linkb re">Try again</button>`; c1.querySelector('.re').onclick = () => captureSnapshot(b); }
    else { c1.innerHTML = `<button class="linkb save-copy">${pdf ? 'Save the PDF' : 'Save a local copy'}</button>`; c1.querySelector('.save-copy').onclick = () => captureSnapshot(b); }
    host.appendChild(c1);
    const sep = document.createElement('span'); sep.className = 'cp-sep'; sep.textContent = '·'; host.appendChild(sep);
    const c2 = document.createElement('span');
    if (b.archiveUrl) { c2.innerHTML = `<span class="ok">✓ Internet Archive</span> · <a class="linkb" href="${escapeHtml(b.archiveUrl)}" target="_blank" rel="noopener">Open archived</a>`; }
    else if (b._archiving) { c2.innerHTML = `<span class="pending">Creating Internet Archive copy…</span>`; }
    else if (b._archConfirm) {
      c2.innerHTML = `<span class="warn">This creates a <b>public</b> copy on archive.org, visible to anyone. Continue?</span> · <button class="linkb go">Create public copy</button> · <button class="linkb no">Cancel</button>`;
      c2.querySelector('.go').onclick = () => makeArchive(b);
      c2.querySelector('.no').onclick = () => { b._archConfirm = false; renderAll(); };
    } else { c2.innerHTML = `<button class="linkb make-arch">Create Internet Archive copy</button>`; c2.querySelector('.make-arch').onclick = () => { b._archConfirm = true; renderAll(); }; }
    host.appendChild(c2);
  }
  async function captureSnapshot(b) {
    b.snapshot = { status: 'saving' }; renderAll();
    const r = await api('POST', `/api/bookmarks/${b.id}/snapshot`);
    if (r.ok && r.data && r.data.snapshot) { Object.assign(b, { snapshot: r.data.snapshot }); setStatus(isPdf(b.url) ? 'PDF stored locally.' : 'Self-contained local copy saved.'); }
    else { b.snapshot = { status: 'failed', reason: (r.data && r.data.reason) || 'the page could not be captured' }; setStatus(`Couldn't save a local copy — ${b.snapshot.reason}. The bookmark is unchanged.`); }
    renderAll();
  }
  async function makeArchive(b) {
    b._archConfirm = false; b._archiving = true; renderAll();
    const r = await api('POST', `/api/bookmarks/${b.id}/archive`, { confirmPublic: true });
    b._archiving = false;
    if (r.ok && r.data && r.data.archiveUrl) { b.archiveUrl = r.data.archiveUrl; setStatus('Internet Archive copy created.'); }
    else { setStatus(`Couldn't create an Internet Archive copy — ${(r.data && r.data.reason) || 'archive.org unavailable'}.`); }
    renderAll();
  }

  // ---------- tag editor with suggestions ----------
  function tagEditor(initial) {
    const wrap = document.createElement('div'); wrap.className = 'taginput';
    const tags = [...(initial || [])];
    const input = document.createElement('input'); input.placeholder = tags.length ? 'add a tag…' : 'type a tag and press Enter';
    let sug = null, active = -1;
    function draw() { [...wrap.querySelectorAll('.tag')].forEach(n => n.remove()); tags.forEach((t, i) => { const s = document.createElement('span'); s.className = 'tag'; s.innerHTML = `${escapeHtml(t)} <span class="x">×</span>`; s.querySelector('.x').onclick = () => { tags.splice(i, 1); draw(); }; wrap.insertBefore(s, input); }); }
    function add(v) { v = String(v || '').trim().toLowerCase().replace(/,$/, ''); if (v && !tags.includes(v)) tags.push(v); input.value = ''; draw(); closeSug(); }
    function closeSug() { if (sug) { sug.remove(); sug = null; } active = -1; }
    function showSug() {
      const q = input.value.trim().toLowerCase();
      const existing = allTags().map(([t]) => t).filter(t => !tags.includes(t));
      const cands = q ? existing.filter(t => t.includes(q)) : existing;
      closeSug(); if (!cands.length && !q) return;
      sug = document.createElement('div'); sug.className = 'suggest';
      cands.slice(0, 6).forEach(t => { const d = document.createElement('div'); d.textContent = t; d.onmousedown = e => { e.preventDefault(); add(t); }; sug.appendChild(d); });
      if (q && !existing.includes(q)) { const d = document.createElement('div'); d.className = 'new'; d.textContent = `Create new tag “${q}”`; d.onmousedown = e => { e.preventDefault(); add(q); }; sug.appendChild(d); }
      wrap.parentElement.appendChild(sug); active = -1;
    }
    function move(dir) { const items = sug ? [...sug.children] : []; if (!items.length) return; items.forEach(x => x.classList.remove('active')); active = (active + dir + items.length) % items.length; items[active].classList.add('active'); }
    input.oninput = showSug; input.onfocus = showSug; input.onblur = () => setTimeout(closeSug, 120);
    input.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (sug && active >= 0) add(sug.children[active].classList.contains('new') ? input.value : sug.children[active].textContent); else add(input.value); }
      else if (e.key === 'Escape') closeSug();
      else if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); draw(); }
    };
    wrap.appendChild(input); draw();
    return { el: wrap, get: () => [...tags] };
  }

  // ---------- draft / editor ----------
  function draftFields(d) {
    const wrap = document.createElement('div'); wrap.className = 'draft';
    wrap.innerHTML =
      `<div class="fetchline" ${d.fetched ? '' : 'style="display:none"'}>✓ Title and description picked up automatically — adjust if needed.</div>` +
      `<div><label>Address</label><input class="d-url" type="text"></div>` +
      `<div><label>Title</label><input class="d-title" type="text"></div>` +
      `<div><label>Description (the site's summary)</label><textarea class="d-desc"></textarea></div>` +
      `<div><label>Tags</label><div class="tagslot"></div></div>` +
      `<div><label>My note (optional)</label><textarea class="d-note" placeholder="Your own note. Use - for a list, [text](https://…) for a link."></textarea>` +
      `<div class="hint">Preview:</div><div class="previewbox d-prev"></div></div>` +
      `<div class="row"><button class="btn d-save">Save bookmark</button><button class="btn ghost d-cancel">Cancel</button></div>`;
    wrap.querySelector('.d-url').value = d.url || '';
    wrap.querySelector('.d-title').value = d.title || '';
    wrap.querySelector('.d-desc').value = d.description || '';
    wrap.querySelector('.d-note').value = d.note || '';
    const te = tagEditor(d.tags || []); wrap.querySelector('.tagslot').appendChild(te.el); wrap._tags = te;
    const prev = wrap.querySelector('.d-prev'), noteEl = wrap.querySelector('.d-note');
    const upd = () => prev.innerHTML = noteEl.value.trim() ? renderNote(noteEl.value) : '<span style="color:#9ca3af">Nothing yet</span>';
    noteEl.oninput = upd; upd();
    return wrap;
  }
  function readDraft(wrap, base) {
    const raw = wrap.querySelector('.d-url').value.trim(); const u = normalizeUrl(raw);
    return {
      _validUrl: !!u, url: u ? u.href : (base.url || ''),
      title: wrap.querySelector('.d-title').value.trim() || base.title || '',
      description: wrap.querySelector('.d-desc').value.trim(),
      note: wrap.querySelector('.d-note').value.trim(),
      tags: wrap._tags.get()
    };
  }

  async function openEditor(b, body) {
    const wrap = draftFields(b); body.innerHTML = ''; body.appendChild(wrap);
    wrap.querySelector('.d-save').textContent = 'Save changes';
    wrap.querySelector('.d-save').onclick = async () => {
      const nd = readDraft(wrap, b);
      if (!nd._validUrl) { setStatus("That address doesn't look like a valid link — please fix it."); return; }
      const r = await patch(b.id, { url: nd.url, title: nd.title, description: nd.description, note: nd.note, tags: nd.tags });
      if (r && r.error === 'address-conflict') { setStatus(`That address is already used by “${r.conflict.title}”${r.conflict.archived ? ' (in Archive)' : ''} — both bookmarks are left unchanged.`); return; }
      setStatus('Your changes are saved.'); renderAll();
    };
    wrap.querySelector('.d-cancel').onclick = renderAll;
  }

  // ---------- add flow (Option C panel) ----------
  async function startAdd() {
    const urlEl = $('url'), addBtn = $('add'), slot = $('slot');
    const u = normalizeUrl(urlEl.value);
    if (!u) { setStatus("That doesn't look like a valid link yet."); return; }
    const dup = state.bookmarks.find(b => dupKey(b.url) === dupKey(u.href));
    if (dup) { urlEl.value = ''; slot.innerHTML = ''; setStatus(dup.archived ? "You already saved this link (it's in your Archive) — here it is." : 'You already saved this link — here it is.'); revealExisting(dup); return; }
    addBtn.disabled = true; setStatus('Fetching page details…');
    const meta = await api('POST', '/api/metadata', { url: u.href });
    addBtn.disabled = false;
    const md = meta.data || {};
    const failed = !md.ok;
    const base = failed
      ? { url: u.href, title: (md.fallback && md.fallback.title) || u.hostname.replace(/^www\./, ''), description: '', note: '', tags: [], fetched: false, favicon: (md.fallback && md.fallback.favicon) || null, preview: null }
      : { url: u.href, title: md.title, description: md.description, note: '', tags: [], fetched: true, favicon: md.favicon || null, preview: md.preview || null };
    const wrap = draftFields(base); slot.innerHTML = ''; slot.appendChild(wrap);
    if (failed) { const w = document.createElement('div'); w.className = 'fetchwarn'; w.textContent = `Couldn't read this page automatically (${md.reason || 'unavailable'}) — we used the site address as the title. Add or correct the details, then save.`; wrap.insertBefore(w, wrap.firstChild); }
    setStatus(failed ? "Page details couldn't be fetched — fill them in and save." : 'Review and add tags, then confirm.');
    wrap.querySelector('.d-save').onclick = async () => {
      const nd = readDraft(wrap, base);
      if (!nd._validUrl) { setStatus("That address doesn't look like a valid link — please fix it."); return; }
      const r = await api('POST', '/api/bookmarks', { url: nd.url, title: nd.title, description: nd.description, note: nd.note, tags: nd.tags, favicon: { real: base.favicon }, preview: base.preview });
      if (r.data && r.data.duplicate) { slot.innerHTML = ''; urlEl.value = ''; await reload(); const ex = state.bookmarks.find(x => x.id === r.data.duplicate.id); setStatus('You already saved this link — opening it instead.'); if (ex) revealExisting(ex); return; }
      if (r.data && r.data.bookmark) {
        state.bookmarks.push(r.data.bookmark); slot.innerHTML = ''; urlEl.value = ''; setStatus('Saved.'); urlEl.focus(); renderAll();
        if (state.settings.autoLocalCopy) captureSnapshot(r.data.bookmark);
      }
    };
    wrap.querySelector('.d-cancel').onclick = () => { slot.innerHTML = ''; setStatus(''); };
    wrap.querySelector('.d-title').focus();
  }

  function revealExisting(dup) {
    state.query = ''; $('search').value = ''; state.compiled = parseQuery(''); state.highlightTerms = []; state.activeTags.clear();
    state.view = dup.archived ? 'archived' : 'all';
    dup._flash = true; renderAll();
    const node = [...$('list').children].find(n => n.dataset.id === dup.id);
    if (node) { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); openEditor(dup, node.querySelector('.body')); }
    setTimeout(() => { dup._flash = false; }, 1500);
  }

  // ---------- mutations helper ----------
  async function patch(id, body) {
    const r = await api('PATCH', '/api/bookmarks/' + id, body);
    if (r.data && r.data.bookmark) { const i = state.bookmarks.findIndex(b => b.id === id); if (i >= 0) state.bookmarks[i] = r.data.bookmark; renderAll(); return r.data; }
    return r.data || {};
  }

  // ---------- settings ----------
  function openSettings() {
    const ov = document.createElement('div'); ov.className = 'overlay';
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML =
      `<div style="font-weight:600;margin-bottom:4px">Settings</div>` +
      `<div class="setrow"><label>Default sort — how the list is ordered when you open the app</label>` +
      `<select id="defsort">${Object.entries(SORT_LABELS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>` +
      `<div class="hint" style="margin-top:6px">Changing the sort dropdown only affects this session; your default stays until you change it here.</div>` +
      `<div class="setrow"><label>Text size</label><select id="setfont"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></div>` +
      `<div class="setrow"><label>Bookmarks shown per page</label><select id="setpage"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="0">All</option></select></div>` +
      `<div class="setrow"><label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="setautocopy"> Automatically save a local copy when I save a bookmark</label></div>` +
      `<div class="setrow"><label>Import / export (standard browser bookmarks file)</label>` +
      `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><a class="btn ghost" id="setexport" href="/api/export">Export bookmarks.html</a>` +
      `<button class="btn ghost" id="setimportbtn" type="button">Import bookmarks.html…</button>` +
      `<input type="file" id="setimport" accept=".html,text/html" style="display:none"></div>` +
      `<div class="hint">Keeps titles, tags and original dates. Already-saved links are skipped.</div></div>` +
      `<div class="row" style="margin-top:14px"><button class="btn" id="setsave">Save</button><button class="btn ghost" id="setclose">Close</button></div>`;
    ov.appendChild(card); document.body.appendChild(ov);
    card.querySelector('#defsort').value = state.settings.defaultSort;
    card.querySelector('#setfont').value = state.settings.textSize;
    card.querySelector('#setpage').value = String(state.settings.perPage);
    card.querySelector('#setautocopy').checked = !!state.settings.autoLocalCopy;
    card.querySelector('#setclose').onclick = () => ov.remove();
    card.querySelector('#setsave').onclick = async () => {
      const patchS = {
        defaultSort: card.querySelector('#defsort').value,
        textSize: card.querySelector('#setfont').value,
        perPage: Number(card.querySelector('#setpage').value),
        autoLocalCopy: card.querySelector('#setautocopy').checked
      };
      const r = await api('PUT', '/api/settings', patchS);
      if (r.data && r.data.settings) state.settings = r.data.settings;
      applyFontSize(); state.sortBy = state.settings.defaultSort; $('sort').value = state.sortBy;
      ov.remove(); setStatus('Settings saved.'); renderAll();
    };
    const fileInput = card.querySelector('#setimport');
    card.querySelector('#setimportbtn').onclick = () => fileInput.click();
    fileInput.onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        const r = await api('POST', '/api/import', String(rd.result), true);
        if (r.data) { if (r.data.bookmarks) state.bookmarks = r.data.bookmarks; setStatus(`Imported ${r.data.added} bookmark(s)${r.data.skipped ? `, skipped ${r.data.skipped} already-saved` : ''}.`); ov.remove(); renderAll(); }
      };
      rd.readAsText(f);
    };
  }
  function applyFontSize() { document.body.classList.remove('fs-small', 'fs-medium', 'fs-large'); document.body.classList.add('fs-' + state.settings.textSize); }

  // ---------- orchestration ----------
  function renderAll() { renderViews(); renderCollections(); renderFilters(); renderBulkBar(); render(); refreshSortNote(); }

  async function reload() {
    const r = await api('GET', '/api/bookmarks'); if (r.data && r.data.bookmarks) state.bookmarks = r.data.bookmarks;
  }

  async function init() {
    const [bs, st, cs] = await Promise.all([api('GET', '/api/bookmarks'), api('GET', '/api/settings'), api('GET', '/api/collections')]);
    if (bs.data) state.bookmarks = bs.data.bookmarks || [];
    if (st.data && st.data.settings) state.settings = st.data.settings;
    if (cs.data) state.collections = cs.data.collections || [];
    state.sortBy = state.settings.defaultSort;
    applyFontSize();
    $('sort').value = state.sortBy;
    $('add').onclick = startAdd;
    $('url').addEventListener('keydown', e => { if (e.key === 'Enter') startAdd(); });
    $('search').addEventListener('input', e => {
      state.query = e.target.value; state.compiled = parseQuery(state.query); state.highlightTerms = termsFromQuery(state.query);
      $('searcherr').textContent = state.compiled.ok ? '' : "That search isn't complete yet — check quotes and parentheses.";
      renderCollections(); render();
    });
    $('sort').addEventListener('change', e => { state.sortBy = e.target.value; render(); refreshSortNote(); });
    $('gear').onclick = openSettings;
    renderAll();
    document.body.setAttribute('data-harness-ready', 'true');
  }

  init();
})();
