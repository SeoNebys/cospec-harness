import { test, expect } from '@playwright/test';
import { ready, seed, uid } from './helpers.js';

test('edit fields persist; delete removes permanently with confirmation', async ({ page }) => {
  const k = uid();
  await ready(page);
  await seed(page, { title: `${k} Original title`, tags: [`${k}t`] });

  await page.fill('#search', `#${k}t`);
  await expect(page.locator('.card')).toHaveCount(1);

  // Edit title + description
  await page.locator('.card').getByRole('button', { name: 'Edit' }).click();
  await page.waitForSelector('.modal h3');
  const titleField = page.locator('.modal input[type=text]').first();
  await titleField.fill(`${k} Edited title`);
  await page.locator('.modal textarea').first().fill('edited description');
  await page.click('.modal button.primary');

  // Persist after reload
  await page.reload();
  await page.waitForSelector('body[data-harness-ready="true"]');
  await page.fill('#search', `#${k}t`);
  await expect(page.locator('.card .title')).toHaveText(`${k} Edited title`);
  await expect(page.locator('.card .desc')).toHaveText('edited description');

  // Delete (accept confirm)
  page.once('dialog', (d) => d.accept());
  await page.locator('.card').getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('#empty-state')).toBeVisible();

  // Stays gone after reload
  await page.reload();
  await page.waitForSelector('body[data-harness-ready="true"]');
  await page.fill('#search', `#${k}t`);
  await expect(page.locator('.card')).toHaveCount(0);
});
