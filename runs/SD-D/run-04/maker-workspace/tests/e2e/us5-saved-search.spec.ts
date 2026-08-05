import { test, expect } from '@playwright/test';

// US5 end-to-end: build a search, save it, clear, then re-apply. App started by config.

async function save(page: import('@playwright/test').Page, url: string, tags: string) {
  await page.getByRole('button', { name: /Add title, tags, or a note/ }).click();
  await page.getByPlaceholder('Paste a web address to save…').fill(url);
  await page.getByPlaceholder('recipes, dinner').fill(tags);
  await page.getByRole('button', { name: 'Save' }).click();
}

test('save a search and re-apply it (US5)', async ({ page }) => {
  await page.goto('/');
  await save(page, 'https://pasta.example/', 'recipes');
  await save(page, 'https://tax.example/', 'finance');

  // Build a text search, save it under a name.
  await page.getByLabel('Search bookmarks').fill('pasta');
  await page.getByPlaceholder('Name this search…').fill('My Pasta');
  await page.getByRole('button', { name: 'Save search' }).click();

  // Clear, then re-apply the saved search.
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.locator('.card')).toHaveCount(2);
  await page.getByRole('button', { name: 'My Pasta' }).click();
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card .url')).toContainText('pasta.example');
});
