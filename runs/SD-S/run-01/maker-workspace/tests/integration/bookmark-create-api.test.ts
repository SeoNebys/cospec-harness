import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestServer } from '../helpers/server.js';

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()?.(); });

function server() {
  let id = 0;
  const test = createTestServer(() => '2026-09-16T12:00:00.000Z', () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`);
  cleanups.push(test.cleanup);
  return test;
}

describe('create and list API', () => {
  it('creates, persists, and lists bookmark details and normalized tags', async () => {
    const test = server();
    const created = await request(test.app).post('/api/bookmarks').send({
      url: ' HTTPS://EXAMPLE.COM:443/guide ', title: '  A useful guide  ', notes: '  Return later  ', tags: [' Web  Design ', 'web design', 'Research'],
    }).expect(201);
    expect(created.body.bookmark).toMatchObject({ url: 'https://example.com/guide', title: 'A useful guide', notes: 'Return later', tags: ['Research', 'Web Design'], status: 'active' });
    const listed = await request(test.app).get('/api/bookmarks').expect(200);
    expect(listed.body.total).toBe(1);
    expect(listed.body.items[0].id).toBe(created.body.bookmark.id);
    expect(listed.body.availableTags).toEqual(['Research', 'Web Design']);
  });

  it('returns actionable validation errors', async () => {
    const test = server();
    const response = await request(test.app).post('/api/bookmarks').send({ url: 'ftp://example.com', title: '' }).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.fieldErrors).toHaveProperty('url');
    expect(response.body.error.fieldErrors).toHaveProperty('title');
  });

  it('requires an explicit override for active duplicates', async () => {
    const test = server();
    await request(test.app).post('/api/bookmarks').send({ url: 'https://example.com', title: 'First' }).expect(201);
    const duplicate = await request(test.app).post('/api/bookmarks').send({ url: 'https://EXAMPLE.com:443/', title: 'Second' }).expect(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_BOOKMARK');
    expect(duplicate.body.error.details.existingBookmark.title).toBe('First');
    await request(test.app).post('/api/bookmarks').send({ url: 'https://example.com/', title: 'Second', allowDuplicate: true }).expect(201);
    expect((await request(test.app).get('/api/bookmarks')).body.total).toBe(2);
  });

  it('does not let an archived match block a new save', async () => {
    const test = server();
    const created = await request(test.app).post('/api/bookmarks').send({ url: 'https://example.com/archived', title: 'Old' });
    await request(test.app).post(`/api/bookmarks/${created.body.bookmark.id}/archive`).expect(200);
    await request(test.app).post('/api/bookmarks').send({ url: 'https://example.com/archived', title: 'New' }).expect(201);
  });

  it('returns a safe internal error if persistence fails', async () => {
    const test = server();
    test.database.close();
    const response = await request(test.app).get('/api/bookmarks').expect(500);
    expect(response.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
  });
});
