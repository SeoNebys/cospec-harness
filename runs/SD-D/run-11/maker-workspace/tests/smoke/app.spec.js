import { test, expect } from '@playwright/test';

test('app loads and marks harness-ready', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();
  await expect(page.locator('.brand')).toContainText('Bookmarks');
});

test('save a bookmark and see it in the list', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('body[data-harness-ready="true"]');

  // A data: URL is a valid absolute URL; metadata fetch will fail gracefully
  // and the editor opens with a derived title so we can save.
  const unique = `https://example.com/smoke-${Date.now()}`;
  await page.fill('#quick-url', unique);
  await page.click('#quick-add button[type="submit"]');

  // Editor opens for a new bookmark.
  await expect(page.locator('#editor')).toBeVisible();
  await page.fill('#f-title', 'Smoke Test Bookmark');
  await page.click('#editor-save');

  // It appears in the list.
  await expect(page.locator('.card-title', { hasText: 'Smoke Test Bookmark' }).first()).toBeVisible();
});
