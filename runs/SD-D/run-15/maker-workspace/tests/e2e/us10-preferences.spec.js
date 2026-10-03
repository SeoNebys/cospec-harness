// T051 [US10]: sorting and persisted display preferences.
import { test, expect } from '@playwright/test';
import { startApp, startFixtureSite, stop } from './helpers/servers.js';

let app, fixture;
test.beforeAll(async () => { fixture = await startFixtureSite(); app = await startApp(); });
test.afterAll(async () => { await stop(app?.child); await new Promise((r) => fixture?.server.close(r)); });

test('sort by title reorders the list', async ({ page, request }) => {
  await request.post('/api/bookmarks', { data: { url: 'http://127.0.0.1:4999/z', title: 'Zebra' } });
  await request.post('/api/bookmarks', { data: { url: 'http://127.0.0.1:4999/a', title: 'Apple' } });
  await request.post('/api/bookmarks', { data: { url: 'http://127.0.0.1:4999/m', title: 'Mango' } });

  await page.goto('/#/');
  await page.selectOption('.sort-select', 'title_asc');
  await page.waitForTimeout(200);
  const titles = await page.locator('.bookmark .bm-title').allTextContents();
  expect(titles).toEqual(['Apple', 'Mango', 'Zebra']);
});

test('preferences persist across reload and apply text size', async ({ page }) => {
  await page.goto('/#/settings');
  await page.selectOption('select[name="default_sort"]', 'title_asc');
  await page.fill('input[name="page_size"]', '10');
  await page.selectOption('select[name="text_size"]', 'large');
  await page.click('#prefs-form button[type="submit"]');
  await expect(page.locator('.saved-note')).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');
  await page.goto('/#/settings');
  await expect(page.locator('select[name="default_sort"]')).toHaveValue('title_asc');
  await expect(page.locator('input[name="page_size"]')).toHaveValue('10');
});
