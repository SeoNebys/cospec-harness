import { describe, expect, it } from 'vitest';
import { temporaryDatabase } from '../helpers/database.js';
import { BookmarkRepository } from '@server/bookmarks/bookmark-repository.js';
import { BulkService } from '@server/bookmarks/bulk-service.js';
import { SelectionService } from '@server/bookmarks/selection-service.js';
describe('bulk actions', () => {
  it('applies explicit and all-matching actions atomically with exact counts', () => {
    const t = temporaryDatabase(),
      repo = new BookmarkRepository(t.db),
      bulk = new BulkService(t.db, repo, new SelectionService(repo));
    const a = repo.create({
        url: 'https://a.example',
        noteMarkdown: 'A',
        tags: ['one'],
        isRead: false
      }),
      b = repo.create({ url: 'https://b.example', noteMarkdown: 'B', tags: ['two'], isRead: true });
    expect(
      bulk.apply({
        selection: { ids: [a.id, b.id] },
        action: { type: 'addTags', tags: ['shared'] }
      })
    ).toEqual({ matched: 2, changed: 2, unchanged: 0 });
    const page = repo.list({ collection: 'active', query: 'tag:shared' });
    expect(
      bulk.apply({
        selection: {
          allMatching: true,
          collection: 'active',
          query: 'tag:shared',
          sort: 'recent',
          queryFingerprint: page.queryFingerprint,
          excludeIds: [b.id]
        },
        action: { type: 'archive' }
      })
    ).toEqual({ matched: 1, changed: 1, unchanged: 0 });
    expect(repo.get(a.id)?.archivedAt).not.toBeNull();
    expect(repo.get(b.id)).toMatchObject({ archivedAt: null, isRead: true, noteMarkdown: 'B' });
    t.close();
  });
  it('rejects stale all-matching selections', () => {
    const t = temporaryDatabase(),
      repo = new BookmarkRepository(t.db),
      bulk = new BulkService(t.db, repo, new SelectionService(repo));
    repo.create({ url: 'https://a.example', noteMarkdown: '', tags: [], isRead: false });
    const page = repo.list({ collection: 'active' });
    repo.create({ url: 'https://b.example', noteMarkdown: '', tags: [], isRead: false });
    expect(() =>
      bulk.apply({
        selection: {
          allMatching: true,
          collection: 'active',
          query: '',
          sort: 'recent',
          queryFingerprint: page.queryFingerprint,
          excludeIds: []
        },
        action: { type: 'markRead', value: true }
      })
    ).toThrow(/results changed/);
    t.close();
  });
});
