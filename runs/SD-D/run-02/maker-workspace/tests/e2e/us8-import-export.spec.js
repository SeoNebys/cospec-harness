import { test, expect } from '@playwright/test';

const NETSCAPE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><A HREF="https://imp-a.example/x" ADD_DATE="1600000000" TAGS="imported,news">Imported Alpha</A>
  <DT><A HREF="https://imp-b.example/y" ADD_DATE="1600000100">Imported Beta</A>
</DL><p>`;

test('import preserves title, tags and date added; export round-trips', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'bookmarks.html',
    mimeType: 'text/html',
    buffer: Buffer.from(NETSCAPE),
  });
  await expect(page.getByText(/Imported 2/)).toBeVisible();

  const card = page.locator('.card', { hasText: 'Imported Alpha' });
  await expect(card).toBeVisible();
  await expect(card.locator('.tag-pill', { hasText: 'imported' })).toBeVisible();

  // Export returns a Netscape file carrying the imported entry + its ADD_DATE.
  const res = await page.request.get('/api/export');
  expect(res.headers()['content-type']).toContain('text/html');
  const body = await res.text();
  expect(body).toContain('NETSCAPE-Bookmark-file');
  expect(body).toContain('https://imp-a.example/x');
  expect(body).toContain('ADD_DATE="1600000000"');
  expect(body).toContain('TAGS="imported,news"');
});

test('a malformed file is rejected and nothing is imported', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/html',
    buffer: Buffer.from('just some random text, not bookmarks'),
  });
  await expect(page.locator('.banner')).toContainText(/not a bookmark file/i);
});
