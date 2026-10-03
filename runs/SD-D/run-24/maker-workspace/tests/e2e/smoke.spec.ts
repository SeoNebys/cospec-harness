import { test, expect, request } from '@playwright/test';

// End-to-end smoke covering the core journeys against the built app.
test('save, search, read-later, archive, export round-trip', async ({ page, baseURL }) => {
  const api = await request.newContext({ baseURL });

  // Save two bookmarks via the API (metadata/capture are best-effort/offline).
  await api.post('/api/bookmarks', { data: { url: 'https://example.com/alpha', title: 'Alpha Doc', tags: ['work'] } });
  await api.post('/api/bookmarks', { data: { url: 'https://example.com/beta', title: 'Beta Guide', tags: ['home'] } });

  // Duplicate is resolved, not created.
  const dup = await api.post('/api/bookmarks', { data: { url: 'http://www.example.com/alpha/?utm_source=x' } });
  expect((await dup.json()).duplicate).toBe(true);

  // UI loads and marks readiness.
  await page.goto('/');
  await expect(page.locator('html[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByText('Alpha Doc')).toBeVisible();

  // Rich search: quoted operator is literal / tag search.
  const tagged = await api.get('/api/bookmarks?q=%23work');
  expect((await tagged.json()).total).toBe(1);

  // Read-later then archive via bulk API, and confirm views.
  const list = await (await api.get('/api/bookmarks')).json();
  const alpha = list.items.find((b: { title: string }) => b.title === 'Alpha Doc');
  await api.post('/api/bookmarks/bulk', { data: { target: { ids: [alpha.id] }, action: 'markReadLater' } });
  expect((await (await api.get('/api/bookmarks?view=readlater')).json()).total).toBe(1);

  await api.post('/api/bookmarks/bulk', { data: { target: { ids: [alpha.id] }, action: 'archive' } });
  expect((await (await api.get('/api/bookmarks?view=archive')).json()).total).toBe(1);
  expect((await (await api.get('/api/bookmarks?q=Alpha')).json()).total).toBe(0); // archived excluded

  // Export produces Netscape HTML with TAGS.
  const html = await (await api.get('/api/export')).text();
  expect(html).toContain('TAGS="home"');
});
