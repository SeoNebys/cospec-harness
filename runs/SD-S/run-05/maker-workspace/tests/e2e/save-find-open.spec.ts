import { test, expect } from '@playwright/test';

// Primary journey (FR-008, SC-002): save two bookmarks, search to narrow to one,
// and confirm the item links to the saved address.
test('save → find → open', async ({ page }) => {
  await page.goto('/');

  // Save first bookmark (explicit title so no network fetch is needed).
  await page.getByLabel('Web address').fill('https://playwright.dev');
  await page.getByLabel('Title').fill('Playwright Docs');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByText('Playwright Docs')).toBeVisible();

  // Save a second, unrelated bookmark.
  await page.getByLabel('Web address').fill('https://example.com/recipes');
  await page.getByLabel('Title').fill('Dinner Recipes');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByText('Dinner Recipes')).toBeVisible();

  // Search narrows the list to the matching bookmark.
  await page.getByLabel('Search bookmarks').fill('playwright');
  await expect(page.getByText('Dinner Recipes')).toHaveCount(0);
  const link = page.getByRole('link', { name: 'Playwright Docs' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'https://playwright.dev');

  // A non-matching search shows the "no matches" guidance.
  await page.getByLabel('Search bookmarks').fill('zzz-nothing-matches');
  await expect(page.getByText('No matches')).toBeVisible();
});
