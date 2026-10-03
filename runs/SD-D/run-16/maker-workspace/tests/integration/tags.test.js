import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { useTempData } from '../helpers/seed.js';

let app;
let svc;
let temp;

before(async () => {
  temp = useTempData();
  svc = await import('../../src/server/services/bookmarks.js');
  app = (await import('../../src/server/app.js')).createApp();
  svc.createBookmark({ address: 'https://a.example/', title: 'A', tags: ['work', 'writing'] });
  svc.createBookmark({ address: 'https://b.example/', title: 'B', tags: ['food'] });
});
after(() => temp.cleanup());

test('GET /api/tags lists tags with counts', async () => {
  const res = await request(app).get('/api/tags');
  assert.equal(res.status, 200);
  const names = res.body.tags.map((t) => t.name).sort();
  assert.deepEqual(names, ['food', 'work', 'writing']);
});

test('GET /api/tags/suggest returns prefix matches', async () => {
  const res = await request(app).get('/api/tags/suggest?prefix=wr');
  assert.deepEqual(res.body.suggestions.sort(), ['writing']);
});

test('adding and removing tags via PATCH updates tag set and prunes unused', async () => {
  const created = svc.createBookmark({ address: 'https://c.example/', title: 'C', tags: ['temp'] });
  await request(app).patch(`/api/bookmarks/${created.id}`).send({ tags: [] });
  const res = await request(app).get('/api/tags');
  assert.ok(!res.body.tags.some((t) => t.name === 'temp'), 'unused tag pruned');
});
