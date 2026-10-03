// T041 [US7]: archive is reversible, hidden from normal list + search, shown in archive.
import { test, expect } from '@playwright/test';
import { startApp, startFixtureSite, stop } from './helpers/servers.js';

let app, fixture;
test.beforeAll(async () => { fixture = await startFixtureSite(); app = await startApp(); });
test.afterAll(async () => { await stop(app?.child); await new Promise((r) => fixture?.server.close(r)); });

test('archive hides from list and search; archive view shows it; restore returns it', async ({ page, request }) => {
  await request.post('/api/bookmarks', { data: { url: 'http://127.0.0.1:4999/keep', title: 'Keep Me' } });
  await request.post('/api/bookmarks', { data: { url: 'http://127.0.0.1:4999/stash', title: 'Stash Me' } });

  // Archive "Stash Me" from the list.
  await page.goto('/#/');
  await page.locator('.bookmark', { hasText: 'Stash Me' }).locator('[data-action="archive"]').click();
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await expect(page.locator('.bookmark .bm-title')).toHaveText('Keep Me');

  // Not in normal search.
  await page.fill('.search-box', 'Stash');
  await page.waitForTimeout(300);
  await expect(page.locator('[data-empty="no-results"]')).toBeVisible();

  // Present in archive view; restore it.
  await page.goto('/#/archive');
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await expect(page.locator('.bookmark .bm-title')).toHaveText('Stash Me');
  await page.locator('.bookmark [data-action="restore"]').click();
  await expect(page.locator('[data-empty="archive"]')).toBeVisible();

  // Back in the normal list.
  await page.goto('/#/');
  await expect(page.locator('.bookmark')).toHaveCount(2);
});
