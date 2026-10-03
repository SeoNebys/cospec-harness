import { test, expect } from '@playwright/test';
import { clearAll, seed, mockPreview } from './helper.js';

test.beforeEach(async ({ request }) => { await clearAll(request); });

test('US1: save a bookmark, adjust title before save, persists', async ({ page }) => {
  await mockPreview(page, {
    url: 'https://example.com/article', urlKey: 'https://example.com/article',
    title: 'Fetched Title', description: 'Fetched description',
    faviconUrl: null, previewImageUrl: null, metadataUnavailable: false, existing: null,
  });
  page.on('dialog', (d) => d.accept('https://example.com/article'));

  await page.goto('/');
  await expect(page.locator('#app[data-harness-ready="true"]')).toBeVisible();
  await page.click('#add-button');

  const titleInput = page.locator('#bookmark-form input[name="title"]');
  await expect(titleInput).toHaveValue('Fetched Title');
  await titleInput.fill('My Adjusted Title');
  await page.click('#bookmark-form button[type="submit"]');

  await expect(page.locator('.bookmark .title', { hasText: 'My Adjusted Title' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.bookmark .title', { hasText: 'My Adjusted Title' })).toBeVisible();
});

test('US2: saving a duplicate opens the existing bookmark for editing', async ({ page, request }) => {
  const existing = await seed(request, 'https://dup.com/x', { title: 'Original' });
  await mockPreview(page, { url: 'https://dup.com/x', existing: { id: existing.id } });
  page.on('dialog', (d) => d.accept('https://dup.com/x'));

  await page.goto('/');
  await page.click('#add-button');
  // Edit form for the existing bookmark should appear (not a create form).
  await expect(page.locator('#bookmark-form h2')).toHaveText('Edit bookmark');
  await expect(page.locator('#bookmark-form input[name="title"]')).toHaveValue('Original');
});

test('US3: edit fields and Markdown note render', async ({ page, request }) => {
  const b = await seed(request, 'https://edit.com/1', { title: 'Before' });
  await page.goto('/');
  await page.locator(`.bookmark[data-id="${b.id}"] button`, { hasText: 'Edit' }).click();
  await page.fill('#bookmark-form input[name="title"]', 'After');
  await page.fill('#bookmark-form textarea[name="noteMd"]', '**bold note**');
  await page.click('#bookmark-form button[type="submit"]');
  await expect(page.locator('.bookmark .title', { hasText: 'After' })).toBeVisible();

  // Reopen and confirm the note persisted and renders bold.
  await page.locator(`.bookmark[data-id="${b.id}"] button`, { hasText: 'Edit' }).click();
  await expect(page.locator('#note-preview strong')).toHaveText('bold note');
});
