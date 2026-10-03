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
  svc.createBookmark({ address: 'https://a.example/', title: 'Rust guide', tags: ['dev', 'rust'] });
  svc.createBookmark({ address: 'https://b.example/', title: 'Rust jobs', tags: ['dev', 'jobs'] });
  svc.createBookmark({ address: 'https://c.example/', title: 'Cooking', tags: ['food'] });
});
after(() => temp.cleanup());

test('create, run, edit, delete a saved search with included/excluded tags', async () => {
  const created = await request(app)
    .post('/api/saved-searches')
    .send({ name: 'Dev not jobs', queryText: '', includedTags: ['dev'], excludedTags: ['jobs'] });
  assert.equal(created.status, 201);
  const id = created.body.savedSearch.id;

  const run = await request(app).get(`/api/saved-searches/${id}/run`);
  assert.equal(run.body.total, 1, 'dev AND not jobs => only the rust guide');
  assert.equal(run.body.items[0].address, 'https://a.example/');

  const edited = await request(app).put(`/api/saved-searches/${id}`).send({ name: 'Renamed' });
  assert.equal(edited.body.savedSearch.name, 'Renamed');

  const del = await request(app).delete(`/api/saved-searches/${id}`);
  assert.equal(del.status, 204);
  const list = await request(app).get('/api/saved-searches');
  assert.equal(list.body.savedSearches.length, 0);
});

test('saved search combines query text with tags', async () => {
  const created = await request(app)
    .post('/api/saved-searches')
    .send({ name: 'Rust dev', queryText: 'rust', includedTags: ['dev'], excludedTags: [] });
  const run = await request(app).get(`/api/saved-searches/${created.body.savedSearch.id}/run`);
  assert.equal(run.body.total, 2);
});
