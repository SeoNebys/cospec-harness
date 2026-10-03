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

test('bulk addTags on an explicit id selection', async () => {
  const a = svc.createBookmark({ address: 'https://a.example/', title: 'A' });
  const b = svc.createBookmark({ address: 'https://b.example/', title: 'B' });
  const res = await request(app)
    .post('/api/bookmarks/bulk')
    .send({ select: { ids: [a.id, b.id] }, action: { type: 'addTags', tags: ['batch'] } });
  assert.equal(res.body.affected, 2);
  const list = await request(app).get('/api/bookmarks?tag=batch');
  assert.equal(list.body.total, 2);
});

test('bulk setArchived on all matching a search (including off-screen)', async () => {
  for (let i = 0; i < 5; i++) svc.createBookmark({ address: `https://m.example/${i}`, title: `matchme ${i}` });
  const res = await request(app)
    .post('/api/bookmarks/bulk')
    .send({ select: { matching: { q: 'matchme' } }, action: { type: 'setArchived', value: true } });
  assert.equal(res.body.affected, 5);
  const archived = await request(app).get('/api/bookmarks?view=archived');
  assert.ok(archived.body.total >= 5);
});

test('bulk delete requires confirmation', async () => {
  const c = svc.createBookmark({ address: 'https://c.example/', title: 'C' });
  const noConfirm = await request(app)
    .post('/api/bookmarks/bulk')
    .send({ select: { ids: [c.id] }, action: { type: 'delete' } });
  assert.equal(noConfirm.status, 400);
  const confirmed = await request(app)
    .post('/api/bookmarks/bulk')
    .send({ select: { ids: [c.id] }, action: { type: 'delete', confirm: true } });
  assert.equal(confirmed.body.affected, 1);
});

test('bulk action scales to 100+ items', async () => {
  const ids = [];
  for (let i = 0; i < 120; i++) ids.push(svc.createBookmark({ address: `https://big.example/${i}`, title: `big ${i}` }).id);
  const res = await request(app)
    .post('/api/bookmarks/bulk')
    .send({ select: { ids }, action: { type: 'setUnread', value: false } });
  assert.equal(res.body.affected, 120);
});
