import { createDb } from '../../src/db.js';
import { createStore } from '../../src/bookmarks.js';
import { createApp } from '../../src/server.js';

// A single shared in-memory DB per test-file process. Using one Database
// instance (rather than one per test) avoids native teardown crashes in
// better-sqlite3 from many finalizers running at process exit.
const db = createDb(':memory:');
let meta = {};
const collect = async (url) => ({
  title: meta.title ?? 'Stub Title',
  description: meta.description ?? 'Stub description',
  faviconUrl: meta.faviconUrl ?? 'https://icon.example/favicon.ico',
  ...(meta.byUrl ? meta.byUrl(url) : {}),
});
const store = createStore(db, { collect });
const app = createApp(store);

// Close the shared DB while the environment is still alive, so better-sqlite3
// finalizes prepared statements before process teardown (avoids a native crash
// in Statement::~Statement / RemoveEnvironmentCleanupHook at exit).
export function closeShared() {
  store.close();
}

// Reset data and configure the metadata stub for the next scenario.
export function makeApp(m = {}) {
  meta = m;
  db.exec('DELETE FROM bookmark_tags; DELETE FROM bookmarks; DELETE FROM tags;');
  return app;
}

// Run `fn` against an ephemeral server bound to the shared app.
export async function withServer(app, fn) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const req = async (method, path, body) => {
    const headers = { connection: 'close' };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  try {
    await fn(req);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}
