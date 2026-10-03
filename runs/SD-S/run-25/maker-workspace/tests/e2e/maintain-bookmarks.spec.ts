import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import type { Bookmark, BookmarkList, MetadataPreview } from '../../src/shared/contracts.js';

async function resetLibrary(request: APIRequestContext) {
  const response = await request.get('/api/bookmarks');
  const list = (await response.json()) as BookmarkList;
  for (const bookmark of list.items) {
    expect((await request.delete(`/api/bookmarks/${bookmark.id}`)).ok()).toBeTruthy();
  }
}

async function installMetadata(page: Page) {
  await page.route('**/api/page-metadata', async (route) => {
    const { url } = route.request().postDataJSON() as { url: string };
    const body: MetadataPreview = {
      requestedUrl: url,
      finalUrl: null,
      outcome: 'unavailable',
      title: null,
      description: null,
      message: 'Page information is unavailable. Existing details remain editable.',
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('edits and deletes a bookmark without losing criteria or other views', async ({ page, request }) => {
  await resetLibrary(request);
  const create = await request.post('/api/bookmarks', {
    data: {
      url: 'https://example.test/original',
      title: 'Keep article',
      description: 'Original notes',
      tags: ['Research'],
      readingState: 'to_read',
    },
  });
  expect(create.status()).toBe(201);
  const created = (await create.json()) as Bookmark;
  await installMetadata(page);
  await page.goto('/?query=keep&tag=research&sort=title');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();

  const card = page.getByRole('article', { name: 'Keep article' });
  await card.getByRole('button', { name: /edit/i }).click();
  const address = page.getByRole('textbox', { name: /web address/i });
  const title = page.getByRole('textbox', { name: /^title/i });
  const description = page.getByRole('textbox', { name: /description/i });
  const tags = page.getByRole('textbox', { name: /^tags/i });
  await expect(address).toHaveValue('https://example.test/original');
  await expect(title).toHaveValue('Keep article');
  await expect(description).toHaveValue('Original notes');
  await expect(tags).toHaveValue('Research');

  await address.fill('https://example.test/manual-edit');
  await expect(page.getByText(/unavailable.*editable/i)).toBeVisible();
  await expect(title).toHaveValue('Keep article');
  await title.fill('Keep article revised');
  await description.fill('Revised notes');
  await tags.fill('Research, Updated');
  await page.getByRole('combobox', { name: /reading status/i }).selectOption('read');
  await page.getByRole('button', { name: /save changes/i }).click();

  await expect(page.getByRole('link', { name: 'Keep article revised' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: /search bookmarks/i })).toHaveValue('keep');
  await expect(page.getByRole('checkbox', { name: /research/i })).toBeChecked();
  await expect(page.getByRole('combobox', { name: /sort bookmarks/i })).toHaveValue('title');
  await expect(page).toHaveURL(/query=keep/);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Keep article revised' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Keep article revised' })).toContainText(
    /reading status\s*read/i,
  );

  const revisedCard = page.getByRole('article', { name: 'Keep article revised' });
  const deleteTrigger = revisedCard.getByRole('button', { name: /delete/i });
  await deleteTrigger.focus();
  await page.keyboard.press('Enter');
  const confirmation = revisedCard.getByRole('group', { name: /delete keep article revised/i });
  const cancel = confirmation.getByRole('button', { name: 'Cancel' });
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(deleteTrigger).toBeFocused();
  await expect(revisedCard).toBeVisible();

  await page.keyboard.press('Enter');
  const confirmDelete = revisedCard.getByRole('button', { name: /^delete$/i });
  await confirmDelete.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'Keep article revised' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /research/i })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Library' })).toBeFocused();

  const list = (await (await request.get('/api/bookmarks')).json()) as BookmarkList;
  expect(list.items.some(({ id }) => id === created.id)).toBe(false);
  await page.getByRole('tab', { name: 'Read Later' }).click();
  await expect(page.getByRole('link', { name: 'Keep article revised' })).toHaveCount(0);
  await page.getByRole('button', { name: /clear search and filters/i }).click();
  await expect(page.getByRole('heading', { name: /nothing to read later/i })).toBeVisible();
  await page.getByRole('tab', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: /your library is empty/i })).toBeVisible();
});
