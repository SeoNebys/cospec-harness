import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase } from '../helpers/database';
import { BookmarkRepository } from '../../src/server/bookmarks/bookmark-repository';
describe('10k collection target', () => {
  const dbs: ReturnType<typeof testDatabase>[] = [];
  afterEach(() => dbs.splice(0).forEach((db) => db.close()));
  it('returns a search page in under one second', () => {
    const db = testDatabase();
    dbs.push(db);
    const uid = randomUUID(),
      now = new Date().toISOString();
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(
      uid,
      'scale@example.com',
      'scale@example.com',
      'x',
      now,
      now,
    );
    const insert = db.prepare('INSERT INTO bookmarks VALUES(?,?,?,?,?,?,?,?,?,?,?)');
    db.exec('BEGIN');
    for (let i = 0; i < 10000; i++)
      insert.run(
        randomUUID(),
        uid,
        `https://example.com/${i}`,
        `https://example.com/${i}`,
        i === 9999 ? 'Unique needle' : 'A saved page',
        '',
        0,
        'active',
        null,
        new Date(Date.now() + i).toISOString(),
        now,
      );
    db.exec('COMMIT');
    const start = performance.now();
    const result = new BookmarkRepository(db).list(uid, {
      view: 'active',
      q: 'Unique needle',
      limit: 50,
    });
    expect(result.items).toHaveLength(1);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
