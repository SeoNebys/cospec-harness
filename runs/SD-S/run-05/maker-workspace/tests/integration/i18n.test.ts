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
});

afterEach(async () => {
  await app.close();
  db.close();
});

describe('Special-character / non-Latin handling (edge case)', () => {
  it('preserves and finds non-Latin titles and tags', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: {
        url: 'https://example.jp',
        title: '日本語のタイトル',
        tags: ['料理', 'café'],
      },
    });

    // Title is stored verbatim.
    const detail = (await app.inject({ method: 'GET', url: '/api/bookmarks/1' })).json();
    expect(detail.title).toBe('日本語のタイトル');
    expect(detail.tags.sort()).toEqual(['café', '料理']);

    // Searchable by a non-Latin substring of the title.
    const byTitle = (
      await app.inject({ method: 'GET', url: '/api/bookmarks?q=' + encodeURIComponent('タイトル') })
    ).json();
    expect(byTitle.bookmarks).toHaveLength(1);

    // Searchable by a non-Latin tag name.
    const byTag = (
      await app.inject({ method: 'GET', url: '/api/bookmarks?q=' + encodeURIComponent('料理') })
    ).json();
    expect(byTag.bookmarks).toHaveLength(1);
  });
});
