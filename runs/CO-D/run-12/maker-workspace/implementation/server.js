'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_DB = path.join(__dirname, 'data', 'trove.db');
const REFERRAL_FIELDS = new Set(['ref', 'referrer']);

function canonicalizeUrl(value) {
  const url = new URL(String(value).trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only web addresses beginning with http:// or https:// can be saved.');
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || REFERRAL_FIELDS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

function normalizeLabel(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, token) => {
    if (token[0] === '#') {
      const hex = token[1].toLowerCase() === 'x';
      const point = Number.parseInt(token.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : _;
    }
    return named[token.toLowerCase()] ?? _;
  }).replace(/\s+/g, ' ').trim();
}

function extractMetadata(html) {
  const source = String(html || '');
  const meta = (key) => {
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${key}["'][^>]*>`, 'i')
    ];
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match) return decodeEntities(match[1]);
    }
    return '';
  };
  const titleMatch = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = meta('og:title') || decodeEntities(titleMatch?.[1] || '');
  const description = meta('og:description') || meta('description');
  return { title, description };
}

function stripTags(value) {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, ' '));
}

function sanitizeNote(html) {
  let value = String(html || '').slice(0, 50000);
  value = value.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  value = value.replace(/<!--[^]*?-->/g, '');
  value = value.replace(/<(?!\/?(?:b|strong|ul|li|br|p|div|a)(?:\s|>|\/))[^>]*>/gi, '');
  value = value.replace(/<(b|strong|ul|li|br|p|div)\b[^>]*>/gi, '<$1>');
  value = value.replace(/<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>/gi, (_, href) => {
    try {
      const parsed = new URL(href, 'https://placeholder.invalid');
      if (!['http:', 'https:'].includes(parsed.protocol)) return '<a>';
      const safe = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return `<a href="${safe}" target="_blank" rel="noreferrer">`;
    } catch { return '<a>'; }
  });
  value = value.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  return value.trim();
}

function openDatabase(dbPath = DEFAULT_DB) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY,
      url TEXT NOT NULL,
      canonical_url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      note_html TEXT NOT NULL DEFAULT '',
      read_later INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS bookmark_labels (
      bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, label_id)
    );
  `);
  return db;
}

function makeStore(db) {
  const labelRowsFor = db.prepare(`SELECT l.id, l.name FROM labels l JOIN bookmark_labels bl ON bl.label_id=l.id WHERE bl.bookmark_id=? ORDER BY l.name COLLATE NOCASE`);
  const hydrate = row => row ? { ...row, readLater: Boolean(row.read_later), noteHtml: row.note_html, createdAt: row.created_at, updatedAt: row.updated_at, labels: labelRowsFor.all(row.id).map(x => x.name), read_later: undefined, note_html: undefined, created_at: undefined, updated_at: undefined, canonical_url: undefined } : null;

  function get(id) { return hydrate(db.prepare('SELECT * FROM bookmarks WHERE id=?').get(id)); }
  function findByCanonical(canonical) { return hydrate(db.prepare('SELECT * FROM bookmarks WHERE canonical_url=?').get(canonical)); }
  function labelCounts() { return db.prepare(`SELECT l.name, COUNT(bl.bookmark_id) count FROM labels l LEFT JOIN bookmark_labels bl ON bl.label_id=l.id GROUP BY l.id ORDER BY l.name COLLATE NOCASE`).all(); }
  function setLabels(bookmarkId, names) {
    const unique = new Map();
    for (const raw of Array.isArray(names) ? names : []) {
      const name = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      const normalized = normalizeLabel(name);
      if (normalized && !unique.has(normalized)) unique.set(normalized, name);
    }
    db.prepare('DELETE FROM bookmark_labels WHERE bookmark_id=?').run(bookmarkId);
    for (const [normalized, requested] of unique) {
      let label = db.prepare('SELECT * FROM labels WHERE normalized_name=?').get(normalized);
      if (!label) {
        const result = db.prepare('INSERT INTO labels(name, normalized_name) VALUES (?,?)').run(requested, normalized);
        label = { id: Number(result.lastInsertRowid), name: requested };
      }
      db.prepare('INSERT OR IGNORE INTO bookmark_labels(bookmark_id,label_id) VALUES (?,?)').run(bookmarkId, label.id);
    }
  }
  function create(input) {
    const canonical = canonicalizeUrl(input.url);
    const existing = findByCanonical(canonical);
    if (existing) return { duplicate: existing };
    const title = String(input.title || '').trim().slice(0, 500);
    if (!title) throw new Error('A title is required.');
    const now = new Date().toISOString();
    const result = db.prepare(`INSERT INTO bookmarks(url,canonical_url,title,description,note_html,read_later,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(String(input.url).trim(), canonical, title, String(input.description || '').trim().slice(0, 4000), sanitizeNote(input.noteHtml), input.readLater ? 1 : 0, now, now);
    const id = Number(result.lastInsertRowid);
    setLabels(id, input.labels);
    return { bookmark: get(id) };
  }
  function update(id, input) {
    const current = get(id);
    if (!current) return null;
    const title = input.title === undefined ? current.title : String(input.title).trim().slice(0, 500);
    if (!title) throw new Error('A title is required.');
    const description = input.description === undefined ? current.description : String(input.description || '').trim().slice(0, 4000);
    const note = input.noteHtml === undefined ? current.noteHtml : sanitizeNote(input.noteHtml);
    const readLater = input.readLater === undefined ? current.readLater : Boolean(input.readLater);
    db.prepare('UPDATE bookmarks SET title=?,description=?,note_html=?,read_later=?,updated_at=? WHERE id=?').run(title, description, note, readLater ? 1 : 0, new Date().toISOString(), id);
    if (input.labels !== undefined) setLabels(id, input.labels);
    return get(id);
  }
  function list({ search = '', label = '', readLater = false } = {}) {
    let rows = db.prepare('SELECT * FROM bookmarks ORDER BY created_at DESC, id DESC').all();
    let result = rows.map(hydrate);
    if (readLater) result = result.filter(x => x.readLater);
    if (label) result = result.filter(x => x.labels.some(name => normalizeLabel(name) === normalizeLabel(label)));
    const query = String(search).trim().toLocaleLowerCase();
    if (query) result = result.filter(x => [x.title, x.description, stripTags(x.noteHtml), x.url].join(' ').toLocaleLowerCase().includes(query));
    return result;
  }
  function counts() {
    return {
      total: Number(db.prepare('SELECT COUNT(*) count FROM bookmarks').get().count),
      readLater: Number(db.prepare('SELECT COUNT(*) count FROM bookmarks WHERE read_later=1').get().count),
      labels: labelCounts()
    };
  }
  return { get, findByCanonical, create, update, list, counts, labelCounts };
}

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
  res.end(body);
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error('Request is too large.');
  }
  return body ? JSON.parse(body) : {};
}

async function fetchPageDetails(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'Trove bookmark metadata fetcher/1.0', accept: 'text/html,application/xhtml+xml' } });
  if (!response.ok) throw new Error(`Page returned ${response.status}.`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) throw new Error('This address is not an HTML page.');
  const html = (await response.text()).slice(0, 1_500_000);
  const details = extractMetadata(html);
  if (!details.title) throw new Error('No page title was available.');
  return details;
}

function createApp({ dbPath = process.env.TROVE_DB_PATH || DEFAULT_DB, fetchImpl = fetch } = {}) {
  const db = openDatabase(dbPath);
  const store = makeStore(db);
  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, 'http://localhost');
      const pathname = requestUrl.pathname;
      if (pathname === '/api/bookmarks' && req.method === 'GET') {
        return json(res, 200, { bookmarks: store.list({ search: requestUrl.searchParams.get('search') || '', label: requestUrl.searchParams.get('label') || '', readLater: requestUrl.searchParams.get('readLater') === '1' }), counts: store.counts() });
      }
      if (pathname === '/api/labels' && req.method === 'GET') return json(res, 200, { labels: store.labelCounts() });
      if (pathname === '/api/metadata' && req.method === 'POST') {
        const input = await readJson(req);
        let canonical;
        try { canonical = canonicalizeUrl(input.url); }
        catch { return json(res, 400, { error: 'That doesn’t look like a complete web address. Try something like https://example.com/page', code: 'INVALID_URL' }); }
        const duplicate = store.findByCanonical(canonical);
        if (duplicate) return json(res, 200, { duplicate });
        try {
          const details = await fetchPageDetails(String(input.url).trim(), fetchImpl);
          return json(res, 200, { url: String(input.url).trim(), ...details });
        } catch (error) {
          return json(res, 200, { url: String(input.url).trim(), unavailable: true, message: 'We couldn’t get this page’s details. The link can still be saved.' });
        }
      }
      if (pathname === '/api/bookmarks' && req.method === 'POST') {
        const result = store.create(await readJson(req));
        return json(res, result.duplicate ? 200 : 201, result);
      }
      const match = pathname.match(/^\/api\/bookmarks\/(\d+)$/);
      if (match && req.method === 'PATCH') {
        const bookmark = store.update(Number(match[1]), await readJson(req));
        return bookmark ? json(res, 200, { bookmark }) : json(res, 404, { error: 'Bookmark not found.' });
      }
      if (pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found.' });
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      const filePath = path.resolve(PUBLIC_DIR, relative);
      if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== path.join(PUBLIC_DIR, 'index.html')) return json(res, 404, { error: 'Not found.' });
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return json(res, 404, { error: 'Not found.' });
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'content-type': types[path.extname(filePath)] || 'application/octet-stream', 'content-length': data.length });
      res.end(data);
    } catch (error) {
      const status = error instanceof SyntaxError ? 400 : 400;
      json(res, status, { error: error.message || 'Something went wrong.' });
    }
  });
  server.on('close', () => db.close());
  return { server, store, db };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4000);
  const { server } = createApp();
  server.listen(port, '0.0.0.0', () => console.log(`Trove listening on http://0.0.0.0:${port}`));
}

module.exports = { createApp, canonicalizeUrl, normalizeLabel, extractMetadata, sanitizeNote, openDatabase, makeStore };
