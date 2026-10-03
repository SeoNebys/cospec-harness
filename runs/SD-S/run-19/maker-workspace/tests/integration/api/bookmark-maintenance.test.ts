import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BookmarkDatabase } from '../../../src/server/db/client.js';
import { openDatabase } from '../../../src/server/db/client.js';
import { createApp } from '../../../src/server/app.js';

let database: BookmarkDatabase;
beforeEach(() => { database = openDatabase(':memory:'); });
afterEach(() => database.close());

describe('bookmark maintenance API', () => {
  it('partially updates and deletes a bookmark', async () => {
    const app = createApp({ database, staticDirectory: false });
    const created = await request(app).post('/api/bookmarks').send({ url: 'https://one.example', title: 'One', tags: ['Old'] }).expect(201);
    await request(app).patch(`/api/bookmarks/${created.body.id}`).send({ title: 'Updated', tags: ['Fresh'] }).expect(200).expect(({ body }) => {
      expect(body).toMatchObject({ title: 'Updated', tags: ['Fresh'] });
    });
    await request(app).delete(`/api/bookmarks/${created.body.id}`).expect(204);
    await request(app).delete(`/api/bookmarks/${created.body.id}`).expect(404);
  });

  it('returns validation, not-found, and duplicate responses', async () => {
    const app = createApp({ database, staticDirectory: false });
    const first = await request(app).post('/api/bookmarks').send({ url: 'https://one.example', title: 'One', tags: [] }).expect(201);
    const second = await request(app).post('/api/bookmarks').send({ url: 'https://two.example', title: 'Two', tags: [] }).expect(201);
    await request(app).patch(`/api/bookmarks/${second.body.id}`).send({ url: first.body.url }).expect(409);
    await request(app).patch(`/api/bookmarks/${second.body.id}`).send({ url: first.body.url, allowDuplicate: true }).expect(200);
    await request(app).patch(`/api/bookmarks/${second.body.id}`).send({ title: '' }).expect(422);
    await request(app).patch('/api/bookmarks/9999').send({ title: 'Missing' }).expect(404);
  });
});
