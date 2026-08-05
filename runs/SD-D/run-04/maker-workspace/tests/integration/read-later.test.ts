import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb, type DB } from '../../src/server/db/connection';
import { buildApp } from '../../src/server/app';

// US4: the read-later flag and its dedicated view (FR-015).

let db: DB;
let app: FastifyInstance;

beforeEach(async () => {
  db = openDb(':memory:');
  app = buildApp({ db, enrich: () => {} });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  db.close();
});

async function create(url: string): Promise<number> {
  const res = await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url } });
  return res.json().bookmark.id;
}
async function readLaterTitles(): Promise<string[]> {
  const res = await app.inject({ method: 'GET', url: '/api/bookmarks?view=readLater' });
  return res.json().bookmarks.map((b: { url: string }) => b.url);
}

describe('read-later flag + view (FR-015)', () => {
  it('shows only flagged, non-archived bookmarks in the read-later view', async () => {
    const a = await create('https://a.com/');
    await create('https://b.com/');
    expect(await readLaterTitles()).toEqual([]);

    await app.inject({ method: 'PATCH', url: `/api/bookmarks/${a}`, payload: { readLater: true } });
    expect(await readLaterTitles()).toEqual(['https://a.com/']);
  });

  it('clearing the flag drops it from the view but keeps it in the collection', async () => {
    const a = await create('https://a.com/');
    await app.inject({ method: 'PATCH', url: `/api/bookmarks/${a}`, payload: { readLater: true } });
    await app.inject({
      method: 'PATCH',
      url: `/api/bookmarks/${a}`,
      payload: { readLater: false },
    });

    expect(await readLaterTitles()).toEqual([]);
    const all = await app.inject({ method: 'GET', url: '/api/bookmarks?view=all' });
    expect(all.json().total).toBe(1); // still in the collection
  });

  it('an archived read-later bookmark does not appear in the read-later view', async () => {
    const a = await create('https://a.com/');
    await app.inject({
      method: 'PATCH',
      url: `/api/bookmarks/${a}`,
      payload: { readLater: true, archived: true },
    });
    expect(await readLaterTitles()).toEqual([]);
  });
});
