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

test('new bookmarks default to unread and appear in the unread view', async () => {
  svc.createBookmark({ address: 'https://u1.example/', title: 'U1' });
  const res = await request(app).get('/api/bookmarks?view=unread');
  assert.equal(res.body.total, 1);
  assert.equal(res.body.items[0].isUnread, true);
});

test('marking read removes it from the unread view', async () => {
  const b = svc.createBookmark({ address: 'https://u2.example/', title: 'U2' });
  await request(app).patch(`/api/bookmarks/${b.id}`).send({ isUnread: false });
  const unread = await request(app).get('/api/bookmarks?view=unread');
  assert.ok(!unread.body.items.some((x) => x.id === b.id));
  const all = await request(app).get('/api/bookmarks?view=normal');
  assert.ok(all.body.items.some((x) => x.id === b.id));
});
