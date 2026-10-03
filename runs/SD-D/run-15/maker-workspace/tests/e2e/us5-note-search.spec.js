// T035 [US4+US5]: a bookmark is found through its note text via search.
import { test, expect } from '@playwright/test';
import { startApp, startFixtureSite, stop } from './helpers/servers.js';

let app, fixture;
test.beforeAll(async () => { fixture = await startFixtureSite(); app = await startApp(); });
test.afterAll(async () => { await stop(app?.child); await new Promise((r) => fixture?.server.close(r)); });

test('search finds a bookmark by a distinctive word in its note', async ({ page, request }) => {
  const b = await (await request.post('/api/bookmarks', { data: { url: 'http://127.0.0.1:4999/notey', title: 'Plain Title' } })).json();
  // Add a note containing a distinctive word via the editor.
  await page.goto(`/#/edit/${b.id}`);
  await page.fill('textarea[name="note"]', 'remember the *zorptastic* keyword here');
  await page.click('button[type="submit"]');
  await expect(page.locator('.saved-note')).toBeVisible();

  // The word is not in the title/description/url — only the note.
  await page.goto('/#/');
  await page.fill('.search-box', 'zorptastic');
  await page.waitForTimeout(300);
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await expect(page.locator('.bookmark .bm-title')).toHaveText('Plain Title');
});
