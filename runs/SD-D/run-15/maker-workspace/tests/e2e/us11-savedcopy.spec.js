// T057 [US11]: saved local copy (HTML + PDF) and Internet Archive (success + failure).
import { test, expect } from '@playwright/test';
import { startApp, startFixtureSite, stop, FIXTURE_BASE } from './helpers/servers.js';

let app, fixture;
test.beforeAll(async () => { fixture = await startFixtureSite(); app = await startApp(); });
test.afterAll(async () => { await stop(app?.child); await new Promise((r) => fixture?.server.close(r)); });

test('save a self-contained HTML copy of a page', async ({ page, request }) => {
  const b = await (await request.post('/api/bookmarks', { data: { url: `${FIXTURE_BASE}/page-with-assets`, title: 'Assets Page' } })).json();
  await page.goto(`/#/edit/${b.id}`);
  await page.locator('[data-copy="snapshot"]').click();
  await expect(page.locator('.copies-status')).toHaveText(/Saved copy created/);
  await expect(page.locator('.copies-list')).toContainText('Local HTML copy');

  // The stored copy is self-contained: CSS inlined, image inlined as data URI.
  const link = await page.locator('.copies-list a').first().getAttribute('href');
  const res = await request.get(link);
  const html = await res.text();
  expect(html).toContain('<style>');
  expect(html).toContain('data:image/png;base64,');
  expect(html).not.toContain('<script');
});

test('store the PDF itself for a PDF link', async ({ page, request }) => {
  const b = await (await request.post('/api/bookmarks', { data: { url: `${FIXTURE_BASE}/doc.pdf`, title: 'A PDF' } })).json();
  await page.goto(`/#/edit/${b.id}`);
  await page.locator('[data-copy="snapshot"]').click();
  await expect(page.locator('.copies-list')).toContainText('Stored PDF');
  const link = await page.locator('.copies-list a').first().getAttribute('href');
  const res = await request.get(link);
  expect(res.headers()['content-type']).toContain('application/pdf');
});

test('Internet Archive success records the archived URL', async ({ page, request }) => {
  const b = await (await request.post('/api/bookmarks', { data: { url: 'http://127.0.0.1:4999/archive-ok', title: 'Archive OK' } })).json();
  await page.goto(`/#/edit/${b.id}`);
  await page.locator('[data-copy="archive"]').click();
  await expect(page.locator('.copies-status')).toHaveText(/Saved copy created/);
  await expect(page.locator('.copies-list')).toContainText('Internet Archive');
});

test('Internet Archive failure is reported honestly, bookmark intact', async ({ page, request }) => {
  const b = await (await request.post('/api/bookmarks', { data: { url: 'http://127.0.0.1:4999/archive-fail', title: 'Archive Fail' } })).json();
  await page.goto(`/#/edit/${b.id}`);
  await page.locator('[data-copy="archive"]').click();
  await expect(page.locator('.copies-status.error')).toBeVisible();
  // Bookmark still exists and has no archive copy.
  const fresh = await (await request.get(`/api/bookmarks/${b.id}`)).json();
  expect(fresh.saved_copies.some((c) => c.kind === 'internet_archive')).toBe(false);
});
