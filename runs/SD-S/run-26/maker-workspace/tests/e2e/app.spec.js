import { test, expect } from '@playwright/test';

test('app loads and reports harness ready with an empty state', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
  await expect(page.locator('#empty')).toBeVisible();
});

test('save a bookmark with auto-fetched details and open its snapshot (US1/US2)', async ({ page, baseURL }) => {
  await page.goto('/');
  // Bookmark the app's own served page (reachable, has <title>).
  await page.fill('#add-input', `${baseURL}/index.html`);
  await page.click('#add-btn');

  const card = page.locator('.card').first();
  await expect(card).toBeVisible({ timeout: 30000 });
  await expect(card.locator('.card-title')).toContainText('Bookmark Manager');

  await card.click();
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#snapshot-row a')).toBeVisible();
});

test('edit, mark read, archive, and delete flow (US3/US4/US6)', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.card').first();
  await card.click();

  // Edit title + notes.
  await page.fill('#edit-title', 'Renamed Bookmark');
  await page.fill('#edit-notes', 'my note');
  await page.click('#save-edit');
  await expect(page.locator('.card-title').first()).toContainText('Renamed Bookmark');

  // Notes are searchable.
  await page.fill('#search', 'my note');
  await expect(page.locator('.card')).toHaveCount(1);
  await page.fill('#search', '');

  // Mark read -> leaves the Unread view.
  await page.locator('.card').first().click();
  await page.click('#toggle-read');
  await page.click('[data-view="unread"]');
  await expect(page.locator('#empty')).toBeVisible();

  // Archive -> appears in Archive view.
  await page.click('[data-view="all"]');
  await page.locator('.card').first().click();
  await page.click('#toggle-archive');
  await page.click('[data-view="archive"]');
  await expect(page.locator('.card')).toHaveCount(1);

  // Delete (confirm dialog) -> gone.
  page.on('dialog', (d) => d.accept());
  await page.locator('.card').first().click();
  await page.click('#delete-btn');
  await expect(page.locator('#empty')).toBeVisible();
});
