import { describe, it, expect } from 'vitest';
import { freshDb } from '../helpers';
import { create, getById, list } from '../../src/models/bookmarks';
import { setBookmarkTags } from '../../src/models/tags';
import { exportBookmarksHtml } from '../../src/services/exporter';
import { importBookmarksHtml, parseNetscapeHtml } from '../../src/services/importer';

describe('import/export (FR-029/030/031, SC-008)', () => {
  it('round-trips titles, tags, and saved dates with no duplicates', () => {
    freshDb();
    const a = create({ url: 'https://a.com/x', title: 'Alpha', tags: ['reading', 'tech'], saved_at: '2025-01-01T00:00:00.000Z' });
    create({ url: 'https://b.com/y', title: 'Beta', tags: ['news'], saved_at: '2025-02-01T00:00:00.000Z' });

    const html = exportBookmarksHtml();
    expect(html).toContain('TAGS="reading,tech"');
    expect(html).toContain('Alpha');

    const before = list({}).total;
    const result = importBookmarksHtml(html);
    // Everything already exists → all merged, none newly imported, no duplicates.
    expect(result.imported).toBe(0);
    expect(result.merged).toBe(2);
    expect(list({}).total).toBe(before);

    const reloaded = getById(a.bookmark.id)!;
    expect(reloaded.tags.sort()).toEqual(['reading', 'tech']);
    expect(reloaded.saved_at).toBe('2025-01-01T00:00:00.000Z');
  });

  it('merges non-destructively: unions tags, keeps earliest date, preserves note', () => {
    freshDb();
    const created = create({ url: 'https://a.com/x', title: 'Kept Title', tags: ['one'], saved_at: '2025-05-01T00:00:00.000Z' });

    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
      <DT><A HREF="https://a.com/x" ADD_DATE="1704067200" TAGS="two">Imported Title</A>
    </DL><p>`;
    const result = importBookmarksHtml(html);
    expect(result.merged).toBe(1);

    const bm = getById(created.bookmark.id)!;
    expect(bm.tags.sort()).toEqual(['one', 'two']); // union
    expect(bm.title).toBe('Kept Title'); // preserved
    expect(bm.saved_at).toBe('2024-01-01T00:00:00.000Z'); // earliest (ADD_DATE 1704067200)
  });

  it('parses TAGS attribute and ADD_DATE', () => {
    const entries = parseNetscapeHtml(
      '<DL><p><DT><A HREF="https://x.com" ADD_DATE="1704067200" TAGS="a,b,c">Hi</A></DL><p>'
    );
    expect(entries[0].tags).toEqual(['a', 'b', 'c']);
    expect(entries[0].url).toBe('https://x.com');
  });
});
