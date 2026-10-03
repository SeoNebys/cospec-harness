import { test, expect } from '@playwright/test';
import { clearAll, seed } from './helper.js';

test.beforeEach(async ({ request }) => { await clearAll(request); });

test('US10: create, revisit and delete a saved search', async ({ page, request }) => {
  await seed(request, 'https://a.com/1', { title: 'Alpha', tags: ['keep'] });
  await seed(request, 'https://a.com/2', { title: 'Beta' });
  await page.goto('/');
  await page.fill('#search', '#keep');
  await expect(page.locator('.bookmark')).toHaveCount(1);
  page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept('Keepers') : d.accept()));
  await page.click('#save-search');

  await page.goto('/#/saved');
  await expect(page.locator('.bookmark .title', { hasText: 'Keepers' })).toBeVisible();
  await page.locator('.bookmark', { hasText: 'Keepers' }).locator('button', { hasText: 'Open' }).click();
  await expect(page.locator('.bookmark .title', { hasText: 'Alpha' })).toBeVisible();
  await expect(page.locator('.bookmark')).toHaveCount(1);
});

test('US12: import a Netscape file then it appears', async ({ page, request }) => {
  await clearAll(request);
  await page.goto('/#/preferences');
  await expect(page.locator('#app[data-harness-ready="true"]')).toBeVisible();
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
    <DT><A HREF="https://imp.com/x" ADD_DATE="1600000000" TAGS="reading">Imported Item</A>
  </DL><p>`;
  await page.setInputFiles('#import-file', { name: 'bookmarks.html', mimeType: 'text/html', buffer: Buffer.from(html) });
  await page.click('#import-btn');
  await expect(page.locator('#import-status')).toContainText('Imported 1');
  await page.goto('/');
  await expect(page.locator('.bookmark .title', { hasText: 'Imported Item' })).toBeVisible();
});

test('US13: preferences persist across reload', async ({ page }) => {
  await page.goto('/#/preferences');
  await page.selectOption('select[name="textSize"]', 'large');
  await page.fill('input[name="itemsPerPage"]', '10');
  await page.click('#prefs-form button[type="submit"]');
  await expect(page.locator('#prefs-error')).toContainText('saved');
  await page.reload();
  await page.goto('/#/preferences');
  await expect(page.locator('select[name="textSize"]')).toHaveValue('large');
  await expect(page.locator('input[name="itemsPerPage"]')).toHaveValue('10');
});
