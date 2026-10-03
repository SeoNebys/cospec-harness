// T038 [US6]: read-later status and the unread view.
import { test, expect } from '@playwright/test';
import { startApp, startFixtureSite, stop } from './helpers/servers.js';

let app, fixture;
test.beforeAll(async () => { fixture = await startFixtureSite(); app = await startApp(); });
test.afterAll(async () => { await stop(app?.child); await new Promise((r) => fixture?.server.close(r)); });

test('new bookmark is unread; mark read removes it from unread; mark unread returns it', async ({ page, request }) => {
  await request.post('/api/bookmarks', { data: { url: 'http://127.0.0.1:4999/r1', title: 'Read Later One' } });

  await page.goto('/#/unread');
  await expect(page.locator('.bookmark')).toHaveCount(1);

  await page.locator('.bookmark [data-action="read"]').click();
  await expect(page.locator('.bookmark')).toHaveCount(0);
  await expect(page.locator('[data-empty="unread"]')).toBeVisible();

  // It is still present (now read) in the All view; mark it unread again.
  await page.goto('/#/');
  await page.locator('.bookmark [data-action="unread"]').click();
  await page.goto('/#/unread');
  await expect(page.locator('.bookmark')).toHaveCount(1);
});
