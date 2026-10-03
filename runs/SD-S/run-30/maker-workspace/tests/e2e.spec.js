import { test, expect } from '@playwright/test';

// End-to-end smoke: save -> list -> search. Assumes the app is running at
// baseURL (see playwright.config.js, which starts the server on port 4100 with
// an isolated database).

test('save, list, and search a bookmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app[data-harness-ready="true"]')).toBeVisible();

  const unique = `Playwright ${Date.now()}`;
  await page.fill('#add-url', 'https://playwright.dev/');
  await page.fill('#add-title', unique);
  await page.fill('#add-tags', 'testing, tools');
  await page.click('#add-form button[type="submit"]');

  // Appears in the list.
  const item = page.locator('.bookmark', { hasText: unique });
  await expect(item).toBeVisible();
  await expect(item.locator('.tag')).toHaveText(['testing', 'tools']);

  // Search narrows to the match.
  await page.fill('#search', unique);
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await expect(page.locator('.bookmark-title')).toHaveText(unique);

  // A non-matching search shows the no-results state.
  await page.fill('#search', 'zzz-no-such-bookmark-zzz');
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('#empty-state')).toContainText('No bookmarks match');
});
