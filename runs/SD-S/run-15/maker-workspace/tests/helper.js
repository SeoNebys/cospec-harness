import { openDatabase } from '../src/db/connection.js';
import { createApp } from '../src/server.js';

/**
 * Boot the app with a fresh in-memory database on an ephemeral port.
 * Returns { base, close } where base is the http://127.0.0.1:PORT origin.
 */
export async function startTestServer() {
  const db = openDatabase(':memory:');
  const app = createApp(db);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((r) => server.close(r));
      db.close();
    },
  };
}

export async function req(base, path, options = {}) {
  const res = await fetch(`${base}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, body };
}
