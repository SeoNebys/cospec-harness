import { afterEach, describe, expect, it } from 'vitest';
import { testDatabase } from '../helpers/database';
import { BookmarkRepository } from '../../src/server/bookmarks/bookmark-repository';
describe('bookmark search repository', () => {
  const dbs: ReturnType<typeof testDatabase>[] = [];
  afterEach(() => dbs.splice(0).forEach((db) => db.close()));
  it('returns stable newest-first literal partial matches', () => {
    const db = testDatabase();
    dbs.push(db);
    const now = new Date().toISOString();
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(
      '00000000-0000-4000-8000-000000000001',
      'a@b.co',
      'a@b.co',
      'x',
      now,
      now,
    );
    const repo = new BookmarkRepository(db);
    repo.create('00000000-0000-4000-8000-000000000001', {
      url: 'https://example.com/a',
      title: '100% useful',
      notes: 'needle here',
      tags: ['Research'],
      isFavorite: true,
      allowDuplicate: false,
    });
    const page = repo.list('00000000-0000-4000-8000-000000000001', {
      view: 'active',
      q: 'needle',
      limit: 50,
    });
    expect(page.items.map((b) => b.title)).toEqual(['100% useful']);
    expect(page.nextCursor).toBeNull();
  });
});
