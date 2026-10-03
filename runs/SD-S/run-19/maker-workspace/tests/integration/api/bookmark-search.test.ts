import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BookmarkDatabase } from '../../../src/server/db/client.js';
import { openDatabase } from '../../../src/server/db/client.js';
import { createApp } from '../../../src/server/app.js';

let database: BookmarkDatabase;
beforeEach(() => { database = openDatabase(':memory:'); });
afterEach(() => database.close());

describe('search and tag API', () => {
  it('filters by text and tag and lists tag counts', async () => {
    const app = createApp({ database, staticDirectory: false });
    await request(app).post('/api/bookmarks').send({ url: 'https://one.example', title: 'Alpha guide', description: 'Design systems', tags: ['Research'] }).expect(201);
    await request(app).post('/api/bookmarks').send({ url: 'https://two.example', title: 'Beta recipe', description: 'Kitchen notes', tags: ['Weekend', 'research'] }).expect(201);
    await request(app).get('/api/bookmarks').query({ q: 'DESIGN', tag: ' research ' }).expect(200).expect(({ body }) => {
      expect(body.items.map(({ title }: { title: string }) => title)).toEqual(['Alpha guide']);
    });
    await request(app).get('/api/tags').expect(200).expect(({ body }) => {
      expect(body.items).toEqual([{ name: 'Research', count: 2 }, { name: 'Weekend', count: 1 }]);
    });
  });

  it('validates query and filter limits and returns a valid empty result', async () => {
    const app = createApp({ database, staticDirectory: false });
    await request(app).get('/api/bookmarks').query({ q: 'x'.repeat(201) }).expect(422);
    await request(app).get('/api/bookmarks').query({ tag: 'x'.repeat(51) }).expect(422);
    await request(app).get('/api/bookmarks').query({ q: 'missing' }).expect(200, { items: [], total: 0 });
  });
});
