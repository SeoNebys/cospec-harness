import { test, expect } from '@playwright/test';

// End-to-end flows covering US1–US4. The webServer (see playwright.config.js)
// starts the app against a dedicated e2e DB.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app[data-harness-ready="true"]')).toBeVisible();
});

async function addBookmark(page, { url, title, tags }) {
  await page.fill('#url', url);
  if (title !== undefined) await page.fill('#title', title);
  if (tags !== undefined) await page.fill('#tags', tags);
  await page.click('#add-form button[type="submit"]');
}

test('save, search, edit, delete and tag-filter a bookmark', async ({ page }) => {
  const unique = Date.now();
  const titleA = `Playwright Docs ${unique}`;
  const titleB = `Node Guide ${unique}`;

  // US1: save
  await addBookmark(page, { url: 'https://playwright.dev', title: titleA, tags: `e2e-${unique}, docs` });
  await expect(page.locator('#add-message')).toContainText('saved');
  await expect(page.locator('.bookmark__title', { hasText: titleA })).toBeVisible();

  await addBookmark(page, { url: 'https://nodejs.org', title: titleB, tags: `e2e-${unique}` });
  await expect(page.locator('.bookmark__title', { hasText: titleB })).toBeVisible();

  // US2: search
  await page.fill('#search', titleB);
  await expect(page.locator('.bookmark__title', { hasText: titleB })).toBeVisible();
  await expect(page.locator('.bookmark__title', { hasText: titleA })).toHaveCount(0);

  // Non-matching search shows empty state
  await page.fill('#search', 'zzz-no-match-zzz');
  await expect(page.locator('.empty')).toBeVisible();
  await page.fill('#search', '');

  // US4: filter by the shared tag → both visible
  await page.click(`.tag-cloud .tag-chip[data-tag="e2e-${unique}"]`);
  await expect(page.locator('#active-filter')).toBeVisible();
  await expect(page.locator('.bookmark')).toHaveCount(2);
  await page.click('#clear-filter');

  // US3: edit titleA
  const cardA = page.locator('.bookmark', { hasText: titleA });
  await cardA.getByRole('button', { name: 'Edit' }).click();
  const editedTitle = `${titleA} (edited)`;
  await page.fill('#edit-title', editedTitle);
  await page.click('#edit-save');
  await expect(page.locator('.bookmark__title', { hasText: editedTitle })).toBeVisible();

  // US3: delete titleB with confirmation
  page.once('dialog', (d) => d.accept());
  const cardB = page.locator('.bookmark', { hasText: titleB });
  await cardB.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.bookmark__title', { hasText: titleB })).toHaveCount(0);
});
