import { test, expect } from '@playwright/test';

// End-to-end smoke: save → search → open flow through the real UI (US1 + US2).
test('save a bookmark, find it via search, and see it open in a new tab', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');

  // Save a bookmark
  await page.fill('#add-address', 'https://example.com/e2e-smoke');
  await page.click('#add-form button[type="submit"]');
  await expect(page.locator('.bookmark')).toHaveCount(1);

  // Search finds it
  await page.fill('#search-input', 'e2e-smoke');
  await expect(page.locator('.bookmark')).toHaveCount(1);

  // No-results state for a non-matching query
  await page.fill('#search-input', 'definitely-not-present-xyz');
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('#empty-state')).toContainText('No matching bookmarks');

  // Clear search; the title link points at the target and opens in a new tab
  await page.fill('#search-input', '');
  const title = page.locator('.bookmark .title').first();
  await expect(title).toHaveAttribute('target', '_blank');
  await expect(title).toHaveAttribute('href', 'https://example.com/e2e-smoke');
});
