import { describe, it, expect } from 'vitest';
import { freshDb } from '../helpers';
import { create } from '../../src/models/bookmarks';

describe('duplicate detection (FR-006 / US2)', () => {
  it('does not create a duplicate for a normalized-equal address', () => {
    freshDb();
    const first = create({ url: 'https://example.com/article' });
    expect(first.duplicate).toBe(false);

    const again = create({ url: 'http://www.example.com/article/?utm_source=news' });
    expect(again.duplicate).toBe(true);
    expect(again.bookmark.id).toBe(first.bookmark.id);
  });

  it('creates separate bookmarks for distinct paths', () => {
    freshDb();
    const a = create({ url: 'https://example.com/a' });
    const b = create({ url: 'https://example.com/b' });
    expect(b.duplicate).toBe(false);
    expect(b.bookmark.id).not.toBe(a.bookmark.id);
  });
});
