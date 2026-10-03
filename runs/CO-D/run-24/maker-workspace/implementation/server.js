'use strict';
// HTTP server for the bookmark manager. Pure Node built-ins (node:http). Serves
// the SPA + static assets, preserved-copy files, and the JSON API.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { ensureSeedUser } = require('./src/db');
const auth = require('./src/auth');
const bm = require('./src/bookmarks');
const { db } = require('./src/db');
const { snapshotPath } = require('./src/snapshot');
const { parseBookmarksHtml, generateBookmarksHtml } = require('./src/bookmarksHtml');

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC = path.join(__dirname, 'public');

const seed = ensureSeedUser();
console.log(`[bookmarks] review account: ${seed.email} / ${seed.password}`);

// ---------- helpers ----------
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}
function sendText(res, status, text, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(text);
}
function setCookie(res, name, value, opts) {
  opts = opts || {};
  let c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax`;
  if (opts.maxAge != null) c += `; Max-Age=${opts.maxAge}`;
  res.setHeader('Set-Cookie', c);
}
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size < 20 * 1024 * 1024) chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(''));
  });
}
async function readJson(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { return {}; }
}
const STATIC_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveStatic(res, file) {
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full)) { sendText(res, 404, 'Not found'); return; }
  const ext = path.extname(full);
  res.writeHead(200, { 'Content-Type': STATIC_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(full).pipe(res);
}
function currentUser(req) {
  const cookies = auth.parseCookies(req);
  return auth.userForToken(cookies[auth.COOKIE]);
}

// ---------- collections & settings ----------
function listCollections(userId) {
  return db.prepare('SELECT id,name,query,created_at AS createdAt FROM collections WHERE user_id=? ORDER BY created_at ASC').all(userId);
}
function getSettings(userId) {
  let s = db.prepare('SELECT default_sort AS defaultSort, density, font_size AS fontSize FROM settings WHERE user_id=?').get(userId);
  if (!s) { db.prepare('INSERT INTO settings(user_id) VALUES(?)').run(userId); s = { defaultSort: 'newest', density: 'comfortable', fontSize: 'medium' }; }
  return s;
}

// ---------- router ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname;
    const method = req.method;

    // Public pages / assets
    if (method === 'GET' && (p === '/' )) return serveStatic(res, 'index.html');
    if (method === 'GET' && p === '/login') return serveStatic(res, 'login.html');
    if (method === 'GET' && ['/app.js', '/styles.css', '/query.js', '/login.js'].includes(p)) return serveStatic(res, p.slice(1));

    // ----- Auth API -----
    if (p === '/api/login' && method === 'POST') {
      const body = await readJson(req);
      const u = auth.login(body.email, body.password);
      if (!u) return sendJson(res, 401, { error: 'invalid_credentials', message: 'Wrong email or password.' });
      const token = auth.createSession(u.id);
      setCookie(res, auth.COOKIE, token, { maxAge: 60 * 60 * 24 * 30 });
      return sendJson(res, 200, { ok: true, email: u.email });
    }
    if (p === '/api/logout' && method === 'POST') {
      const cookies = auth.parseCookies(req);
      auth.deleteSession(cookies[auth.COOKIE]);
      setCookie(res, auth.COOKIE, '', { maxAge: 0 });
      return sendJson(res, 200, { ok: true });
    }

    // Everything below requires auth.
    const user = currentUser(req);
    if (p.startsWith('/api/') || p.startsWith('/snapshots/')) {
      if (!user) return sendJson(res, 401, { error: 'unauthorized' });
    }

    if (p === '/api/me' && method === 'GET') {
      return sendJson(res, 200, { email: user.email, settings: getSettings(user.id) });
    }

    // ----- Preserved copy files -----
    if (p.startsWith('/snapshots/') && method === 'GET') {
      const id = Number(p.split('/')[2]);
      const row = bm.getRow(user.id, id);
      if (!row || row.snapshot_status !== 'saved' || !row.snapshot_file) return sendText(res, 404, 'No preserved copy');
      const file = snapshotPath(row.snapshot_file);
      if (!fs.existsSync(file)) return sendText(res, 404, 'Missing');
      const type = row.snapshot_is_pdf ? 'application/pdf' : 'text/html; charset=utf-8';
      res.writeHead(200, { 'Content-Type': type });
      return fs.createReadStream(file).pipe(res);
    }

    // ----- Bookmarks API -----
    if (p === '/api/bookmarks' && method === 'GET') {
      return sendJson(res, 200, { bookmarks: bm.list(user.id) });
    }
    if (p === '/api/bookmarks' && method === 'POST') {
      const body = await readJson(req);
      const r = await bm.create(user.id, body.url);
      if (r.error) return sendJson(res, 400, r);
      return sendJson(res, r.duplicate ? 200 : 201, r);
    }
    if (p === '/api/bookmarks/bulk' && method === 'POST') {
      const body = await readJson(req);
      const r = bm.bulk(user.id, body.ids, body.action, body.value);
      if (r.error) return sendJson(res, 400, r);
      return sendJson(res, 200, r);
    }
    let m;
    if ((m = p.match(/^\/api\/bookmarks\/(\d+)$/))) {
      const id = Number(m[1]);
      if (method === 'GET') { const b = bm.get(user.id, id); return b ? sendJson(res, 200, { bookmark: b }) : sendJson(res, 404, { error: 'notfound' }); }
      if (method === 'PATCH') { const body = await readJson(req); const r = bm.update(user.id, id, body); return sendJson(res, r.error ? 400 : 200, r); }
      if (method === 'DELETE') { const r = bm.remove(user.id, id); return sendJson(res, r.error ? 404 : 200, r); }
    }
    if ((m = p.match(/^\/api\/bookmarks\/(\d+)\/snapshot$/)) && method === 'POST') {
      const id = Number(m[1]);
      if (!bm.getRow(user.id, id)) return sendJson(res, 404, { error: 'notfound' });
      bm.scheduleSnapshot(user.id, id);
      return sendJson(res, 202, { ok: true, status: 'pending' });
    }
    if ((m = p.match(/^\/api\/bookmarks\/(\d+)\/archiveorg$/)) && method === 'POST') {
      const id = Number(m[1]);
      const body = await readJson(req);
      const row = bm.getRow(user.id, id);
      if (!row) return sendJson(res, 404, { error: 'notfound' });
      if (body.enabled) { setImmediate(() => bm.runArchiveOrg(user.id, id).catch(() => {})); return sendJson(res, 202, { ok: true, status: 'pending' }); }
      db.prepare('UPDATE bookmarks SET archiveorg_status=?, archiveorg_url=NULL WHERE id=?').run('none', id);
      return sendJson(res, 200, { ok: true, status: 'none' });
    }

    // ----- Import / Export -----
    if (p === '/api/import' && method === 'POST') {
      const raw = await readBody(req);
      const parsed = parseBookmarksHtml(raw);
      const r = bm.importParsed(user.id, parsed);
      return sendJson(res, 200, r);
    }
    if (p === '/api/export' && method === 'GET') {
      const html = generateBookmarksHtml(bm.exportList(user.id));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': 'attachment; filename="bookmarks.html"' });
      return res.end(html);
    }

    // ----- Collections -----
    if (p === '/api/collections' && method === 'GET') return sendJson(res, 200, { collections: listCollections(user.id) });
    if (p === '/api/collections' && method === 'POST') {
      const body = await readJson(req);
      const name = String(body.name || '').trim();
      const query = String(body.query || '').trim();
      if (!name || !query) return sendJson(res, 400, { error: 'invalid' });
      const info = db.prepare('INSERT INTO collections(user_id,name,query,created_at) VALUES(?,?,?,?)').run(user.id, name, query, Date.now());
      return sendJson(res, 201, { collection: { id: info.lastInsertRowid, name, query } });
    }
    if ((m = p.match(/^\/api\/collections\/(\d+)$/)) && method === 'DELETE') {
      db.prepare('DELETE FROM collections WHERE user_id=? AND id=?').run(user.id, Number(m[1]));
      return sendJson(res, 200, { ok: true });
    }

    // ----- Settings -----
    if (p === '/api/settings' && method === 'PUT') {
      const body = await readJson(req);
      const cur = getSettings(user.id);
      const defaultSort = ['newest', 'oldest', 'az', 'za'].includes(body.defaultSort) ? body.defaultSort : cur.defaultSort;
      const density = ['comfortable', 'cozy', 'compact'].includes(body.density) ? body.density : cur.density;
      const fontSize = ['small', 'medium', 'large'].includes(body.fontSize) ? body.fontSize : cur.fontSize;
      db.prepare('UPDATE settings SET default_sort=?, density=?, font_size=? WHERE user_id=?').run(defaultSort, density, fontSize, user.id);
      return sendJson(res, 200, { settings: { defaultSort, density, fontSize } });
    }

    sendText(res, 404, 'Not found');
  } catch (err) {
    console.error('[bookmarks] error', err);
    try { sendJson(res, 500, { error: 'server_error' }); } catch (e) { /* noop */ }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[bookmarks] listening on http://${HOST}:${PORT}`);
});

module.exports = server;
