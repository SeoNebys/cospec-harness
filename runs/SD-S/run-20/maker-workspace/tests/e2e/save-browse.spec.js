import { test, expect } from '@playwright/test';
import { clearAllBookmarks } from './reset.js';

// US1 (save) + US2 (browse & open) — the MVP journey.

test.beforeEach(async ({ request, baseURL }) => {
  await clearAllBookmarks(request, baseURL);
});

test('shows the empty state before any bookmarks exist', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
  await expect(page.locator('#empty-state')).toBeVisible();
});

test('saves a bookmark, normalizes a scheme-less address, and lists it', async ({
  page,
}) => {
  await page.goto('/');
  await page.fill('#url-input', 'example.com');
  await page.fill('#title-input', 'Example Site');
  await page.fill('#tags-input', 'reading, demo');
  await page.click('#save-form button[type="submit"]');

  const firstItem = page.locator('.bookmark-item').first();
  await expect(firstItem.locator('.bookmark-title')).toHaveText('Example Site');
  await expect(firstItem.locator('.bookmark-url')).toHaveText(
    'https://example.com/'
  );
  await expect(firstItem.locator('.tag-chip')).toHaveText(['reading', 'demo']);

  // The list survives a reload (persistence within the session).
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
  await expect(
    page.locator('.bookmark-item').first().locator('.bookmark-title')
  ).toHaveText('Example Site');
});

test('rejects an invalid address without creating a bookmark', async ({ page }) => {
  await page.goto('/');
  const countBefore = await page.locator('.bookmark-item').count();
  await page.fill('#url-input', 'not a url');
  await page.click('#save-form button[type="submit"]');
  await expect(page.locator('#form-message')).toBeVisible();
  await expect(page.locator('.bookmark-item')).toHaveCount(countBefore);
});

test('a bookmark link opens in a new tab', async ({ page }) => {
  await page.goto('/');
  await page.fill('#url-input', 'https://openme.example.com');
  await page.fill('#title-input', 'Open Me');
  await page.click('#save-form button[type="submit"]');

  const link = page.locator('.bookmark-item').first().locator('.bookmark-title');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  await expect(link).toHaveAttribute('href', 'https://openme.example.com/');
});
