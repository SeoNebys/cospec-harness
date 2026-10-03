import { test, expect } from '@playwright/test';
import { ready, seed, uid } from './helpers.js';

test('formatted notes are saved and rendered; hostile markup is sanitized', async ({ page }) => {
  const k = uid();
  await ready(page);
  const bm = await seed(page, { title: `${k} Notes`, tags: [`${k}n`] });

  // Apply bold formatting in the notes editor and save
  await page.fill('#search', `#${k}n`);
  await expect(page.locator('.card')).toHaveCount(1);
  await page.locator('.card').getByRole('button', { name: 'Edit' }).click();
  await page.waitForSelector('.notes-editor');
  const editor = page.locator('.notes-editor');
  await editor.click();
  await page.keyboard.type('important');
  await editor.selectText();
  await page.locator('.notes-toolbar button').filter({ hasText: /^B$/ }).click();
  await page.click('.modal button.primary');

  // Reopen: formatting is rendered as markup, not shown as raw text
  await expect(page.locator('.card')).toHaveCount(1);
  await page.locator('.card').getByRole('button', { name: 'Edit' }).click();
  await page.waitForSelector('.notes-editor');
  const html = await page.locator('.notes-editor').innerHTML();
  expect(html.toLowerCase()).toMatch(/<(b|strong)[ >]/);
  await page.click('.modal .row button'); // cancel

  // Sanitization: a script in notes is stripped at the API level
  await page.request.patch(`/api/bookmarks/${bm.id}`, {
    data: { notes_html: '<b>ok</b><script>alert(1)</script>' },
  });
  const res = await page.request.get(`/api/bookmarks/${bm.id}`);
  const data = await res.json();
  expect(data.notes_html).not.toContain('<script');
  expect(data.notes_html).toContain('<b>ok</b>');
});
