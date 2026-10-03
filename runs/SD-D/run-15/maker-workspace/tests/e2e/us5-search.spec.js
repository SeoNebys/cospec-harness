// T034 [US5]: search — text+#tag, phrase, literal "AND", boolean + parentheses.
import { test, expect } from '@playwright/test';
import { startApp, startFixtureSite, stop } from './helpers/servers.js';

let app, fixture;
test.beforeAll(async () => { fixture = await startFixtureSite(); app = await startApp(); });
test.afterAll(async () => { await stop(app?.child); await new Promise((r) => fixture?.server.close(r)); });

async function seed(request, url, title, tags = []) {
  const b = await (await request.post('/api/bookmarks', { data: { url, title } })).json();
  if (tags.length) await request.patch(`/api/bookmarks/${b.id}`, { data: { tags } });
  return b;
}

test.beforeAll(async () => {
  const { request } = await import('@playwright/test').then((m) => ({ request: m.request }));
  const ctx = await request.newContext({ baseURL: 'http://127.0.0.1:4010' });
  await seed(ctx, 'http://127.0.0.1:4999/py', 'Python guide', ['reading']);
  await seed(ctx, 'http://127.0.0.1:4999/rs', 'Rust book', ['reading', 'work']);
  await seed(ctx, 'http://127.0.0.1:4999/inv', 'Invoice notes', ['work']);
  await seed(ctx, 'http://127.0.0.1:4999/and', 'Logic AND gates', []);
  await ctx.dispose();
});

async function searchTitles(page, q) {
  await page.goto('/#/');
  await page.fill('.search-box', q);
  await page.waitForTimeout(300);
  return page.locator('.bookmark .bm-title').allTextContents();
}

test('text combined with #tag narrows by both', async ({ page }) => {
  const titles = await searchTitles(page, 'invoice #work');
  expect(titles).toEqual(['Invoice notes']);
});

test('quoted operator word "AND" is literal', async ({ page }) => {
  const titles = await searchTitles(page, '"AND"');
  expect(titles).toEqual(['Logic AND gates']);
});

test('boolean OR / NOT with tags', async ({ page }) => {
  const titles = (await searchTitles(page, '#reading NOT #work')).sort();
  expect(titles).toEqual(['Python guide']);
});

test('no matches shows the no-results state', async ({ page }) => {
  await page.goto('/#/');
  await page.fill('.search-box', 'zzz-nothing-matches');
  await page.waitForTimeout(300);
  await expect(page.locator('[data-empty="no-results"]')).toBeVisible();
});
