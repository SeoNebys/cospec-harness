import { expect, test } from '@playwright/test';
import { resetE2eData } from './database.js';

test.beforeEach(() => resetE2eData());

test('keeps saved bookmarks after a page session reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await page.getByLabel('Title').fill('Persistent link');
  await page.getByLabel('Web address').fill('https://example.com/persistent');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByRole('heading', { name: 'Persistent link' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Persistent link' })).toBeVisible();
});
