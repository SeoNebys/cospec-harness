// T065: data persists across a server restart (SC-004); archive→restore keeps
// tags, notes, and saved copies (SC-007).
import { test, expect } from '@playwright/test';
import { startApp, startFixtureSite, stop, FIXTURE_BASE } from './helpers/servers.js';

let app, fixture, dataDir;
test.beforeAll(async () => {
  fixture = await startFixtureSite();
  app = await startApp();
  dataDir = app.dataDir;
});
test.afterAll(async () => { await stop(app?.child); await new Promise((r) => fixture?.server.close(r)); });

test('bookmarks and their data survive a server restart', async ({ request }) => {
  const b = await (await request.post('/api/bookmarks', { data: { url: `${FIXTURE_BASE}/article`, title: 'Persisted' } })).json();
  await request.patch(`/api/bookmarks/${b.id}`, { data: { tags: ['keepme'], note: 'a durable note' } });

  // Restart the app against the SAME data directory.
  await stop(app.child);
  app = await startApp({ BM_DATA_DIR: dataDir });

  const fresh = await (await request.get(`/api/bookmarks/${b.id}`)).json();
  expect(fresh.title).toBe('Persisted');
  expect(fresh.tags).toContain('keepme');
  expect(fresh.note).toBe('a durable note');
});

test('archive then restore preserves tags, note, and saved copies (SC-007)', async ({ request }) => {
  const b = await (await request.post('/api/bookmarks', { data: { url: `${FIXTURE_BASE}/page-with-assets`, title: 'Round trip' } })).json();
  await request.patch(`/api/bookmarks/${b.id}`, { data: { tags: ['t1', 't2'], note: 'keep this note' } });
  await request.post(`/api/bookmarks/${b.id}/snapshot`);

  await request.post(`/api/bookmarks/${b.id}/archive`);
  await request.post(`/api/bookmarks/${b.id}/restore`);

  const fresh = await (await request.get(`/api/bookmarks/${b.id}`)).json();
  expect(fresh.is_archived).toBe(false);
  expect(fresh.tags.sort()).toEqual(['t1', 't2']);
  expect(fresh.note).toBe('keep this note');
  expect(fresh.saved_copies.length).toBeGreaterThan(0);
});
