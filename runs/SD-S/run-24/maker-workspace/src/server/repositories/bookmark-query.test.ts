import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BookmarkRepository } from './bookmark-repository.js';
import {
  createTemporaryDatabase,
  type TemporaryDatabase,
} from '../../../tests/helpers/database.js';

describe('BookmarkRepository collection queries', () => {
  let temporary: TemporaryDatabase;
  let repository: BookmarkRepository;

  beforeEach(() => {
    temporary = createTemporaryDatabase();
    let tick = 0;
    repository = new BookmarkRepository(
      temporary.db,
      () => `2026-09-25T12:00:${String(tick++).padStart(2, '0')}.000Z`,
    );
    repository.create({
      title: 'TypeScript Handbook',
      url: 'https://example.com/typescript?edition=2',
      notes: 'Language reference',
      tags: ['Code', 'Reference'],
    });
    const favorite = repository.create({
      title: 'Garden Notes',
      url: 'https://garden.example/path',
      notes: 'Tomatoes & basil',
      tags: ['Reference', 'Home'],
    });
    const archived = repository.create({
      title: 'Old Reading',
      url: 'https://example.com/archive',
      notes: 'Past article',
      tags: ['Reading'],
    });
    temporary.db.prepare('UPDATE bookmarks SET is_favorite = 1 WHERE id = ?').run(favorite.id);
    temporary.db.prepare('UPDATE bookmarks SET is_archived = 1 WHERE id = ?').run(archived.id);
  });

  afterEach(() => temporary.close());

  it.each(['typescript', 'EDITION=2', 'language reference', 'code', 'tomatoes &'])(
    'searches title, URL, notes, and tags literally for %s',
    (q) => expect(repository.list({ q, tags: [], archived: false, sort: 'newest' }).total).toBe(1),
  );

  it('uses match-all tags and favorite filters', () => {
    expect(
      repository.list({ q: '', tags: ['reference', 'home'], archived: false, sort: 'newest' })
        .items,
    ).toHaveLength(1);
    expect(
      repository.list({ q: '', tags: [], favorite: true, archived: false, sort: 'newest' }).items[0]
        ?.title,
    ).toBe('Garden Notes');
    expect(
      repository.list({ q: '', tags: [], favorite: false, archived: false, sort: 'newest' }).total,
    ).toBe(1);
  });

  it('selects archived records and applies every deterministic sort', () => {
    expect(
      repository.list({ q: '', tags: [], archived: true, sort: 'newest' }).items[0]?.title,
    ).toBe('Old Reading');
    expect(
      repository.list({ q: '', tags: [], archived: false, sort: 'oldest' }).items[0]?.title,
    ).toBe('TypeScript Handbook');
    expect(
      repository.list({ q: '', tags: [], archived: false, sort: 'title' }).items[0]?.title,
    ).toBe('Garden Notes');
  });

  it('returns tag summaries for the selected archive state', () => {
    expect(repository.listTags(false)).toEqual([
      { name: 'Code', bookmarkCount: 1 },
      { name: 'Home', bookmarkCount: 1 },
      { name: 'Reference', bookmarkCount: 2 },
    ]);
    expect(repository.listTags(true)).toEqual([{ name: 'Reading', bookmarkCount: 1 }]);
  });

  it('returns a valid empty collection', () => {
    temporary.db.prepare('DELETE FROM bookmarks').run();
    expect(repository.list()).toEqual({ items: [], total: 0 });
  });
});
