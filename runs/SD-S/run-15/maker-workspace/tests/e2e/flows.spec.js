import { test, expect } from '@playwright/test';

// These E2E flows exercise the six quickstart journeys against a running server.
// Each test uses a unique address so runs are independent of existing data.
const uniq = () => `https://e2e-${Date.now()}-${Math.random().toString(36).slice(2)}.example.com/`;

async function addBookmark(page, { address, title = '', tags = '' }) {
  await page.fill('#f-address', address);
  if (title) await page.fill('#f-title', title);
  if (tags) await page.fill('#f-tags', tags);
  await page.click('#save-btn');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-harness-ready', 'true');
});

test('US1/US2: save a bookmark and see it in the list', async ({ page }) => {
  const address = uniq();
  await addBookmark(page, { address, title: 'E2E Saved', tags: 'demo' });
  const item = page.locator('.bookmark', { hasText: 'E2E Saved' });
  await expect(item).toBeVisible();
  await expect(item.locator('.bm-title a')).toHaveAttribute('target', '_blank');
});

test('US1: saving an existing address opens it for editing', async ({ page }) => {
  const address = uniq();
  await addBookmark(page, { address, title: 'Original' });
  await expect(page.locator('.bookmark', { hasText: 'Original' })).toBeVisible();
  await addBookmark(page, { address, title: 'Duplicate attempt' });
  await expect(page.locator('#form-error')).toContainText('already exists');
  await expect(page.locator('#form-heading')).toHaveText('Edit bookmark');
  await expect(page.locator('#f-address')).toHaveValue(address);
});

test('US3: edit a title and delete a bookmark', async ({ page }) => {
  const address = uniq();
  await addBookmark(page, { address, title: 'To Edit' });
  const item = page.locator('.bookmark', { hasText: 'To Edit' });
  await item.getByRole('button', { name: 'Edit' }).click();
  await page.fill('#f-title', 'Edited Title');
  await page.click('#save-btn');
  await expect(page.locator('.bookmark', { hasText: 'Edited Title' })).toBeVisible();

  page.once('dialog', (d) => d.accept());
  await page.locator('.bookmark', { hasText: 'Edited Title' })
    .getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.bookmark', { hasText: 'Edited Title' })).toHaveCount(0);
});

test('US4: read-later view and mark read', async ({ page }) => {
  const address = uniq();
  await addBookmark(page, { address, title: 'Read Later Item' });
  await page.click('.view-tab[data-view="unread"]');
  const item = page.locator('.bookmark', { hasText: 'Read Later Item' });
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: 'Mark read' }).click();
  await expect(page.locator('.bookmark', { hasText: 'Read Later Item' })).toHaveCount(0);
});

test('US5: archive then restore', async ({ page }) => {
  const address = uniq();
  await addBookmark(page, { address, title: 'Archive Item' });
  await page.locator('.bookmark', { hasText: 'Archive Item' })
    .getByRole('button', { name: 'Archive' }).click();
  await expect(page.locator('.bookmark', { hasText: 'Archive Item' })).toHaveCount(0);

  await page.click('.view-tab[data-view="archive"]');
  const archived = page.locator('.bookmark', { hasText: 'Archive Item' });
  await expect(archived).toBeVisible();
  await archived.getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('.bookmark', { hasText: 'Archive Item' })).toHaveCount(0);

  await page.click('.view-tab[data-view="active"]');
  await expect(page.locator('.bookmark', { hasText: 'Archive Item' })).toBeVisible();
});

test('US6: search filters the list', async ({ page }) => {
  const address = uniq();
  const marker = `Zebra${Date.now()}`;
  await addBookmark(page, { address, title: marker });
  await page.fill('#search', marker);
  await expect(page.locator('.bookmark', { hasText: marker })).toBeVisible();
  await page.fill('#search', 'no-such-bookmark-xyz');
  await expect(page.locator('#empty-state')).toBeVisible();
});
