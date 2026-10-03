import { test, expect } from '@playwright/test';
import { uniqueUrl, createBookmark } from './helpers.js';

test('US2: saving an existing address routes to the existing bookmark (no duplicate)', async ({ page, request }) => {
  const url = uniqueUrl();
  const created = await createBookmark(request, { url, title: 'Original' });

  // Try to save a trivial variant (trailing slash + uppercase host).
  const variant = url.replace('https://example.com', 'https://EXAMPLE.com') + '/';
  await page.goto('/#/add');
  await page.getByLabel('url').fill(variant);
  await page.getByRole('button', { name: 'Save' }).click();

  // Routed to the existing bookmark, shown as a duplicate.
  await expect(page).toHaveURL(new RegExp(`#/bookmark/${created.id}`));
  await expect(page.getByText('already bookmarked')).toBeVisible();

  // Still only one bookmark for that URL key.
  const list = await (await request.get(`/api/bookmarks?q=${encodeURIComponent(url)}`)).json();
  expect(list.total).toBe(1);
});
