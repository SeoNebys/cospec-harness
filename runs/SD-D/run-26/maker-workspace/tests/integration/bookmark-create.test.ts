import { describe, expect, it } from 'vitest';
import { BookmarkRepository } from '@server/bookmarks/bookmark-repository.js';
import { BookmarkService } from '@server/bookmarks/bookmark-service.js';
import { temporaryDatabase } from '../helpers/database.js';
describe('bookmark persistence', () => {
  it('creates unread bookmarks, tags them, finds them, and survives reopen', () => {
    const t = temporaryDatabase(),
      repo = new BookmarkRepository(t.db),
      service = new BookmarkService(repo);
    const b = service.create({
      url: 'https://example.com/path?q=1#part',
      title: 'Example',
      description: 'Description',
      noteMarkdown: 'A **useful** note',
      tags: ['Research'],
      isRead: false
    });
    expect(repo.get(b.id)).toMatchObject({ isRead: false, tags: [{ name: 'Research' }] });
    expect(repo.list({ collection: 'active', query: 'useful AND tag:research' }).total).toBe(1);
    expect(() => service.create({ url: b.url, noteMarkdown: '', tags: [], isRead: false })).toThrow(
      /already saved/
    );
    t.close();
  });
});
