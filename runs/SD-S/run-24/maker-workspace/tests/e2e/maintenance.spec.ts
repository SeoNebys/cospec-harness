import { expect, test } from '@playwright/test';

import { resetE2eData } from './database.js';

test.beforeEach(() => resetE2eData());

test('edits, favorites, archives, restores, and confirms deletion while preserving view state', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add bookmark' }).click();
  await page.getByLabel('Title').fill('Maintain me');
  await page.getByLabel('Web address').fill('https://example.com/maintain');
  await page.getByRole('textbox', { name: 'Tags' }).fill('Work');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await expect(page.getByRole('heading', { name: 'Maintain me' })).toBeVisible();

  await page.getByLabel('Search bookmarks').fill('Maintain');
  await expect(page.getByLabel('Search bookmarks')).toHaveValue('Maintain');
  await page.getByLabel('Sort bookmarks').selectOption('title');
  await expect(page.getByLabel('Search bookmarks')).toHaveValue('Maintain');
  await expect(page.getByLabel('Sort bookmarks')).toHaveValue('title');
  await page.getByRole('button', { name: 'Edit Maintain me' }).click();
  await expect(page.getByLabel('Search bookmarks')).toHaveValue('Maintain');
  await page.getByLabel('Title').fill('Maintained');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByLabel('Search bookmarks')).toHaveValue('Maintain');
  await expect(page.getByLabel('Sort bookmarks')).toHaveValue('title');
  await expect(page.getByRole('heading', { name: 'Maintained' })).toBeVisible();

  await page.getByRole('button', { name: 'Favorite Maintained' }).click();
  await expect(
    page.getByRole('button', { name: 'Remove Maintained from favorites' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Archive Maintained' }).click();
  await page.getByLabel('Bookmark status').selectOption('archived');
  await expect(page.getByRole('heading', { name: 'Maintained' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore Maintained' }).click();
  await page.getByLabel('Bookmark status').selectOption('active');

  await page.getByRole('button', { name: 'Delete Maintained' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'Maintained' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Maintained' }).click();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByText('No links match this view')).toBeVisible();
});
