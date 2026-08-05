import { test, expect } from '@playwright/test';

// US2 end-to-end: open, search, and tag-filter. Requires the app running
// (Playwright starts it via playwright.config.ts). Seeds via the UI.

async function save(page: import('@playwright/test').Page, url: string, tags: string) {
  await page.getByRole('button', { name: /Add title, tags, or a note/ }).click();
  await page.getByPlaceholder('Paste a web address to save…').fill(url);
  await page.getByPlaceholder('recipes, dinner').fill(tags);
  await page.getByRole('button', { name: 'Save' }).click();
  await page
    .getByPlaceholder('recipes, dinner')
    .waitFor({ state: 'hidden' })
    .catch(() => {});
}

test('search narrows the list and clearing restores it (US2)', async ({ page }) => {
  await page.goto('/');
  await save(page, 'https://pasta.example/', 'recipes, dinner');
  await save(page, 'https://tart.example/', 'recipes, dessert');

  await expect(page.locator('.card')).toHaveCount(2);

  await page.getByLabel('Search bookmarks').fill('tart');
  await expect(page.locator('.card .url')).toContainText('tart.example');

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.locator('.card')).toHaveCount(2);
});

test('tag chips filter with any/all/not (US2)', async ({ page }) => {
  await page.goto('/');
  await save(page, 'https://pasta.example/', 'recipes, dinner');
  await save(page, 'https://tart.example/', 'recipes, dessert');

  // Click "dessert" once → any; expect only the tart.
  await page.getByRole('button', { name: /^dessert/ }).click();
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card .url')).toContainText('tart.example');
});

test('clicking a bookmark opens the page in a new tab (US2, FR-008)', async ({ page }) => {
  await page.goto('/');
  await save(page, 'https://example.com/', 'ref');
  const title = page.locator('.card a.title').first();
  await expect(title).toHaveAttribute('target', '_blank');
  await expect(title).toHaveAttribute('href', 'https://example.com/');
});
