import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb, type DB } from '../../src/server/db/connection';
import { buildApp } from '../../src/server/app';

// US5: saved searches — CRUD, and that applying re-runs live (FR-021).

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

describe('saved search CRUD (FR-021)', () => {
  it('creates, lists, renames, and deletes; stores the filter definition', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/saved-searches',
      payload: {
        name: 'Dinner ideas',
        queryText: 'pasta',
        filter: { tagsAny: ['recipes', 'dinner'], tagsNot: ['dessert'] },
      },
    });
    expect(create.statusCode).toBe(201);
    const id = create.json().savedSearch.id;
    expect(create.json().savedSearch.filter.tagsAny).toEqual(['recipes', 'dinner']);

    const list = await app.inject({ method: 'GET', url: '/api/saved-searches' });
    expect(list.json().savedSearches).toHaveLength(1);

    const rename = await app.inject({
      method: 'PATCH',
      url: `/api/saved-searches/${id}`,
      payload: { name: 'Weeknight' },
    });
    expect(rename.json().savedSearch.name).toBe('Weeknight');

    const del = await app.inject({ method: 'DELETE', url: `/api/saved-searches/${id}` });
    expect(del.statusCode).toBe(204);
    const after = await app.inject({ method: 'GET', url: '/api/saved-searches' });
    expect(after.json().savedSearches).toHaveLength(0);
  });

  it('rejects a nameless saved search', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/saved-searches',
      payload: { filter: {} },
    });
    expect(res.statusCode).toBe(400);
  });

  it('applying the saved filter re-runs against the live collection', async () => {
    // Save a filter first, THEN add matching bookmarks — proving it is not a frozen result set.
    await app.inject({
      method: 'POST',
      url: '/api/saved-searches',
      payload: { name: 'Recipes', filter: { tagsAny: ['recipes'] } },
    });
    await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: { url: 'https://new.com/', tags: ['recipes'] },
    });

    const saved = (await app.inject({ method: 'GET', url: '/api/saved-searches' })).json()
      .savedSearches[0];
    const applied = await app.inject({
      method: 'GET',
      url: `/api/bookmarks?tagsAny=${saved.filter.tagsAny[0]}`,
    });
    expect(applied.json().total).toBe(1); // the newly-added match shows up
  });
});
