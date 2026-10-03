import { afterEach, describe, expect, it } from 'vitest';
import { testDatabase } from '../helpers/database';
import { BookmarkRepository } from '../../src/server/bookmarks/bookmark-repository';
describe('bookmark mutation transactions', () => {
  const dbs: ReturnType<typeof testDatabase>[] = [];
  afterEach(() => dbs.splice(0).forEach((db) => db.close()));
  it('replaces tags and preserves archive invariants', () => {
    const db = testDatabase();
    dbs.push(db);
    const now = new Date().toISOString();
    const uid = '00000000-0000-4000-8000-000000000001';
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(uid, 'a@b.co', 'a@b.co', 'x', now, now);
    const repo = new BookmarkRepository(db);
    const made = repo.create(uid, {
      url: 'https://example.com',
      title: 'One',
      notes: '',
      tags: ['One'],
      isFavorite: false,
      allowDuplicate: false,
    });
    const edited = repo.update(uid, made.id, {
      url: made.url,
      title: 'Two',
      notes: '',
      tags: ['Two'],
      isFavorite: false,
      allowDuplicate: false,
    })!;
    expect(edited.tags[0].name).toBe('Two');
    const archived = repo.setStatus(uid, made.id, 'archived')!;
    expect(archived.archivedAt).not.toBeNull();
    expect(repo.setStatus(uid, made.id, 'active')!.archivedAt).toBeNull();
  });
});
