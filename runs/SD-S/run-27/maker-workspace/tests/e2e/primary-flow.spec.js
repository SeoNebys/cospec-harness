import { test, expect } from '@playwright/test';

// Primary flow: add a bookmark, see it listed, search for it, and confirm the
// link points at the original address (FR-001, FR-005, FR-006, FR-010).
test('save, find, and open a bookmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();

  const unique = `https://playwright-${Date.now()}.example.com/`;

  await page.click('#add-btn');
  await page.fill('#f-address', unique);
  await page.fill('#f-title', 'Playwright Test Bookmark');
  await page.fill('#f-tags', 'e2e, testing');
  await page.click('#save-btn');

  const card = page.locator('.bookmark', { hasText: 'Playwright Test Bookmark' });
  await expect(card).toBeVisible();

  // Search narrows the list.
  await page.fill('#search', 'Playwright Test Bookmark');
  await expect(page.locator('.bookmark')).toHaveCount(1);

  // The title link opens the original address in a new tab.
  const link = card.locator('a.title');
  await expect(link).toHaveAttribute('href', unique);
  await expect(link).toHaveAttribute('target', '_blank');

  // No-results empty state.
  await page.fill('#search', 'no-such-bookmark-xyz');
  await expect(page.locator('.empty')).toContainText('No bookmarks match');
});
