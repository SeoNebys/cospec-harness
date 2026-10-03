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

test('editing address to another existing address returns 409', async () => {
  const a = svc.createBookmark({ address: 'https://a.example/', title: 'A' });
  svc.createBookmark({ address: 'https://b.example/', title: 'B' });
  const res = await request(app).patch(`/api/bookmarks/${a.id}`).send({ address: 'https://b.example/' });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'address_conflict');
});

test('delete requires confirmation', async () => {
  const c = svc.createBookmark({ address: 'https://c.example/', title: 'C' });
  const noConfirm = await request(app).delete(`/api/bookmarks/${c.id}`);
  assert.equal(noConfirm.status, 400);
  assert.equal(noConfirm.body.error.code, 'confirm_required');
  const confirmed = await request(app).delete(`/api/bookmarks/${c.id}?confirm=true`);
  assert.equal(confirmed.status, 204);
  const gone = await request(app).get(`/api/bookmarks/${c.id}`);
  assert.equal(gone.status, 404);
});

test('deleting a bookmark cascades its tag links', async () => {
  const d = svc.createBookmark({ address: 'https://d.example/', title: 'D', tags: ['solo'] });
  await request(app).delete(`/api/bookmarks/${d.id}?confirm=true`);
  const tags = await request(app).get('/api/tags');
  assert.ok(!tags.body.tags.some((t) => t.name === 'solo'), 'orphaned tag pruned after delete');
});
