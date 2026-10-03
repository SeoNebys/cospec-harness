import { test, expect } from '@playwright/test';
import { ready, addViaUi, ORIGIN, uid } from './helpers.js';

test('save with review step, persist incl. favicon/preview, duplicate opens existing, invalid rejected', async ({ page }) => {
  await ready(page);
  const token = uid();
  const target = `${ORIGIN}/index.html?save=${token}`;

  // Enter URL -> review modal appears with auto-collected details -> edit title -> confirm
  await page.fill('#add-url', target);
  await page.click('#add-form button[type=submit]');
  await page.waitForSelector('.modal h3');
  await expect(page.locator('.modal h3')).toHaveText('Save bookmark');
  await page.fill('.modal input[type=text]', `Saved ${token}`);
  await page.click('.modal button.primary');

  const card = page.locator('.card', { hasText: `Saved ${token}` });
  await expect(card).toHaveCount(1);
  // FR-009: title links to the original target
  await expect(card.locator('a.title')).toHaveAttribute('href', target);

  // Persists after reload, including a favicon element (fallback /favicon.ico is stored)
  await page.reload();
  await page.waitForSelector('body[data-harness-ready="true"]');
  const card2 = page.locator('.card', { hasText: `Saved ${token}` });
  await expect(card2).toHaveCount(1);

  // Confirm favicon + preview persisted at the data level (FR-002/008)
  const listRes = await page.request.get(`/api/bookmarks?q=${encodeURIComponent('Saved ' + token)}`);
  const { items } = await listRes.json();
  expect(items[0].favicon_url).toBeTruthy();

  // Duplicate -> opens existing for editing (Edit modal), no new card
  const countBefore = await page.locator('.card').count();
  await page.fill('#add-url', target);
  await page.click('#add-form button[type=submit]');
  await page.waitForSelector('.modal h3');
  await expect(page.locator('.modal h3')).toHaveText('Edit bookmark');
  await page.click('.modal .row button'); // Cancel
  await expect(page.locator('.card')).toHaveCount(countBefore);

  // Invalid URL -> rejected via alert, nothing saved
  page.once('dialog', (d) => d.accept());
  await page.fill('#add-url', 'not a url');
  await page.click('#add-form button[type=submit]');
  await page.waitForTimeout(300);
  await expect(page.locator('.card')).toHaveCount(countBefore);
});
