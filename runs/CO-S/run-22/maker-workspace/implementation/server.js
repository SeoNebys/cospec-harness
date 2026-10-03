// Bookmark Keeper — production HTTP server (zero external dependencies).
// Serves the web UI and a small JSON API. Data rules live in lib/store.js.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './lib/store.js';
import { lookupTitle, capturePage } from './lib/fetchpage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const HOST = '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

const store = new Store(DATA_DIR);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > 5 * 1024 * 1024) { reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  try {
    // --- API ---
    if (p === '/api/bookmarks' && req.method === 'GET') {
      return sendJson(res, 200, { bookmarks: store.list() });
    }

    if (p === '/api/bookmarks' && req.method === 'POST') {
      const body = await readBody(req);
      const result = store.create(body);
      if (result.error === 'empty') return sendJson(res, 400, { error: 'empty', message: 'Please enter a link address first.' });
      if (result.error === 'invalid') return sendJson(res, 400, { error: 'invalid', message: "That doesn't look like a valid web address. Please check it." });
      if (result.error === 'duplicate') return sendJson(res, 409, { error: 'duplicate', existing: result.existing, message: "You already saved this link. It won't be saved twice." });
      // SCN-005: capture snapshot when a copy was requested.
      if (result.bookmark.keepcopy) {
        const cap = await capturePage(result.bookmark.url);
        store.setSnapshot(result.bookmark.id, JSON.stringify({
          capturedAt: result.bookmark.savedOn,
          ok: cap.ok,
          title: cap.title || result.bookmark.title,
          text: cap.ok ? cap.text : '',
        }));
      }
      return sendJson(res, 201, { bookmark: result.bookmark });
    }

    const idMatch = p.match(/^\/api\/bookmarks\/(\d+)$/);
    if (idMatch) {
      const id = Number(idMatch[1]);
      if (req.method === 'PUT') {
        const body = await readBody(req);
        const before = store.get(id);
        const wasCopy = before && before.keepcopy;
        const result = store.update(id, body);
        if (result.error === 'notfound') return sendJson(res, 404, { error: 'notfound' });
        if (result.error === 'invalid') return sendJson(res, 400, { error: 'invalid', message: "That doesn't look like a valid web address." });
        if (result.error === 'duplicate') return sendJson(res, 409, { error: 'duplicate', existing: result.existing, message: 'Another saved link already uses that address.' });
        // Refresh snapshot if a copy is now wanted and none stored, or address changed.
        const bm = result.bookmark;
        if (bm.keepcopy && (!wasCopy || (body.url !== undefined))) {
          const cap = await capturePage(bm.url);
          store.setSnapshot(bm.id, JSON.stringify({
            capturedAt: bm.savedOn, ok: cap.ok,
            title: cap.title || bm.title, text: cap.ok ? cap.text : '',
          }));
        }
        return sendJson(res, 200, { bookmark: bm });
      }
      if (req.method === 'DELETE') {
        const result = store.remove(id);
        if (result.error) return sendJson(res, 404, { error: 'notfound' });
        return sendJson(res, 200, { ok: true });
      }
    }

    const snapMatch = p.match(/^\/api\/snapshot\/(\d+)$/);
    if (snapMatch && req.method === 'GET') {
      const raw = store.getSnapshot(snapMatch[1]);
      if (!raw) return sendJson(res, 404, { error: 'nosnapshot' });
      return sendJson(res, 200, JSON.parse(raw));
    }

    if (p === '/api/lookup-title' && req.method === 'GET') {
      const target = url.searchParams.get('url') || '';
      const r = await lookupTitle(target);
      return sendJson(res, 200, { title: r.title, ok: r.ok });
    }

    // --- Static ---
    if (req.method === 'GET') return serveStatic(req, res, p);

    res.writeHead(405); res.end('Method not allowed');
  } catch (e) {
    sendJson(res, 400, { error: 'badrequest', message: String(e && e.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Bookmark Keeper listening on http://${HOST}:${PORT}`);
});

export { server, store };
