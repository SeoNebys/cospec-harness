import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb, type DB } from '../../src/server/db/connection';
import { buildApp } from '../../src/server/app';

// US6: an export from one collection, imported into an empty one, restores
// everything intact — including original saved/modified dates and sort order
// (FR-028, SC-008).

let srcDb: DB;
let src: FastifyInstance;

beforeEach(async () => {
  srcDb = openDb(':memory:');
  src = buildApp({ db: srcDb, enrich: () => {} });
  await src.ready();
});

afterEach(async () => {
  await src.close();
  srcDb.close();
});

describe('export → import round-trip (SC-008)', () => {
  it('restores bookmarks, tags, notes, flags, and original dates identically', async () => {
    // Seed three bookmarks, then force distinct known dates so sort-by-oldest is meaningful.
    await src.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: { url: 'https://one.com/', title: 'One', notes: 'first', tags: ['a'] },
    });
    await src.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: { url: 'https://two.com/', title: 'Two', tags: ['a', 'b'] },
    });
    await src.inject({
      method: 'POST',
      url: '/api/bookmarks',
      payload: { url: 'https://three.com/', title: 'Three' },
    });
    srcDb
      .prepare('UPDATE bookmarks SET created_at = ?, updated_at = ? WHERE url = ?')
      .run('2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z', 'https://one.com/');
    srcDb
      .prepare('UPDATE bookmarks SET created_at = ?, updated_at = ? WHERE url = ?')
      .run('2021-06-15T00:00:00.000Z', '2021-06-15T00:00:00.000Z', 'https://two.com/');
    srcDb
      .prepare('UPDATE bookmarks SET created_at = ?, updated_at = ? WHERE url = ?')
      .run('2022-12-31T00:00:00.000Z', '2022-12-31T00:00:00.000Z', 'https://three.com/');
    // Flags: archive three, read-later one.
    srcDb.prepare('UPDATE bookmarks SET archived = 1 WHERE url = ?').run('https://three.com/');
    srcDb.prepare('UPDATE bookmarks SET read_later = 1 WHERE url = ?').run('https://one.com/');

    const exp = await src.inject({ method: 'GET', url: '/api/export' });
    expect(exp.statusCode).toBe(200);
    const doc = exp.json();
    expect(doc.format).toBe('bookmark-manager-export');
    expect(doc.bookmarks).toHaveLength(3);

    // Fresh, empty target collection.
    const tgtDb = openDb(':memory:');
    const tgt = buildApp({ db: tgtDb, enrich: () => {} });
    await tgt.ready();

    const imp = await tgt.inject({ method: 'POST', url: '/api/import', payload: doc });
    expect(imp.statusCode).toBe(200);
    expect(imp.json()).toMatchObject({ added: 3, alreadyPresent: 0 });

    // Sort-by-oldest order must match the original chronology.
    const oldest = await tgt.inject({ method: 'GET', url: '/api/bookmarks?view=all&sort=oldest' });
    // 'three' is archived, so the 'all' view (non-archived) shows one, two oldest-first.
    expect(oldest.json().bookmarks.map((b: { title: string }) => b.title)).toEqual(['One', 'Two']);

    // Dates preserved exactly (FR-028).
    const two = oldest.json().bookmarks.find((b: { title: string }) => b.title === 'Two');
    expect(two.createdAt).toBe('2021-06-15T00:00:00.000Z');

    // Flags and tags preserved.
    const readLater = await tgt.inject({ method: 'GET', url: '/api/bookmarks?view=readLater' });
    expect(readLater.json().bookmarks.map((b: { title: string }) => b.title)).toEqual(['One']);
    const archived = await tgt.inject({ method: 'GET', url: '/api/bookmarks?view=archived' });
    expect(archived.json().bookmarks.map((b: { title: string }) => b.title)).toEqual(['Three']);
    const twoTags = oldest.json().bookmarks.find((b: { title: string }) => b.title === 'Two');
    expect(twoTags.tags).toEqual(['a', 'b']);

    await tgt.close();
    tgtDb.close();
  });

  it('exports an empty collection as a valid document', async () => {
    const exp = await src.inject({ method: 'GET', url: '/api/export' });
    expect(exp.statusCode).toBe(200);
    expect(exp.json().bookmarks).toEqual([]);
    expect(exp.json().savedSearches).toEqual([]);
  });
});
