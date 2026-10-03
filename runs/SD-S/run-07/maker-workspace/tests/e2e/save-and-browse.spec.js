import { test, expect } from '@playwright/test';

test('save a bookmark, see it newest-first, then search for it', async ({ page }) => {
  const stamp = Date.now();
  const url = `https://e2e-save-${stamp}.example.com/page`;
  const title = `E2E Save ${stamp}`;

  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');

  await page.fill('#url-input', url);
  await page.fill('#title-input', title);
  await page.click('#save-btn');

  const list = page.locator('#bookmark-list');
  const first = list.locator('.bookmark').first();
  await expect(first.locator('.bookmark-title')).toHaveText(title);
  await expect(first.locator('.bookmark-title')).toHaveAttribute('href', url);
  await expect(first.locator('.bookmark-title')).toHaveAttribute('target', '_blank');

  // Search narrows to the saved bookmark.
  await page.fill('#search-input', title);
  await expect(list.locator('.bookmark')).toHaveCount(1);
  await expect(list.locator('.bookmark-title')).toHaveText(title);

  // A non-matching search shows the no-results state.
  await page.fill('#search-input', `no-match-${stamp}`);
  await expect(page.locator('#no-results')).toBeVisible();
});
