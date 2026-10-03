import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { useTempData } from '../helpers/seed.js';

let app;
let temp;

before(async () => {
  temp = useTempData();
  app = (await import('../../src/server/app.js')).createApp();
});
after(() => temp.cleanup());

test('GET /api/preferences returns defaults', async () => {
  const res = await request(app).get('/api/preferences');
  assert.equal(res.status, 200);
  assert.equal(res.body.defaultSort, 'newest');
  assert.equal(res.body.itemsShown, 50);
  assert.equal(res.body.textSize, 'medium');
});

test('PUT /api/preferences persists valid values', async () => {
  const res = await request(app).put('/api/preferences').send({ defaultSort: 'title', itemsShown: 25, textSize: 'large' });
  assert.equal(res.status, 200);
  assert.equal(res.body.defaultSort, 'title');
  const again = await request(app).get('/api/preferences');
  assert.equal(again.body.itemsShown, 25);
  assert.equal(again.body.textSize, 'large');
});

test('PUT /api/preferences rejects invalid values', async () => {
  assert.equal((await request(app).put('/api/preferences').send({ defaultSort: 'bogus' })).status, 400);
  assert.equal((await request(app).put('/api/preferences').send({ textSize: 'huge' })).status, 400);
  assert.equal((await request(app).put('/api/preferences').send({ itemsShown: 0 })).status, 400);
});
