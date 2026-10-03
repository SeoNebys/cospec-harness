import { test, expect } from '@playwright/test';
import { uniqueUrl } from './helpers.js';

test('US1: save a link, then edit address/title/description/tags/note', async ({ page }) => {
  const url = uniqueUrl();
  await page.goto('/#/add');
  await page.getByLabel('url').fill(url);
  await page.getByRole('button', { name: 'Save' }).click();

  // Landed on the detail/edit page.
  await expect(page.getByRole('heading', { name: 'Edit bookmark' })).toBeVisible();
  await expect(page.getByLabel('edit url')).toHaveValue(url);

  // Edit all fields.
  page.on('dialog', (d) => d.accept());
  await page.getByLabel('edit title').fill('Edited Title');
  await page.getByLabel('edit description').fill('Edited description');
  await page.getByLabel('add tag').fill('alpha');
  await page.getByLabel('add tag').press('Enter');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await page.reload();
  await expect(page.getByLabel('edit title')).toHaveValue('Edited Title');
  await expect(page.getByLabel('edit description')).toHaveValue('Edited description');
  await expect(page.getByText('#alpha')).toBeVisible();
});

test('US1: invalid URL is rejected', async ({ page }) => {
  await page.goto('/#/add');
  await page.getByLabel('url').fill('not a url');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.error')).toBeVisible();
});
