// Shared helper: start the app on an ephemeral port with a temp file DB.
// (A unique file per process avoids a better-sqlite3 :memory: teardown crash.)
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.BOOKMARKS_DB = join(tmpdir(), `bm-int-${process.pid}-${Date.now()}.db`);

import { createApp } from '../../src/server.js';
import { getDb } from '../../src/db/index.js';

let server;
let base;

export async function startServer() {
  if (base) return base;
  const app = createApp();
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  server.unref();
  base = `http://127.0.0.1:${server.address().port}`;
  return base;
}

export function resetDb() {
  const db = getDb();
  db.exec('DELETE FROM bookmark_tags; DELETE FROM bookmark; DELETE FROM tag; DELETE FROM saved_search;');
  db.exec("UPDATE preferences SET default_sort='date_added_desc', items_per_page=25, text_size='medium' WHERE id=1;");
}

export async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(base + path, opts);
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}

/** Seed a bookmark directly (bypassing metadata fetch). */
export async function seed(url, extra = {}) {
  const { body } = await api('POST', '/api/bookmarks', { url, title: extra.title || url, ...extra });
  return body;
}
