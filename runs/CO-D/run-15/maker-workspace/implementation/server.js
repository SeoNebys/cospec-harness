import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { StowDatabase } from './lib/database.js';
import { gatherMetadata } from './lib/metadata.js';
import { newSessionToken } from './lib/security.js';
import { sanitizeRichText, stripTags } from './lib/text.js';
import { canonicalizeUrl, parseWebUrl, sameUnderlyingPage } from './lib/urls.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(here, 'public');
const JSON_LIMIT = 1_000_000;

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function sendJson(response, status, value, headers = {}) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    ...headers
  });
  response.end(body);
}

function sendError(response, status, message, code = 'ERROR', extra = {}) {
  sendJson(response, status, { error: message, code, ...extra });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > JSON_LIMIT) {
      const error = new Error('Request is too large.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.status = 400;
    throw error;
  }
}

function sessionCookie(token, ttlSeconds, secure) {
  return `stow_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${ttlSeconds}${secure ? '; Secure' : ''}`;
}

function clearSessionCookie(secure) {
  return `stow_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}

function securityHeaders() {
  return {
    'content-security-policy': "default-src 'self'; img-src 'self' https: http: data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY'
  };
}

function serveStatic(requestPath, response) {
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const resolved = path.resolve(publicRoot, relative);
  if (!resolved.startsWith(`${publicRoot}${path.sep}`) && resolved !== path.join(publicRoot, 'index.html')) return false;
  let file = resolved;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(publicRoot, 'index.html');
  const body = fs.readFileSync(file);
  response.writeHead(200, {
    'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'content-length': body.length,
    'cache-control': file.endsWith('index.html') ? 'no-store' : 'public, max-age=3600',
    ...securityHeaders()
  });
  response.end(body);
  return true;
}

function cleanText(value, max, field, allowEmpty = true) {
  const text = String(value ?? '').trim().slice(0, max);
  if (!allowEmpty && !text) {
    const error = new Error(`${field} cannot be empty.`);
    error.status = 400;
    error.code = 'INVALID_FIELD';
    throw error;
  }
  return text;
}

export function createApp(options = {}) {
  const database = options.database ?? new StowDatabase(
    options.databasePath ?? process.env.STOW_DB_PATH ?? path.join(here, 'data', 'stow.db'),
    {
      email: options.email ?? process.env.STOW_EMAIL ?? 'you@example.com',
      password: options.password ?? process.env.STOW_PASSWORD ?? 'bookmarks'
    }
  );
  const ownsDatabase = !options.database;
  const sessionTtlMs = options.sessionTtlMs ?? 30 * 24 * 60 * 60 * 1000;
  const secureCookie = options.secureCookie ?? process.env.COOKIE_SECURE === '1';
  const metadataOptions = {
    fixtureFile: options.metadataFixtureFile ?? process.env.STOW_METADATA_FIXTURE_FILE,
    timeoutMs: options.metadataTimeoutMs
  };

  async function requireUser(request, response) {
    const token = parseCookies(request.headers.cookie).stow_session;
    const session = database.getSession(token);
    if (!session) {
      sendError(response, 401, 'Sign in to continue.', 'AUTH_REQUIRED');
      return null;
    }
    return { ...session, token };
  }

  async function handler(request, response) {
    const url = new URL(request.url, 'http://stow.local');
    try {
      if (url.pathname === '/api/session' && request.method === 'GET') {
        const token = parseCookies(request.headers.cookie).stow_session;
        const session = database.getSession(token);
        return sendJson(response, 200, session
          ? { signedIn: true, user: session.user, expiresAt: session.expiresAt }
          : { signedIn: false });
      }

      if (url.pathname === '/api/login' && request.method === 'POST') {
        const body = await readJson(request);
        const user = database.authenticate(body.email, body.password);
        if (!user) return sendError(response, 401, 'Those details do not match this account.', 'INVALID_CREDENTIALS');
        const token = newSessionToken();
        const expiresAt = database.createSession(user.id, token, sessionTtlMs);
        return sendJson(response, 200, { user, expiresAt }, {
          'set-cookie': sessionCookie(token, Math.floor(sessionTtlMs / 1000), secureCookie)
        });
      }

      if (url.pathname === '/api/logout' && request.method === 'POST') {
        const token = parseCookies(request.headers.cookie).stow_session;
        database.deleteSession(token);
        return sendJson(response, 200, { signedOut: true }, { 'set-cookie': clearSessionCookie(secureCookie) });
      }

      if (url.pathname.startsWith('/api/')) {
        const session = await requireUser(request, response);
        if (!session) return;
      }

      if (url.pathname === '/api/tags' && request.method === 'GET') {
        return sendJson(response, 200, { tags: database.listTags(url.searchParams.get('q') ?? '') });
      }

      if (url.pathname === '/api/bookmarks' && request.method === 'GET') {
        const result = database.listBookmarks({
          view: url.searchParams.get('view') ?? 'active',
          query: url.searchParams.get('q') ?? '',
          tag: url.searchParams.get('tag') ?? '',
          limit: url.searchParams.get('limit') ?? 12,
          offset: url.searchParams.get('offset') ?? 0
        });
        return sendJson(response, 200, result);
      }

      if (url.pathname === '/api/bookmarks' && request.method === 'POST') {
        const body = await readJson(request);
        const parsed = parseWebUrl(body.url);
        const canonicalUrl = canonicalizeUrl(parsed.toString());
        const duplicate = database.getBookmarkByCanonical(canonicalUrl);
        if (duplicate) return sendJson(response, 200, { duplicate: true, bookmark: duplicate });
        const metadata = await gatherMetadata(parsed.toString(), metadataOptions);
        try {
          const bookmark = database.createBookmark({
            url: parsed.toString(),
            canonicalUrl,
            ...metadata
          });
          return sendJson(response, 201, { duplicate: false, bookmark });
        } catch (error) {
          if (String(error.message).includes('UNIQUE')) {
            return sendJson(response, 200, {
              duplicate: true,
              bookmark: database.getBookmarkByCanonical(canonicalUrl)
            });
          }
          throw error;
        }
      }

      const tagRoute = url.pathname.match(/^\/api\/bookmarks\/(\d+)\/tags(?:\/(\d+))?$/);
      if (tagRoute && request.method === 'POST' && !tagRoute[2]) {
        const body = await readJson(request);
        const bookmark = database.addTag(Number(tagRoute[1]), body.name);
        if (!bookmark) return sendError(response, 404, 'Bookmark not found.', 'NOT_FOUND');
        return sendJson(response, 200, { bookmark });
      }
      if (tagRoute && request.method === 'DELETE' && tagRoute[2]) {
        const bookmark = database.removeTag(Number(tagRoute[1]), Number(tagRoute[2]));
        if (!bookmark) return sendError(response, 404, 'Tag or bookmark not found.', 'NOT_FOUND');
        return sendJson(response, 200, { bookmark });
      }

      const bookmarkRoute = url.pathname.match(/^\/api\/bookmarks\/(\d+)$/);
      if (bookmarkRoute && request.method === 'GET') {
        const bookmark = database.getBookmark(Number(bookmarkRoute[1]));
        return bookmark
          ? sendJson(response, 200, { bookmark })
          : sendError(response, 404, 'Bookmark not found.', 'NOT_FOUND');
      }

      if (bookmarkRoute && request.method === 'DELETE') {
        const deleted = database.deleteBookmark(Number(bookmarkRoute[1]));
        return deleted
          ? sendJson(response, 200, { deleted: true })
          : sendError(response, 404, 'Bookmark not found.', 'NOT_FOUND');
      }

      if (bookmarkRoute && request.method === 'PATCH') {
        const id = Number(bookmarkRoute[1]);
        const existing = database.getBookmark(id);
        if (!existing) return sendError(response, 404, 'Bookmark not found.', 'NOT_FOUND');
        const body = await readJson(request);
        const updates = {};

        if ('title' in body) updates.title = cleanText(body.title, 500, 'Title', false);
        if ('description' in body) updates.description = cleanText(body.description, 2_000, 'Description');
        if ('readLater' in body) updates.readLater = Boolean(body.readLater);
        if ('archived' in body) updates.archived = Boolean(body.archived);
        if ('noteHtml' in body) {
          updates.noteHtml = sanitizeRichText(body.noteHtml).slice(0, 20_000);
          updates.notePlain = stripTags(updates.noteHtml).slice(0, 10_000);
        }

        if ('url' in body) {
          const parsed = parseWebUrl(body.url);
          const canonicalUrl = canonicalizeUrl(parsed.toString());
          const duplicate = database.getBookmarkByCanonical(canonicalUrl);
          if (duplicate && duplicate.id !== id) {
            return sendError(response, 409, 'That page is already saved.', 'DUPLICATE', { bookmark: duplicate });
          }
          const samePage = sameUnderlyingPage(existing.url, parsed.toString());
          if (!samePage && !['refresh', 'keep'].includes(body.detailStrategy)) {
            return sendError(response, 409, 'This address appears to point to a different page.', 'DIFFERENT_PAGE', {
              bookmark: existing,
              proposedUrl: parsed.toString()
            });
          }
          updates.url = parsed.toString();
          updates.canonicalUrl = canonicalUrl;
          if (!samePage) {
            const metadata = await gatherMetadata(parsed.toString(), metadataOptions);
            updates.siteName = metadata.siteName;
            updates.siteIcon = metadata.siteIcon;
            updates.previewImage = metadata.previewImage;
            updates.metadataStatus = metadata.metadataStatus;
            if (body.detailStrategy === 'refresh') {
              updates.title = metadata.title;
              updates.description = metadata.description;
            }
          }
        }

        const bookmark = database.updateBookmark(id, updates);
        return sendJson(response, 200, { bookmark });
      }

      if (url.pathname.startsWith('/api/')) return sendError(response, 404, 'Not found.', 'NOT_FOUND');
      if (request.method !== 'GET' && request.method !== 'HEAD') return sendError(response, 405, 'Method not allowed.', 'METHOD_NOT_ALLOWED');
      return serveStatic(url.pathname, response);
    } catch (error) {
      const status = error.status ?? (error.code === 'INVALID_URL' ? 400 : 500);
      const code = error.code ?? (status === 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
      if (status >= 500) console.error(error);
      return sendError(response, status, status >= 500 ? 'Something went wrong. Please try again.' : error.message, code);
    }
  }

  const server = http.createServer(handler);
  return {
    server,
    database,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (ownsDatabase) database.close();
        if (error) reject(error);
        else resolve();
      });
    })
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? '0.0.0.0';
  const app = createApp();
  app.server.listen(port, host, () => {
    console.log(`Stow listening on http://${host}:${port}`);
  });
}
