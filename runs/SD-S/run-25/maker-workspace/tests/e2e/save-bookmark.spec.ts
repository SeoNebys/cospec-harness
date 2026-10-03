import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import type { BookmarkList, MetadataPreview } from '../../src/shared/contracts.js';

const AUTOMATIC_URL = 'https://example.test/automatic-guide';
const MANUAL_URL = 'https://example.test/manual-guide';

async function resetLibrary(request: APIRequestContext): Promise<void> {
  const listResponse = await request.get('/api/bookmarks');
  expect(listResponse.ok()).toBeTruthy();
  const list = (await listResponse.json()) as BookmarkList;

  for (const bookmark of list.items) {
    const deleteResponse = await request.delete(`/api/bookmarks/${bookmark.id}`);
    expect(deleteResponse.ok()).toBeTruthy();
  }
}

async function installMetadataFixture(page: Page): Promise<void> {
  await page.route('**/api/page-metadata', async (route) => {
    const request = route.request();
    const { url } = request.postDataJSON() as { url: string };
    const response: MetadataPreview =
      url === AUTOMATIC_URL
        ? {
            requestedUrl: url,
            finalUrl: url,
            outcome: 'complete',
            title: 'Automatically titled guide',
            description: 'Description supplied by the controlled page fixture.',
          }
        : {
            requestedUrl: url,
            finalUrl: null,
            outcome: 'unavailable',
            title: null,
            description: null,
            message: 'Page information is unavailable. Enter a title manually.',
          };

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
  });

  await page.context().route('https://example.test/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Destination</title><h1>Destination page</h1>',
    });
  });
}

async function openAddFormWithKeyboard(page: Page): Promise<void> {
  const addButton = page.getByRole('button', { name: /add bookmark/i });
  await addButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: /web address/i })).toBeFocused();
}

test('completes the save-and-revisit MVP with keyboard-operable duplicate choices', async ({
  page,
  request,
}) => {
  await resetLibrary(request);
  await installMetadataFixture(page);
  await page.goto('/');

  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: /your library is empty/i })).toBeVisible();

  await openAddFormWithKeyboard(page);
  await page.keyboard.insertText(AUTOMATIC_URL);
  await expect(
    page.getByRole('status').filter({ hasText: /retrieving page information/i }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^title/i })).toHaveValue(
    'Automatically titled guide',
  );
  await expect(page.getByRole('textbox', { name: /description/i })).toHaveValue(
    'Description supplied by the controlled page fixture.',
  );
  const saveButton = page.getByRole('button', { name: /save bookmark/i });
  await saveButton.focus();
  await page.keyboard.press('Enter');

  const automaticLink = page.getByRole('link', { name: 'Automatically titled guide' });
  await expect(automaticLink).toBeVisible();
  await expect(automaticLink).toHaveAttribute('target', '_blank');
  await expect(automaticLink).toHaveAttribute('rel', /noopener/);
  const destinationPromise = page.waitForEvent('popup');
  await automaticLink.click();
  const destination = await destinationPromise;
  await destination.waitForLoadState();
  await expect(destination).toHaveURL(AUTOMATIC_URL);
  await destination.close();

  await page.reload();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Automatically titled guide' })).toBeVisible();

  await openAddFormWithKeyboard(page);
  await page.keyboard.insertText(MANUAL_URL);
  await expect(
    page.getByRole('status').filter({ hasText: /unavailable|enter a title manually/i }),
  ).toBeVisible();
  const manualTitle = page.getByRole('textbox', { name: /^title/i });
  await manualTitle.focus();
  await page.keyboard.insertText('Manual fallback title');
  await saveButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'Manual fallback title' })).toBeVisible();

  await openAddFormWithKeyboard(page);
  await page.keyboard.insertText(AUTOMATIC_URL);
  await expect(page.getByRole('textbox', { name: /^title/i })).toHaveValue(
    'Automatically titled guide',
  );
  await saveButton.focus();
  await page.keyboard.press('Enter');

  const duplicateAlert = page.getByRole('alert');
  await expect(duplicateAlert).toContainText(/already saved/i);
  const openExisting = page.getByRole('link', { name: /open existing bookmark/i });
  await expect(openExisting).toHaveAttribute('href', AUTOMATIC_URL);
  await expect(openExisting).toHaveAttribute('target', '_blank');
  await openExisting.focus();
  const existingDestinationPromise = page.waitForEvent('popup');
  await page.keyboard.press('Enter');
  const existingDestination = await existingDestinationPromise;
  await expect(existingDestination).toHaveURL(AUTOMATIC_URL);
  await existingDestination.close();

  const saveAnyway = page.getByRole('button', { name: /save anyway/i });
  await saveAnyway.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'Automatically titled guide' })).toHaveCount(2);

  await page.reload();
  await expect(page.getByRole('link', { name: 'Automatically titled guide' })).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Manual fallback title' })).toBeVisible();
});
