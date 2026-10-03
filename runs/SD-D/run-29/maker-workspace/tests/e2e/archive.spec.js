import { test, expect } from '@playwright/test';
import { ready, seed, uid } from './helpers.js';

test('archive hides from list/search, shows in archive view, restore returns it', async ({ page }) => {
  const k = uid();
  await ready(page);
  await seed(page, { title: `${k} Archivable`, tags: [`${k}a`] });

  await page.fill('#search', `#${k}a`);
  await expect(page.locator('.card')).toHaveCount(1);

  // Archive from the card
  await page.locator('.card').getByRole('button', { name: 'Archive' }).click();
  await expect(page.locator('.card')).toHaveCount(0); // gone from normal search

  // Present in archive view only
  await page.click('.view-tab[data-view="archived"]');
  await page.fill('#search', `#${k}a`);
  await expect(page.locator('.card')).toHaveCount(1);

  // Restore -> back in All
  await page.locator('.card').getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('.card')).toHaveCount(0); // gone from archived view
  await page.click('.view-tab[data-view="all"]');
  await page.fill('#search', `#${k}a`);
  await expect(page.locator('.card')).toHaveCount(1);
});
