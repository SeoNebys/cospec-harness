import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { temporaryDatabase } from '../helpers/database.js';
import { BookmarkRepository } from '@server/bookmarks/bookmark-repository.js';
it('searches, filters, sorts, and views 10,000 bookmarks in under two seconds', () => {
  const t = temporaryDatabase(),
    insert = t.db.prepare(
      `INSERT INTO bookmarks(id,url,url_key,title,description,note_markdown,icon_choice,title_origin,description_origin,is_read,metadata_status,created_at,updated_at,search_title,search_url,search_description,search_note) VALUES(?,?,?,?,?,'','automatic','user','user',0,'idle',?,?,?,?,?,?)`
    ),
    tx = t.db.transaction(() => {
      for (let i = 0; i < 10_000; i++) {
        const id = randomUUID(),
          url = `https://example.com/${i}`,
          now = new Date(1_700_000_000_000 + i).toISOString();
        insert.run(
          id,
          url,
          url,
          `Guide ${i}`,
          i % 100 === 0 ? 'special needle' : 'ordinary',
          now,
          now,
          `guide ${i}`,
          url,
          i % 100 === 0 ? 'special needle' : 'ordinary',
          ''
        );
      }
    });
  tx();
  const repo = new BookmarkRepository(t.db),
    start = performance.now(),
    page = repo.list({ collection: 'active', query: '"special needle"', sort: 'title' }),
    elapsed = performance.now() - start;
  expect(page.total).toBe(100);
  expect(elapsed).toBeLessThan(2000);
  t.close();
});
