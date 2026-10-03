import { test, expect } from '@playwright/test';

// End-to-end happy path: add (with review) → list → search → archive → find in
// Archived. Metadata/snapshot network steps degrade gracefully.
test('save, search and archive a bookmark', async ({ page }) => {
  const stamp = Date.now();
  const url = `https://example.com/e2e-${stamp}`;
  const title = `E2E Bookmark ${stamp}`;

  await page.goto('/');
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();

  // Add a bookmark
  await page.click('text=+ Add bookmark');
  await page.fill('input[placeholder="https://example.com/article"]', url);
  await page.click('text=Fetch details');

  // Wait for the review stage, then set the title (labeled input avoids matching
  // the URL-stage input while the preview is still loading).
  await expect(page.getByRole('button', { name: 'Save bookmark' })).toBeVisible();
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Save bookmark' }).click();

  // Wait for the commit to land on the edit view before navigating away.
  await expect(page.getByRole('heading', { name: 'Edit bookmark' })).toBeVisible();

  // Go to All and confirm it appears
  await page.click('text=All bookmarks');
  await page.fill('input[type="search"]', title);
  const card = page.locator('.card').filter({ hasText: title });
  await expect(card).toBeVisible();

  // Archive from the row
  await card.getByRole('button', { name: 'Archive' }).click();

  // It appears in Archived
  await page.click('text=Archived');
  await page.fill('input[type="search"]', title);
  await expect(page.locator('.card').filter({ hasText: title })).toBeVisible();
});
