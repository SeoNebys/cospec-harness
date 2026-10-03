// T044 [US8]: bulk actions on a selection and on everything matching a view.
import { test, expect } from '@playwright/test';
import { startApp, startFixtureSite, stop } from './helpers/servers.js';

let app, fixture;
test.beforeAll(async () => { fixture = await startFixtureSite(); app = await startApp(); });
test.afterAll(async () => { await stop(app?.child); await new Promise((r) => fixture?.server.close(r)); });

async function seedN(request, n) {
  for (let i = 0; i < n; i++) {
    await request.post('/api/bookmarks', { data: { url: `http://127.0.0.1:4999/b${i}`, title: `Item ${i}` } });
  }
}

test('bulk add a tag to a selection', async ({ page, request }) => {
  await seedN(request, 3);
  await page.goto('/#/');
  const boxes = page.locator('.row-select');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.fill('.bulk-tag', 'batch');
  await page.locator('[data-bulk="add_tag"]').click();
  // Filter by the new tag → 2 tagged.
  await page.waitForTimeout(200);
  await page.locator('.tag-btn', { hasText: 'batch' }).first().click();
  await expect(page.locator('.bookmark')).toHaveCount(2);
});

test('select everything matching the view and archive it', async ({ page }) => {
  await page.goto('/#/');
  await page.waitForSelector('#app[data-harness-ready="true"]');
  await expect(page.locator('.bookmark').first()).toBeVisible();
  const count = await page.locator('.bookmark').count();
  expect(count).toBeGreaterThan(0);
  await page.locator('.row-select').first().check(); // reveals the bulk bar
  await page.locator('[data-bulk="select-matching"]').click();
  await page.locator('[data-bulk="archive"]').click();
  await page.waitForTimeout(200);
  await expect(page.locator('[data-empty="all"]')).toBeVisible();
  await page.goto('/#/archive');
  await expect(page.locator('.bookmark')).toHaveCount(count);
});

test('bulk delete requires confirmation', async ({ page }) => {
  await page.goto('/#/archive');
  page.on('dialog', (d) => d.accept());
  await page.locator('.row-select').first().check();
  await page.locator('[data-bulk="select-matching"]').click();
  await page.locator('[data-bulk="delete"]').click();
  await page.waitForTimeout(200);
  await expect(page.locator('[data-empty="archive"]')).toBeVisible();
});
