// Shared helper: start the Express app on an ephemeral port with an in-memory DB.
// Each test file runs in its own process (node --test), so the in-memory DB and
// module singletons are isolated per file.

process.env.DB_PATH = ':memory:';

import { createApp } from '../../src/server.js';

export async function startServer() {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  return { server, base, stop: () => new Promise((r) => server.close(r)) };
}

export async function req(base, path, options = {}) {
  const res = await fetch(base + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}
