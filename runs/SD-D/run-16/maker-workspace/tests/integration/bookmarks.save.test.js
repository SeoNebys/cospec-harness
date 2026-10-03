import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { useTempData } from '../helpers/seed.js';

let app;
let temp;

before(async () => {
  temp = useTempData();
  const mod = await import('../../src/server/app.js');
  app = mod.createApp();
});

after(() => temp.cleanup());

test('POST /api/bookmarks rejects empty address (400)', async () => {
  const res = await request(app).post('/api/bookmarks').send({ address: '' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'address_required');
});

test('POST /api/bookmarks rejects malformed address (400)', async () => {
  const res = await request(app).post('/api/bookmarks').send({ address: 'not a url' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'address_invalid');
});

test('POST /api/bookmarks creates a bookmark with a title fallback and defaults to unread', async () => {
  const res = await request(app).post('/api/bookmarks').send({ address: 'https://example.com/save-test' });
  assert.equal(res.status, 201);
  assert.equal(res.body.existing, false);
  assert.equal(res.body.bookmark.address, 'https://example.com/save-test');
  assert.ok(res.body.bookmark.title, 'title should be present (captured or address fallback)');
  assert.equal(res.body.bookmark.isUnread, true);
});

test('saving an existing address returns the existing bookmark for editing (dedup)', async () => {
  const first = await request(app).post('/api/bookmarks').send({ address: 'https://example.com/dupe' });
  assert.equal(first.status, 201);
  const second = await request(app).post('/api/bookmarks').send({ address: 'https://example.com/dupe' });
  assert.equal(second.status, 200);
  assert.equal(second.body.existing, true);
  assert.equal(second.body.bookmark.id, first.body.bookmark.id);
});

test('PATCH edits title/description and persists', async () => {
  const created = await request(app).post('/api/bookmarks').send({ address: 'https://example.com/edit' });
  const id = created.body.bookmark.id;
  const patched = await request(app)
    .patch(`/api/bookmarks/${id}`)
    .send({ title: 'My Title', description: 'My description' });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.bookmark.title, 'My Title');
  assert.equal(patched.body.bookmark.description, 'My description');

  const fetched = await request(app).get(`/api/bookmarks/${id}`);
  assert.equal(fetched.body.bookmark.title, 'My Title');
  assert.equal(fetched.body.bookmark.description, 'My description');
});
