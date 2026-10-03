// Phase 1 exploratory prototype — Bookmark library
// Iteration 7: richer save & edit —
//   * review/correct the auto-filled title & description BEFORE finalizing a save
//   * edit an entry's address too (with duplicate-address guard)
//   * notes support simple formatting (headings/bold/lists/links), rendered on view
// Carries approved behaviour: quick save, auto-fill, readable list, duplicate
//   handling, read/archive states with All / Unread / Archived views, tags with
//   single- and multi-tag (match-all) filtering, editing title/description/note.
// Exploration prototype only — NOT production code; must not seed Phase 2.

const http = require('http');

const PORT = 4001;
const HOST = '0.0.0.0';

/** In-memory store (prototype only). Each entry: {read, archived, tags:[]}. */
const bookmarks = [];
let nextId = 1;

function seed() {
  const now = Date.now();
  const samples = [
    { url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Grid',
      title: 'CSS Grid Layout — MDN',
      description: 'A two-dimensional layout system for the web, with rows and columns.',
      siteName: 'developer.mozilla.org', read: false, archived: false, ageMin: 8,
      tags: ['css', 'reference', 'web'] },
    { url: 'https://www.nngroup.com/articles/progressive-disclosure/',
      title: 'Progressive Disclosure — Nielsen Norman Group',
      description: 'Defer advanced or rarely used features to a secondary screen to keep interfaces calm.',
      siteName: 'nngroup.com', read: false, archived: false, ageMin: 40,
      tags: ['ux', 'reading', 'web'],
      note: 'Re-read before redesigning the settings screen.' },
    { url: 'https://en.wikipedia.org/wiki/Zettelkasten',
      title: 'Zettelkasten — Wikipedia',
      description: 'A method of personal knowledge management and note-taking.',
      siteName: 'en.wikipedia.org', read: true, archived: false, ageMin: 130,
      tags: ['notes', 'method', 'reading'] },
    { url: 'https://www.gutenberg.org/ebooks/1342',
      title: 'Pride and Prejudice, by Jane Austen — Project Gutenberg',
      description: 'The complete text, free to read.',
      siteName: 'gutenberg.org', read: true, archived: true, ageMin: 1500,
      tags: ['book'] },
    { url: 'https://web.archive.org/',
      title: 'Internet Archive: Wayback Machine',
      description: 'Explore archived snapshots of web pages over time.',
      siteName: 'web.archive.org', read: false, archived: true, ageMin: 6000,
      tags: ['tools', 'reference'] },
  ];
  for (const s of samples) {
    const host = new URL(s.url).hostname.replace(/^www\./, '');
    bookmarks.push({
      id: nextId++, url: s.url, key: canonicalKey(s.url),
      title: s.title, description: s.description, siteName: s.siteName,
      favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
      retrieved: true, read: s.read, archived: s.archived, tags: s.tags.slice(),
      note: s.note || '',
      savedAt: new Date(now - s.ageMin * 60000).toISOString(),
    });
  }
  bookmarks.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
}

// ---- metadata retrieval -----------------------------------------------------

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .trim();
}
function metaContent(html, patterns) {
  for (const re of patterns) {
    const m = re.exec(html);
    if (m && m[1] && m[1].trim()) return decodeEntities(m[1]);
  }
  return '';
}
function normalizeUrl(raw) {
  let u = (raw || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { return new URL(u).toString(); } catch { return ''; }
}
function canonicalKey(url) {
  try {
    const p = new URL(url);
    const host = p.hostname.replace(/^www\./, '').toLowerCase();
    let path = p.pathname.replace(/\/+$/, '');
    if (path === '') path = '/';
    return host + path + p.search;
  } catch { return url; }
}
async function fetchMetadata(url) {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, '');
  const result = { title: '', description: '', siteName: host,
    favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=64`, retrieved: false };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BookmarkPrototype/1.0)' },
      signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    const html = (await res.text()).slice(0, 400000);
    result.title = metaContent(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i ]);
    result.description = metaContent(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i ]);
    const site = metaContent(html, [
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i ]);
    if (site) result.siteName = site;
    result.retrieved = true;
  } catch { result.retrieved = false; }
  if (!result.title) result.title = host + parsed.pathname.replace(/\/$/, '');
  return result;
}

// ---- api --------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function normTag(t) { return (t || '').trim().replace(/\s+/g, ' ').slice(0, 40); }

async function handleSave(req, res) {
  const body = await readBody(req);
  let url = '';
  try { url = JSON.parse(body).url; } catch {}
  const normalized = normalizeUrl(url);
  if (!normalized) return json(res, 400, { error: 'invalid_url' });
  const key = canonicalKey(normalized);
  const existing = bookmarks.find((b) => b.key === key);
  if (existing) return json(res, 200, { bookmark: existing, duplicate: true });
  const meta = await fetchMetadata(normalized);
  const entry = {
    id: nextId++, url: normalized, key,
    title: meta.title, description: meta.description, siteName: meta.siteName,
    favicon: meta.favicon, retrieved: meta.retrieved,
    read: false, archived: false, tags: [], note: '',
    savedAt: new Date().toISOString() };
  bookmarks.unshift(entry);
  json(res, 200, { bookmark: entry, duplicate: false });
}

async function handleField(req, res, field) {
  const body = await readBody(req);
  let id, value;
  try { ({ id, value } = JSON.parse(body)); } catch {}
  if (typeof value !== 'boolean') return json(res, 400, { error: 'bad_value' });
  const b = bookmarks.find((x) => x.id === id);
  if (!b) return json(res, 404, { error: 'not_found' });
  b[field] = value;
  json(res, 200, { bookmark: b });
}

function faviconFor(host) {
  return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
}

// Fetch details for a candidate address WITHOUT storing it, so the client can
// review/correct the title and description before the save is finalized.
async function handlePreview(req, res) {
  const body = await readBody(req);
  let url = '';
  try { url = JSON.parse(body).url; } catch {}
  const normalized = normalizeUrl(url);
  if (!normalized) return json(res, 400, { error: 'invalid_url' });
  const key = canonicalKey(normalized);
  const existing = bookmarks.find((b) => b.key === key);
  if (existing) return json(res, 200, { duplicate: true, bookmark: existing });
  const meta = await fetchMetadata(normalized);
  json(res, 200, { duplicate: false, preview: {
    url: normalized, title: meta.title, description: meta.description,
    siteName: meta.siteName, favicon: meta.favicon, retrieved: meta.retrieved } });
}

// Finalize a save using the (possibly edited) title/description/note.
async function handleCreate(req, res) {
  const body = await readBody(req);
  let url, title, description, note, retrieved;
  try { ({ url, title, description, note, retrieved } = JSON.parse(body)); } catch {}
  const normalized = normalizeUrl(url);
  if (!normalized) return json(res, 400, { error: 'invalid_url' });
  const key = canonicalKey(normalized);
  const existing = bookmarks.find((b) => b.key === key);
  if (existing) return json(res, 200, { duplicate: true, bookmark: existing });
  const host = new URL(normalized).hostname.replace(/^www\./, '');
  const entry = {
    id: nextId++, url: normalized, key,
    title: (typeof title === 'string' && title.trim()) ? title.trim() : host,
    description: typeof description === 'string' ? description.trim() : '',
    siteName: host, favicon: faviconFor(host),
    retrieved: retrieved !== false,
    read: false, archived: false, tags: [],
    note: typeof note === 'string' ? note.trim() : '',
    savedAt: new Date().toISOString() };
  bookmarks.unshift(entry);
  json(res, 200, { duplicate: false, bookmark: entry });
}

async function handleUpdate(req, res) {
  const body = await readBody(req);
  let id, url, title, description, note;
  try { ({ id, url, title, description, note } = JSON.parse(body)); } catch {}
  const b = bookmarks.find((x) => x.id === id);
  if (!b) return json(res, 404, { error: 'not_found' });
  // Address change: validate and guard against creating a duplicate.
  if (typeof url === 'string' && url.trim()) {
    const norm = normalizeUrl(url);
    if (!norm) return json(res, 400, { error: 'invalid_url' });
    const nk = canonicalKey(norm);
    const clash = bookmarks.find((x) => x.id !== id && x.key === nk);
    if (clash) return json(res, 409, { error: 'duplicate_address', title: clash.title });
    if (nk !== b.key) {
      b.url = norm; b.key = nk;
      const host = new URL(norm).hostname.replace(/^www\./, '');
      b.siteName = host; b.favicon = faviconFor(host);
    }
  }
  if (typeof title === 'string') {
    const t = title.trim();
    b.title = t || (new URL(b.url).hostname.replace(/^www\./, ''));
  }
  if (typeof description === 'string') b.description = description.trim();
  if (typeof note === 'string') b.note = note.trim();
  json(res, 200, { bookmark: b });
}

async function handleTag(req, res, add) {
  const body = await readBody(req);
  let id, tag;
  try { ({ id, tag } = JSON.parse(body)); } catch {}
  const b = bookmarks.find((x) => x.id === id);
  if (!b) return json(res, 404, { error: 'not_found' });
  const t = normTag(tag);
  if (!t) return json(res, 400, { error: 'empty_tag' });
  if (add) {
    if (!b.tags.some((x) => x.toLowerCase() === t.toLowerCase())) b.tags.push(t);
  } else {
    b.tags = b.tags.filter((x) => x.toLowerCase() !== t.toLowerCase());
  }
  json(res, 200, { bookmark: b });
}

// ---- html -------------------------------------------------------------------

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Library</title>
<style>
  :root{--bg:#f6f5f2;--card:#fff;--ink:#23201b;--muted:#8a857c;--line:#e7e4dd;
    --accent:#5b6b4f;--accent-soft:#eef0e9;--shadow:0 1px 2px rgba(0,0,0,.04),0 6px 20px rgba(0,0,0,.05)}
  *{box-sizing:border-box}html,body{margin:0;padding:0}
  body{background:var(--bg);color:var(--ink);
    font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:760px;margin:0 auto;padding:40px 20px 96px}
  header.top{margin-bottom:22px}
  header.top h1{font-size:26px;font-weight:600;letter-spacing:-.01em;margin:0 0 4px}
  header.top p{margin:0;color:var(--muted);font-size:15px}
  .saver{position:sticky;top:16px;z-index:5;background:var(--card);border:1px solid var(--line);
    border-radius:14px;box-shadow:var(--shadow);padding:14px;margin-bottom:20px;display:flex;gap:10px;align-items:center}
  .saver input{flex:1;border:none;outline:none;background:transparent;font-size:16px;color:var(--ink);padding:8px 6px}
  .saver input::placeholder{color:#b4afa5}
  .saver button.save{border:none;background:var(--accent);color:#fff;font-size:15px;font-weight:500;
    padding:10px 18px;border-radius:10px;cursor:pointer;transition:opacity .15s,transform .05s}
  .saver button.save:hover{opacity:.92}.saver button.save:active{transform:translateY(1px)}
  .saver button.save:disabled{opacity:.55;cursor:default}
  .notice{margin:0 4px 16px;font-size:14px;color:#6f6a60;background:#fbf6e9;border:1px solid #ecdfbf;
    border-radius:10px;padding:9px 13px;display:flex;gap:8px;align-items:center;animation:rise .2s ease}
  .notice b{color:#4a4640;font-weight:600}
  .tabs{display:flex;gap:6px;margin:0 0 14px;border-bottom:1px solid var(--line)}
  .tab{border:none;background:none;font:inherit;font-size:14.5px;color:var(--muted);cursor:pointer;
    padding:9px 12px;border-bottom:2px solid transparent;margin-bottom:-1px;display:flex;gap:7px;align-items:center}
  .tab:hover{color:#5f5b53}
  .tab.active{color:var(--ink);border-bottom-color:var(--accent);font-weight:600}
  .tab .n{font-size:12px;color:var(--muted);background:var(--accent-soft);border-radius:999px;padding:1px 7px}
  .tab.active .n{color:var(--accent)}
  .filterbar{margin:0 2px 16px;font-size:13.5px;color:#6f6a60;display:none;gap:8px;align-items:center}
  .filterbar.on{display:flex}
  .filterbar .ftag{font-weight:600;color:var(--accent);background:var(--accent-soft);border-radius:999px;padding:2px 10px;cursor:pointer}
  .filterbar .ftag:hover{background:#e2e7d9}
  .filterbar button{font:inherit;font-size:12.5px;border:1px solid var(--line);background:#fbfaf8;color:#6f6a60;
    padding:3px 10px;border-radius:999px;cursor:pointer}
  .filterbar button:hover{background:#f2f0ea}
  ul.list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px}
  li.item{background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);
    padding:16px 18px;display:flex;gap:14px;align-items:flex-start;animation:rise .25s ease}
  li.item.read{opacity:.82}
  li.item.fresh{box-shadow:0 0 0 2px var(--accent-soft),var(--shadow)}
  li.item.flash{animation:flash 1.6s ease}
  @keyframes flash{0%{box-shadow:0 0 0 3px #d9c48f,var(--shadow);background:#fdf7e6}100%{box-shadow:var(--shadow);background:var(--card)}}
  @keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .fav{width:34px;height:34px;border-radius:8px;flex:none;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;overflow:hidden}
  .fav img{width:20px;height:20px}
  .body{min-width:0;flex:1}
  .body .t{font-size:16.5px;font-weight:600;letter-spacing:-.005em;margin:0 0 3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .body .t a{color:var(--ink);text-decoration:none}.body .t a:hover{text-decoration:underline}
  .body .d{color:#5f5b53;font-size:14px;margin:0 0 8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .body .meta{color:var(--muted);font-size:12.5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .body .meta .site{font-weight:500;color:#6f6a60}
  .body .meta .dot{opacity:.5}
  .flag{font-size:11.5px;color:#9a7b3f;background:#f6efe0;padding:2px 8px;border-radius:999px}
  .sb{font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:999px;white-space:nowrap}
  .sb.unread{color:#3f5a74;background:#e6eef6}
  .sb.read{color:#3f6b4f;background:#e6f1e9}
  .sb.arch{color:#7a736a;background:#eeece7}
  /* tags */
  .tags{margin-top:10px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .chip{font-size:12px;color:#55606a;background:#eef1f4;border:1px solid #e2e7ec;border-radius:999px;
    padding:2px 4px 2px 10px;display:inline-flex;gap:5px;align-items:center}
  .chip.on{background:var(--accent-soft);border-color:#cdd6c4}
  .chip.on .lab{color:var(--accent)}
  .chip .lab{cursor:pointer}
  .chip .lab:hover{color:#2f3a44;text-decoration:underline}
  .chip .x{cursor:pointer;color:#a7adb4;width:16px;height:16px;border-radius:999px;display:inline-flex;
    align-items:center;justify-content:center;font-size:12px}
  .chip .x:hover{background:#dfe4e9;color:#6b7178}
  .addtag{font-size:12px;color:var(--muted);background:none;border:1px dashed #d6d2c9;border-radius:999px;
    padding:3px 10px;cursor:pointer}
  .addtag:hover{color:#5f5b53;border-color:#c2bdb2;background:#faf9f6}
  .taginput{font:inherit;font-size:12px;border:1px solid var(--accent);border-radius:999px;padding:3px 10px;outline:none;width:130px}
  /* personal note (distinct from fetched description); supports simple formatting */
  .note{margin:9px 0 0;font-size:13.5px;color:#5a5347;background:#fbf7ee;border-left:3px solid #d9c48f;
    border-radius:0 8px 8px 0;padding:8px 12px}
  .note .nlab{display:block;font-size:11px;font-weight:600;color:#9a8a5f;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
  .note .md>*:first-child{margin-top:0}
  .note .md>*:last-child{margin-bottom:0}
  .note .md p{margin:6px 0}
  .note .md h4,.note .md h5,.note .md h6{margin:8px 0 4px;color:#4a4238;line-height:1.3}
  .note .md h4{font-size:15px}.note .md h5{font-size:13.5px}.note .md h6{font-size:12.5px}
  .note .md ul,.note .md ol{margin:5px 0;padding-left:20px}
  .note .md li{margin:2px 0}
  .note .md a{color:var(--accent);text-decoration:underline}
  .note .md strong{color:#43403a}
  .fmthint{font-size:11.5px;color:#9a958b;margin-top:3px}
  .fmthint code{background:#efece5;border-radius:4px;padding:0 4px}
  /* pre-save review panel */
  .review{background:var(--card);border:1px solid #cdd6c4;border-radius:14px;
    box-shadow:0 0 0 2px var(--accent-soft),var(--shadow);padding:16px 18px;margin:0 0 22px;animation:rise .2s ease}
  .review[hidden]{display:none}
  .review .rh{font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px;display:flex;gap:8px;align-items:center}
  .review .rurl{font-size:12.5px;color:var(--muted);word-break:break-all;margin-bottom:10px}
  .review label{font-size:12px;font-weight:600;color:#6f6a60;display:block;margin:8px 0 3px}
  .review input,.review textarea{width:100%;font:inherit;font-size:14px;color:var(--ink);
    border:1px solid var(--line);border-radius:9px;padding:8px 10px;background:#fff;outline:none;resize:vertical}
  .review input:focus,.review textarea:focus{border-color:var(--accent)}
  .review .row{display:flex;gap:8px;margin-top:12px}
  .ef-error{font-size:12.5px;color:#9a3f3f;background:#f8e9e9;border:1px solid #ecc9c9;border-radius:8px;padding:7px 10px;margin-top:4px}
  /* inline edit form */
  .editform{margin-top:4px;display:flex;flex-direction:column;gap:9px}
  .editform label{font-size:12px;font-weight:600;color:#6f6a60;display:block;margin-bottom:3px}
  .editform input,.editform textarea{width:100%;font:inherit;font-size:14px;color:var(--ink);
    border:1px solid var(--line);border-radius:9px;padding:8px 10px;background:#fff;outline:none;resize:vertical}
  .editform input:focus,.editform textarea:focus{border-color:var(--accent)}
  .editform .row{display:flex;gap:8px;margin-top:2px}
  .ctrls{margin-top:11px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .btn{font:inherit;font-size:12.5px;border:1px solid var(--line);background:#fbfaf8;color:#5f5b53;
    padding:6px 12px;border-radius:8px;cursor:pointer;transition:background .12s,border-color .12s}
  .btn:hover{background:#f2f0ea;border-color:#dcd8cf}
  .btn.primary{border-color:#cdd6c4;background:var(--accent-soft);color:var(--accent)}
  .empty{text-align:center;color:var(--muted);padding:56px 20px}
  .empty .big{font-size:17px;color:#6f6a60;margin-bottom:6px}
  @media (max-width:560px){.wrap{padding:24px 14px 80px}.saver{flex-direction:column;align-items:stretch}.saver button.save{width:100%}}
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>Library</h1>
    <p>Your calm, readable place for links worth keeping.</p>
  </header>
  <form class="saver" id="saver" autocomplete="off">
    <input id="url" name="url" type="text" placeholder="Paste a link and press Save…" aria-label="Link address">
    <button type="submit" class="save" id="saveBtn">Save</button>
  </form>
  <p class="notice" id="notice" hidden></p>
  <div class="review" id="review" hidden></div>
  <nav class="tabs" id="tabs"></nav>
  <div class="filterbar" id="filterbar"></div>
  <ul class="list" id="list"></ul>
  <datalist id="alltags"></datalist>
</div>
<script>
  var VIEWS=['all','unread','archived'];
  var VIEW_LABEL={all:'All',unread:'Unread',archived:'Archived'};
  var active='all';
  var activeTags=[];       // selected tags; a link must carry ALL of them (AND)
  var editingTagId=null;   // which entry currently shows a tag input
  var editingEntryId=null; // which entry is open in the edit form
  var items=[];
  var listEl=document.getElementById('list'),tabsEl=document.getElementById('tabs'),
      form=document.getElementById('saver'),urlInput=document.getElementById('url'),
      saveBtn=document.getElementById('saveBtn'),noticeEl=document.getElementById('notice'),
      filterEl=document.getElementById('filterbar'),datalistEl=document.getElementById('alltags'),
      reviewEl=document.getElementById('review');
  var noticeTimer=null;
  var pendingPreview=null; // preview awaiting the client's confirm/discard

  function esc(s){var d=document.createElement('div');d.textContent=s==null?'':s;return d.innerHTML;}

  // --- minimal, safe formatting for notes (headings, bold, italic, lists, links) ---
  function mdEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function inlineMd(s){
    s=s.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g,function(m,txt,href){
      return '<a href="'+href+'" target="_blank" rel="noopener">'+txt+'</a>';});
    s=s.replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>');
    s=s.replace(/(^|[^*])\\*([^*]+)\\*/g,'$1<em>$2</em>');
    s=s.replace(/_([^_]+)_/g,'<em>$1</em>');
    return s;
  }
  function renderMarkdown(raw){
    var text=mdEsc(raw);var lines=text.split(/\\r?\\n/);var html='';var i=0;
    function isH(l){return /^#{1,3}\\s+/.test(l);}
    function isUL(l){return /^\\s*[-*]\\s+/.test(l);}
    function isOL(l){return /^\\s*\\d+\\.\\s+/.test(l);}
    while(i<lines.length){
      var line=lines[i];
      if(/^\\s*$/.test(line)){i++;continue;}
      var h=/^(#{1,3})\\s+(.*)$/.exec(line);
      if(h){var lvl=h[1].length+3;html+='<h'+lvl+'>'+inlineMd(h[2])+'</h'+lvl+'>';i++;continue;}
      if(isUL(line)){html+='<ul>';while(i<lines.length&&isUL(lines[i])){html+='<li>'+inlineMd(lines[i].replace(/^\\s*[-*]\\s+/,''))+'</li>';i++;}html+='</ul>';continue;}
      if(isOL(line)){html+='<ol>';while(i<lines.length&&isOL(lines[i])){html+='<li>'+inlineMd(lines[i].replace(/^\\s*\\d+\\.\\s+/,''))+'</li>';i++;}html+='</ol>';continue;}
      var para=[];
      while(i<lines.length&&!/^\\s*$/.test(lines[i])&&!isH(lines[i])&&!isUL(lines[i])&&!isOL(lines[i])){para.push(inlineMd(lines[i]));i++;}
      html+='<p>'+para.join('<br>')+'</p>';
    }
    return html;
  }
  var FMT_HINT='<div class="fmthint">Supports simple formatting: <code>**bold**</code>, <code># heading</code>, <code>- list</code>, <code>[text](https://…)</code>.</div>';
  function timeAgo(iso){var s=(Date.now()-new Date(iso).getTime())/1000;
    if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+' min ago';
    if(s<86400)return Math.floor(s/3600)+' h ago';return Math.floor(s/86400)+' d ago';}
  function showNotice(html){noticeEl.innerHTML=html;noticeEl.hidden=false;
    clearTimeout(noticeTimer);noticeTimer=setTimeout(function(){noticeEl.hidden=true;},5000);}

  function inView(b,v){
    if(v==='all')return !b.archived;
    if(v==='unread')return !b.archived && !b.read;
    return b.archived;
  }
  function count(v){return items.filter(function(b){return inView(b,v);}).length;}
  function hasTag(b,t){return b.tags.some(function(x){return x.toLowerCase()===t.toLowerCase();});}
  function tagActive(t){return activeTags.some(function(x){return x.toLowerCase()===t.toLowerCase();});}
  function toggleTag(t){
    if(tagActive(t)) activeTags=activeTags.filter(function(x){return x.toLowerCase()!==t.toLowerCase();});
    else activeTags=activeTags.concat([t]);
  }
  function matchesTags(b){return activeTags.every(function(t){return hasTag(b,t);});}

  function allTags(){
    var set={};items.forEach(function(b){b.tags.forEach(function(t){set[t.toLowerCase()]=t;});});
    return Object.keys(set).sort().map(function(k){return set[k];});
  }

  function renderTabs(){
    tabsEl.innerHTML=VIEWS.map(function(v){
      return '<button class="tab'+(v===active?' active':'')+'" data-tab="'+v+'">'+
        VIEW_LABEL[v]+'<span class="n">'+count(v)+'</span></button>';
    }).join('');
  }
  function renderFilter(){
    if(!activeTags.length){filterEl.className='filterbar';filterEl.innerHTML='';return;}
    filterEl.className='filterbar on';
    var chips=activeTags.map(function(t){
      return '<span class="ftag" data-untag="'+esc(t)+'">'+esc(t)+' ✕</span>';
    }).join('');
    var lead=activeTags.length>1?'Showing links tagged with all of':'Showing links tagged';
    filterEl.innerHTML=lead+' '+chips+' <button data-clearfilter>Clear tag filter</button>';
  }
  function refreshDatalist(){
    datalistEl.innerHTML=allTags().map(function(t){return '<option value="'+esc(t)+'">';}).join('');
  }

  function tagsHtml(b){
    var chips=b.tags.map(function(t){
      var on=tagActive(t)?' on':'';
      return '<span class="chip'+on+'"><span class="lab" data-tagfilter="'+esc(t)+'">'+esc(t)+'</span>'+
        '<span class="x" data-tagremove="'+esc(t)+'" data-id="'+b.id+'" title="Remove tag">✕</span></span>';
    }).join('');
    var adder = editingTagId===b.id
      ? '<input class="taginput" list="alltags" data-taginput="'+b.id+'" placeholder="tag name…" autocomplete="off">'
      : '<button class="addtag" data-tagadd="'+b.id+'">＋ tag</button>';
    return '<div class="tags">'+chips+adder+'</div>';
  }

  function controls(b){
    var btns=[];
    if(b.archived){
      btns.push('<button class="btn" data-act="restore" data-id="'+b.id+'">↩ Restore</button>');
    }else{
      if(!b.read) btns.push('<button class="btn primary" data-act="read" data-id="'+b.id+'">✓ Mark read</button>');
      else btns.push('<button class="btn" data-act="unread" data-id="'+b.id+'">↩ Mark unread</button>');
      btns.push('<button class="btn" data-act="archive" data-id="'+b.id+'">🗄 Archive</button>');
    }
    btns.push('<button class="btn" data-editopen="'+b.id+'">✏ Edit</button>');
    return '<div class="ctrls">'+btns.join('')+'</div>';
  }
  function favHtml(b){
    return '<span class="fav"><img src="'+esc(b.favicon)+'" alt="" onerror="this.style.display=\\'none\\'"></span>';
  }
  function noteHtml(b){
    return b.note?'<div class="note"><span class="nlab">Your note</span><div class="md">'+renderMarkdown(b.note)+'</div></div>':'';
  }
  function editRow(b,cls){
    return '<li class="'+cls+'" data-id="'+b.id+'">'+favHtml(b)+
      '<div class="body"><div class="editform">'+
        '<div><label>Address</label><input data-ef="url" value="'+esc(b.url)+'"></div>'+
        '<div><label>Title</label><input data-ef="title" value="'+esc(b.title)+'"></div>'+
        '<div><label>Description</label><textarea data-ef="description" rows="2">'+esc(b.description)+'</textarea></div>'+
        '<div><label>Your note</label><textarea data-ef="note" rows="3" placeholder="Add a private note to your future self…">'+esc(b.note)+'</textarea>'+FMT_HINT+'</div>'+
        '<div class="ef-error" data-eferror hidden></div>'+
        '<div class="row"><button class="btn primary" data-editsave="'+b.id+'">Save changes</button>'+
          '<button class="btn" data-editcancel="'+b.id+'">Cancel</button></div>'+
      '</div></div></li>';
  }
  function badge(b){
    var read=b.read?'<span class="sb read">Read</span>':'<span class="sb unread">Unread</span>';
    var arch=b.archived?'<span class="sb arch">Archived</span>':'';
    return read+arch;
  }

  function render(freshId){
    renderTabs();renderFilter();refreshDatalist();
    var shown=items.filter(function(b){return inView(b,active)&&matchesTags(b);});
    if(!shown.length){
      var msg;
      if(activeTags.length) msg='No '+VIEW_LABEL[active].toLowerCase()+' links tagged '+
        activeTags.map(function(t){return '"'+esc(t)+'"';}).join(' + ')+'.';
      else msg={all:'Your library is empty.',unread:'Nothing unread — you\\'re all caught up.',archived:'Nothing archived.'}[active];
      listEl.innerHTML='<div class="empty"><div class="big">'+msg+'</div>'+
        (active==='all'&&!activeTags.length?'<div>Paste a link above to add something.</div>':'')+'</div>';
      return;
    }
    listEl.innerHTML=shown.map(function(b){
      var cls='item'+(b.id===freshId?' fresh':'')+(b.read&&!b.archived?' read':'');
      if(editingEntryId===b.id) return editRow(b,cls);
      var flag=b.retrieved?'':'<span class="flag">details couldn\\'t be fetched</span>';
      var desc=b.description?'<p class="d">'+esc(b.description)+'</p>':'';
      return '<li class="'+cls+'" data-id="'+b.id+'">'+favHtml(b)+
        '<div class="body">'+
          '<h3 class="t"><a href="'+esc(b.url)+'" target="_blank" rel="noopener">'+esc(b.title)+'</a></h3>'+desc+
          noteHtml(b)+
          '<div class="meta">'+badge(b)+'<span class="site">'+esc(b.siteName)+'</span>'+
            '<span class="dot">·</span><span>'+timeAgo(b.savedAt)+'</span>'+
            (flag?'<span class="dot">·</span>'+flag:'')+'</div>'+
          tagsHtml(b)+controls(b)+
        '</div></li>';
    }).join('');
    if(editingEntryId!=null){
      var ef=listEl.querySelector('li.item[data-id="'+editingEntryId+'"] [data-ef="title"]');
      if(ef)ef.focus();
    }
    if(editingTagId!=null){
      var inp=listEl.querySelector('[data-taginput="'+editingTagId+'"]');
      if(inp)inp.focus();
    }
  }

  function goToEntry(id){var el=listEl.querySelector('li.item[data-id="'+id+'"]');
    if(!el)return;el.scrollIntoView({behavior:'smooth',block:'center'});
    el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');}

  async function apply(id,field,value,msg){
    var r=await fetch('/api/'+field,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:id,value:value})});
    if(!r.ok)return;var d=await r.json();
    var it=items.find(function(x){return x.id===id;});
    if(it){it.read=d.bookmark.read;it.archived=d.bookmark.archived;}
    render();showNotice(msg);
  }
  async function saveEdit(id){
    var li=listEl.querySelector('li.item[data-id="'+id+'"]');
    if(!li)return;
    var payload={id:id,
      url:li.querySelector('[data-ef="url"]').value,
      title:li.querySelector('[data-ef="title"]').value,
      description:li.querySelector('[data-ef="description"]').value,
      note:li.querySelector('[data-ef="note"]').value};
    var r=await fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!r.ok){
      var err={};try{err=await r.json();}catch(e){}
      var box=li.querySelector('[data-eferror]');
      if(box){
        box.hidden=false;
        box.textContent = err.error==='duplicate_address'
          ? 'That address is already saved as “'+(err.title||'another entry')+'”. Your changes were not applied.'
          : err.error==='invalid_url' ? 'That address doesn’t look valid.'
          : 'Could not save your changes.';
      }
      return;
    }
    var d=await r.json();
    var it=items.find(function(x){return x.id===id;});
    if(it){it.url=d.bookmark.url;it.title=d.bookmark.title;it.description=d.bookmark.description;
      it.note=d.bookmark.note;it.siteName=d.bookmark.siteName;it.favicon=d.bookmark.favicon;}
    editingEntryId=null;render();showNotice('Saved your changes.');
  }
  async function tagOp(id,tag,add){
    var r=await fetch('/api/tags/'+(add?'add':'remove'),{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:id,tag:tag})});
    if(!r.ok)return;var d=await r.json();
    var it=items.find(function(x){return x.id===id;});
    if(it)it.tags=d.bookmark.tags;
    // drop any active-filter tags that no longer exist anywhere
    var present=allTags();
    activeTags=activeTags.filter(function(t){return present.some(function(p){return p.toLowerCase()===t.toLowerCase();});});
    render();
  }

  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-tab]');
    if(t){active=t.getAttribute('data-tab');editingTagId=null;editingEntryId=null;render();return;}
    if(e.target.closest('[data-clearfilter]')){activeTags=[];render();return;}
    var un=e.target.closest('[data-untag]');
    if(un){toggleTag(un.getAttribute('data-untag'));render();return;}
    var tf=e.target.closest('[data-tagfilter]');
    if(tf){toggleTag(tf.getAttribute('data-tagfilter'));editingTagId=null;render();return;}
    var tr=e.target.closest('[data-tagremove]');
    if(tr){tagOp(+tr.getAttribute('data-id'),tr.getAttribute('data-tagremove'),false);return;}
    var ta=e.target.closest('[data-tagadd]');
    if(ta){editingTagId=+ta.getAttribute('data-tagadd');render();return;}
    var eo=e.target.closest('[data-editopen]');
    if(eo){editingEntryId=+eo.getAttribute('data-editopen');editingTagId=null;render();return;}
    var ec=e.target.closest('[data-editcancel]');
    if(ec){editingEntryId=null;render();return;}
    var es=e.target.closest('[data-editsave]');
    if(es){saveEdit(+es.getAttribute('data-editsave'));return;}
    if(e.target.closest('[data-reviewsave]')){confirmCreate();return;}
    if(e.target.closest('[data-reviewcancel]')){closeReview();return;}
    var a=e.target.closest('[data-act]');
    if(a){var id=+a.getAttribute('data-id'),act=a.getAttribute('data-act');
      if(act==='read')apply(id,'read',true,'Marked as <b>read</b>.');
      else if(act==='unread')apply(id,'read',false,'Marked as <b>unread</b>.');
      else if(act==='archive')apply(id,'archive',true,'<b>Archived</b> — moved out of your active library, not deleted.');
      else if(act==='restore')apply(id,'archive',false,'<b>Restored</b> to your library.');
      return;}
  });
  document.addEventListener('keydown',function(e){
    var inp=e.target.closest('[data-taginput]');if(!inp)return;
    if(e.key==='Enter'){e.preventDefault();var id=+inp.getAttribute('data-taginput');var v=inp.value.trim();
      if(v){editingTagId=null;tagOp(id,v,true);}else{editingTagId=null;render();}}
    else if(e.key==='Escape'){editingTagId=null;render();}
  });
  // commit tag on blur
  document.addEventListener('focusout',function(e){
    var inp=e.target.closest?e.target.closest('[data-taginput]'):null;if(!inp)return;
    var id=+inp.getAttribute('data-taginput');var v=inp.value.trim();
    editingTagId=null;
    if(v)tagOp(id,v,true);else render();
  });

  function goToExisting(bk){
    activeTags=[];active=bk.archived?'archived':'all';closeReview();render();
    showNotice('You already saved this — <b>'+esc(bk.title)+'</b>. Here it is.');
    goToEntry(bk.id);
  }
  function closeReview(){pendingPreview=null;reviewEl.hidden=true;reviewEl.innerHTML='';}
  function openReview(pv){
    pendingPreview=pv;reviewEl.hidden=false;
    reviewEl.innerHTML=
      '<div class="rh">✎ Review before saving</div>'+
      '<div class="rurl">'+esc(pv.url)+'</div>'+
      (pv.retrieved?'':'<div class="ef-error">We couldn’t read this page’s details automatically — please fill them in below.</div>')+
      '<label>Title</label><input data-rv="title" value="'+esc(pv.title)+'">'+
      '<label>Description</label><textarea data-rv="description" rows="2">'+esc(pv.description)+'</textarea>'+
      '<label>Your note (optional)</label><textarea data-rv="note" rows="2" placeholder="Add a private note…"></textarea>'+FMT_HINT+
      '<div class="row"><button class="btn primary" data-reviewsave>Add to library</button>'+
        '<button class="btn" data-reviewcancel>Discard</button></div>';
    reviewEl.scrollIntoView({behavior:'smooth',block:'nearest'});
    var t=reviewEl.querySelector('[data-rv="title"]');if(t)t.focus();
  }
  async function confirmCreate(){
    if(!pendingPreview)return;
    var payload={url:pendingPreview.url,
      title:reviewEl.querySelector('[data-rv="title"]').value,
      description:reviewEl.querySelector('[data-rv="description"]').value,
      note:reviewEl.querySelector('[data-rv="note"]').value,
      retrieved:pendingPreview.retrieved};
    var r=await fetch('/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!r.ok)return;var d=await r.json();
    if(d.duplicate){goToExisting(d.bookmark);return;}
    items.unshift(d.bookmark);closeReview();noticeEl.hidden=true;activeTags=[];active='all';render(d.bookmark.id);
    showNotice('Added <b>'+esc(d.bookmark.title)+'</b> to your library.');
  }

  form.addEventListener('submit',async function(e){
    e.preventDefault();var url=urlInput.value.trim();if(!url)return;
    editingEntryId=null;
    saveBtn.disabled=true;saveBtn.textContent='Fetching…';
    try{
      var r=await fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})});
      if(!r.ok){saveBtn.textContent='Try again';setTimeout(function(){saveBtn.textContent='Save';saveBtn.disabled=false;},1200);return;}
      var d=await r.json();
      if(d.duplicate){urlInput.value='';goToExisting(d.bookmark);}
      else{urlInput.value='';openReview(d.preview);}
    }finally{if(saveBtn.textContent==='Fetching…')saveBtn.textContent='Save';saveBtn.disabled=false;}
  });

  async function load(){var r=await fetch('/api/bookmarks');var d=await r.json();
    items=d.bookmarks;render();
    document.querySelector('.wrap').setAttribute('data-harness-ready','true');}
  load();
</script>
</body>
</html>`;

// ---- server -----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    const path = req.url.split('?')[0];
    if (req.method === 'GET' && (path === '/' || path === '')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(PAGE);
    }
    if (req.method === 'GET' && path === '/api/bookmarks') return json(res, 200, { bookmarks });
    if (req.method === 'POST' && path === '/api/save') return await handleSave(req, res);
    if (req.method === 'POST' && path === '/api/preview') return await handlePreview(req, res);
    if (req.method === 'POST' && path === '/api/create') return await handleCreate(req, res);
    if (req.method === 'POST' && path === '/api/read') return await handleField(req, res, 'read');
    if (req.method === 'POST' && path === '/api/archive') return await handleField(req, res, 'archived');
    if (req.method === 'POST' && path === '/api/update') return await handleUpdate(req, res);
    if (req.method === 'POST' && path === '/api/tags/add') return await handleTag(req, res, true);
    if (req.method === 'POST' && path === '/api/tags/remove') return await handleTag(req, res, false);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  } catch (e) {
    json(res, 500, { error: 'server_error', detail: String(e && e.message) });
  }
});

seed();
server.listen(PORT, HOST, () => {
  console.log('Bookmark prototype (iteration 7) on http://' + HOST + ':' + PORT);
});
