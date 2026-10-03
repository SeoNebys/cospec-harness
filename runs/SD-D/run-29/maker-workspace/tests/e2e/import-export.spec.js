import { test, expect } from '@playwright/test';
import { ready, seed, uid, ORIGIN } from './helpers.js';

test('export produces browser HTML; import retains titles/tags/dates and de-dupes', async ({ page }) => {
  const k = uid();
  await ready(page);
  await seed(page, { title: `${k} Exportable`, tags: [`${k}x`] });

  // Export is valid Netscape HTML containing our bookmark
  const exp = await page.request.get('/api/export');
  expect(exp.ok()).toBeTruthy();
  const html = await exp.text();
  expect(html).toContain('NETSCAPE-Bookmark-file-1');
  expect(html).toContain(`${k} Exportable`);

  // Re-importing the export creates no duplicates
  const dupRes = await page.request.post('/api/import', {
    headers: { 'Content-Type': 'text/html' }, data: html,
  });
  const dup = await dupRes.json();
  expect(dup.duplicates).toBeGreaterThanOrEqual(1);
  expect(dup.imported).toBe(0);

  // Importing a new entry retains its title, tag, and saved date
  const addDate = 1600000000; // seconds
  const fresh = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
    <DT><A HREF="${ORIGIN}/index.html?imp=${k}" ADD_DATE="${addDate}" TAGS="${k}imported">${k} Imported Title</A>
  </DL><p>`;
  const impRes = await page.request.post('/api/import', {
    headers: { 'Content-Type': 'text/html' }, data: fresh,
  });
  expect((await impRes.json()).imported).toBe(1);

  // Verify retained fields via search + API
  const found = await (await page.request.get(`/api/bookmarks?q=${encodeURIComponent(k + ' Imported Title')}`)).json();
  expect(found.items).toHaveLength(1);
  expect(found.items[0].tags).toContain(`${k}imported`);
  expect(found.items[0].saved_date).toBe(addDate * 1000);
});
