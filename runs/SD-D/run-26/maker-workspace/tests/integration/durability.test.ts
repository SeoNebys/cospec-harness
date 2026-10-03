import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase } from '@server/db/database.js';
import { BookmarkRepository } from '@server/bookmarks/bookmark-repository.js';
describe('durability', () => {
  it('retains confirmed changes and integrity across 100 leave/restart cycles', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'larder-durable-'));
    let db = openDatabase(dir),
      repo = new BookmarkRepository(db);
    const saved = repo.create({
      url: 'https://durable.example',
      title: 'Persistent',
      noteMarkdown: 'kept',
      tags: ['safe'],
      isRead: true
    });
    db.close();
    for (let i = 0; i < 100; i++) {
      db = openDatabase(dir);
      expect(db.pragma('quick_check', { simple: true })).toBe('ok');
      db.close();
    }
    db = openDatabase(dir);
    repo = new BookmarkRepository(db);
    expect(repo.get(saved.id)).toMatchObject({
      title: 'Persistent',
      noteMarkdown: 'kept',
      isRead: true,
      tags: [{ name: 'safe' }]
    });
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
