import { test, expect } from '@playwright/test';
test('application reaches a real ready state and exposes every approved workflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /Save a link/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Bookmark views' })).toBeVisible();
  await expect(page.getByLabel('Search bookmarks')).toBeVisible();
  await expect(page.getByLabel('Sort bookmarks')).toBeVisible();
});
