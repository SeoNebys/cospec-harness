import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb, type DB } from '../../src/server/db/connection';
import { buildApp } from '../../src/server/app';

// US6: importing into a non-empty collection merges by normalized address without
// duplicating (FR-029), and an invalid file changes nothing (FR-030).

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

async function count(): Promise<number> {
  const res = await app.inject({ method: 'GET', url: '/api/bookmarks?view=all' });
  return res.json().total;
}

describe('import merge (FR-029)', () => {
  it('does not duplicate an existing address and merges its tags', async () => {
    // Existing: example.com with tag "old".
    await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: { url: 'https://example.com/', tags: ['old'] },
    });

    const doc = {
      format: 'bookmark-manager-export',
      version: 1,
      exportedAt: '2023-01-01T00:00:00.000Z',
      bookmarks: [
        {
          url: 'example.com',
          title: 'Dup',
          tags: ['new'],
          createdAt: '2019-01-01T00:00:00.000Z',
          updatedAt: '2019-01-01T00:00:00.000Z',
        },
        {
          url: 'https://fresh.com/',
          title: 'Fresh',
          tags: ['x'],
          createdAt: '2019-02-02T00:00:00.000Z',
          updatedAt: '2019-02-02T00:00:00.000Z',
        },
      ],
      savedSearches: [],
    };

    const imp = await app.inject({ method: 'POST', url: '/api/import', payload: doc });
    expect(imp.statusCode).toBe(200);
    expect(imp.json()).toMatchObject({ added: 1, alreadyPresent: 1 });

    expect(await count()).toBe(2); // example.com merged, fresh.com added — no duplicate

    const list = await app.inject({ method: 'GET', url: '/api/bookmarks?tagsAll=old&tagsAll=new' });
    // The pre-existing example.com now carries BOTH old and new tags.
    expect(list.json().bookmarks.map((b: { url: string }) => b.url)).toEqual([
      'https://example.com/',
    ]);
  });
});

describe('invalid import leaves the collection unchanged (FR-030)', () => {
  it('rejects a non-export file with 400 and no changes', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: { url: 'https://keep.com/' },
    });
    const before = await count();

    const res = await app.inject({
      method: 'POST',
      url: '/api/import',
      payload: { hello: 'world' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBeTruthy();
    expect(await count()).toBe(before);
  });

  it('rolls back entirely if a bookmark entry is malformed', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: { url: 'https://keep.com/' },
    });
    const before = await count();

    const doc = {
      format: 'bookmark-manager-export',
      version: 1,
      exportedAt: '2023-01-01T00:00:00.000Z',
      bookmarks: [
        { url: 'https://good.com/', title: 'Good' },
        { title: 'No URL here' }, // malformed → whole import must roll back
      ],
      savedSearches: [],
    };
    const res = await app.inject({ method: 'POST', url: '/api/import', payload: doc });
    expect(res.statusCode).toBe(400);
    // good.com must NOT have been added — transaction rolled back.
    expect(await count()).toBe(before);
  });
});
