import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  await request.post('/api/test/reset');
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
});

test('saves a valid URL with blank title and shows it in the list', async ({ page }) => {
  await page.fill('#add-url', 'https://playwright.dev');
  await page.click('#add-form button[type=submit]');

  const item = page.locator('.bookmark').filter({ hasText: 'playwright.dev' });
  await expect(item).toHaveCount(1);

  // Persists after reload.
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
  await expect(page.locator('.bookmark').filter({ hasText: 'playwright.dev' })).toHaveCount(1);
});

test('rejects a malformed address with a clear error', async ({ page }) => {
  await page.fill('#add-url', 'not a url');
  await page.click('#add-form button[type=submit]');
  await expect(page.locator('#add-error')).toBeVisible();
  await expect(page.locator('.bookmark')).toHaveCount(0);
});

test('warns on a duplicate address and does not add twice', async ({ page }) => {
  await page.fill('#add-url', 'https://example.org');
  await page.click('#add-form button[type=submit]');
  await expect(page.locator('.bookmark').filter({ hasText: 'example.org' })).toHaveCount(1);

  await page.fill('#add-url', 'https://example.org');
  await page.click('#add-form button[type=submit]');
  await expect(page.locator('#add-error')).toBeVisible();
  await expect(page.locator('.bookmark').filter({ hasText: 'example.org' })).toHaveCount(1);
});
