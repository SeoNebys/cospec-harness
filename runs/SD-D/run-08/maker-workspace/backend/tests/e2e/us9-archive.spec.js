import { test, expect } from '@playwright/test';
import { uniqueUrl, createBookmark } from './helpers.js';

test('US9: archive excludes from list/search, shows in archive, restores', async ({ request }) => {
  const kw = `arch${Date.now()}`;
  const bm = await createBookmark(request, { url: uniqueUrl(), title: `${kw} item` });

  await request.post(`/api/bookmarks/${bm.id}/archive`);
  // Excluded from active list and search.
  expect((await (await request.get(`/api/bookmarks?q=${kw}`)).json()).total).toBe(0);
  // Present in archive.
  expect((await (await request.get(`/api/bookmarks/archived?q=${kw}`)).json()).total).toBe(1);

  await request.post(`/api/bookmarks/${bm.id}/restore`);
  expect((await (await request.get(`/api/bookmarks?q=${kw}`)).json()).total).toBe(1);
});

test('US9: single delete requires confirmation (cancel keeps it, confirm removes it)', async ({ page, request }) => {
  const bm = await createBookmark(request, { url: uniqueUrl(), title: `DelConfirm${Date.now()}` });
  await page.goto(`/#/bookmark/${bm.id}`);

  // Click delete -> confirmation dialog appears; cancel keeps the bookmark.
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('confirm-ok')).toBeVisible();
  await page.getByTestId('confirm-cancel').click();
  expect((await request.get(`/api/bookmarks/${bm.id}`)).status()).toBe(200);

  // Confirm actually deletes.
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByTestId('confirm-ok').click();
  await expect(page).toHaveURL(/#\/$|#\/$/);
  await expect.poll(async () => (await request.get(`/api/bookmarks/${bm.id}`)).status()).toBe(404);
});
