import { describe, expect, it } from 'vitest';
import { temporaryDatabase } from '../helpers/database.js';
import { BookmarkRepository } from '@server/bookmarks/bookmark-repository.js';
import { BookmarkService } from '@server/bookmarks/bookmark-service.js';
import { ImportService } from '@server/import-export/import-service.js';
import { writeExport } from '@server/import-export/export-writer.js';
describe('application export round trip', () => {
  it('restores description, note, tags, read and archive state exactly', () => {
    const one = temporaryDatabase(),
      source = new BookmarkRepository(one.db);
    const saved = source.create({
      url: 'https://roundtrip.example/path',
      title: 'Round trip',
      description: 'Kept description',
      noteMarkdown: '**Kept** note',
      tags: ['One', 'Two'],
      isRead: true
    });
    source.update(saved.id, { archived: true });
    const html = writeExport(source);
    const two = temporaryDatabase(),
      target = new BookmarkRepository(two.db),
      imports = new ImportService(two.db, target, new BookmarkService(target));
    const preview = imports.preview(html);
    expect(preview).toMatchObject({ newCount: 1, sourceKind: 'bookmark_manager_export' });
    imports.commit(preview.id);
    const restored = target.list({ collection: 'archive' }).items[0];
    expect(restored).toMatchObject({
      title: 'Round trip',
      description: 'Kept description',
      noteMarkdown: '**Kept** note',
      isRead: true
    });
    expect(restored?.tags.map((t) => t.name).sort()).toEqual(['One', 'Two']);
    one.close();
    two.close();
  });
});
