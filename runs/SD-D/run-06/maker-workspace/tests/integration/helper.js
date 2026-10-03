import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

// Start the app with an isolated temp DB and async capture disabled.
export async function startTestServer() {
  const db = join(tmpdir(), `bm-int-${process.pid}-${Math.random().toString(36).slice(2)}.db`);
  process.env.BOOKMARKS_DB = db;
  process.env.DISABLE_CAPTURE = '1';

  const { migrate } = await import('../../src/server/db/migrations.js');
  const { createApp } = await import('../../src/server/app.js');
  const { closeDb } = await import('../../src/server/db/connection.js');
  migrate();

  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  const api = async (method, path, body) => {
    const opts = { method };
    if (body !== undefined) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
    const res = await fetch(base + path, opts);
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  };

  const close = () => new Promise((resolve) => {
    server.close(() => {
      closeDb();
      for (const suffix of ['', '-wal', '-shm']) { try { rmSync(db + suffix); } catch { /* ignore */ } }
      resolve();
    });
  });

  return { base, api, close };
}
