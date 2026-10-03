import { expect, it } from 'vitest';
import { temporaryDatabase } from '../helpers/database.js';
import { BookmarkRepository } from '@server/bookmarks/bookmark-repository.js';
import { BookmarkService } from '@server/bookmarks/bookmark-service.js';
import { ImportService } from '@server/import-export/import-service.js';
it('previews and imports 10,000 browser bookmarks in under 60 seconds', () => {
  const t = temporaryDatabase(),
    repo = new BookmarkRepository(t.db),
    service = new ImportService(t.db, repo, new BookmarkService(repo)),
    anchors = Array.from(
      { length: 10_000 },
      (_, i) => `<DT><A HREF="https://import.example/${i}">Item ${i}</A>`
    ).join(''),
    html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL>${anchors}</DL>`,
    start = performance.now(),
    preview = service.preview(html),
    result = service.commit(preview.id),
    elapsed = performance.now() - start;
  expect(preview.newCount).toBe(10_000);
  expect(result.importedCount).toBe(10_000);
  expect(repo.list({ collection: 'active' }).total).toBe(10_000);
  expect(elapsed).toBeLessThan(60_000);
  t.close();
});
