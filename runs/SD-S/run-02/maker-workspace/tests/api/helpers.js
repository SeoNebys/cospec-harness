import { openDatabase } from '../../src/db.js';
import { createApp } from '../../src/server.js';

/**
 * Start the app on an ephemeral port against an in-memory DB, with an injectable
 * enrichment stub so API tests are hermetic (no network).
 * Returns { base, server, close }.
 */
export async function startTestApp({ enrich } = {}) {
  const db = openDatabase(':memory:');
  const stubEnrich =
    enrich ||
    (async () => ({ ok: true, title: 'Stub Title', description: 'Stub desc',
      faviconUrl: 'https://x/favicon.ico', previewUrl: 'https://x/p.png' }));
  const app = createApp(db, { enrich: stubEnrich });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    server,
    db,
    close: async () => {
      // Drain any in-flight enrichment before closing the DB so its native
      // statements don't finalize against a closed handle.
      await Promise.allSettled([...app.locals.pendingEnrichment]);
      await new Promise((r) => server.close(r));
      try { db.close(); } catch { /* ignore */ }
    },
  };
}

export async function req(base, path, options = {}) {
  const res = await fetch(base + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let body = null;
  if (res.status !== 204) {
    try { body = await res.json(); } catch { body = null; }
  }
  return { status: res.status, body };
}

// Wait until a bookmark's enrichment status leaves 'pending'.
export async function waitForEnrichment(base, id, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { body } = await req(base, `/api/bookmarks/${id}`);
    if (body && body.enrichmentStatus !== 'pending') return body;
    await new Promise((r) => setTimeout(r, 25));
  }
  const { body } = await req(base, `/api/bookmarks/${id}`);
  return body;
}
