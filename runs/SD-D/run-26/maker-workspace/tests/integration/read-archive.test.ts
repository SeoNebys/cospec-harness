import { describe, expect, it } from 'vitest';
import { temporaryDatabase } from '../helpers/database.js';
import { BookmarkRepository } from '@server/bookmarks/bookmark-repository.js';
describe('read later and archive', () => {
  it('preserves read state through archive and restore', () => {
    const t = temporaryDatabase(),
      repo = new BookmarkRepository(t.db);
    const b = repo.create({
      url: 'https://example.net',
      noteMarkdown: '',
      tags: [],
      isRead: false
    });
    repo.update(b.id, { isRead: true });
    repo.update(b.id, { archived: true });
    expect(repo.list({ collection: 'archive' }).items[0]).toMatchObject({ isRead: true });
    repo.update(b.id, { archived: false });
    expect(repo.get(b.id)).toMatchObject({ isRead: true, archivedAt: null });
    t.close();
  });
});
