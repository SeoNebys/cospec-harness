import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/data/db';
import { add, get, list } from '../../src/data/bookmarkRepository';

beforeEach(async () => {
  await db.bookmarks.clear();
});

describe('list (default ordering)', () => {
  it('returns all bookmarks most-recent-first (FR-014)', async () => {
    const first = await add({ url: 'example.com/1', title: 'First' });
    // ensure a strictly later timestamp for the second bookmark
    await new Promise((r) => setTimeout(r, 5));
    const second = await add({ url: 'example.com/2', title: 'Second' });

    const results = await list();
    expect(results.map((b) => b.id)).toEqual([second.id, first.id]);
  });

  it('returns an empty array when nothing is saved', async () => {
    expect(await list()).toEqual([]);
  });
});

describe('get', () => {
  it('returns a bookmark by id or undefined', async () => {
    const bm = await add({ url: 'example.com', title: 'X' });
    expect((await get(bm.id))?.title).toBe('X');
    expect(await get('missing')).toBeUndefined();
  });
});
