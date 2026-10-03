import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { useTempData, seedBookmarks } from '../helpers/seed.js';

let app;
let temp;

before(async () => {
  temp = useTempData();
  app = (await import('../../src/server/app.js')).createApp();
  await seedBookmarks(600, 'perf');
});
after(() => temp.cleanup());

test('search over 600 bookmarks returns within 1s', async () => {
  const start = Date.now();
  const res = await request(app).get('/api/search?q=perf&sort=title');
  const elapsed = Date.now() - start;
  assert.equal(res.status, 200);
  assert.ok(res.body.total > 0);
  assert.ok(elapsed < 1000, `search took ${elapsed}ms (expected < 1000ms)`);
});

test('sorted list over 600 bookmarks returns within 1s', async () => {
  const start = Date.now();
  const res = await request(app).get('/api/bookmarks?sort=title&view=normal');
  const elapsed = Date.now() - start;
  assert.equal(res.status, 200);
  assert.ok(elapsed < 1000, `list took ${elapsed}ms (expected < 1000ms)`);
});
