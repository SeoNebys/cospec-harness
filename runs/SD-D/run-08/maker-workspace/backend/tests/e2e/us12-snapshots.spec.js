import { test, expect } from '@playwright/test';
import { uniqueUrl, createBookmark } from './helpers.js';

test('US12: HTML snapshot is self-contained and renders offline', async ({ page, request }) => {
  const bm = await createBookmark(request, { url: 'https://example.com/', title: 'SnapHtml' });

  // Wait for the background snapshot to complete.
  await expect
    .poll(async () => (await (await request.get(`/api/bookmarks/${bm.id}`)).json()).snapshot.status, {
      timeout: 30000,
    })
    .toBe('ready');

  const snap = (await (await request.get(`/api/bookmarks/${bm.id}`)).json()).snapshot;
  expect(snap.kind).toBe('html');

  // Load the snapshot with all requests to the ORIGINAL site blocked; it must still render.
  await page.route('**://example.com/**', (r) => r.abort());
  await page.route('**://*.example.com/**', (r) => r.abort());
  await page.goto(snap.url);
  await expect(page.locator('body')).toContainText(/example/i);
  // No <script> tags survive in the snapshot.
  expect(await page.locator('script').count()).toBe(0);
});

test('US12: snapshot failure is visibly surfaced and does not block saving', async ({ page, request }) => {
  // An unreachable host: the bookmark still saves, snapshot ends 'failed'.
  const bm = await createBookmark(request, {
    url: `https://nonexistent-${Date.now()}.invalid/page`,
    title: 'WillFailSnap',
  });
  expect(bm.id).toBeTruthy(); // save not blocked

  await expect
    .poll(async () => (await (await request.get(`/api/bookmarks/${bm.id}`)).json()).snapshot.status, {
      timeout: 40000,
    })
    .toBe('failed');

  // The failure is visible in the UI (not silent).
  await page.goto(`/#/bookmark/${bm.id}`);
  await expect(page.getByText('snapshot failed').first()).toBeVisible();
});

test('US12: Internet Archive outcome is surfaced', async ({ page, request }) => {
  const bm = await createBookmark(request, {
    url: `https://nonexistent-${Date.now()}.invalid/x`,
    title: 'ArchiveOutcome',
  });
  await request.post(`/api/bookmarks/${bm.id}/archive-org`);

  // The status resolves to a visible terminal state (ready or failed), never stuck silent.
  await expect
    .poll(async () => (await (await request.get(`/api/bookmarks/${bm.id}`)).json()).archiveOrg.status, {
      timeout: 40000,
    })
    .toMatch(/ready|failed/);
});
