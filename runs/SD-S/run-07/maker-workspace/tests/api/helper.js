// Shared helper for API tests: start the Express app on an ephemeral port
// backed by an in-memory SQLite database. The env var must be set before any
// module reads the DB path, so the app is loaded via dynamic import after we
// set it here. node:test runs each test file in its own process, so each file
// gets an isolated database.

process.env.BOOKMARKS_DB = ':memory:';

export async function startTestServer() {
  const { createApp } = await import('../../src/server.js');
  const { _resetDbForTests } = await import('../../src/db.js');
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  return {
    base,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      _resetDbForTests();
    },
  };
}

export async function jsonRequest(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await res.json() : null;
  return { status: res.status, body };
}
