'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var Store = require('./lib/store');
var urls = require('./lib/urls');
var metadata = require('./lib/metadata');
var snapshot = require('./lib/snapshot');
var wayback = require('./lib/wayback');
var bookmarkfile = require('./lib/bookmarkfile');
var fetcher = require('./lib/fetcher');

var PORT = process.env.PORT || 4000;
var HOST = process.env.HOST || '0.0.0.0';
var DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
var PUBLIC_DIR = path.join(__dirname, 'public');
var store = new Store(DATA_DIR);

var MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function sendJson(res, code, obj) {
  var body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}
function sendText(res, code, text, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(text);
}
function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); if (chunks.join('').length > 50 * 1024 * 1024) req.destroy(); });
    req.on('end', function () { resolve(Buffer.concat(chunks.map(function (c) { return Buffer.from(c); }))); });
    req.on('error', reject);
  });
}
async function readJson(req) {
  var buf = await readBody(req);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch (e) { return {}; }
}

var CONTENT_FIELDS = ['title', 'url', 'description', 'note', 'tags'];

function serveStatic(req, res, urlPath) {
  var rel = urlPath === '/' ? '/index.html' : urlPath;
  var file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (file.indexOf(PUBLIC_DIR) !== 0) { sendText(res, 403, 'Forbidden'); return; }
  fs.readFile(file, function (err, data) {
    if (err) { sendText(res, 404, 'Not found'); return; }
    var ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function createBookmark(url) {
  var norm = urls.normalize(url);
  var meta, isPdf = urls.isPdf(norm);
  try {
    if (isPdf) {
      meta = metadata.fallback(norm);
    } else {
      var page = await fetcher.fetchText(norm, 10000);
      var ct = (page.contentType || '').toLowerCase();
      if (ct.indexOf('application/pdf') >= 0) { isPdf = true; meta = metadata.fallback(norm); }
      else if (page.ok) meta = metadata.extract(page.body, norm);
      else meta = metadata.fallback(norm);
    }
  } catch (e) {
    meta = metadata.fallback(norm); // save anyway (SCN-012)
  }
  var now = Date.now();
  return {
    id: store.nextId(), url: norm, title: meta.title, description: meta.description,
    icon: meta.icon, image: meta.image, note: '', tags: [], read: false, archived: false,
    isPdf: isPdf, saved: now, updated: now, snapshot: null, wayback: null
  };
}

async function handleApi(req, res, urlPath, method) {
  // /api/state
  if (urlPath === '/api/state' && method === 'GET') return sendJson(res, 200, store.state());

  // /api/bookmarks (create)
  if (urlPath === '/api/bookmarks' && method === 'POST') {
    var body = await readJson(req);
    var norm = urls.normalize(body.url || '');
    if (!urls.isValid(norm)) return sendJson(res, 400, { error: 'That does not look like a web address.' });
    var existing = store.findByUrl(norm);
    if (existing) return sendJson(res, 409, { error: 'already-saved', existingId: existing.id });
    var b = await createBookmark(norm);
    store.data.bookmarks.unshift(b);
    store.save();
    return sendJson(res, 201, { bookmark: b });
  }

  // /api/bookmarks/bulk
  if (urlPath === '/api/bookmarks/bulk' && method === 'POST') {
    var bb = await readJson(req);
    var ids = (bb.ids || []).map(Number);
    var action = bb.action;
    var affected = store.data.bookmarks.filter(function (x) { return ids.indexOf(x.id) >= 0; });
    var now = Date.now(), count = 0;
    if (action === 'addTag' || action === 'removeTag') {
      var tag = (bb.tag || '').trim().toLowerCase().replace(/^#/, '');
      if (!tag) return sendJson(res, 400, { error: 'Tag required.' });
      affected.forEach(function (x) {
        if (action === 'addTag') { if (x.tags.indexOf(tag) < 0) { x.tags.push(tag); x.updated = now; count++; } }
        else { if (x.tags.indexOf(tag) >= 0) { x.tags = x.tags.filter(function (t) { return t !== tag; }); x.updated = now; count++; } }
      });
    } else if (action === 'read' || action === 'unread') {
      affected.forEach(function (x) { x.read = (action === 'read'); count++; });
    } else if (action === 'archive' || action === 'restore') {
      affected.forEach(function (x) { x.archived = (action === 'archive'); count++; });
    } else if (action === 'delete') {
      affected.forEach(function (x) { store.removeSnapshot(x.id); });
      store.data.bookmarks = store.data.bookmarks.filter(function (x) { return ids.indexOf(x.id) < 0; });
      count = affected.length;
    } else {
      return sendJson(res, 400, { error: 'Unknown action.' });
    }
    store.save();
    return sendJson(res, 200, { count: count, state: store.state() });
  }

  // /api/bookmarks/:id  and sub-resources
  var m = urlPath.match(/^\/api\/bookmarks\/(\d+)(\/(snapshot|wayback))?$/);
  if (m) {
    var id = Number(m[1]);
    var sub = m[3];
    var b = store.byId(id);
    if (!b) return sendJson(res, 404, { error: 'Not found.' });

    if (!sub && method === 'PATCH') {
      var upd = await readJson(req);
      var changed = false, contentChanged = false;
      if (typeof upd.url === 'string') {
        var nu = urls.normalize(upd.url);
        if (!urls.isValid(nu)) return sendJson(res, 400, { error: 'That does not look like a web address.' });
        var clash = store.findByUrl(nu);
        if (clash && clash.id !== b.id) return sendJson(res, 409, { error: 'address-in-use', existingId: clash.id });
        if (nu !== b.url) { b.url = nu; b.isPdf = urls.isPdf(nu); changed = contentChanged = true; }
      }
      ['title', 'description', 'note'].forEach(function (f) {
        if (typeof upd[f] === 'string' && upd[f] !== b[f]) { b[f] = upd[f]; changed = contentChanged = true; }
      });
      if (Array.isArray(upd.tags)) {
        var t = upd.tags.map(function (x) { return String(x).trim().toLowerCase(); }).filter(Boolean);
        var uniq = []; t.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
        if (uniq.join(',') !== b.tags.join(',')) { b.tags = uniq; changed = contentChanged = true; }
      }
      if (typeof upd.read === 'boolean' && upd.read !== b.read) { b.read = upd.read; changed = true; }
      if (typeof upd.archived === 'boolean' && upd.archived !== b.archived) { b.archived = upd.archived; changed = true; }
      if (contentChanged) b.updated = Date.now();
      if (changed) store.save();
      return sendJson(res, 200, { bookmark: b });
    }

    if (!sub && method === 'DELETE') {
      store.removeSnapshot(id);
      store.data.bookmarks = store.data.bookmarks.filter(function (x) { return x.id !== id; });
      store.save();
      return sendJson(res, 200, { ok: true });
    }

    if (sub === 'snapshot' && method === 'POST') {
      try {
        var cap = await snapshot.capture(b.url);
        if (cap.kind === 'pdf') store.writeSnapshot(id, 'pdf', cap.buffer);
        else store.writeSnapshot(id, 'page', cap.html);
        b.snapshot = { date: Date.now(), kind: cap.kind };
        store.save();
        return sendJson(res, 200, { snapshot: b.snapshot });
      } catch (e) {
        return sendJson(res, 502, { error: 'Could not save a copy: ' + e.message + ' You can retry.' });
      }
    }
    if (sub === 'snapshot' && method === 'DELETE') {
      store.removeSnapshot(id); b.snapshot = null; store.save();
      return sendJson(res, 200, { ok: true });
    }
    if (sub === 'wayback' && method === 'POST') {
      try {
        var w = await wayback.preserve(b.url);
        b.wayback = w; store.save();
        return sendJson(res, 200, { wayback: w });
      } catch (e) {
        return sendJson(res, 502, { error: 'Internet Archive preservation failed: ' + e.message + ' You can retry.' });
      }
    }
  }

  // /api/views
  if (urlPath === '/api/views' && method === 'POST') {
    var v = await readJson(req);
    var name = (v.name || '').trim();
    if (!name) return sendJson(res, 400, { error: 'Name required.' });
    var view = { name: name, query: v.query || '', inc: v.inc || [], exc: v.exc || [] };
    var idx = store.data.views.findIndex(function (x) { return x.name.toLowerCase() === name.toLowerCase(); });
    if (idx >= 0) store.data.views[idx] = view; else store.data.views.push(view);
    store.save();
    return sendJson(res, 200, { views: store.data.views });
  }
  var vm = urlPath.match(/^\/api\/views\/(.+)$/);
  if (vm && method === 'DELETE') {
    var nm = decodeURIComponent(vm[1]).toLowerCase();
    store.data.views = store.data.views.filter(function (x) { return x.name.toLowerCase() !== nm; });
    store.save();
    return sendJson(res, 200, { views: store.data.views });
  }

  // /api/settings
  if (urlPath === '/api/settings' && method === 'PUT') {
    var s = await readJson(req);
    if (typeof s.sort === 'string') store.data.settings.sort = s.sort;
    if (s.pageSize != null) store.data.settings.pageSize = Number(s.pageSize);
    if (typeof s.textSize === 'string') store.data.settings.textSize = s.textSize;
    store.save();
    return sendJson(res, 200, { settings: store.data.settings });
  }

  // export / import
  if (urlPath === '/api/export' && method === 'GET') {
    var file = bookmarkfile.generate(store.data.bookmarks);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'attachment; filename="bookmarks-' + new Date().toISOString().slice(0, 10) + '.html"'
    });
    return res.end(file);
  }
  if (urlPath === '/api/import' && method === 'POST') {
    var raw = await readBody(req);
    var entries = bookmarkfile.parse(raw.toString('utf8'));
    var added = 0, skipped = 0, now = Date.now();
    entries.forEach(function (e) {
      var nu = urls.normalize(e.url);
      if (!urls.isValid(nu)) { skipped++; return; }
      if (store.findByUrl(nu)) { skipped++; return; }
      var fb = metadata.fallback(nu);
      var saved = e.addDate && isFinite(e.addDate) ? e.addDate : now;
      store.data.bookmarks.push({
        id: store.nextId(), url: nu, title: (e.title || '').trim() || fb.title,
        description: '', icon: fb.icon, image: '', note: e.note || '',
        tags: e.tags || [], read: false, archived: false, isPdf: urls.isPdf(nu),
        saved: saved, updated: saved, snapshot: null, wayback: null
      });
      added++;
    });
    store.save();
    return sendJson(res, 200, { added: added, skipped: skipped, state: store.state() });
  }

  return sendJson(res, 404, { error: 'Unknown endpoint.' });
}

var server = http.createServer(function (req, res) {
  var parsed;
  try { parsed = new URL(req.url, 'http://localhost'); } catch (e) { return sendText(res, 400, 'Bad request'); }
  var urlPath = parsed.pathname;
  var method = req.method.toUpperCase();

  if (urlPath.indexOf('/api/') === 0) {
    handleApi(req, res, urlPath, method).catch(function (e) {
      sendJson(res, 500, { error: 'Server error: ' + (e && e.message) });
    });
    return;
  }
  // serve stored snapshots
  var sm = urlPath.match(/^\/snapshots\/(\d+)$/);
  if (sm && method === 'GET') {
    var id = Number(sm[1]);
    var b = store.byId(id);
    var kind = b && b.snapshot ? b.snapshot.kind : 'page';
    var p = store.snapshotPath(id, kind);
    return fs.readFile(p, function (err, data) {
      if (err) return sendText(res, 404, 'No saved copy for this bookmark.');
      res.writeHead(200, { 'Content-Type': kind === 'pdf' ? 'application/pdf' : 'text/html; charset=utf-8' });
      res.end(data);
    });
  }
  // serve the browser-safe shared libs
  var lm = urlPath.match(/^\/lib\/(query|urls)\.js$/);
  if (lm && method === 'GET') {
    return fs.readFile(path.join(__dirname, 'lib', lm[1] + '.js'), function (err, data) {
      if (err) return sendText(res, 404, 'Not found');
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      res.end(data);
    });
  }
  serveStatic(req, res, urlPath);
});

if (require.main === module) {
  server.listen(PORT, HOST, function () {
    console.log('Bookmarks app listening on http://' + HOST + ':' + PORT);
  });
}

module.exports = { server: server, store: store, createBookmark: createBookmark };
