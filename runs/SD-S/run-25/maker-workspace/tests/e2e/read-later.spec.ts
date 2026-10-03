import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import type { BookmarkList, MetadataPreview } from '../../src/shared/contracts.js';

const QUEUED_URL = 'https://example.test/read-later-journey';

async function resetLibrary(request: APIRequestContext): Promise<void> {
  const listResponse = await request.get('/api/bookmarks');
  expect(listResponse.ok()).toBeTruthy();
  const list = (await listResponse.json()) as BookmarkList;
  for (const bookmark of list.items) {
    expect((await request.delete(`/api/bookmarks/${bookmark.id}`)).ok()).toBeTruthy();
  }
}

async function installUnavailableMetadata(page: Page): Promise<void> {
  await page.route('**/api/page-metadata', async (route) => {
    const { url } = route.request().postDataJSON() as { url: string };
    const body: MetadataPreview = {
      requestedUrl: url,
      finalUrl: null,
      outcome: 'unavailable',
      title: null,
      description: null,
      message: 'Page information is unavailable. Enter a title manually.',
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('persists the keyboard-operated Read Later lifecycle without deleting bookmarks', async ({
  page,
  request,
}) => {
  await resetLibrary(request);
  const untrackedResponse = await request.post('/api/bookmarks', {
    data: {
      url: 'https://example.test/reference-only',
      title: 'Reference only',
      readingState: 'untracked',
    },
  });
  expect(untrackedResponse.status()).toBe(201);
  await installUnavailableMetadata(page);
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();

  const tablist = page.getByRole('tablist', { name: /bookmark views/i });
  const libraryTab = tablist.getByRole('tab', { name: 'Library' });
  const readLaterTab = tablist.getByRole('tab', { name: 'Read Later' });
  await expect(libraryTab).toHaveAttribute('aria-selected', 'true');
  await expect(readLaterTab).toHaveAttribute('aria-selected', 'false');

  const addButton = page.getByRole('button', { name: /add bookmark/i });
  await addButton.focus();
  await page.keyboard.press('Enter');
  const address = page.getByRole('textbox', { name: /web address/i });
  await expect(address).toBeFocused();
  await page.keyboard.insertText(QUEUED_URL);
  await expect(
    page.getByRole('status').filter({ hasText: /unavailable|enter a title manually/i }),
  ).toBeVisible();

  const title = page.getByRole('textbox', { name: /^title/i });
  await title.focus();
  await page.keyboard.insertText('Queued from the form');
  const readingStatus = page.getByRole('combobox', { name: /reading status/i });
  await readingStatus.focus();
  await page.keyboard.press('ArrowDown');
  await expect(readingStatus).toHaveValue('to_read');
  const saveButton = page.getByRole('button', { name: /save bookmark/i });
  await saveButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'Queued from the form' })).toBeVisible();

  await libraryTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(readLaterTab).toBeFocused();
  await expect(readLaterTab).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/\?view=read-later(?:&|$)/);
  const readLaterPanel = page.getByRole('tabpanel', { name: 'Read Later' });
  await expect(readLaterPanel.getByRole('link', { name: 'Queued from the form' })).toBeVisible();
  await expect(readLaterPanel).not.toContainText('Reference only');

  const queuedCard = readLaterPanel.getByRole('article', { name: 'Queued from the form' });
  const markRead = queuedCard.getByRole('button', { name: /mark.*read/i });
  await markRead.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /nothing to read later/i })).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: /nothing to read later|marked.*read/i }),
  ).toBeVisible();

  await libraryTab.focus();
  await page.keyboard.press('Enter');
  const libraryCard = page.getByRole('article', { name: 'Queued from the form' });
  await expect(libraryCard).toBeVisible();
  await expect(libraryCard).toContainText(/reading status\s*read/i);
  const requeue = libraryCard.getByRole('button', { name: /mark.*to read/i });
  await requeue.focus();
  await page.keyboard.press('Enter');

  await readLaterTab.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('article', { name: 'Queued from the form' })).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(readLaterTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('article', { name: 'Queued from the form' })).toBeVisible();

  const reloadedCard = page.getByRole('article', { name: 'Queued from the form' });
  await reloadedCard.getByRole('button', { name: /mark.*read/i }).click();
  await expect(page.getByRole('heading', { name: /nothing to read later/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /nothing to read later/i })).toBeVisible();
  await page.getByRole('tab', { name: 'Library' }).click();
  await expect(page.getByRole('article', { name: 'Queued from the form' })).toContainText(
    /reading status\s*read/i,
  );
});
