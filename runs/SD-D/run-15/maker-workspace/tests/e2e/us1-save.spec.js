// T016 [US1]: save with auto page info, edit, duplicate→existing, unreachable, invalid.
import { test, expect } from '@playwright/test';
import { startApp, startFixtureSite, stop } from './helpers/servers.js';

let app, fixture;

test.beforeAll(async () => {
  fixture = await startFixtureSite();
  app = await startApp();
});

test.afterAll(async () => {
  await stop(app?.child);
  await new Promise((r) => fixture?.server.close(r));
});

test('save a page and auto-capture title/description, then edit the title', async ({ page }) => {
  await page.goto('/#/new');
  await page.fill('input[name="url"]', `${fixture.base}/article`);
  await page.click('button[type="submit"]');

  // Lands on the editor for the created bookmark with auto-filled fields.
  await expect(page.locator('input[name="title"]')).toHaveValue('The Fixture Article');
  await expect(page.locator('textarea[name="description"]')).toHaveValue(
    'A predictable fixture description.'
  );

  // Edit the title and confirm it persists after reload.
  await page.fill('input[name="title"]', 'My Edited Title');
  await page.click('button[type="submit"]');
  await expect(page.locator('.saved-note')).toBeVisible();
  await page.reload();
  await expect(page.locator('input[name="title"]')).toHaveValue('My Edited Title');
});

test('saving an already-saved address opens the existing bookmark', async ({ page }) => {
  // The article was saved in the previous test; saving it again should route to edit.
  await page.goto('/#/new');
  await page.fill('input[name="url"]', `${fixture.base}/article`);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/#\/edit\/\d+/);
  await expect(page.locator('input[name="title"]')).toHaveValue('My Edited Title');
});

test('an unreachable page still saves with a derived title', async ({ page }) => {
  await page.goto('/#/new');
  await page.fill('input[name="url"]', 'http://127.0.0.1:4999/some-dead-page');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/#\/edit\/\d+/);
  await expect(page.locator('input[name="title"]')).toHaveValue(/some dead page/i);
});

test('an invalid address is rejected with a clear message', async ({ page }) => {
  await page.goto('/#/new');
  await page.fill('input[name="url"]', 'not a real url');
  await page.click('button[type="submit"]');
  await expect(page.locator('.form-error')).toBeVisible();
  await expect(page).toHaveURL(/#\/new/);
});
