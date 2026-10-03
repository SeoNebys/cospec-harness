import { test, expect } from '@playwright/test';

// Smoke test of the primary journeys. Requires the app running on :4000
// (npm start) with an empty/dev database.

test('save, list, tag, search, and delete a bookmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();

  // Add a bookmark with a tag and note.
  const unique = `example.com/e2e-${Date.now()}`;
  await page.fill('#add-url', `https://${unique}`);
  await page.locator('.add-details summary').click();
  await page.fill('#add-title', 'E2E Bookmark');
  await page.fill('#add-tags', 'e2e-tag');
  await page.fill('#add-note', 'created by playwright');
  await page.click('#add-submit');

  const card = page.locator('.bookmark', { hasText: 'E2E Bookmark' });
  await expect(card).toBeVisible();
  await expect(card.locator('.tag', { hasText: 'e2e-tag' })).toBeVisible();

  // Search finds it by note text.
  await page.fill('#search', 'created by playwright');
  await expect(page.locator('.bookmark', { hasText: 'E2E Bookmark' })).toBeVisible();

  // Clear search, then delete with confirmation.
  await page.click('#clear-search');
  await card.getByRole('button', { name: 'Delete' }).click();
  await page.click('#delete-confirm');
  await expect(page.locator('.bookmark', { hasText: 'E2E Bookmark' })).toHaveCount(0);
});
