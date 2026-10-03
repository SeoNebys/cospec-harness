import { test, expect } from '@playwright/test';
import { clearAllBookmarks } from './reset.js';

// US3 (edit & delete) + US4 (organize & find).

test.beforeEach(async ({ request, baseURL }) => {
  await clearAllBookmarks(request, baseURL);
});

async function seed(page, { url, title, tags = '' }) {
  await page.fill('#url-input', url);
  await page.fill('#title-input', title);
  await page.fill('#tags-input', tags);
  await page.click('#save-form button[type="submit"]');
  await expect(page.locator('.bookmark-item').first().locator('.bookmark-title')).toHaveText(
    title
  );
}

test('edits a bookmark title and it persists', async ({ page }) => {
  await page.goto('/');
  await seed(page, { url: 'https://edit.example.com', title: 'Before' });

  await page.locator('.bookmark-item').first().getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#edit-dialog')).toBeVisible();
  await page.fill('#edit-title', 'After');
  await page.click('#edit-save');

  await expect(
    page.locator('.bookmark-item').first().locator('.bookmark-title')
  ).toHaveText('After');

  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
  await expect(
    page.locator('.bookmark-item').first().locator('.bookmark-title')
  ).toHaveText('After');
});

test('deletes a bookmark after confirmation and returns to empty state', async ({
  page,
}) => {
  await page.goto('/');
  await seed(page, { url: 'https://del.example.com', title: 'Delete Me' });

  page.on('dialog', (dialog) => dialog.accept());
  await page
    .locator('.bookmark-item')
    .first()
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect(page.locator('.bookmark-item')).toHaveCount(0);
  await expect(page.locator('#empty-state')).toBeVisible();
});

test('cancelling a delete leaves the bookmark unchanged', async ({ page }) => {
  await page.goto('/');
  await seed(page, { url: 'https://keep.example.com', title: 'Keep Me' });

  page.on('dialog', (dialog) => dialog.dismiss());
  await page
    .locator('.bookmark-item')
    .first()
    .getByRole('button', { name: 'Delete' })
    .click();

  await expect(page.locator('.bookmark-item')).toHaveCount(1);
  await expect(
    page.locator('.bookmark-item').first().locator('.bookmark-title')
  ).toHaveText('Keep Me');
});

test('filters by tag and searches by text, with a no-results state', async ({
  page,
}) => {
  await page.goto('/');
  await seed(page, {
    url: 'https://space.example.com',
    title: 'Space News',
    tags: 'science',
  });
  await seed(page, {
    url: 'https://pasta.example.com',
    title: 'Pasta Recipes',
    tags: 'cooking',
  });

  // Tag filter narrows to one.
  await page.selectOption('#tag-filter', 'cooking');
  await expect(page.locator('.bookmark-item')).toHaveCount(1);
  await expect(
    page.locator('.bookmark-item').first().locator('.bookmark-title')
  ).toHaveText('Pasta Recipes');

  // Clear restores both.
  await page.click('#clear-filters');
  await expect(page.locator('.bookmark-item')).toHaveCount(2);

  // Search narrows by title text.
  await page.fill('#search-input', 'space');
  await expect(page.locator('.bookmark-item')).toHaveCount(1);
  await expect(
    page.locator('.bookmark-item').first().locator('.bookmark-title')
  ).toHaveText('Space News');

  // A non-matching term shows the no-results state.
  await page.fill('#search-input', 'zzzznope');
  await expect(page.locator('#no-results')).toBeVisible();
  await expect(page.locator('.bookmark-item')).toHaveCount(0);

  // Clearing filters brings everything back.
  await page.click('#clear-filters');
  await expect(page.locator('.bookmark-item')).toHaveCount(2);
});
