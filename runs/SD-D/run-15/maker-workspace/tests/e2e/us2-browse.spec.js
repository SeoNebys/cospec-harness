// T020 [US2]: readable list (title/description/tags/icon), open in new tab, empty state.
import { test, expect } from '@playwright/test';
import { startApp, startFixtureSite, stop } from './helpers/servers.js';

let app, fixture;

test.beforeAll(async () => {
  fixture = await startFixtureSite();
  app = await startApp();
});

test.afterAll(async () => {
  await stop(app?.child);
  await new Promise((r) => fixture?.server.close(r));
});

test('a fresh collection shows the empty state', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('#app[data-harness-ready="true"]')).toBeVisible();
  await expect(page.locator('.empty-state')).toBeVisible();
  await expect(page.locator('.empty-state')).toContainText('No bookmarks yet');
});

test('saved bookmarks appear in the list with title, description and host', async ({ page }) => {
  // Seed one bookmark via the UI.
  await page.goto('/#/new');
  await page.fill('input[name="url"]', `${fixture.base}/article`);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/#\/edit\/\d+/);

  await page.goto('/#/');
  const row = page.locator('.bookmark').first();
  await expect(row.locator('.bm-title')).toHaveText('The Fixture Article');
  await expect(row.locator('.bm-desc')).toContainText('predictable fixture description');
  await expect(row.locator('.bm-host')).toContainText('127.0.0.1');
});

test('the bookmark title links to its address in a new tab', async ({ page }) => {
  await page.goto('/#/');
  const link = page.locator('.bookmark .bm-title').first();
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('href', `${fixture.base}/article`);
});
