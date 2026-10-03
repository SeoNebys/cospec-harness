// Shared test helper: boot the Express app against an in-memory database and
// expose a base URL for fetch-based assertions.
process.env.BOOKMARKS_DB = ':memory:';
process.env.PORT = '0';

import { createApp } from '../../server/app.js';
import { getDb } from '../../server/db.js';

export async function startServer() {
  // Ensure schema is initialized before serving.
  getDb();
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  return { server, base, close: () => new Promise((r) => server.close(r)) };
}

export function resetDb() {
  getDb().exec('DELETE FROM bookmarks');
}

export async function api(base, path, options) {
  const res = await fetch(`${base}${path}`, options);
  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

export function postBookmark(base, payload) {
  return api(base, '/api/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
