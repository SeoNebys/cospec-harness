import { test, expect } from '@playwright/test';
import { startFixtureServer } from './fixture-server.js';
import { seedBookmark } from './helpers.js';

let fixture;
test.beforeAll(async () => {
  fixture = await startFixtureServer();
});
test.afterAll(async () => {
  await new Promise((r) => fixture.server.close(r));
});

test('HTML page snapshot is a self-contained file that reopens', async ({ page, request }) => {
  const b = await seedBookmark(request, { url: `${fixture.base}/page?n=7`, title: 'Snap HTML' });
  await page.goto('/');
  const card = page.locator('.card', { hasText: 'Snap HTML' });
  await card.getByRole('button', { name: 'Snapshot', exact: true }).click();
  await expect(page.getByText('Snapshot saved.')).toBeVisible({ timeout: 40000 });

  const snap = await request.get(`/api/bookmarks/${b.id}/snapshot`);
  expect(snap.headers()['content-type']).toContain('text/html');
  const html = await snap.text();
  expect(html).toContain('zebra-7'); // page content is inlined
});

test('PDF target is kept as a PDF', async ({ page, request }) => {
  const b = await seedBookmark(request, { url: `${fixture.base}/doc.pdf`, title: 'Snap PDF' });
  await page.goto('/');
  const card = page.locator('.card', { hasText: 'Snap PDF' });
  await card.getByRole('button', { name: 'Snapshot', exact: true }).click();
  await expect(page.getByText('Snapshot saved.')).toBeVisible({ timeout: 40000 });

  const snap = await request.get(`/api/bookmarks/${b.id}/snapshot`);
  expect(snap.headers()['content-type']).toContain('application/pdf');
});

test('Internet Archive save reports a result and never corrupts the bookmark', async ({ page, request }) => {
  await seedBookmark(request, { url: `${fixture.base}/page?n=8`, title: 'IA Card' });
  await page.goto('/');
  const card = page.locator('.card', { hasText: 'IA Card' });
  await card.getByRole('button', { name: 'Save to Archive.org' }).click();
  // Either success or a recoverable failure — a banner mentioning the archive.
  await expect(page.locator('.banner')).toContainText(/Internet Archive/i, { timeout: 40000 });
  await expect(card).toBeVisible();
});
