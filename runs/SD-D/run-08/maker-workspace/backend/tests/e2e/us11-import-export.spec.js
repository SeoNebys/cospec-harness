import { test, expect } from '@playwright/test';

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Reading</H3>
  <DL><p>
    <DT><A HREF="https://import-e2e.example.com/one" ADD_DATE="1600000000" TAGS="news">One</A>
    <DT><A HREF="https://import-e2e.example.com/two" ADD_DATE="1600000100">Two</A>
  </DL><p>
</DL><p>`;

test('US11: import preserves titles/tags/dates and skips duplicates; export round-trips', async ({ request }) => {
  // First import.
  let res = await request.post('/api/import', {
    multipart: { file: { name: 'bm.html', mimeType: 'text/html', buffer: Buffer.from(SAMPLE) } },
  });
  let body = await res.json();
  expect(body.imported).toBe(2);
  expect(body.skipped).toBe(0);

  // Tags (folder + TAGS) preserved.
  const list = await (await request.get('/api/bookmarks?q=import-e2e')).json();
  const one = list.items.find((b) => b.url.endsWith('/one'));
  expect(one.tags).toContain('Reading');
  expect(one.tags).toContain('news');
  expect(one.createdAt).toBe(new Date(1600000000 * 1000).toISOString());

  // Re-import skips duplicates.
  res = await request.post('/api/import', {
    multipart: { file: { name: 'bm.html', mimeType: 'text/html', buffer: Buffer.from(SAMPLE) } },
  });
  body = await res.json();
  expect(body.imported).toBe(0);
  expect(body.skipped).toBe(2);

  // Export round-trips.
  const html = await (await request.get('/api/export')).text();
  expect(html).toContain('https://import-e2e.example.com/one');
  expect(html).toContain('ADD_DATE="1600000000"');
});
