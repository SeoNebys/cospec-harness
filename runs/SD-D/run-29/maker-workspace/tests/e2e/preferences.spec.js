import { test, expect } from '@playwright/test';
import { ready, seed, uid } from './helpers.js';

test('display preferences (sort, density, text size) apply and persist', async ({ page }) => {
  const k = uid();
  await ready(page);
  await seed(page, { title: `${k} Pref`, description: 'has a description', tags: [`${k}pr`] });

  await page.click('#btn-prefs');
  await page.waitForSelector('.modal');
  const selects = page.locator('.modal select');
  await selects.nth(0).selectOption('title_asc');   // default sort
  await selects.nth(1).selectOption('compact');      // density
  await selects.nth(2).selectOption('large');        // text size
  await page.click('.modal .row button:last-child');

  // Applied immediately
  await expect(page.locator('body')).toHaveAttribute('data-text-size', 'large');
  await expect(page.locator('body')).toHaveAttribute('data-density', 'compact');
  // Compact hides descriptions
  await page.fill('#search', `#${k}pr`);
  await expect(page.locator('.card .desc')).toBeHidden();

  // Persist across reload
  await page.reload();
  await page.waitForSelector('body[data-harness-ready="true"]');
  await expect(page.locator('body')).toHaveAttribute('data-text-size', 'large');
  await expect(page.locator('body')).toHaveAttribute('data-density', 'compact');
  await expect(page.locator('#sort')).toHaveValue('title_asc');
});
