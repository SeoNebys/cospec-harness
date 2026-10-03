// T029 [US4]: formatted note + display, edit all fields, permanent delete.
import { test, expect } from '@playwright/test';
import { startApp, startFixtureSite, stop, FIXTURE_BASE } from './helpers/servers.js';

let app, fixture;
test.beforeAll(async () => { fixture = await startFixtureSite(); app = await startApp(); });
test.afterAll(async () => { await stop(app?.child); await new Promise((r) => fixture?.server.close(r)); });

test('add a formatted note, edit every field, and confirm persistence', async ({ page, request }) => {
  const b = await (await request.post('/api/bookmarks', { data: { url: `${FIXTURE_BASE}/article`, title: 'Orig Title' } })).json();
  await page.goto(`/#/edit/${b.id}`);

  await page.fill('input[name="title"]', 'Edited Title');
  await page.fill('textarea[name="description"]', 'Edited description');
  await page.fill('input[name="url"]', 'http://127.0.0.1:4999/edited');
  await page.fill('.tag-field', 'edited-tag');
  await page.locator('.tag-field').press('Enter');
  await page.fill('textarea[name="note"]', '**bold note** with a [link](https://example.com)');
  await page.click('button[type="submit"]');
  await expect(page.locator('.saved-note')).toBeVisible();

  // The rendered preview shows formatting.
  await expect(page.locator('.note-preview strong')).toHaveText('bold note');
  await expect(page.locator('.note-preview a')).toHaveAttribute('href', 'https://example.com');

  // Reload: every field persisted.
  await page.reload();
  await expect(page.locator('input[name="title"]')).toHaveValue('Edited Title');
  await expect(page.locator('textarea[name="description"]')).toHaveValue('Edited description');
  await expect(page.locator('input[name="url"]')).toHaveValue('http://127.0.0.1:4999/edited');
  await expect(page.locator('.tag-chips')).toContainText('edited-tag');
  await expect(page.locator('textarea[name="note"]')).toHaveValue(/bold note/);
});

test('permanently delete a bookmark via confirmation', async ({ page, request }) => {
  const b = await (await request.post('/api/bookmarks', { data: { url: 'http://127.0.0.1:4999/to-delete', title: 'Delete Me' } })).json();
  page.on('dialog', (d) => d.accept());
  await page.goto(`/#/edit/${b.id}`);
  await page.click('[data-delete]');
  await expect(page).toHaveURL(/#\/$/);
  // Gone after reload.
  const res = await request.get(`/api/bookmarks/${b.id}`);
  expect(res.status()).toBe(404);
});
