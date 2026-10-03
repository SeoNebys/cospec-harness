import { expect, test } from '@playwright/test';

test('saves and reopens a rich bookmark on desktop and phone', async ({ page }, testInfo) => {
  const uniqueSuffix = `${testInfo.project.name}-${Date.now()}`;
  const uniqueUrl = `https://example.com/article-${uniqueSuffix}`;
  const editedTitle = `My edited title ${uniqueSuffix}`;
  await page.route('**/api/metadata/preview', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        requestedUrl: uniqueUrl,
        finalUrl: uniqueUrl,
        title: { value: 'A title gathered from the page', source: 'open_graph' },
        description: { value: 'A concise description gathered automatically.', source: 'open_graph' },
        favicon: { value: null, source: 'favicon_fallback' },
        previewImage: { value: null, source: 'open_graph' },
        warnings: [
          { field: 'previewImage', code: 'metadata_missing', message: 'No usable preview image was found.' },
        ],
      }),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await page
    .getByRole('button', { name: /Add bookmark/ })
    .first()
    .click();
  const editor = page.getByRole('dialog', { name: 'Save a bookmark' });
  const metadataStartedAt = Date.now();
  await editor.getByLabel('Web address').fill(uniqueUrl);
  const titleInput = editor.getByRole('textbox', { name: /^Title/ });
  await expect(titleInput).toHaveValue('A title gathered from the page');
  const metadataMilliseconds = Date.now() - metadataStartedAt;
  expect(metadataMilliseconds).toBeLessThan(3_000);
  await testInfo.attach('metadata-timing.json', {
    body: JSON.stringify({ project: testInfo.project.name, metadataMilliseconds }),
    contentType: 'application/json',
  });
  await titleInput.fill(editedTitle);
  await editor.getByLabel('Your note').fill('## Why I kept this\n\nA **useful** reference.');
  await editor.getByRole('button', { name: 'Keep this bookmark' }).click();
  let detail = page.getByRole('dialog', { name: editedTitle });
  await expect(detail.getByRole('heading', { name: editedTitle })).toBeVisible();
  await expect(detail.getByText('Why I kept this')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: `View details for ${editedTitle}` }).click();
  detail = page.getByRole('dialog', { name: editedTitle });
  await expect(detail.getByRole('heading', { name: editedTitle })).toBeVisible();
});

test('still saves manually when page details cannot be retrieved', async ({ page }, testInfo) => {
  const journeyStartedAt = Date.now();
  const uniqueUrl = `https://unavailable.example/${testInfo.project.name}-${Date.now()}`;
  await page.route('**/api/metadata/preview', async (route) => {
    await route.fulfill({
      status: 422,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        type: 'https://bookmark.local/problems/remote-timeout',
        title: 'Page details unavailable',
        status: 422,
        detail: 'The destination took too long to respond.',
        code: 'remote_timeout',
      }),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'Library', exact: true }).waitFor();
  await page
    .getByRole('button', { name: /Add bookmark/ })
    .first()
    .click();
  const editor = page.getByRole('dialog', { name: 'Save a bookmark' });
  await editor.getByLabel('Web address').fill(uniqueUrl);
  await expect(editor.getByText('The destination took too long to respond.')).toBeVisible();
  const manualTitle = `Saved without metadata ${testInfo.project.name} ${Date.now()}`;
  await editor.getByRole('textbox', { name: /^Title/ }).fill(manualTitle);
  await editor.getByRole('button', { name: 'Keep this bookmark' }).click();
  const detail = page.getByRole('dialog', { name: manualTitle });
  await expect(detail.getByRole('heading', { name: manualTitle })).toBeVisible();
  const journeyMilliseconds = Date.now() - journeyStartedAt;
  expect(journeyMilliseconds).toBeLessThan(45_000);
  await testInfo.attach('manual-fallback-timing.json', {
    body: JSON.stringify({ project: testInfo.project.name, journeyMilliseconds }),
    contentType: 'application/json',
  });
});
