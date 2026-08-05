import { test, expect } from '@playwright/test';

// End-to-end smoke flow for the MVP: save → find → open (quickstart.md).
test('save, find, and open a bookmark', async ({ page }) => {
  await page.goto('/');

  // Empty state on first load.
  await expect(page.getByText(/haven’t saved any bookmarks/i)).toBeVisible();

  // Save a bookmark.
  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await page.getByLabel('Web address').fill('https://playwright.dev');
  await page.getByLabel('Title').fill('Playwright');
  await page.getByLabel('Tags').fill('testing');
  await page.getByRole('button', { name: 'Save bookmark' }).click();

  // It appears in the list.
  const link = page.getByRole('link', { name: 'Playwright' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'https://playwright.dev/');

  // Find it by keyword.
  await page.getByLabel('Search bookmarks').fill('play');
  await expect(link).toBeVisible();

  // Reload — it persists.
  await page.reload();
  await expect(page.getByRole('link', { name: 'Playwright' })).toBeVisible();
});
