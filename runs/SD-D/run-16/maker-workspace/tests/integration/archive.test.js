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
});
after(() => temp.cleanup());

test('archiving hides from normal list and search, shows in archived view, and restores', async () => {
  const b = svc.createBookmark({ address: 'https://arch.example/unique-term', title: 'Archive me', tags: ['keep'] });

  await request(app).patch(`/api/bookmarks/${b.id}`).send({ isArchived: true });

  const normal = await request(app).get('/api/bookmarks?view=normal');
  assert.ok(!normal.body.items.some((x) => x.id === b.id), 'excluded from normal list');

  const search = await request(app).get('/api/search?q=unique-term');
  assert.equal(search.body.total, 0, 'excluded from search');

  const archived = await request(app).get('/api/bookmarks?view=archived');
  assert.ok(archived.body.items.some((x) => x.id === b.id), 'present in archived view');

  await request(app).patch(`/api/bookmarks/${b.id}`).send({ isArchived: false });
  const restored = await request(app).get('/api/bookmarks?view=normal');
  assert.ok(restored.body.items.some((x) => x.id === b.id), 'restored to normal list');
});

test('archive is independent of delete (archived item still retrievable)', async () => {
  const b = svc.createBookmark({ address: 'https://arch2.example/', title: 'Still here' });
  await request(app).patch(`/api/bookmarks/${b.id}`).send({ isArchived: true });
  const res = await request(app).get(`/api/bookmarks/${b.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.bookmark.isArchived, true);
});
