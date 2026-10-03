import { test, expect } from '@playwright/test';
import { ready, seed, uid } from './helpers.js';

test('bulk mark-read on a manual selection', async ({ page }) => {
  const k = uid();
  await ready(page);
  await seed(page, { title: `${k} One`, tags: [`${k}g`] });
  await seed(page, { title: `${k} Two`, tags: [`${k}g`] });
  await page.fill('#search', `#${k}g`);
  await expect(page.locator('.card')).toHaveCount(2);

  // Select both via header select-all, then mark read
  await page.click('#select-all');
  await expect(page.locator('#sel-count')).toHaveText('2 selected');
  page.once('dialog', (d) => d.accept());
  await page.click('[data-bulk="mark_read"]');

  // Both should no longer show the Unread badge
  await expect(page.locator('.card .badge.unread')).toHaveCount(0);
});

test('select all matching a search then archive affects the whole set', async ({ page }) => {
  const k = uid();
  await ready(page);
  for (let i = 0; i < 3; i++) await seed(page, { title: `${k} Item ${i}`, tags: [`${k}m`] });
  await page.fill('#search', `#${k}m`);
  await expect(page.locator('.card')).toHaveCount(3);

  await page.click('#bulk-select-matching');
  await expect(page.locator('#sel-count')).toHaveText('All matching selected');
  await page.click('[data-bulk="archive"]');

  // All archived -> gone from normal search
  await expect(page.locator('.card')).toHaveCount(0);
  // Present in archived view
  await page.click('.view-tab[data-view="archived"]');
  await page.fill('#search', `#${k}m`);
  await expect(page.locator('.card')).toHaveCount(3);
});
