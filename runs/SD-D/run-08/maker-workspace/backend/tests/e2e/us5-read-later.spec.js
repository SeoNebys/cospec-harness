import { test, expect } from '@playwright/test';
import { uniqueUrl, createBookmark } from './helpers.js';

test('US5: new bookmark is not unread; can be marked read later and toggled', async ({ request }) => {
  const bm = await createBookmark(request, { url: uniqueUrl(), title: 'ReadLater' });
  expect(bm.isUnread).toBe(false); // not auto-unread (FR-023)

  // Mark read later.
  let res = await request.post(`/api/bookmarks/${bm.id}/read-state`, { data: { unread: true } });
  expect((await res.json()).isUnread).toBe(true);

  // Appears in the unread view.
  const unread = await (await request.get('/api/bookmarks?unread=true')).json();
  expect(unread.items.some((b) => b.id === bm.id)).toBe(true);

  // Mark read again -> leaves unread view.
  res = await request.post(`/api/bookmarks/${bm.id}/read-state`, { data: { unread: false } });
  expect((await res.json()).isUnread).toBe(false);
  const unread2 = await (await request.get('/api/bookmarks?unread=true')).json();
  expect(unread2.items.some((b) => b.id === bm.id)).toBe(false);
});

test('US5: unread view UI shows a marked item', async ({ page, request }) => {
  const bm = await createBookmark(request, { url: uniqueUrl(), title: `UnreadUI${Date.now()}` });
  await request.post(`/api/bookmarks/${bm.id}/read-state`, { data: { unread: true } });
  await page.goto('/#/unread');
  await expect(page.getByText(bm.title)).toBeVisible();
});
