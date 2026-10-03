import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestServer } from '../helpers/server.js';

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()?.(); });

function server() {
  let tick = 0;
  let id = 0;
  const test = createTestServer(
    () => `2026-09-16T12:00:0${tick++}.000Z`,
    () => `10000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
  );
  cleanups.push(test.cleanup);
  return test;
}

async function create(app: Parameters<typeof request>[0], title: string, path: string, notes: string, tags: string[]) {
  return request(app).post('/api/bookmarks').send({ url: `https://example.com/${path}`, title, notes, tags }).expect(201);
}

describe('bookmark query API', () => {
  it('searches title, URL, notes, and tags case-insensitively and treats wildcards literally', async () => {
    const test = server();
    await create(test.app, 'Design systems', 'patterns', 'A practical handbook', ['UX']);
    await create(test.app, 'Cooking', 'pasta-guide', 'Weeknight food', ['Recipes']);
    expect((await request(test.app).get('/api/bookmarks?q=DESIGN')).body.total).toBe(1);
    expect((await request(test.app).get('/api/bookmarks?q=pasta')).body.total).toBe(1);
    expect((await request(test.app).get('/api/bookmarks?q=handbook')).body.total).toBe(1);
    expect((await request(test.app).get('/api/bookmarks?q=ux')).body.total).toBe(1);
    expect((await request(test.app).get('/api/bookmarks?q=%25')).body.total).toBe(0);
  });

  it('combines tag and favorite criteria and returns scope-aware tags', async () => {
    const test = server();
    const first = await create(test.app, 'Favorite UX', 'favorite', '', ['UX', 'Work']);
    await create(test.app, 'Other UX', 'other', '', ['UX']);
    await request(test.app).patch(`/api/bookmarks/${first.body.bookmark.id}`).send({ isFavorite: true }).expect(200);
    const filtered = await request(test.app).get('/api/bookmarks?tag=UX&favorite=true').expect(200);
    expect(filtered.body.items.map((item: { title: string }) => item.title)).toEqual(['Favorite UX']);
    expect(filtered.body.availableTags).toEqual(['UX', 'Work']);
  });

  it('supports all deterministic sort orders', async () => {
    const test = server();
    const beta = await create(test.app, 'Beta', 'beta', '', []);
    await create(test.app, 'Alpha', 'alpha', '', []);
    expect((await request(test.app).get('/api/bookmarks?sort=newest')).body.items[0].title).toBe('Alpha');
    expect((await request(test.app).get('/api/bookmarks?sort=oldest')).body.items[0].title).toBe('Beta');
    expect((await request(test.app).get('/api/bookmarks?sort=title')).body.items[0].title).toBe('Alpha');
    await request(test.app).patch(`/api/bookmarks/${beta.body.bookmark.id}`).send({ isFavorite: true });
    expect((await request(test.app).get('/api/bookmarks?sort=updated')).body.items[0].title).toBe('Beta');
  });
});
