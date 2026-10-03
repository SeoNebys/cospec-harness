import { test, expect } from '@playwright/test';
import { uniqueUrl, createBookmark } from './helpers.js';

test('US4: search operators and malformed query', async ({ page, request }) => {
  const stamp = Date.now();
  const kw = `kw${stamp}`;
  const tagA = `ta${stamp}`;
  const tagB = `tb${stamp}`;
  await createBookmark(request, { url: uniqueUrl(), title: `${kw} one`, tags: [tagA] });
  await createBookmark(request, { url: uniqueUrl(), title: `${kw} two`, tags: [tagB] });
  await createBookmark(request, { url: uniqueUrl(), title: 'unrelated', tags: [tagA] });

  const total = async (q) =>
    (await (await request.get(`/api/bookmarks?q=${encodeURIComponent(q)}`)).json()).total;

  // implicit AND: keyword + #tag
  expect(await total(`${kw} #${tagA}`)).toBe(1);
  // explicit OR
  expect(await total(`${kw} OR #${tagA}`)).toBe(3);
  // case-insensitive operators
  expect(await total(`${kw} and #${tagA}`)).toBe(1);
  // NOT
  expect(await total(`${kw} NOT #${tagB}`)).toBe(1);
  // grouping
  expect(await total(`(#${tagA} OR #${tagB}) AND ${kw}`)).toBe(2);

  // Malformed query surfaces an error in the UI.
  await page.goto(`/#/?q=${encodeURIComponent('(a AND')}`);
  await expect(page.locator('.error')).toBeVisible();
});
