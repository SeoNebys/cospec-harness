import { expect, it } from 'vitest';
import { temporaryDatabase } from '../helpers/database.js';
import { BookmarkRepository } from '@server/bookmarks/bookmark-repository.js';
import { BulkService } from '@server/bookmarks/bulk-service.js';
import { SelectionService } from '@server/bookmarks/selection-service.js';
it('atomically updates 1,000 bookmarks in under five seconds', () => {
  const t = temporaryDatabase(),
    repo = new BookmarkRepository(t.db),
    ids: string[] = [];
  t.db.transaction(() => {
    for (let i = 0; i < 1000; i++)
      ids.push(
        repo.create({
          url: `https://bulk.example/${i}`,
          noteMarkdown: `note ${i}`,
          tags: ['kept'],
          isRead: false
        }).id
      );
  })();
  const bulk = new BulkService(t.db, repo, new SelectionService(repo)),
    start = performance.now(),
    result = bulk.apply({ selection: { ids }, action: { type: 'markRead', value: true } }),
    elapsed = performance.now() - start;
  expect(result).toEqual({ matched: 1000, changed: 1000, unchanged: 0 });
  expect(repo.get(ids[500]!)?.noteMarkdown).toBe('note 500');
  expect(repo.get(ids[500]!)?.tags[0]?.name).toBe('kept');
  expect(elapsed).toBeLessThan(5000);
  t.close();
});
