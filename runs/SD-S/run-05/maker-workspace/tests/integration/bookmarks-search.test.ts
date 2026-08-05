import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb, type DB } from '../../src/server/db';
import { buildApp } from '../../src/server/app';

let db: DB;
let app: FastifyInstance;

beforeEach(async () => {
  db = openDb(':memory:');
  app = buildApp(db);
  await app.ready();
  await app.inject({
    method: 'POST',
    url: '/api/bookmarks',
    payload: { url: 'https://reactjs.org', title: 'React Docs', tags: ['frontend'] },
  });
  await app.inject({
    method: 'POST',
    url: '/api/bookmarks',
    payload: { url: 'https://nodejs.org', title: 'Node Home', tags: ['backend'] },
  });
  await app.inject({
    method: 'POST',
    url: '/api/bookmarks',
    payload: { url: 'https://example.com/cooking', title: 'Best Recipes' },
  });
});

afterEach(async () => {
  await app.close();
  db.close();
});

async function search(q: string) {
  const res = await app.inject({
    method: 'GET',
    url: `/api/bookmarks?q=${encodeURIComponent(q)}`,
  });
  return res.json().bookmarks as { title: string }[];
}

describe('GET /api/bookmarks?q= (FR-007)', () => {
  it('matches on title (case-insensitive)', async () => {
    const r = await search('react');
    expect(r.map((b) => b.title)).toEqual(['React Docs']);
  });

  it('matches on address', async () => {
    const r = await search('cooking');
    expect(r.map((b) => b.title)).toEqual(['Best Recipes']);
  });

  it('matches on tag name', async () => {
    const r = await search('backend');
    expect(r.map((b) => b.title)).toEqual(['Node Home']);
  });

  it('returns an empty array when nothing matches (FR-015)', async () => {
    const r = await search('nonexistentkeyword');
    expect(r).toEqual([]);
  });

  it('trims whitespace and treats blank q as no filter', async () => {
    const r = await search('   ');
    expect(r.length).toBe(3);
  });
});

describe('GET /api/bookmarks/:id (detail)', () => {
  it('returns full fields for an existing bookmark', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/bookmarks/1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('React Docs');
  });

  it('returns 404 for a missing bookmark', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/bookmarks/999' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });
});
