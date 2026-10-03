// Phase 1 exploratory prototype — Bookmark library
// Iteration 1: core happy path — quick save + automatic page-detail fill + readable list.
// This simulates external behaviour for requirement exploration only.
// It is NOT the production implementation and must not be carried into Phase 2.

const http = require('http');

const PORT = 4001;
const HOST = '0.0.0.0';

/** In-memory store (prototype only). */
const bookmarks = [];
let nextId = 1;

// ---- metadata retrieval -----------------------------------------------------

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
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
  try {
    const parsed = new URL(u);
    return parsed.toString();
  } catch {
    return '';
  }
}

async function fetchMetadata(url) {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, '');
  const result = {
    title: '',
    description: '',
    siteName: host,
    favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
    retrieved: false,
  };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BookmarkPrototype/1.0)' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    const html = (await res.text()).slice(0, 400000);

    result.title = metaContent(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    ]);
    result.description = metaContent(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    ]);
    const site = metaContent(html, [
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
    ]);
    if (site) result.siteName = site;
    result.retrieved = true;
  } catch {
    result.retrieved = false;
  }
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
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

async function handleSave(req, res) {
  const body = await readBody(req);
  let url = '';
  try {
    url = JSON.parse(body).url;
  } catch {}
  const normalized = normalizeUrl(url);
  if (!normalized) {
    return json(res, 400, { error: 'invalid_url' });
  }
  const meta = await fetchMetadata(normalized);
  const entry = {
    id: nextId++,
    url: normalized,
    title: meta.title,
    description: meta.description,
    siteName: meta.siteName,
    favicon: meta.favicon,
    retrieved: meta.retrieved,
    savedAt: new Date().toISOString(),
  };
  bookmarks.unshift(entry);
  json(res, 200, { bookmark: entry });
}

// ---- html -------------------------------------------------------------------

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Library</title>
<style>
  :root {
    --bg: #f6f5f2;
    --card: #ffffff;
    --ink: #23201b;
    --muted: #8a857c;
    --line: #e7e4dd;
    --accent: #5b6b4f;
    --accent-soft: #eef0e9;
    --shadow: 0 1px 2px rgba(0,0,0,.04), 0 6px 20px rgba(0,0,0,.05);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--ink);
    font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 760px; margin: 0 auto; padding: 40px 20px 96px; }
  header.top { margin-bottom: 28px; }
  header.top h1 {
    font-size: 26px; font-weight: 600; letter-spacing: -.01em; margin: 0 0 4px;
  }
  header.top p { margin: 0; color: var(--muted); font-size: 15px; }

  .saver {
    position: sticky; top: 16px; z-index: 5;
    background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    box-shadow: var(--shadow); padding: 14px; margin-bottom: 28px;
    display: flex; gap: 10px; align-items: center;
  }
  .saver input {
    flex: 1; border: none; outline: none; background: transparent;
    font-size: 16px; color: var(--ink); padding: 8px 6px;
  }
  .saver input::placeholder { color: #b4afa5; }
  .saver button {
    border: none; background: var(--accent); color: #fff; font-size: 15px;
    font-weight: 500; padding: 10px 18px; border-radius: 10px; cursor: pointer;
    transition: opacity .15s, transform .05s;
  }
  .saver button:hover { opacity: .92; }
  .saver button:active { transform: translateY(1px); }
  .saver button:disabled { opacity: .55; cursor: default; }

  .count { color: var(--muted); font-size: 13px; margin: 0 4px 14px; }

  ul.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  li.item {
    background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    box-shadow: var(--shadow); padding: 16px 18px;
    display: flex; gap: 14px; align-items: flex-start;
    animation: rise .25s ease;
  }
  li.item.fresh { box-shadow: 0 0 0 2px var(--accent-soft), var(--shadow); }
  @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .fav { width: 34px; height: 34px; border-radius: 8px; flex: none; background: var(--accent-soft);
         display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .fav img { width: 20px; height: 20px; }
  .body { min-width: 0; flex: 1; }
  .body .t { font-size: 16.5px; font-weight: 600; letter-spacing: -.005em; margin: 0 0 3px;
             overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .body .t a { color: var(--ink); text-decoration: none; }
  .body .t a:hover { text-decoration: underline; }
  .body .d { color: #5f5b53; font-size: 14px; margin: 0 0 8px;
             display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .body .meta { color: var(--muted); font-size: 12.5px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .body .meta .site { font-weight: 500; color: #6f6a60; }
  .body .meta .dot { opacity: .5; }
  .flag { font-size: 11.5px; color: #9a7b3f; background: #f6efe0; padding: 2px 8px; border-radius: 999px; }

  .empty { text-align: center; color: var(--muted); padding: 60px 20px; }
  .empty .big { font-size: 17px; color: #6f6a60; margin-bottom: 6px; }

  @media (max-width: 560px) {
    .wrap { padding: 24px 14px 80px; }
    .saver { flex-direction: column; align-items: stretch; }
    .saver button { width: 100%; }
  }
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
    <button type="submit" id="saveBtn">Save</button>
  </form>

  <p class="count" id="count"></p>
  <ul class="list" id="list"></ul>
</div>

<script>
  const listEl = document.getElementById('list');
  const countEl = document.getElementById('count');
  const form = document.getElementById('saver');
  const urlInput = document.getElementById('url');
  const saveBtn = document.getElementById('saveBtn');
  let items = [];

  function esc(s){ const d=document.createElement('div'); d.textContent=s==null?'':s; return d.innerHTML; }
  function timeAgo(iso){
    const s=(Date.now()-new Date(iso).getTime())/1000;
    if(s<60)return 'just now';
    if(s<3600)return Math.floor(s/60)+' min ago';
    if(s<86400)return Math.floor(s/3600)+' h ago';
    return Math.floor(s/86400)+' d ago';
  }

  function render(freshId){
    countEl.textContent = items.length
      ? items.length + (items.length===1?' saved link':' saved links')
      : '';
    if(!items.length){
      listEl.innerHTML =
        '<div class="empty"><div class="big">Nothing saved yet</div>'+
        '<div>Paste a link above to start your library.</div></div>';
      return;
    }
    listEl.innerHTML = items.map(function(b){
      const fresh = b.id===freshId ? ' fresh' : '';
      const flag = b.retrieved ? '' :
        '<span class="flag">details couldn\\'t be fetched</span>';
      const desc = b.description ? '<p class="d">'+esc(b.description)+'</p>' : '';
      return '<li class="item'+fresh+'">'+
        '<span class="fav"><img src="'+esc(b.favicon)+'" alt="" onerror="this.style.display=\\'none\\'"></span>'+
        '<div class="body">'+
          '<h3 class="t"><a href="'+esc(b.url)+'" target="_blank" rel="noopener">'+esc(b.title)+'</a></h3>'+
          desc+
          '<div class="meta"><span class="site">'+esc(b.siteName)+'</span>'+
            '<span class="dot">·</span><span>'+timeAgo(b.savedAt)+'</span>'+
            (flag?'<span class="dot">·</span>'+flag:'')+
          '</div>'+
        '</div>'+
      '</li>';
    }).join('');
  }

  async function load(){
    const r = await fetch('/api/bookmarks');
    const d = await r.json();
    items = d.bookmarks;
    render();
    document.querySelector('.wrap').setAttribute('data-harness-ready','true');
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    const url = urlInput.value.trim();
    if(!url) return;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const r = await fetch('/api/save', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({url})
      });
      if(!r.ok){
        saveBtn.textContent = 'Try again';
        setTimeout(()=>{saveBtn.textContent='Save';saveBtn.disabled=false;}, 1200);
        return;
      }
      const d = await r.json();
      items.unshift(d.bookmark);
      urlInput.value='';
      render(d.bookmark.id);
    } finally {
      if(saveBtn.textContent==='Saving…') saveBtn.textContent='Save';
      saveBtn.disabled = false;
    }
  });

  load();
</script>
</body>
</html>`;

// ---- server -----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(PAGE);
    }
    if (req.method === 'GET' && req.url === '/api/bookmarks') {
      return json(res, 200, { bookmarks });
    }
    if (req.method === 'POST' && req.url === '/api/save') {
      return await handleSave(req, res);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  } catch (e) {
    json(res, 500, { error: 'server_error', detail: String(e && e.message) });
  }
});

server.listen(PORT, HOST, () => {
  console.log('Bookmark prototype (iteration 1) on http://' + HOST + ':' + PORT);
});
