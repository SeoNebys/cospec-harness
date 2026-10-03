import { test, expect } from '@playwright/test';

// US6 — archiving an unread bookmark and restoring it keeps it unread and
// returns it to the read-later view (FR-016, FR-017).
test('archive then restore preserves unread status', async ({ page }) => {
  const url = `https://e2e.test/status-${Date.now()}`;
  const created = await page.request.post('/api/bookmarks', { data: { url, title: 'Status Test' } });
  const bookmark = await created.json();
  expect(bookmark.isRead).toBe(false);

  // Archive it (still unread).
  await page.request.post(`/api/bookmarks/${bookmark.id}/status`, { data: { isArchived: true } });
  let after = await (await page.request.get(`/api/bookmarks/${bookmark.id}`)).json();
  expect(after.isArchived).toBe(true);
  expect(after.isRead).toBe(false);

  // Not in read-later while archived.
  let rl = await (await page.request.get('/api/bookmarks?view=read_later')).json();
  expect(rl.bookmarks.find((b) => b.id === bookmark.id)).toBeUndefined();

  // Restore — must remain unread and reappear in read-later.
  await page.request.post(`/api/bookmarks/${bookmark.id}/status`, { data: { isArchived: false } });
  after = await (await page.request.get(`/api/bookmarks/${bookmark.id}`)).json();
  expect(after.isArchived).toBe(false);
  expect(after.isRead).toBe(false);

  rl = await (await page.request.get('/api/bookmarks?view=read_later')).json();
  expect(rl.bookmarks.find((b) => b.id === bookmark.id)).toBeTruthy();
});
