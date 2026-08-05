import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb, type DB } from '../../src/server/db';
import { buildApp } from '../../src/server/app';

let db: DB;
let app: FastifyInstance;

async function create(payload: Record<string, unknown>) {
  const res = await app.inject({ method: 'POST', url: '/api/bookmarks', payload });
  return res.json();
}

async function tags() {
  const res = await app.inject({ method: 'GET', url: '/api/tags' });
  return res.json().tags as { id: number; name: string; count: number }[];
}

beforeEach(async () => {
  db = openDb(':memory:');
  app = buildApp(db);
  await app.ready();
});

afterEach(async () => {
  await app.close();
  db.close();
});

describe('GET /api/tags (FR-010)', () => {
  it('lists tags with a count of active bookmarks carrying each', async () => {
    await create({ url: 'https://a.com', title: 'A', tags: ['work', 'reading'] });
    await create({ url: 'https://b.com', title: 'B', tags: ['work'] });
    const list = await tags();
    const work = list.find((t) => t.name === 'work');
    const reading = list.find((t) => t.name === 'reading');
    expect(work?.count).toBe(2);
    expect(reading?.count).toBe(1);
  });

  it('treats tag names case-insensitively (Work == work)', async () => {
    await create({ url: 'https://a.com', title: 'A', tags: ['Work'] });
    await create({ url: 'https://b.com', title: 'B', tags: ['work'] });
    const list = await tags();
    expect(list.filter((t) => t.name.toLowerCase() === 'work')).toHaveLength(1);
    expect(list[0].count).toBe(2);
  });
});

describe('PATCH /api/tags/:id — rename propagation (FR-009)', () => {
  it('renames the tag on every bookmark carrying it', async () => {
    await create({ url: 'https://a.com', title: 'A', tags: ['js'] });
    await create({ url: 'https://b.com', title: 'B', tags: ['js'] });
    const js = (await tags()).find((t) => t.name === 'js')!;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tags/${js.id}`,
      payload: { name: 'javascript' },
    });
    expect(res.statusCode).toBe(200);

    const list = await tags();
    expect(list.find((t) => t.name === 'javascript')?.count).toBe(2);
    expect(list.find((t) => t.name === 'js')).toBeUndefined();
  });

  it('merges into an existing tag when renamed to a name already in use', async () => {
    await create({ url: 'https://a.com', title: 'A', tags: ['js'] });
    await create({ url: 'https://b.com', title: 'B', tags: ['javascript'] });
    const js = (await tags()).find((t) => t.name === 'js')!;

    await app.inject({
      method: 'PATCH',
      url: `/api/tags/${js.id}`,
      payload: { name: 'JavaScript' },
    });

    const list = await tags();
    const merged = list.filter((t) => t.name.toLowerCase() === 'javascript');
    expect(merged).toHaveLength(1);
    expect(merged[0].count).toBe(2);
  });
});

describe('DELETE /api/tags/:id — remove propagation (FR-009)', () => {
  it('removes the tag from all bookmarks that carry it', async () => {
    const a = await create({ url: 'https://a.com', title: 'A', tags: ['temp', 'keep'] });
    await create({ url: 'https://b.com', title: 'B', tags: ['temp'] });
    const temp = (await tags()).find((t) => t.name === 'temp')!;

    const res = await app.inject({ method: 'DELETE', url: `/api/tags/${temp.id}` });
    expect(res.statusCode).toBe(200);

    expect((await tags()).find((t) => t.name === 'temp')).toBeUndefined();
    const detail = await app.inject({ method: 'GET', url: `/api/bookmarks/${a.id}` });
    expect(detail.json().tags).toEqual(['keep']);
  });
});
