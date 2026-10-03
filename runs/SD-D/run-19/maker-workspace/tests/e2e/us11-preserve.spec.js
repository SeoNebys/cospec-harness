import { test, expect } from '@playwright/test';
import { clearAll, seed } from './helper.js';

test.beforeEach(async ({ request }) => { await clearAll(request); });

// The preservation service itself uses Chromium + network; here we verify the
// UI wiring and fail-soft messaging by mocking the endpoint deterministically.
test('US11: preserve action shows a link to the stored copy', async ({ page, request }) => {
  const b = await seed(request, 'https://a.com/preserve-me', { title: 'Preserve Me' });
  await page.route('**/api/bookmarks/*/preserve', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preservedHtmlPath: `data/preserved/${b.id}.html`, status: 'ok' }) }));

  await page.goto('/');
  await page.locator(`.bookmark[data-id="${b.id}"] button`, { hasText: 'Edit' }).click();
  await page.click('#preserve-btn');
  await expect(page.locator('#preserve-status a', { hasText: 'View preserved copy' })).toBeVisible();
});

test('US11: failed preservation reports without affecting the bookmark', async ({ page, request }) => {
  const b = await seed(request, 'https://a.com/fail', { title: 'Fail Preserve' });
  await page.route('**/api/bookmarks/*/preserve', (route) =>
    route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'preserve-failed', message: 'unreachable' }, status: 'failed' }) }));

  await page.goto('/');
  await page.locator(`.bookmark[data-id="${b.id}"] button`, { hasText: 'Edit' }).click();
  await page.click('#preserve-btn');
  await expect(page.locator('#preserve-status')).toContainText('did not complete');
});
