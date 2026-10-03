import { expect, test } from '@playwright/test';
import { resetBookmarks } from '../fixtures/bookmarks';

test.beforeEach(() => resetBookmarks());

test('search, combine filters, favorite, sort, and clear criteria', async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;
  const records = [
    { url: `https://example.com/${suffix}/design`, title: `Design notes ${suffix}`, notes: 'Interface handbook', tags: ['Research'] },
    { url: `https://example.com/${suffix}/recipe`, title: `Pasta recipe ${suffix}`, notes: 'Weeknight dinner', tags: ['Food'] },
    { url: `https://example.com/${suffix}/tools`, title: `Useful tools ${suffix}`, notes: 'Design workflow', tags: ['Research', 'Work'] },
  ];
  for (const record of records) await page.request.post('/api/bookmarks', { data: record });
  await page.goto('/');
  await expect(page.getByRole('link', { name: records[0]!.title })).toBeVisible();
  await page.getByLabel('Search bookmarks').fill('handbook');
  await expect(page.getByRole('link', { name: records[0]!.title })).toBeVisible();
  await expect(page.getByRole('link', { name: records[1]!.title })).toBeHidden();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: new RegExp(`add ${records[0]!.title} to favorites`, 'i') }).click();
  await page.getByLabel(/Favorites only/).check();
  await expect(page.getByRole('link', { name: records[0]!.title })).toBeVisible();
  await expect(page.getByRole('link', { name: records[2]!.title })).toBeHidden();
  await page.getByRole('combobox', { name: 'Tag', exact: true }).selectOption('Research');
  await expect(page.getByLabel('Active filters')).toContainText('Research');
  await page.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('title');
  await expect(page.getByLabel('Active filters')).toContainText('Favorites only');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('link', { name: records[1]!.title })).toBeVisible();
});
