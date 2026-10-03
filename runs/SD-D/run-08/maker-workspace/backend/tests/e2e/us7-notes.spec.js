import { test, expect } from '@playwright/test';
import { uniqueUrl, createBookmark } from './helpers.js';

test('US7: markdown note renders formatted and is sanitized', async ({ page, request }) => {
  const bm = await createBookmark(request, { url: uniqueUrl(), title: 'NoteTest' });
  await page.goto(`/#/bookmark/${bm.id}`);

  await page.getByRole('button', { name: 'Add note' }).click();
  await page.getByLabel('note markdown').fill('# Heading\n\n- item one\n\n<script>window.__x=1</script>');
  await page.getByRole('button', { name: 'Save note' }).click();

  // Renders formatting.
  await expect(page.locator('.note-preview h1')).toHaveText('Heading');
  await expect(page.locator('.note-preview li')).toHaveText('item one');

  // Script is sanitized away (never executes / not present).
  const injected = await page.evaluate(() => window.__x);
  expect(injected).toBeUndefined();
  await expect(page.locator('.note-preview script')).toHaveCount(0);

  // Persists across reload.
  await page.reload();
  await expect(page.locator('.note-preview h1')).toHaveText('Heading');
});
