import { test, expect } from '@playwright/test';

// US6 end-to-end: export the collection to a file, then import it back and see a
// summary. Requires the app running (Playwright starts it via config).

test('export produces a downloadable file (US6)', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Paste a web address to save…').fill('https://example.com/');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.card')).toHaveCount(1);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export to file' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('bookmarks-export');
});

test('import an export file merges without duplicating (US6)', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Paste a web address to save…').fill('https://example.com/');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.card')).toHaveCount(1);

  // Build an export doc in-page and import it via the hidden file input.
  const doc = {
    format: 'bookmark-manager-export',
    version: 1,
    exportedAt: '2023-01-01T00:00:00.000Z',
    bookmarks: [
      { url: 'example.com', title: 'Dup' },
      { url: 'https://new.example/', title: 'New' },
    ],
    savedSearches: [],
  };
  await page.setInputFiles('input[type=file]', {
    name: 'export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });

  await expect(page.locator('.backup-msg')).toContainText('1 added, 1 already present');
  await expect(page.locator('.card')).toHaveCount(2); // no duplicate for example.com
});

test('importing a junk file shows an error and changes nothing (US6, FR-030)', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Paste a web address to save…').fill('https://keep.example/');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.card')).toHaveCount(1);

  await page.setInputFiles('input[type=file]', {
    name: 'junk.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"nope":true}'),
  });
  await expect(page.locator('.backup-err')).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(1);
});
