// T024 [US3]: assign tags with existing-tag suggestions; filter by tag.
import { test, expect } from '@playwright/test';
import { startApp, startFixtureSite, stop, FIXTURE_BASE } from './helpers/servers.js';

let app, fixture;
test.beforeAll(async () => { fixture = await startFixtureSite(); app = await startApp(); });
test.afterAll(async () => { await stop(app?.child); await new Promise((r) => fixture?.server.close(r)); });

test('tag with suggestions, then filter the list by a tag', async ({ page, request }) => {
  const a = await (await request.post('/api/bookmarks', { data: { url: `${FIXTURE_BASE}/article`, title: 'Alpha' } })).json();
  const b = await (await request.post('/api/bookmarks', { data: { url: 'http://127.0.0.1:4999/beta', title: 'Beta' } })).json();

  // Tag Alpha with 'work' and 'reading'.
  await page.goto(`/#/edit/${a.id}`);
  for (const t of ['work', 'reading']) {
    await page.locator('.tag-field').fill(t);
    await page.locator('.tag-field').press('Enter');
  }
  await expect(page.locator('.tag-chips')).toContainText('work');
  await expect(page.locator('.tag-chips')).toContainText('reading');
  await page.click('button[type="submit"]');
  await expect(page.locator('.saved-note')).toBeVisible();

  // Beta: typing 'wo' suggests the existing 'work' tag; then tag Beta 'home'.
  await page.goto(`/#/edit/${b.id}`);
  await page.locator('.tag-field').fill('wo');
  await expect(page.locator('.tag-suggestion', { hasText: 'work' })).toBeVisible();
  await page.locator('.tag-field').fill('home');
  await page.locator('.tag-field').press('Enter');
  await page.click('button[type="submit"]');
  await expect(page.locator('.saved-note')).toBeVisible();

  // Filter by 'reading' → only Alpha.
  await page.goto('/#/');
  await page.locator('.tag-btn', { hasText: 'reading' }).first().click();
  await expect(page.locator('.bookmark')).toHaveCount(1);
  await expect(page.locator('.bookmark .bm-title')).toHaveText('Alpha');
});
