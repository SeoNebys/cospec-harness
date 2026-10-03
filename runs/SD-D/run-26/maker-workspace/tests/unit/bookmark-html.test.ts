import { describe, expect, it } from 'vitest';
import { parseBookmarkHtml } from '@server/import-export/browser-bookmark-parser.js';
describe('browser bookmark HTML', () => {
  it('accepts only HTTP(S), combines folder and TAGS, and never executes markup', () => {
    (globalThis as any).__bookmarkPwned = false;
    const parsed = parseBookmarkHtml(
      `<DL><DT><H3>Folder &amp; More</H3><DL><DT><A HREF="https://example.com?a=1&amp;b=2" TAGS="Extra">Title <script>globalThis.__bookmarkPwned=true</script></A><DT><A HREF="javascript:alert(1)">Bad</A></DL></DL>`
    );
    expect(parsed.entries[0]).toMatchObject({
      url: 'https://example.com/?a=1&b=2',
      tags: ['Folder & More', 'Extra']
    });
    expect(parsed.entries[1]).toMatchObject({ error: 'invalid_url' });
    expect((globalThis as any).__bookmarkPwned).toBe(false);
  });
});
