import { expect, test } from '@playwright/test';
import { resetE2eData } from './database.js';

test.beforeEach(() => resetE2eData());

test('searches, combines tags, sorts, shows no results, and resets', async ({ page }) => {
  await page.goto('/');
  for (const bookmark of [
    {
      title: 'Zebra Guide',
      url: 'https://example.com/zebra',
      notes: 'Striped reference',
      tags: 'Code, Shared',
    },
    {
      title: 'Alpha Notes',
      url: 'https://example.com/alpha',
      notes: 'Garden ideas',
      tags: 'Home, Shared',
    },
  ]) {
    await page.getByRole('button', { name: 'Add bookmark' }).click();
    await page.getByLabel('Title').fill(bookmark.title);
    await page.getByLabel('Web address').fill(bookmark.url);
    await page.getByLabel('Notes').fill(bookmark.notes);
    await page.getByRole('textbox', { name: 'Tags' }).fill(bookmark.tags);
    await page.getByRole('button', { name: 'Save bookmark' }).click();
  }
  await expect(page.getByText('2 saved links')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alpha Notes' })).toBeVisible();

  await page.getByLabel('Search bookmarks').fill('GARDEN');
  await expect(page.getByRole('heading', { name: 'Alpha Notes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Zebra Guide' })).toBeHidden();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page.getByRole('button', { name: /Shared/ }).click();
  await page.getByRole('button', { name: /Code/ }).click();
  await expect(page.getByRole('heading', { name: 'Zebra Guide' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alpha Notes' })).toBeHidden();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page.getByLabel('Sort bookmarks').selectOption('title');
  await expect(page.locator('.bookmark-card h2').first()).toHaveText('Alpha Notes');
  await page.getByLabel('Search bookmarks').fill('does not exist');
  await expect(page.getByText('No links match this view')).toBeVisible();
  await page.getByRole('button', { name: 'Reset search and filters' }).click();
  await expect(page.getByRole('heading', { name: 'Zebra Guide' })).toBeVisible();
});
