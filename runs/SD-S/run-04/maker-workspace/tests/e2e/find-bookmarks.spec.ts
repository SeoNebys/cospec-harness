import { test, expect } from '@playwright/test';
test('searches and clears collection filters', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /create an account/i }).click();
  await page.getByLabel('Email address').fill(`find-${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('button', { name: /add bookmark/i }).click();
  await page.getByLabel(/web address/i).fill('https://example.com/ocean');
  await page.getByLabel(/title/i).fill('Ocean type');
  await page.getByLabel(/notes/i).fill('Serif research');
  await page.getByLabel(/tags/i).fill('Design');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await page.getByRole('searchbox', { name: /search bookmarks/i }).fill('serif');
  await expect(page.getByRole('link', { name: /Ocean type/ })).toBeVisible();
  await page.getByRole('button', { name: /clear search/i }).click();
  await expect(page.getByRole('link', { name: /Ocean type/ })).toBeVisible();
});
