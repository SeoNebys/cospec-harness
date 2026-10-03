import { describe, it, expect } from 'vitest';
import { freshDb } from '../helpers';
import { create, list, listMatchingIds, update } from '../../src/models/bookmarks';
import { addTagsToBookmark } from '../../src/models/tags';

describe('bulk apply-to-all-matching (FR-021 / SC-006)', () => {
  it('affects every match across pages and excludes non-matching', () => {
    freshDb();
    // 60 matching + 10 non-matching
    for (let i = 0; i < 60; i++) create({ url: `https://match.com/p${i}`, title: `Report ${i}`, tags: ['work'] });
    for (let i = 0; i < 10; i++) create({ url: `https://other.com/p${i}`, title: `Misc ${i}`, tags: ['home'] });

    // Simulate "apply to all matching #work" — tag them all 'reviewed'.
    const ids = listMatchingIds({ q: '#work' });
    expect(ids.length).toBe(60);
    for (const id of ids) {
      addTagsToBookmark(id, ['reviewed']);
      update(id, {});
    }

    // All 60 matches carry 'reviewed'; none of the 10 non-matches do.
    expect(list({ q: '#reviewed', pageSize: 500 }).total).toBe(60);
    expect(list({ q: '#reviewed AND #home' }).total).toBe(0);
  });

  it('read-later view excludes new saves (default read) and archive excludes from main list', () => {
    freshDb();
    const a = create({ url: 'https://x.com/a', title: 'A' });
    expect(list({ view: 'readlater' }).total).toBe(0); // new saves are read
    update(a.bookmark.id, { read: false });
    expect(list({ view: 'readlater' }).total).toBe(1);

    update(a.bookmark.id, { read: true, archived: true });
    expect(list({ view: 'all' }).total).toBe(0); // archived excluded from main list
    expect(list({ view: 'archive' }).total).toBe(1);
    expect(list({ q: 'A' }).total).toBe(0); // archived excluded from ordinary search
  });
});
