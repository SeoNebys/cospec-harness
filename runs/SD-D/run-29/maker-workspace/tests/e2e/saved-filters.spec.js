import { test, expect } from '@playwright/test';
import { ready, seed, uid } from './helpers.js';

test('create, apply, and delete a saved filter combining search + excluded tag', async ({ page }) => {
  const k = uid();
  await ready(page);
  await seed(page, { title: `${k} Keeper`, tags: [`${k}topic`] });
  await seed(page, { title: `${k} Excluded`, tags: [`${k}topic`, `${k}skip`] });

  // Search, then save current search as a filter with an excluded tag
  await page.fill('#search', `#${k}topic`);
  await expect(page.locator('.card')).toHaveCount(2);
  await page.click('#btn-save-filter');
  await page.waitForSelector('.modal');
  await page.locator('.modal input').nth(0).fill(`${k} Filter`);
  await page.locator('.modal input').nth(2).fill(`${k}skip`); // exclude tags field
  await page.click('.modal .row button:last-child');

  // Clear search, apply the saved filter from the sidebar
  await page.fill('#search', '');
  await page.locator('#filter-list .apply', { hasText: `${k} Filter` }).click();
  await expect(page.locator('#active-filter')).toContainText(`${k} Filter`);
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card .title')).toContainText(`${k} Keeper`);

  // Delete the filter
  await page.locator('#filter-list li', { hasText: `${k} Filter` }).getByRole('button', { name: '✕' }).click();
  await expect(page.locator('#filter-list .apply', { hasText: `${k} Filter` })).toHaveCount(0);
});
