import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BookmarkDatabase } from '../../../src/server/db/client.js';
import { openDatabase } from '../../../src/server/db/client.js';
import { runMigrations } from '../../../src/server/db/migrations.js';
import { BookmarkRepository } from '../../../src/server/db/bookmark-repository.js';

let database: BookmarkDatabase;
let repository: BookmarkRepository;

beforeEach(() => {
  database = openDatabase(':memory:');
  runMigrations(database);
  repository = new BookmarkRepository(database);
  repository.create({ url: 'https://design.example/guide', title: 'Design guide', description: 'A practical reference', tags: ['Research', ' UX '], allowDuplicate: false });
  repository.create({ url: 'https://cooking.example/soup', title: 'Weekend soup', description: 'Warm and simple', tags: ['weekend', 'research'], allowDuplicate: false });
});
afterEach(() => database.close());

describe('bookmark search and tags', () => {
  it('reuses normalized tags while retaining the first display spelling', () => {
    expect(repository.listTags()).toEqual([
      { name: 'Research', count: 2 },
      { name: 'UX', count: 1 },
      { name: 'weekend', count: 1 },
    ]);
  });

  it.each([
    ['DESIGN', 'Design guide'],
    ['cooking.example', 'Weekend soup'],
    ['practical', 'Design guide'],
    ['ux', 'Design guide'],
  ])('matches %s across bookmark fields', (query, expected) => {
    expect(repository.list({ query }).map(({ title }) => title)).toEqual([expected]);
  });

  it('intersects text and tag filters and keeps newest-first order', () => {
    expect(repository.list({ query: 'simple', tag: ' RESEARCH ' }).map(({ title }) => title)).toEqual(['Weekend soup']);
    expect(repository.list({ tag: 'research' }).map(({ title }) => title)).toEqual(['Weekend soup', 'Design guide']);
  });

  it('removes orphaned tags after tag replacement', () => {
    const design = repository.list({ query: 'Design' })[0]!;
    repository.update(design.id, { tags: ['reference'], allowDuplicate: false });
    expect(repository.listTags().map(({ name }) => name)).not.toContain('UX');
  });
});
