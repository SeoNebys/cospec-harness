// Phase 1 exploratory prototype — Bookmark library
// Iteration 3: read-state and archive-state are INDEPENDENT.
//   Views: All (non-archived), Unread (non-archived & unread), Archived.
//   New saves start unread & active. Marking read leaves it in All. Archiving
//   removes from All+Unread; restoring preserves prior read/unread.
//   Status-change interaction = labelled buttons (the client's chosen style).
// Carries approved behaviour: quick save, auto-fill, readable list, duplicate
//   handling.
// Exploration prototype only — NOT production code; must not seed Phase 2.

const http = require('http');

const PORT = 4001;
const HOST = '0.0.0.0';

/** In-memory store (prototype only). Each entry: {read:bool, archived:bool}. */
const bookmarks = [];
let nextId = 1;

// Preloaded samples so the read/archive behaviour and the three views can be
// tried immediately, without saving several links first.
function seed() {
  const now = Date.now();
  const samples = [
    { url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Grid',
      title: 'CSS Grid Layout — MDN',
      description: 'A two-dimensional layout system for the web, with rows and columns.',
      siteName: 'developer.mozilla.org', read: false, archived: false, ageMin: 8 },
    { url: 'https://www.nngroup.com/articles/progressive-disclosure/',
      title: 'Progressive Disclosure — Nielsen Norman Group',
      description: 'Defer advanced or rarely used features to a secondary screen to keep interfaces calm.',
      siteName: 'nngroup.com', read: false, archived: false, ageMin: 40 },
    { url: 'https://en.wikipedia.org/wiki/Zettelkasten',
      title: 'Zettelkasten — Wikipedia',
      description: 'A method of personal knowledge management and note-taking.',
      siteName: 'en.wikipedia.org', read: true, archived: false, ageMin: 130 },
    { url: 'https://www.gutenberg.org/ebooks/1342',
      title: 'Pride and Prejudice, by Jane Austen — Project Gutenberg',
      description: 'The complete text, free to read.',
      siteName: 'gutenberg.org', read: true, archived: true, ageMin: 1500 },
    { url: 'https://web.archive.org/',
      title: 'Internet Archive: Wayback Machine',
      description: 'Explore archived snapshots of web pages over time.',
      siteName: 'web.archive.org', read: false, archived: true, ageMin: 6000 },
  ];
  for (const s of samples) {
    const host = new URL(s.url).hostname.replace(/^www\./, '');
    bookmarks.push({
      id: nextId++, url: s.url, key: canonicalKey(s.url),
      title: s.title, description: s.description, siteName: s.siteName,
      favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
      retrieved: true, read: s.read, archived: s.archived,
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

// Canonical identity for duplicate detection.
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
    read: false, archived: false,
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
  b[field] = value; // read or archived; the other field is left untouched
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
  .tabs{display:flex;gap:6px;margin:0 0 18px;border-bottom:1px solid var(--line)}
  .tab{border:none;background:none;font:inherit;font-size:14.5px;color:var(--muted);cursor:pointer;
    padding:9px 12px;border-bottom:2px solid transparent;margin-bottom:-1px;display:flex;gap:7px;align-items:center}
  .tab:hover{color:#5f5b53}
  .tab.active{color:var(--ink);border-bottom-color:var(--accent);font-weight:600}
  .tab .n{font-size:12px;color:var(--muted);background:var(--accent-soft);border-radius:999px;padding:1px 7px}
  .tab.active .n{color:var(--accent)}
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
  <nav class="tabs" id="tabs"></nav>
  <ul class="list" id="list"></ul>
</div>
<script>
  var VIEWS=['all','unread','archived'];
  var VIEW_LABEL={all:'All',unread:'Unread',archived:'Archived'};
  var active='all';
  var items=[];
  var listEl=document.getElementById('list'),tabsEl=document.getElementById('tabs'),
      form=document.getElementById('saver'),urlInput=document.getElementById('url'),
      saveBtn=document.getElementById('saveBtn'),noticeEl=document.getElementById('notice');
  var noticeTimer=null;

  function esc(s){var d=document.createElement('div');d.textContent=s==null?'':s;return d.innerHTML;}
  function timeAgo(iso){var s=(Date.now()-new Date(iso).getTime())/1000;
    if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+' min ago';
    if(s<86400)return Math.floor(s/3600)+' h ago';return Math.floor(s/86400)+' d ago';}
  function showNotice(html){noticeEl.innerHTML=html;noticeEl.hidden=false;
    clearTimeout(noticeTimer);noticeTimer=setTimeout(function(){noticeEl.hidden=true;},5000);}

  function inView(b,v){
    if(v==='all')return !b.archived;
    if(v==='unread')return !b.archived && !b.read;
    return b.archived; // archived
  }
  function count(v){return items.filter(function(b){return inView(b,v);}).length;}

  function renderTabs(){
    tabsEl.innerHTML=VIEWS.map(function(v){
      return '<button class="tab'+(v===active?' active':'')+'" data-tab="'+v+'">'+
        VIEW_LABEL[v]+'<span class="n">'+count(v)+'</span></button>';
    }).join('');
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
    return '<div class="ctrls">'+btns.join('')+'</div>';
  }

  function badge(b){
    var read=b.read?'<span class="sb read">Read</span>':'<span class="sb unread">Unread</span>';
    var arch=b.archived?'<span class="sb arch">Archived</span>':'';
    return read+arch;
  }

  function render(freshId){
    renderTabs();
    var shown=items.filter(function(b){return inView(b,active);});
    if(!shown.length){
      var msg={all:'Your library is empty.',unread:'Nothing unread — you\\'re all caught up.',archived:'Nothing archived.'}[active];
      listEl.innerHTML='<div class="empty"><div class="big">'+msg+'</div>'+
        (active==='all'?'<div>Paste a link above to add something.</div>':'')+'</div>';
      return;
    }
    listEl.innerHTML=shown.map(function(b){
      var cls='item'+(b.id===freshId?' fresh':'')+(b.read&&!b.archived?' read':'');
      var flag=b.retrieved?'':'<span class="flag">details couldn\\'t be fetched</span>';
      var desc=b.description?'<p class="d">'+esc(b.description)+'</p>':'';
      return '<li class="'+cls+'" data-id="'+b.id+'">'+
        '<span class="fav"><img src="'+esc(b.favicon)+'" alt="" onerror="this.style.display=\\'none\\'"></span>'+
        '<div class="body">'+
          '<h3 class="t"><a href="'+esc(b.url)+'" target="_blank" rel="noopener">'+esc(b.title)+'</a></h3>'+desc+
          '<div class="meta">'+badge(b)+'<span class="site">'+esc(b.siteName)+'</span>'+
            '<span class="dot">·</span><span>'+timeAgo(b.savedAt)+'</span>'+
            (flag?'<span class="dot">·</span>'+flag:'')+'</div>'+
          controls(b)+
        '</div></li>';
    }).join('');
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

  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-tab]');
    if(t){active=t.getAttribute('data-tab');render();return;}
    var a=e.target.closest('[data-act]');
    if(!a)return;
    var id=+a.getAttribute('data-id'),act=a.getAttribute('data-act');
    if(act==='read')apply(id,'read',true,'Marked as <b>read</b>.');
    else if(act==='unread')apply(id,'read',false,'Marked as <b>unread</b>.');
    else if(act==='archive')apply(id,'archive',true,'<b>Archived</b> — moved out of your active library, not deleted.');
    else if(act==='restore')apply(id,'archive',false,'<b>Restored</b> to your library.');
  });

  form.addEventListener('submit',async function(e){
    e.preventDefault();var url=urlInput.value.trim();if(!url)return;
    saveBtn.disabled=true;saveBtn.textContent='Saving…';
    try{
      var r=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})});
      if(!r.ok){saveBtn.textContent='Try again';setTimeout(function(){saveBtn.textContent='Save';saveBtn.disabled=false;},1200);return;}
      var d=await r.json();
      if(d.duplicate){
        urlInput.value='';active=d.bookmark.archived?'archived':'all';render();
        showNotice('You already saved this — <b>'+esc(d.bookmark.title)+'</b>. Here it is.');
        goToEntry(d.bookmark.id);
      }else{
        items.unshift(d.bookmark);urlInput.value='';noticeEl.hidden=true;active='all';render(d.bookmark.id);
      }
    }finally{if(saveBtn.textContent==='Saving…')saveBtn.textContent='Save';saveBtn.disabled=false;}
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
    if (req.method === 'POST' && path === '/api/read') return await handleField(req, res, 'read');
    if (req.method === 'POST' && path === '/api/archive') return await handleField(req, res, 'archived');
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  } catch (e) {
    json(res, 500, { error: 'server_error', detail: String(e && e.message) });
  }
});

seed();
server.listen(PORT, HOST, () => {
  console.log('Bookmark prototype (iteration 3) on http://' + HOST + ':' + PORT);
});
