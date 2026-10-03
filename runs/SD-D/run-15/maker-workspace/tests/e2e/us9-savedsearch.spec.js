// T048 [US9]: saved searches combining text with included/excluded tags.
import { test, expect } from '@playwright/test';
import { startApp, startFixtureSite, stop } from './helpers/servers.js';

let app, fixture;
test.beforeAll(async () => { fixture = await startFixtureSite(); app = await startApp(); });
test.afterAll(async () => { await stop(app?.child); await new Promise((r) => fixture?.server.close(r)); });

test('create a saved search (included + excluded tags), run it, delete it', async ({ page, request }) => {
  const mk = async (url, title, tags) => {
    const b = await (await request.post('/api/bookmarks', { data: { url, title } })).json();
    await request.patch(`/api/bookmarks/${b.id}`, { data: { tags } });
  };
  await mk('http://127.0.0.1:4999/a', 'Reading only', ['reading']);
  await mk('http://127.0.0.1:4999/b', 'Reading and work', ['reading', 'work']);
  await mk('http://127.0.0.1:4999/c', 'Work only', ['work']);

  await page.goto('/#/saved');
  await page.fill('input[name="name"]', 'Reading not work');
  await page.fill('input[name="included"]', 'reading');
  await page.fill('input[name="excluded"]', 'work');
  await page.click('#ss-form button[type="submit"]');

  await expect(page.locator('.saved-search-list li')).toHaveCount(1);
  await page.locator('[data-run]').click();
  const titles = await page.locator('#ss-results .bm-title').allTextContents();
  expect(titles).toEqual(['Reading only']);

  page.on('dialog', (d) => d.accept());
  await page.locator('[data-del]').click();
  await expect(page.locator('.saved-search-list')).toContainText('No saved searches yet');
});
