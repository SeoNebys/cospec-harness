import { expect, test } from '@playwright/test';
import { navigate, saveBookmark, signIn } from './helpers';

test('saves and reopens a live search configuration', async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const title = `Saved search target ${suffix}`;
  const name = `Useful search ${suffix}`;
  await signIn(page);
  await saveBookmark(page, { url: `https://example.com/saved-search-${suffix}`, title });
  await page.getByLabel('Search bookmarks').fill(`"${title}"`);
  await expect(page.getByRole('button', { name: `View details for ${title}` })).toBeVisible();
  await page.getByRole('button', { name: '☆ Save this search' }).click();
  await page.getByRole('dialog', { name: 'Save this search' }).getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Save search' }).click();
  await navigate(page, 'Saved Searches');
  await expect(page.getByRole('button', { name })).toBeVisible();
  await page.getByRole('button', { name }).click();
  await expect(page.getByLabel('Search bookmarks')).toHaveValue(`"${title}"`);
});
