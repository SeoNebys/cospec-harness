// T062 [US12]: export and import through the interface; fields preserved; dupes skipped.
import { test, expect } from '@playwright/test';
import { startApp, startFixtureSite, stop } from './helpers/servers.js';

let app, fixture;
test.beforeAll(async () => { fixture = await startFixtureSite(); app = await startApp(); });
test.afterAll(async () => { await stop(app?.child); await new Promise((r) => fixture?.server.close(r)); });

const IMPORT_FILE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Recipes</H3>
  <DL><p>
    <DT><A HREF="https://import.example/soup" ADD_DATE="1500000000" TAGS="dinner">Soup Recipe</A>
  </DL><p>
  <DT><A HREF="https://import.example/plain" ADD_DATE="1500000600">Plain Link</A>
</DL><p>`;

test('export downloads a Netscape file; import preserves title/tags/date and skips dupes', async ({ page, request }) => {
  await page.goto('/#/settings');

  // Import through the UI.
  await page.setInputFiles('#import-file', {
    name: 'bookmarks.html',
    mimeType: 'text/html',
    buffer: Buffer.from(IMPORT_FILE, 'utf8'),
  });
  await page.click('#import-btn');
  await expect(page.locator('.import-status')).toHaveText(/Imported 2 bookmark\(s\); skipped 0/);

  // Imported data preserved (title, folder+attr tags, original date).
  const soup = await (await request.get('/api/bookmarks?q=soup')).json();
  const b = soup.items[0];
  expect(b.title).toBe('Soup Recipe');
  expect(b.tags.map((t) => t.toLowerCase()).sort()).toEqual(['dinner', 'recipes']);
  expect(b.date_added).toBe(new Date(1500000000 * 1000).toISOString());

  // Export through the UI (download) contains ADD_DATE + TAGS.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a[href="/api/export"]'),
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const exported = Buffer.concat(chunks).toString('utf8');
  expect(exported).toContain('ADD_DATE="1500000000"');
  expect(exported).toContain('TAGS=');

  // Re-import the same file → all skipped as duplicates.
  await page.setInputFiles('#import-file', {
    name: 'again.html',
    mimeType: 'text/html',
    buffer: Buffer.from(IMPORT_FILE, 'utf8'),
  });
  await page.click('#import-btn');
  await expect(page.locator('.import-status')).toHaveText(/Imported 0 bookmark\(s\); skipped 2/);
});
