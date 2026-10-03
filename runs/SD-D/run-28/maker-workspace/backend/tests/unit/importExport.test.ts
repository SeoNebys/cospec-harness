import { describe, it, expect } from 'vitest';
import { getDb } from '../../src/db/db.ts';
import { parseNetscape, importBookmarks, exportBookmarks } from '../../src/services/importExport.ts';
import { getById } from '../../src/models/bookmark.ts';

const sample = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Work</H3>
  <DL><p>
    <DT><A HREF="https://a.example/report" ADD_DATE="1600000000" TAGS="work,reports">Quarterly Report</A>
    <DT><A HREF="https://b.example/page" ADD_DATE="1600000100">Folder Tagged</A>
  </DL><p>
</DL><p>`;

describe('Netscape import/export', () => {
  it('parses href, title, tags and dates (folder as fallback tag)', () => {
    const parsed = parseNetscape(sample);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ url: 'https://a.example/report', title: 'Quarterly Report' });
    expect(parsed[0].tags).toEqual(['work', 'reports']);
    expect(parsed[0].addDate).toBe(new Date(1600000000 * 1000).toISOString());
    expect(parsed[1].tags).toEqual(['Work']); // folder fallback
  });

  it('imports preserving titles/tags/dates and merges duplicates', () => {
    const db = getDb(':memory:');
    const jobs: string[] = [];
    const r1 = importBookmarks(db, sample, (j) => jobs.push(j.id));
    expect(r1.imported).toBe(2);
    expect(r1.merged).toBe(0);
    expect(jobs).toHaveLength(2);

    // Re-import the same file → merges, no duplicates (SC-006).
    const r2 = importBookmarks(db, sample, () => {});
    expect(r2.imported).toBe(0);
    expect(r2.merged).toBe(2);

    const first = getById(db, r1.newIds[0].id)!;
    expect(first.tags).toEqual(expect.arrayContaining(['work', 'reports']));
    expect(first.dateAdded).toBe(new Date(1600000000 * 1000).toISOString());
  });

  it('round-trips through export', () => {
    const db = getDb(':memory:');
    importBookmarks(db, sample, () => {});
    const html = exportBookmarks(db);
    expect(html).toContain('NETSCAPE-Bookmark-file-1');
    const reparsed = parseNetscape(html);
    expect(reparsed).toHaveLength(2);
    expect(reparsed.map((b) => b.url).sort()).toEqual(
      ['https://a.example/report', 'https://b.example/page'].sort(),
    );
  });
});
