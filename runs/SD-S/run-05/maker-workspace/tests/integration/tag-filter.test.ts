import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb, type DB } from '../../src/server/db';
import { buildApp } from '../../src/server/app';

let db: DB;
let app: FastifyInstance;

async function create(payload: Record<string, unknown>) {
  await app.inject({ method: 'POST', url: '/api/bookmarks', payload });
}

beforeEach(async () => {
  db = openDb(':memory:');
  app = buildApp(db);
  await app.ready();
  await create({ url: 'https://a.com', title: 'A', tags: ['work'] });
  await create({ url: 'https://b.com', title: 'B', tags: ['work', 'reading'] });
  await create({ url: 'https://c.com', title: 'C', tags: ['reading'] });
  await create({ url: 'https://d.com', title: 'D' });
});

afterEach(async () => {
  await app.close();
  db.close();
});

async function byTag(tag: string) {
  const res = await app.inject({
    method: 'GET',
    url: `/api/bookmarks?tag=${encodeURIComponent(tag)}`,
  });
  return (res.json().bookmarks as { title: string }[]).map((b) => b.title);
}

describe('GET /api/bookmarks?tag= (FR-010)', () => {
  it('returns only bookmarks carrying the tag', async () => {
    expect((await byTag('work')).sort()).toEqual(['A', 'B']);
    expect((await byTag('reading')).sort()).toEqual(['B', 'C']);
  });

  it('is case-insensitive on the tag name', async () => {
    expect((await byTag('WORK')).sort()).toEqual(['A', 'B']);
  });

  it('returns empty for an unused tag', async () => {
    expect(await byTag('nope')).toEqual([]);
  });

  it('combines tag filter with keyword search', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/bookmarks?tag=work&q=B',
    });
    expect((res.json().bookmarks as { title: string }[]).map((b) => b.title)).toEqual([
      'B',
    ]);
  });
});
