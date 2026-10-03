import { test, expect } from '@playwright/test';

// These run against a freshly started server with an in-memory DB (see
// playwright.config.js). Tests run serially and share that DB, so ordering
// matters; each test builds on a clean-ish starting point.

test.describe.configure({ mode: 'serial' });

async function addBookmark(page, { url, title = '', notes = '', tags = '' }) {
  await page.getByRole('button', { name: '+ Add bookmark' }).click();
  await page.locator('#field-url').fill(url);
  if (title) await page.locator('#field-title').fill(title);
  if (notes) await page.locator('#field-notes').fill(notes);
  if (tags) await page.locator('#field-tags').fill(tags);
  await page.locator('#form-submit').click();
}

test('page loads and marks harness ready with an empty state (US2/FR-013)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#list-region[data-harness-ready="true"]')).toBeVisible();
  await expect(page.locator('#empty-state')).toBeVisible();
});

test('Scenario A: save a bookmark, address normalised and titled (US1)', async ({ page }) => {
  await page.goto('/');
  await addBookmark(page, { url: 'example.com', title: 'Example Home', tags: 'demo' });

  const first = page.locator('.bookmark').first();
  await expect(first.locator('.bookmark-title')).toHaveText('Example Home');
  await expect(first.locator('.bookmark-url')).toHaveText('https://example.com/');
  await expect(first.locator('.tag')).toHaveText('demo');
});

test('Scenario A: invalid address is rejected (US1/FR-002)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '+ Add bookmark' }).click();
  await page.locator('#field-url').fill('not a url');
  await page.locator('#form-submit').click();
  await expect(page.locator('#form-error')).toBeVisible();
  await expect(page.locator('#form-error')).toContainText(/valid web address/i);
});

test('Scenario B: bookmark link opens the target (US2/FR-007)', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('.bookmark-title').first();
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('href', /example\.com/);
});

test('Scenario E: duplicate warns then saves with confirm (FR-010)', async ({ page }) => {
  await page.goto('/');
  // Cancel the still-open form from the previous invalid attempt if present.
  await addBookmark(page, { url: 'example.com', title: 'Dup Attempt' });
  await expect(page.locator('#dup-warning')).toBeVisible();
  await expect(page.locator('#form-submit')).toHaveText('Save anyway');
  await page.locator('#form-submit').click();
  await expect(page.locator('#form-overlay')).toBeHidden();
});

test('Scenario C: edit a bookmark title (US3/FR-008)', async ({ page }) => {
  await page.goto('/');
  const target = page.locator('.bookmark').filter({ hasText: 'Example Home' }).first();
  await target.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#field-title').fill('Edited Title');
  await page.locator('#form-submit').click();
  await expect(page.locator('.bookmark').filter({ hasText: 'Edited Title' })).toHaveCount(1);
});

test('Scenario C: delete requires confirmation then removes (US3/FR-009)', async ({ page }) => {
  await page.goto('/');
  const before = await page.locator('.bookmark').count();
  const target = page.locator('.bookmark').filter({ hasText: 'Edited Title' }).first();
  await target.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('#confirm-overlay')).toBeVisible();
  await page.locator('#confirm-delete').click();
  await expect(page.locator('.bookmark').filter({ hasText: 'Edited Title' })).toHaveCount(0);
  await expect(page.locator('.bookmark')).toHaveCount(before - 1);
});

test('Scenario D: search and tag filter with no-results state (US4)', async ({ page }) => {
  await page.goto('/');
  await addBookmark(page, { url: 'example.com/news', title: 'World News', tags: 'news' });
  await addBookmark(page, { url: 'example.com/dev', title: 'Dev Blog', tags: 'dev' });

  // Search
  await page.locator('#search').fill('World News');
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await expect(page.locator('.bookmark').first()).toContainText('World News');

  // No results state
  await page.locator('#search').fill('zzzznope');
  await expect(page.locator('#no-results')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('#no-results')).toBeHidden();

  // Tag filter
  await page.locator('#tag-filter').selectOption('dev');
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await expect(page.locator('.bookmark').first()).toContainText('Dev Blog');
});
