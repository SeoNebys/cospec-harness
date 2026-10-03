import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestServer } from '../helpers/server.js';

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()?.(); });

function server() {
  let tick = 0; let id = 0;
  const test = createTestServer(() => `2026-09-16T12:00:0${tick++}.000Z`, () => `20000000-0000-4000-8000-${String(++id).padStart(12, '0')}`);
  cleanups.push(test.cleanup); return test;
}

describe('bookmark maintenance API', () => {
  it('transactionally edits content and replaces tags', async () => {
    const test = server();
    const created = await request(test.app).post('/api/bookmarks').send({ url: 'https://example.com/old', title: 'Old', notes: 'Old notes', tags: ['Old tag'] });
    const updated = await request(test.app).patch(`/api/bookmarks/${created.body.bookmark.id}`).send({ url: 'https://example.com/new', title: 'New', notes: 'New notes', tags: ['New tag'] }).expect(200);
    expect(updated.body.bookmark).toMatchObject({ url: 'https://example.com/new', title: 'New', notes: 'New notes', tags: ['New tag'] });
    expect(updated.body.bookmark.createdAt).toBe(created.body.bookmark.createdAt);
    expect(updated.body.bookmark.updatedAt).not.toBe(created.body.bookmark.updatedAt);
    expect(test.database.prepare("select count(*) as count from tags where normalized_name = 'old tag'").get()).toEqual({ count: 0 });
  });

  it('rejects URL changes that duplicate another active bookmark', async () => {
    const test = server();
    await request(test.app).post('/api/bookmarks').send({ url: 'https://example.com/one', title: 'One' });
    const second = await request(test.app).post('/api/bookmarks').send({ url: 'https://example.com/two', title: 'Two' });
    const response = await request(test.app).patch(`/api/bookmarks/${second.body.bookmark.id}`).send({ url: 'https://example.com/one' }).expect(409);
    expect(response.body.error.code).toBe('DUPLICATE_BOOKMARK');
  });

  it('enforces archive, restore, and archived-only delete transitions', async () => {
    const test = server();
    const created = await request(test.app).post('/api/bookmarks').send({ url: 'https://example.com/lifecycle', title: 'Lifecycle', tags: ['Temporary'] });
    const id = created.body.bookmark.id;
    expect((await request(test.app).delete(`/api/bookmarks/${id}`).expect(409)).body.error.code).toBe('BOOKMARK_NOT_ARCHIVED');
    const archived = await request(test.app).post(`/api/bookmarks/${id}/archive`).expect(200);
    expect(archived.body.bookmark).toMatchObject({ status: 'archived' });
    expect(archived.body.bookmark.archivedAt).not.toBeNull();
    expect((await request(test.app).post(`/api/bookmarks/${id}/archive`).expect(409)).body.error.code).toBe('BOOKMARK_ALREADY_ARCHIVED');
    const restored = await request(test.app).post(`/api/bookmarks/${id}/restore`).expect(200);
    expect(restored.body.bookmark).toMatchObject({ status: 'active', archivedAt: null, tags: ['Temporary'] });
    expect((await request(test.app).post(`/api/bookmarks/${id}/restore`).expect(409)).body.error.code).toBe('BOOKMARK_ALREADY_ACTIVE');
    await request(test.app).post(`/api/bookmarks/${id}/archive`).expect(200);
    await request(test.app).delete(`/api/bookmarks/${id}`).expect(204);
    await request(test.app).patch(`/api/bookmarks/${id}`).send({ title: 'Gone' }).expect(404);
    expect(test.database.prepare('select count(*) as count from tags').get()).toEqual({ count: 0 });
  });
});
