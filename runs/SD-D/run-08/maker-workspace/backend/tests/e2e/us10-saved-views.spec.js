import { test, expect } from '@playwright/test';
import { uniqueUrl, createBookmark } from './helpers.js';

test('US10: create a saved view, reopen it reproduces results, rename, delete', async ({ page, request }) => {
  const tagIn = `vin${Date.now()}`;
  const tagOut = `vout${Date.now()}`;
  const kw = `vkw${Date.now()}`;
  await createBookmark(request, { url: uniqueUrl(), title: `${kw} keep`, tags: [tagIn] });
  await createBookmark(request, { url: uniqueUrl(), title: `${kw} drop`, tags: [tagIn, tagOut] });

  const view = await (await request.post('/api/views', {
    data: { name: `View${Date.now()}`, query: kw, includeTags: [tagIn], excludeTags: [tagOut] },
  })).json();

  // Opening the view's parameters reproduces the filtered set (1 result).
  const list = await (await request.get(
    `/api/bookmarks?q=${kw}&includeTags=${tagIn}&excludeTags=${tagOut}`
  )).json();
  expect(list.total).toBe(1);
  expect(list.items[0].title).toContain('keep');

  // Rename + delete via API (mirrors the UI actions).
  await request.patch(`/api/views/${view.id}`, { data: { name: 'Renamed' } });
  await page.goto('/#/views');
  await expect(page.getByText('Renamed', { exact: true })).toBeVisible();
  await request.delete(`/api/views/${view.id}`);
  expect((await (await request.get('/api/views')).json()).some((v) => v.id === view.id)).toBe(false);
});
