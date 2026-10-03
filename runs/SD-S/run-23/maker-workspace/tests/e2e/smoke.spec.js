import { test, expect } from '@playwright/test';

// Start each run from a clean slate (the e2e DB file may persist between runs).
test.beforeEach(async ({ request }) => {
  const res = await request.get('/api/bookmarks');
  const { bookmarks } = await res.json();
  for (const b of bookmarks) {
    await request.delete(`/api/bookmarks/${b.id}`);
  }
});

// Submit an add and wait for the POST to complete so the async handler
// (which clears the inputs) settles before the next interaction.
async function addBookmark(page, url, tags) {
  await page.fill('#add-url', url);
  await page.fill('#add-tags', tags ?? '');
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/bookmarks') && r.request().method() === 'POST'
    ),
    page.click('#add-btn'),
  ]);
  // Wait for the input to be cleared, i.e. the handler finished rendering.
  await expect(page.locator('#add-url')).toHaveValue('');
  return res;
}

test('save, browse, tag/filter, edit and delete a bookmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body[data-harness-ready="true"]')).toBeVisible();
  await expect(page.locator('#empty-state')).toBeVisible();

  // Save a bookmark with a tag.
  await addBookmark(page, 'example.com/playwright-smoke', 'work');
  const item = page.locator('.bookmark', { hasText: 'example.com/playwright-smoke' });
  await expect(item).toBeVisible();
  await expect(item.locator('.tag-chip', { hasText: 'work' })).toBeVisible();

  // Duplicate save does not create a second row.
  const dupRes = await addBookmark(page, 'https://example.com/playwright-smoke');
  expect(dupRes.status()).toBe(200);
  await expect(page.locator('.bookmark')).toHaveCount(1);

  // Add a second, differently-tagged bookmark and filter by tag.
  await addBookmark(page, 'example.com/other-page', 'home');
  await expect(page.locator('.bookmark')).toHaveCount(2);

  await page.selectOption('#tag-filter', 'work');
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await page.selectOption('#tag-filter', '');
  await expect(page.locator('.bookmark')).toHaveCount(2);

  // Search narrows results.
  await page.fill('#search', 'other-page');
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await page.fill('#search', '');
  await expect(page.locator('.bookmark')).toHaveCount(2);

  // Edit a bookmark's title.
  const target = page.locator('.bookmark', { hasText: 'other-page' });
  await target.getByRole('button', { name: 'Edit' }).click();
  await page.fill('#edit-title', 'Edited Title');
  await page.click('#edit-save');
  await expect(page.locator('.bookmark', { hasText: 'Edited Title' })).toBeVisible();

  // Delete with confirmation.
  page.on('dialog', (d) => d.accept());
  await page
    .locator('.bookmark', { hasText: 'Edited Title' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.locator('.bookmark')).toHaveCount(1);
});
