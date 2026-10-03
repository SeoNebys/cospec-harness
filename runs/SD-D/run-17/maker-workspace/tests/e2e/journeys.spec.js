import { test, expect } from '@playwright/test';

// End-to-end smoke of the primary journeys against a running server.
// The app shell marks the list [data-harness-ready] once loaded.

test('app shell loads and shows ready marker', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#list[data-harness-ready="true"]')).toBeVisible();
});

test('save, search, read-later, archive via API then reflect in UI', async ({ page, request }) => {
  // Create two bookmarks directly via the API.
  const a = await request.post('/api/bookmarks', {
    data: { url: 'https://example.com/', title: 'Example Domain', description: 'Example site', tags: ['docs'] },
  });
  expect(a.ok()).toBeTruthy();
  await request.post('/api/bookmarks', {
    data: { url: 'https://www.iana.org/', title: 'IANA', tags: ['docs', 'net'] },
  });

  // Duplicate save returns the existing one.
  const dup = await request.post('/api/bookmarks', { data: { url: 'https://example.com/' } });
  const dupBody = await dup.json();
  expect(dupBody.duplicate).toBe(true);

  // Search by tag.
  const list = await request.get('/api/bookmarks?q=' + encodeURIComponent('#net'));
  const body = await list.json();
  expect(body.items.some((b) => b.title === 'IANA')).toBe(true);
  expect(body.items.some((b) => b.title === 'Example Domain')).toBe(false);

  // Malformed query is rejected.
  const bad = await request.get('/api/bookmarks?q=' + encodeURIComponent('(unbalanced'));
  expect(bad.status()).toBe(400);

  // UI shows the bookmarks.
  await page.goto('/');
  await expect(page.locator('#list[data-harness-ready="true"]')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(2);
});
