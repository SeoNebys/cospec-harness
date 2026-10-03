import { test, expect } from '@playwright/test';

test('full bookmark flow: save, tag, filter, search, edit, delete, dedupe', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app[data-harness-ready="true"]')).toBeVisible();

  // Save a bookmark with a tag.
  await page.fill('#address', 'https://example.com/first');
  await page.fill('#tags', 'reading');
  await page.click('#submit-btn');
  await expect(page.locator('.bookmark')).toHaveCount(1);

  // Save a second with a different tag.
  await page.fill('#address', 'https://example.org/second');
  await page.fill('#tags', 'news');
  await page.click('#submit-btn');
  await expect(page.locator('.bookmark')).toHaveCount(2);

  // Filter by tag.
  await page.click('.tag-chip:has-text("news")');
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await page.click('.tag-chip.active');
  await expect(page.locator('.bookmark')).toHaveCount(2);

  // Case-insensitive search.
  await page.fill('#search', 'SECOND');
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await page.fill('#search', '');
  await expect(page.locator('.bookmark')).toHaveCount(2);

  // Edit a bookmark's title.
  await page.locator('.bookmark', { hasText: 'example.com/first' }).getByRole('button', { name: 'Edit' }).click();
  // Wait for the edit form to finish loading the bookmark before typing.
  await expect(page.locator('#edit-id')).not.toHaveValue('');
  await page.fill('#title', 'My First Bookmark');
  await page.click('#submit-btn');
  await expect(
    page.locator('.bookmark', { hasText: 'example.com/first' }).locator('.title')
  ).toContainText('My First Bookmark');

  // Re-saving an existing address opens it for editing (no duplicate).
  await page.fill('#address', 'https://EXAMPLE.org/second/');
  await page.click('#submit-btn');
  await expect(page.locator('#form-error')).toContainText('already bookmarked');
  await page.click('#cancel-edit');
  await expect(page.locator('.bookmark')).toHaveCount(2);

  // Delete a bookmark.
  page.on('dialog', (d) => d.accept());
  await page.locator('.bookmark').first().getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.bookmark')).toHaveCount(1);
});
