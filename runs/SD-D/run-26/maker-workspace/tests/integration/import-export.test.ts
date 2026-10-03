import { describe, expect, it } from 'vitest';
import { temporaryDatabase } from '../helpers/database.js';
import { BookmarkRepository } from '@server/bookmarks/bookmark-repository.js';
import { BookmarkService } from '@server/bookmarks/bookmark-service.js';
import { ImportService } from '@server/import-export/import-service.js';
import { writeExport } from '@server/import-export/export-writer.js';
describe('import and export', () => {
  it('turns folder paths into tags and round trips app state', () => {
    const t = temporaryDatabase(),
      repo = new BookmarkRepository(t.db),
      service = new ImportService(t.db, repo, new BookmarkService(repo));
    const preview = service.preview(
      `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><H3>Work</H3><DL><DT><A HREF="https://example.com" ADD_DATE="1">Example</A></DL></DL>`
    );
    expect(preview.newCount).toBe(1);
    service.commit(preview.id);
    expect(repo.list({ collection: 'active' }).items[0]?.tags.map((x) => x.name)).toContain('Work');
    expect(writeExport(repo)).toContain('DATA-BOOKMARK-MANAGER-META');
    t.close();
  });
});
